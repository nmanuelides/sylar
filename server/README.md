# Sylar build server

Compiles exported Zepp OS watchface projects into installable `.zab` packages and
serves them so the studio can show an **"Install on watch"** QR code — end users never
touch Node or a terminal; only whoever hosts this server does.

## Setup (once, on the server machine)

```bash
npm install -g @zeppos/zeus-cli @babel/core
cd server
npm install
npm start           # listens on :8787
```

No Zepp account is needed — anonymous preview uploads work. If Zepp ever starts
returning 401 on uploads, run `zeus login` once on this machine.

The QR flow runs `zeus preview`, which uploads the compiled package to **Zepp's own
cloud** and returns their download URL — the only QR format the Zepp app scanner
recognizes. It also means phones don't need network access to this server at all.

Point the studio at it via `.env`:

```env
VITE_BUILD_SERVER_URL=http://YOUR_SERVER:8787
```

> For phones to install from the QR, the server URL must be reachable from the phone —
> use your LAN IP during development (e.g. `http://192.168.1.20:8787`) or deploy to any
> Node host (Fly.io / Railway / Cloud Run) with `PUBLIC_URL` set to its public URL.

## Env vars

| Var          | Default            | Purpose                                    |
| ------------ | ------------------ | ------------------------------------------ |
| `PORT`       | `8787`             | Listen port                                |
| `ZEUS_CMD`   | `zeus`             | zeus CLI command (absolute path if needed) |
| `PUBLIC_URL` | request host       | Base URL embedded in download links / QRs  |

## API

- `POST /api/build?mode=qr` — body: exported project zip → `{ url, cloud: true }` (Zepp-cloud QR URL)
- `POST /api/build?mode=file` — same body → `{ url, size }` (locally hosted `.zab`)
- `GET /dl/<id>.zab` — compiled packages from `mode=file` (kept ~1 hour)
- `GET /api/health` — liveness probe
