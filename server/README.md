# Sylar build server

Compiles exported Zepp OS watchface projects into installable `.zab` packages and
serves them so the studio can show an **"Install on watch"** QR code — end users never
touch Node or a terminal; only whoever hosts this server does.

## Setup (once, on the server machine)

```bash
npm install -g @zeppos/zeus-cli @babel/core
cd server
npm install
npm start          # listens on :8787
```

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

- `POST /api/build` — body: exported project zip (`application/zip`) → `{ url, size }`
- `GET /dl/<id>.zab` — the compiled package (artifacts kept ~1 hour)
- `GET /api/health` — liveness probe
