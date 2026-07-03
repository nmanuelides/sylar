import { zipSync, strToU8 } from 'fflate';
import type {
  ComplicationElement,
  DataSource,
  HandKind,
  WatchElement,
  WatchfaceProject,
} from '@/types/watchface';
import { getDevice } from '@/data/devices';
import { WEATHER_CONDITIONS } from '@/data/icons';
import { PREVIEW_DATA } from '@/store/liveDataStore';
import { pivotOffset } from '@/lib/geometry';
import { slugify } from '@/lib/download';
import { WatchfaceSVG } from '@/components/watchface/WatchfaceSVG';
import { ElementRenderer, FONT_HEIGHT_RATIO } from '@/components/watchface/renderers';
import { dataUrlToBytes, renderNodeToPng } from './rasterize';
import { RUNTIME_TEMPLATE } from './runtime';

export interface ZeppExportResult {
  zip: Uint8Array;
  filename: string;
  warnings: string[];
}

type FileMap = Record<string, Uint8Array>;

interface TextSpec {
  kind: 'time' | 'source';
  x: number;
  y: number;
  w: number;
  h: number;
  size: number;
  color: number;
  font?: string;
  aod: boolean;
  // time kind
  twelve?: boolean;
  seconds?: boolean;
  ampm?: boolean;
  // source kind
  source?: DataSource;
  showUnit?: boolean;
}

/** '#rrggbb' / '#rgb' / 'rgb(a)(...)' → 0xRRGGBB (alpha dropped) */
function cssToZeppColor(css: string): number {
  const hex = css.trim();
  if (hex.startsWith('#')) {
    const h = hex.slice(1);
    if (h.length === 3) {
      return parseInt(h.split('').map((c) => c + c).join(''), 16);
    }
    return parseInt(h.slice(0, 6), 16);
  }
  const m = hex.match(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  if (m) return (parseInt(m[1]) << 16) | (parseInt(m[2]) << 8) | parseInt(m[3]);
  return 0xffffff;
}

const isHandLike = (el: WatchElement): boolean =>
  el.type === 'hand' || (el.type === 'image' && !!el.rotateWith);

const isLiveText = (el: WatchElement): boolean =>
  el.type === 'digitalTime' || el.type === 'number';

const isLiveWeather = (el: WatchElement): boolean =>
  el.type === 'weatherIcon' && el.condition === 'live';

/** Elements baked into the static background (chrome of dynamic ones included via staticOnly) */
const isBaked = (el: WatchElement): boolean =>
  !isHandLike(el) && !isLiveText(el) && !isLiveWeather(el);

function complicationSource(kind: ComplicationElement['kind']): DataSource {
  return kind === 'weather' ? 'weather' : (kind as DataSource);
}

export async function generateZeppProject(
  project: WatchfaceProject,
  onProgress: (step: string) => void,
): Promise<ZeppExportResult> {
  const warnings: string[] = [];
  const device = getDevice(project.deviceId);
  const st = device.shape === 'round' ? 'r' : 's';
  const targetKey = device.id;
  const assetsDir = `assets/${targetKey}.${st}`;
  const files: FileMap = {};

  const customFontPath = (family: string): string | undefined => {
    const font = (project.fonts ?? []).find((f) => f.family === family);
    return font ? `fonts/${slugify(font.family)}.ttf` : undefined;
  };

  /* ------------------------- static backgrounds ------------------------- */
  onProgress('Rendering background');
  const bakedNormal = project.normal.filter(isBaked);
  files[`${assetsDir}/bg.png`] = await renderNodeToPng(
    <WatchfaceSVG
      device={device}
      elements={bakedNormal}
      background={project.backgroundColor}
      data={PREVIEW_DATA}
      width={device.width}
      staticOnly
    />,
    device.width,
    device.height,
  );

  const hasAod = project.aod.length > 0;
  if (hasAod) {
    onProgress('Rendering AOD background');
    files[`${assetsDir}/aod-bg.png`] = await renderNodeToPng(
      <WatchfaceSVG
        device={device}
        elements={project.aod.filter(isBaked)}
        background={project.aodBackgroundColor}
        data={PREVIEW_DATA}
        width={device.width}
        staticOnly
      />,
      device.width,
      device.height,
    );
  }

  /* ------------------------------- preview ------------------------------ */
  onProgress('Rendering preview icon');
  files[`${assetsDir}/icon.png`] = await renderNodeToPng(
    <WatchfaceSVG
      device={device}
      elements={project.normal}
      background={project.backgroundColor}
      data={PREVIEW_DATA}
      width={240}
    />,
    240,
    Math.round((240 * device.height) / device.width),
  );

  /* -------------------------------- hands ------------------------------- */
  const pointers: {
    kind: HandKind;
    path: string;
    cx: number;
    cy: number;
    px: number;
    py: number;
    aod: boolean;
  }[] = [];

  const renderHand = async (el: WatchElement, aod: boolean, index: number) => {
    if (el.type !== 'hand' && el.type !== 'image') return;
    const kind: HandKind = el.type === 'hand' ? el.hand : el.rotateWith!;
    const w = Math.max(2, Math.round(el.width));
    const h = Math.max(2, Math.round(el.height));
    onProgress(`Rendering ${kind} hand`);
    const png = await renderNodeToPng(
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} xmlns="http://www.w3.org/2000/svg">
        <g transform={`translate(${w / 2} ${h / 2})`} opacity={el.opacity}>
          <ElementRenderer el={el} data={PREVIEW_DATA} />
        </g>
      </svg>,
      w,
      h,
    );
    const name = `hands/${aod ? 'aod-' : ''}${kind}-${index}.png`;
    files[`${assetsDir}/${name}`] = png;
    const pivot = pivotOffset(el);
    if (el.rotation !== 0) {
      warnings.push(
        `"${el.name}" has a manual rotation of ${el.rotation}° — Zepp OS pointers ignore it (time drives the angle).`,
      );
    }
    pointers.push({
      kind,
      path: name,
      cx: Math.round(el.x + pivot.x),
      cy: Math.round(el.y + pivot.y),
      px: Math.round(w / 2 + pivot.x),
      py: Math.round(h / 2 + pivot.y),
      aod,
    });
  };

  let handIndex = 0;
  for (const el of project.normal.filter(isHandLike)) {
    if (!el.visible) continue;
    await renderHand(el, false, handIndex++);
  }
  for (const el of project.aod.filter(isHandLike)) {
    if (!el.visible) continue;
    await renderHand(el, true, handIndex++);
  }

  /* -------------------------- live weather icons ------------------------ */
  const weathers: { x: number; y: number; dir: string; aod: boolean }[] = [];
  const liveWeatherEls = [
    ...project.normal.filter(isLiveWeather).map((el) => ({ el, aod: false })),
    ...project.aod.filter(isLiveWeather).map((el) => ({ el, aod: true })),
  ];
  for (let i = 0; i < liveWeatherEls.length; i++) {
    const { el, aod } = liveWeatherEls[i];
    if (el.type !== 'weatherIcon' || !el.visible) continue;
    onProgress('Rendering weather icons');
    const dir = `weather-${i}`;
    const w = Math.round(el.width);
    const h = Math.round(el.height);
    for (const cond of WEATHER_CONDITIONS) {
      files[`${assetsDir}/${dir}/${cond.value}.png`] = await renderNodeToPng(
        <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} xmlns="http://www.w3.org/2000/svg">
          <g transform={`translate(${w / 2} ${h / 2})`} opacity={el.opacity}>
            <ElementRenderer
              el={{ ...el, condition: cond.value as never }}
              data={PREVIEW_DATA}
            />
          </g>
        </svg>,
        w,
        h,
      );
    }
    weathers.push({
      x: Math.round(el.x - w / 2),
      y: Math.round(el.y - h / 2),
      dir,
      aod,
    });
  }

  /* -------------------------------- fonts ------------------------------- */
  for (const font of project.fonts ?? []) {
    files[`${assetsDir}/fonts/${slugify(font.family)}.ttf`] = dataUrlToBytes(font.src);
  }

  /* ----------------------------- widget specs --------------------------- */
  const texts: TextSpec[] = [];
  const arcs: {
    cx: number; cy: number; r: number; width: number; color: number;
    start: number; end: number; source: DataSource; rounded: boolean; aod: boolean;
  }[] = [];
  const bars: {
    x: number; y: number; w: number; h: number; color: number;
    radius: number; source: DataSource; aod: boolean;
  }[] = [];

  const googleFontWarn = new Set<string>();
  const resolveFont = (family: string): string | undefined => {
    const path = customFontPath(family);
    if (!path && !googleFontWarn.has(family)) {
      googleFontWarn.add(family);
      warnings.push(
        `Live text uses "${family}" — Google Fonts aren't packaged, the watch system font is used instead. Upload the TTF in Assets to ship it.`,
      );
    }
    return path;
  };

  const collect = (elements: WatchElement[], aod: boolean) => {
    for (const el of elements) {
      if (!el.visible) continue;
      if (el.type === 'digitalTime') {
        const size = Math.round(el.height * FONT_HEIGHT_RATIO);
        texts.push({
          kind: 'time',
          x: Math.round(el.x - el.width / 2),
          y: Math.round(el.y - el.height / 2),
          w: Math.round(el.width),
          h: Math.round(el.height),
          size,
          color: cssToZeppColor(el.color),
          font: resolveFont(el.fontFamily),
          twelve: el.format.startsWith('hh'),
          seconds: el.format.endsWith('ss'),
          ampm: el.showAmPm && el.format.startsWith('hh'),
          aod,
        });
        if (el.rotation !== 0) {
          warnings.push(`"${el.name}" rotation is ignored — Zepp OS text widgets can't rotate.`);
        }
      } else if (el.type === 'number') {
        texts.push({
          kind: 'source',
          x: Math.round(el.x - el.width / 2),
          y: Math.round(el.y - el.height / 2),
          w: Math.round(el.width),
          h: Math.round(el.height),
          size: Math.round(el.height * FONT_HEIGHT_RATIO),
          color: cssToZeppColor(el.color),
          font: resolveFont(el.fontFamily),
          source: el.source,
          showUnit: el.showUnit,
          aod,
        });
        if (el.rotation !== 0) {
          warnings.push(`"${el.name}" rotation is ignored — Zepp OS text widgets can't rotate.`);
        }
      } else if (el.type === 'complication') {
        const s = Math.min(el.width, el.height);
        const valueColor = cssToZeppColor(el.valueColor ?? el.textColor);
        const valueFont = resolveFont(el.valueFont ?? el.fontFamily);
        const valueScale = el.valueScale ?? el.textScale ?? 1;
        if (el.kind === 'date') {
          const h = s * 0.92;
          const headerH = h * 0.32;
          const labelScale = el.labelScale ?? el.textScale ?? 1;
          texts.push({
            kind: 'source',
            source: 'dayName',
            x: Math.round(el.x - el.width / 2 + (el.labelDx ?? 0)),
            y: Math.round(el.y - h / 2 + (el.labelDy ?? 0)),
            w: Math.round(el.width),
            h: Math.round(headerH),
            size: Math.round(h * 0.17 * labelScale),
            color: cssToZeppColor(el.labelColor ?? el.accentColor),
            font: resolveFont(el.labelFont ?? el.fontFamily),
            aod,
          });
          texts.push({
            kind: 'source',
            source: 'dayNumber',
            x: Math.round(el.x - el.width / 2 + (el.valueDx ?? 0)),
            y: Math.round(el.y - h / 2 + headerH + (el.valueDy ?? 0)),
            w: Math.round(el.width),
            h: Math.round(h - headerH),
            size: Math.round(h * 0.4 * valueScale),
            color: valueColor,
            font: valueFont,
            aod,
          });
        } else {
          const valueSize = Math.round(s * 0.24 * valueScale);
          texts.push({
            kind: 'source',
            source: complicationSource(el.kind),
            x: Math.round(el.x - el.width / 2 + (el.valueDx ?? 0)),
            y: Math.round(el.y + s * 0.035 + (el.valueDy ?? 0) - valueSize * 0.7),
            w: Math.round(el.width),
            h: Math.round(valueSize * 1.4),
            size: valueSize,
            color: valueColor,
            font: valueFont,
            aod,
          });
          if (el.showRing) {
            const ringW = Math.max(2, s * 0.055);
            arcs.push({
              cx: Math.round(el.x),
              cy: Math.round(el.y),
              r: Math.round(s / 2 - ringW / 2 - 1),
              width: Math.round(ringW),
              color: cssToZeppColor(el.accentColor),
              start: 0,
              end: 360,
              source: complicationSource(el.kind),
              rounded: true,
              aod,
            });
          }
        }
      } else if (el.type === 'progressBar') {
        if (el.variant === 'circular') {
          const r = Math.min(el.width, el.height) / 2 - el.thickness / 2;
          arcs.push({
            cx: Math.round(el.x),
            cy: Math.round(el.y),
            r: Math.round(r),
            width: Math.round(el.thickness),
            color: cssToZeppColor(el.fillColor),
            start: el.startAngle,
            end: el.startAngle + Math.max(10, Math.min(360, el.sweep)),
            source: el.source,
            rounded: el.rounded,
            aod,
          });
          if (el.showValue) {
            const size = Math.round(r * 0.42 * (el.textScale ?? 1));
            texts.push({
              kind: 'source',
              source: el.source,
              x: Math.round(el.x - el.width / 2),
              y: Math.round(el.y - size * 0.7),
              w: Math.round(el.width),
              h: Math.round(size * 1.4),
              size,
              color: cssToZeppColor(el.fillColor),
              font: resolveFont(el.fontFamily),
              aod,
            });
          }
        } else {
          const t = Math.min(el.thickness, el.height);
          bars.push({
            x: Math.round(el.x - el.width / 2),
            y: Math.round(el.y - t / 2),
            w: Math.round(el.width),
            h: Math.round(t),
            radius: el.rounded ? Math.round(t / 2) : 0,
            color: cssToZeppColor(el.fillColor),
            source: el.source,
            aod,
          });
          if (el.rotation !== 0) {
            warnings.push(`"${el.name}" rotation is ignored — linear bars export axis-aligned.`);
          }
        }
      }
    }
  };

  collect(project.normal, false);
  if (hasAod) collect(project.aod, true);

  /* ------------------------------ code files ---------------------------- */
  onProgress('Generating code');
  const spec = { width: device.width, height: device.height, hasAod, texts, arcs, bars, weathers, pointers };
  const indexJs = RUNTIME_TEMPLATE.replace('__SPEC__', JSON.stringify(spec, null, 2));

  const appJson = {
    configVersion: 'v3',
    app: {
      appId: 100000 + (Math.floor(Math.random() * 800000) | 0),
      appName: project.name,
      appType: 'watchface',
      version: { code: 1, name: '1.0.0' },
      vender: 'sylar',
      description: `${project.name} — made with Sylar Watchface Studio`,
      icon: 'icon.png',
    },
    permissions: ['data:user.hd.workout', 'device:os.local_storage'],
    runtime: { apiVersion: { compatible: '3.0', target: '3.0', minVersion: '3.0' } },
    targets: {
      [targetKey]: {
        module: {
          watchface: { path: 'watchface/index', main: 1, editable: 0, lockscreen: 0 },
        },
        platforms: [{ st }],
        designWidth: device.width,
      },
    },
    i18n: { 'en-US': { name: project.name } },
    defaultLanguage: 'en-US',
    debug: false,
  };

  const appJs = `App({\n  globalData: {},\n  onCreate() {},\n  onDestroy() {},\n})\n`;

  const readme = `# ${project.name} — Zepp OS watchface

Generated by Sylar Watchface Studio for ${device.name} (${device.width}×${device.height}).

## Install on your watch

1. Install Node.js, then the Zepp OS CLI:
   \`\`\`
   npm install -g @zeppos/zeus-cli
   \`\`\`
2. Create a free Zepp developer account and log in: \`zeus login\`
3. In the Zepp app on your phone: Profile → Settings → About → tap the logo
   repeatedly to unlock Developer Mode, and enable it.
4. In this folder run:
   \`\`\`
   zeus preview
   \`\`\`
   Scan the QR code with the Zepp app → the watchface installs on your watch.
   (\`zeus build\` alone produces the installable \`.zab\` in \`dist/\` without a device.)

## Troubleshooting

- **"Cannot find module '@babel/core'"** during build: run \`npm install -g @babel/core\` and retry.
- The CLI must be installed globally (\`-g\`) — a local install breaks its internal module aliasing.

## Notes

- Static content (backgrounds, tick marks, labels, icons, images) is pre-rendered
  into \`bg.png\` / \`aod-bg.png\` at device resolution, so it looks exactly like the editor.
- Live values are drawn by the watch: time, date, and health/weather data refresh
  every minute (every second when a seconds display is present).
- Sensor access is defensive — if a data source isn't available on your model it
  shows \`--\` instead of crashing.
${warnings.length ? `\n## Export warnings\n\n${warnings.map((w) => `- ${w}`).join('\n')}\n` : ''}`;

  files['app.json'] = strToU8(JSON.stringify(appJson, null, 2));
  files['app.js'] = strToU8(appJs);
  files['watchface/index.js'] = strToU8(indexJs);
  files['README.md'] = strToU8(readme);

  onProgress('Zipping');
  const zip = zipSync(files, { level: 6 });
  return { zip, filename: `${slugify(project.name)}-zeppos.zip`, warnings };
}
