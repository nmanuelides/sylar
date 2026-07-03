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
 * Runs `zeus preview`: builds, uploads the package to Zepp's cloud (needs a
 * one-time `zeus login` on this machine) and resolves with the QR URL that the
 * Zepp app scanner actually recognizes.
 */
function runZeusPreview(cwd, deviceName) {
  return new Promise((resolve, reject) => {
    // forward slashes: NODE_OPTIONS mangles quoted backslash paths on Windows
    const shim = path.join(__dirname, 'qr-shim.js').replace(/\\/g, '/');
    // -t skips the interactive device picker; quotes survive shell:true arg joining
    const args = deviceName ? ['preview', '-t', `"${deviceName}"`] : ['preview'];
    const child = execFile(
      ZEUS_CMD,
      args,
      {
        cwd,
        shell: true,
        timeout: 8 * 60 * 1000,
        windowsHide: true,
        env: { ...process.env, NODE_OPTIONS: `--require ${shim}` },
      },
      (err, stdout, stderr) => {
        const out = `${stdout}\n${stderr}`;
        const match = out.match(/SYLAR_QR_URL::(\S+)/);
        if (match) return resolve(match[1]);
        const hint = /login/i.test(out)
          ? ' — run `zeus login` once on the build server machine.'
          : '';
        reject(new Error(`zeus preview produced no QR URL${hint}\n${out.slice(-2000)}`));
      },
    );
    // zeus may wait on interactive prompts in edge cases; never let it hang on stdin
    child.stdin?.end();
  });
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.post('/api/build', async (req, res) => {
  cleanupOld();
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).json({ error: 'Send the exported project zip as application/zip' });
  }
  // mode=qr (default): zeus preview → Zepp-cloud QR URL the Zepp app recognizes.
  // mode=file: zeus build → locally hosted .zab download.
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
    if (mode === 'qr') {
      const url = await runZeusPreview(projectDir, req.query.device);
      console.log(`[${id}] done → ${url}`);
      return res.json({ url, cloud: true });
    }
    const zabPath = await runZeus(projectDir);
    const artifactName = `${id}.zab`;
    fs.copyFileSync(zabPath, path.join(ARTIFACTS, artifactName));
    const base = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
    const url = `${base.replace(/\/$/, '')}/dl/${artifactName}`;
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
