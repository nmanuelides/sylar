# Sylar — Watchface Studio

Design your own **Amazfit** watchfaces in the browser with a drag & drop editor:
complications, watch hands, digital time, text, icons, progress bars, tick marks and your
own uploaded assets — freely placed, layered, rotated and styled on a per-device canvas,
with a dedicated **Always-On Display** variant for every design.

![Stack](https://img.shields.io/badge/React_18-TypeScript-blue) ![Style](https://img.shields.io/badge/Sass-blueprint_UI-064F8C) ![DB](https://img.shields.io/badge/Supabase-optional-3ECF8E)

## Features

- **Device-aware canvas** — Amazfit Balance, GTR 4, Active 2, T-Rex 3, Cheetah Pro, GTS 4, Bip 5; round & rectangular screens at native resolutions.
- **Component library** — complications (heart rate, steps, battery, calories, weather, date, distance), hour/minute/second hands in 3 styles, digital time, data numbers, text labels, icons, linear & circular progress bars, hour/minute tick marks and numerals.
- **Full manipulation** — drag, resize, rotate (Shift = 15° steps), opacity, colors, per-type options; multi-select, alignment tools, lock & hide.
- **Typography** — ~55 Google Fonts (tech/display, sans, mono, serif & script) loaded on demand, per-family weight options, and explicit text-size controls on every text-bearing element.
- **Font Awesome icons** — 46 curated icons in the library plus a searchable picker over the full free-solid catalog (~1,400 icons, lazy-loaded); complication glyphs use FA too.
- **Layers panel** — animated drag-to-reorder z-index, exactly like a design tool.
- **Grid & snapping** — configurable grid size, snap toggle, rulers, center guides, Ctrl+scroll zoom, fit-to-view.
- **AOD mode** — a switch flips the canvas to the Always-On Display variant with its own element tree and background, plus one-click copy from the main face.
- **Custom assets** — upload PNG/JPG/SVG and place them anywhere.
- **Live preview** — real ticking time and simulated health data, in-editor and in a device-bezel preview modal.
- **Undo/redo** (60 steps), keyboard shortcuts, autosaving thumbnails.
- **Save & sync** — Supabase when configured, otherwise localStorage. Export as JSON project + PNG renders.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:5173.

## Supabase setup (optional)

The app is fully functional without Supabase (projects live in localStorage).
To enable cloud persistence:

1. Create a project at [supabase.com](https://supabase.com).
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor.
3. Copy `.env.example` to `.env` and fill in:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

4. Restart the dev server.

> The demo RLS policies are open; tighten them (see comments in the schema) once auth is added.

## Scripts

| Command             | Purpose                          |
| ------------------- | -------------------------------- |
| `npm run dev`       | Vite dev server with HMR         |
| `npm run build`     | Type-check + production build    |
| `npm run preview`   | Serve the production build       |
| `npm run typecheck` | TypeScript only                  |

## Project structure

```
src/
├── components/
│   ├── common/          # Reusable UI: buttons, modal, switch, fields, toasts
│   ├── layout/          # Top navigation bar
│   └── watchface/       # SVG rendering engine (shared by editor, preview, export)
├── data/                # Devices, fonts, icon paths, component library
├── lib/                 # Geometry, time/data formatting, drag tracking, supabase client
├── pages/
│   ├── editor/          # The studio: canvas, panels, modals, shortcuts
│   ├── watchfaces/      # Saved designs gallery
│   ├── community/       # Coming soon
│   └── docs/            # User guide & shortcuts
├── services/            # Persistence (Supabase ⇄ localStorage fallback)
├── store/               # Zustand stores: editor, live data, toasts
├── styles/              # Sass tokens + globals
└── types/               # Shared TypeScript models
```

## Install on a real watch

Export → **Zepp OS project (.zip)** produces a ready-to-build watchface source project:
static content is baked pixel-perfect into device-resolution images, hands become
`TIME_POINTER` widgets, and live text/rings are driven by defensive sensor code.
Unzip it, then `npm i -g @zeppos/zeus-cli`, `zeus login`, and `zeus preview` — scan the
QR with the Zepp app in developer mode. See the README inside the export for details.

## Roadmap

- Cloud builds — one-click "Install on watch" QR without Node/CLI
- Supabase auth + per-user libraries
- Community gallery (publish, browse, remix)
- Import `.sylar.json` projects
- More devices & component templates

## License

GPL-3.0 — see [LICENSE](LICENSE).
