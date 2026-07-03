/**
 * Sylar build server — turns exported Zepp OS project zips into installable
 * .zab packages using the official zeus CLI, and serves them for the Zepp
 * app's developer-mode QR installer.
 *
 * Requirements on this machine (one-time):
 *   npm install -g @zeppos/zeus-cli @babel/core
 *
 * Env:
 *   PORT        (default 8787)
 *   ZEUS_CMD    (default "zeus"; e.g. absolute path to zeus.cmd on Windows)
 *   PUBLIC_URL  (optional; base URL phones can reach — defaults to the request host)
 */
const express = require('express');
const { unzipSync } = require('fflate');
const { execFile } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = process.env.PORT || 8787;
const ZEUS_CMD = process.env.ZEUS_CMD || 'zeus';
const ROOT = path.join(os.tmpdir(), 'sylar-builds');
const ARTIFACTS = path.join(ROOT, 'artifacts');
fs.mkdirSync(ARTIFACTS, { recursive: true });

const app = express();

// The studio runs on a different origin (vite dev server / static host)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.raw({ type: 'application/zip', limit: '100mb' }));

function cleanupOld() {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const dir of [ARTIFACTS, ROOT]) {
    for (const entry of fs.readdirSync(dir)) {
      const p = path.join(dir, entry);
      try {
        if (fs.statSync(p).mtimeMs < cutoff && p !== ARTIFACTS) {
          fs.rmSync(p, { recursive: true, force: true });
        }
      } catch {
        /* ignore */
      }
    }
  }
}

// Google serves plain TrueType only to very old browsers — modern UAs get
// woff/woff2, which Zepp OS's font renderer doesn't understand.
const OLD_UA = 'Mozilla/5.0 (Linux; U; Android 2.2)';

async function fetchGoogleFontTtf(family, weight) {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`,
    { headers: { 'User-Agent': OLD_UA } },
  ).then((r) => {
    if (!r.ok) throw new Error(`fonts.googleapis.com ${r.status}`);
    return r.text();
  });
  const match = css.match(/url\(([^)]+)\)\s*format\('truetype'\)/);
  if (!match) throw new Error(`no truetype src for ${family} ${weight}`);
  const buf = await fetch(match[1]).then((r) => {
    if (!r.ok) throw new Error(`fonts.gstatic.com ${r.status}`);
    return r.arrayBuffer();
  });
  return Buffer.from(buf);
}

/**
 * Downloads every font listed in the project's google-fonts.json (written by
 * the Sylar exporter) into place. Fonts that fail to fetch (offline build
 * server, family typo, etc.) are stripped from watchface/index.js's SPEC so
 * the widget falls back to the system font instead of referencing a missing
 * file — better a wrong font than a build the watch refuses to install.
 */
async function resolveGoogleFonts(projectDir) {
  const manifestPath = path.join(projectDir, 'google-fonts.json');
  if (!fs.existsSync(manifestPath)) return;
  const needs = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const failedPaths = [];
  for (const need of needs) {
    try {
      const ttf = await fetchGoogleFontTtf(need.family, need.weight);
      const dest = path.join(projectDir, need.path);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, ttf);
      console.log(`  font ok: ${need.family} ${need.weight} -> ${need.path}`);
    } catch (err) {
      console.warn(`  font FAILED: ${need.family} ${need.weight}: ${err.message}`);
      // path as it appears inside the generated index.js (relative to assets dir)
      failedPaths.push(need.path.replace(/^assets\/[^/]+\//, ''));
    }
  }
  if (failedPaths.length === 0) return;
  const indexPath = path.join(projectDir, 'watchface', 'index.js');
  const src = fs.readFileSync(indexPath, 'utf8');
  const marker = 'const SPEC = ';
  const start = src.indexOf(marker);
  if (start === -1) return;
  const jsonStart = start + marker.length;
  // brace-counting, not a regex, so deeply nested JSON isn't truncated at the first '}'
  let depth = 0;
  let end = -1;
  for (let i = jsonStart; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end === -1) return;
  try {
    const spec = JSON.parse(src.slice(jsonStart, end));
    for (const t of spec.texts || []) {
      if (failedPaths.includes(t.font)) delete t.font;
    }
    const patched = src.slice(0, jsonStart) + JSON.stringify(spec, null, 2) + src.slice(end);
    fs.writeFileSync(indexPath, patched);
  } catch (err) {
    console.warn(`  could not patch missing fonts out of index.js: ${err.message}`);
  }
}

function runZeus(cwd) {
  return new Promise((resolve, reject) => {
    execFile(
      ZEUS_CMD,
      ['build'],
      { cwd, shell: true, timeout: 5 * 60 * 1000, windowsHide: true },
      (err, stdout, stderr) => {
        const out = `${stdout}\n${stderr}`;
        // zeus sometimes exits non-zero after a successful build (post-build notice),
        // so trust the presence of a .zab over the exit code.
        const distDir = path.join(cwd, 'dist');
        const zab =
          fs.existsSync(distDir) && fs.readdirSync(distDir).find((f) => f.endsWith('.zab'));
        if (zab) return resolve(path.join(distDir, zab));
        reject(new Error(`zeus build produced no .zab.\n${out.slice(-2000)}`));
      },
    );
  });
}

/**
 * Extracts the device .zpk from a built .zab bundle. The Zepp app's
 * developer-mode scanner installs zpkd1://<host>/<path> QR links by
 * downloading the .zpk over plain HTTPS — no Zepp cloud, no account.
 */
function extractZpk(zabPath, resolution) {
  const bundle = unzipSync(new Uint8Array(fs.readFileSync(zabPath)));
  const manifest = JSON.parse(Buffer.from(bundle['manifest.json']).toString('utf8'));
  const zpks = manifest.zpks || [];
  let entry = zpks[0];
  if (resolution) {
    const match = zpks.find((z) =>
      (z.platforms || []).some((p) => p.screenResolution === resolution),
    );
    if (match) entry = match;
    else if (zpks.length > 1) {
      console.warn(`no zpk matches ${resolution}; falling back to ${entry && entry.name}`);
    }
  }
  if (!entry || !bundle[entry.name]) {
    throw new Error('.zab bundle contains no .zpk package');
  }
  return Buffer.from(bundle[entry.name]);
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.post('/api/build', async (req, res) => {
  cleanupOld();
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).json({ error: 'Send the exported project zip as application/zip' });
  }
  // mode=qr (default): build → serve the device .zpk → zpkd1:// install QR.
  // mode=file: build → locally hosted .zab download.
  const mode = req.query.mode === 'file' ? 'file' : 'qr';
  const id = crypto.randomBytes(8).toString('hex');
  const projectDir = path.join(ROOT, id);
  try {
    const entries = unzipSync(new Uint8Array(req.body));
    for (const [name, data] of Object.entries(entries)) {
      if (name.includes('..')) continue;
      const target = path.join(projectDir, name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      if (!name.endsWith('/')) fs.writeFileSync(target, data);
    }
    console.log(`[${id}] ${mode} build…`);
    await resolveGoogleFonts(projectDir);
    const zabPath = await runZeus(projectDir);
    const base = (process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`)
      .replace(/\/$/, '');
    if (mode === 'qr') {
      const zpk = extractZpk(zabPath, req.query.res);
      const artifactName = `${id}.zpk`;
      fs.writeFileSync(path.join(ARTIFACTS, artifactName), zpk);
      // the Zepp app fetches zpkd1:// links over standard HTTPS —
      // PUBLIC_URL must therefore be an https host reachable from phones
      const url = `zpkd1://${base.replace(/^https?:\/\//, '')}/dl/${artifactName}`;
      console.log(`[${id}] done → ${url}`);
      return res.json({ url, size: zpk.length });
    }
    const artifactName = `${id}.zab`;
    fs.copyFileSync(zabPath, path.join(ARTIFACTS, artifactName));
    const url = `${base}/dl/${artifactName}`;
    console.log(`[${id}] done → ${url}`);
    res.json({ url, size: fs.statSync(zabPath).size });
  } catch (err) {
    console.error(`[${id}] failed:`, err.message);
    res.status(500).json({ error: err.message });
  } finally {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});

app.get('/dl/:file', (req, res) => {
  const file = path.basename(req.params.file);
  const p = path.join(ARTIFACTS, file);
  if (!fs.existsSync(p)) return res.status(404).send('expired');
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${file}"`);
  fs.createReadStream(p).pipe(res);
});

app.listen(PORT, () => {
  console.log(`Sylar build server on http://0.0.0.0:${PORT} (zeus: ${ZEUS_CMD})`);
});
