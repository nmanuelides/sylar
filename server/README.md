# Sylar build server

Compiles exported Zepp OS watchface projects and serves the resulting `.zpk`
packages so the studio can show an **"Install on watch"** QR code. End users never
touch Node or a terminal — they design, click Install, and scan.

## How installs work

The Zepp app's Developer Mode scanner accepts QR codes of the form
`zpkd1://<host>/<path>` and downloads the `.zpk` over standard **HTTPS** from any
host (this is the same mechanism community sites like AmazFaces use). No Zepp
account, cloud upload, or developer login is involved — but the URL **must** be
HTTPS on the default port and reachable from the phone.

## Setup (once, on the server machine)

```bash
npm install -g @zeppos/zeus-cli @babel/core
cd server
npm install
npm start           # listens on :8787
```

Point the studio at it via `.env`:

```env
VITE_BUILD_SERVER_URL=http://YOUR_SERVER:8787
```

### Making it phone-reachable

- **Production**: deploy anywhere with HTTPS (Fly.io / Railway / Cloud Run) and set
  `PUBLIC_URL=https://your-host` — install QRs will use that host.
- **Local development**: use a quick tunnel and restart with `PUBLIC_URL` set:

  ```bash
  cloudflared tunnel --url http://localhost:8787
  # prints e.g. https://random-words.trycloudflare.com
  PUBLIC_URL=https://random-words.trycloudflare.com npm start
  ```

## Env vars

| Var          | Default            | Purpose                                          |
| ------------ | ------------------ | ------------------------------------------------ |
| `PORT`       | `8787`             | Listen port                                      |
| `ZEUS_CMD`   | `zeus`             | zeus CLI command (absolute path if needed)       |
| `PUBLIC_URL` | request host       | HTTPS base phones use to download packages (QRs) |

## API

- `POST /api/build?mode=qr` — body: exported project zip (`application/zip`) → `{ url, size }` with a `zpkd1://` install URL
- `POST /api/build?mode=file` — same body → `{ url, size }` (hosted `.zab` bundle)
- `GET /dl/<id>.zpk|.zab` — compiled packages (kept ~1 hour)
- `GET /api/health` — liveness probe

## Troubleshooting

- **"Cannot find module '@babel/core'"** during build: `npm install -g @babel/core`.
- zeus must be installed globally (`-g`) — a local install breaks its module aliasing.
- Install QR shows then phone says "Download failed: null" → `PUBLIC_URL` isn't
  HTTPS-reachable from the phone (plain http / custom ports are rejected by the app).
