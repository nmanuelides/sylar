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
function extractZpk(zabPath) {
  const bundle = unzipSync(new Uint8Array(fs.readFileSync(zabPath)));
  const manifest = JSON.parse(Buffer.from(bundle['manifest.json']).toString('utf8'));
  const entry = manifest.zpks && manifest.zpks[0];
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
    const zabPath = await runZeus(projectDir);
    const base = (process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`)
      .replace(/\/$/, '');
    if (mode === 'qr') {
      const zpk = extractZpk(zabPath);
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
