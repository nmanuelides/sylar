import { zipSync, strToU8 } from 'fflate';
import type {
  ComplicationElement,
  DataSource,
  HandKind,
  LiveData,
  WatchElement,
  WatchfaceProject,
} from '@/types/watchface';
import { getDevice } from '@/data/devices';
import { WEATHER_CONDITIONS } from '@/data/icons';
import { PREVIEW_DATA } from '@/store/liveDataStore';
import { resolvePivot } from '@/lib/geometry';
import { slugify } from '@/lib/download';
import { hasPartialShadowSupport, isLiveText, supportsShadow } from '@/lib/elementClassification';
import { DEFAULT_LANGUAGE, MONTH_NAMES, WEEKDAY_NAMES } from '@/lib/i18n';
import { WatchfaceSVG } from '@/components/watchface/WatchfaceSVG';
import { ElementRenderer, FONT_HEIGHT_RATIO } from '@/components/watchface/renderers';
import { ShadowDefs, shadowFilterMargin } from '@/components/watchface/shadows';
import { dataUrlToBytes, renderNodeToPng, renderGlyphToPng } from './rasterize';
import { RUNTIME_TEMPLATE } from './runtime';

export interface ZeppExportResult {
  zip: Uint8Array;
  filename: string;
  warnings: string[];
}

/**
 * Official deviceSource IDs per model (docs.zepp.com device list).
 * Explicit sources force zeus to build for exactly this device — with a
 * screen-type wildcard ({st:'r'}) it builds every round device and the
 * wrong-resolution package can end up installed (global misalignment).
 */
const DEVICE_SOURCES: Record<string, number[]> = {
  balance: [8519936, 8519937, 8519939],
  balance2: [9568512, 9568513, 9568515],
  // Balance 3 isn't in Zepp's public device list yet — Balance 2 IDs (same panel)
  balance3: [9568512, 9568513, 9568515],
  gtr4: [7930112, 7930113, 7864577],
  active2: [8913152, 8913153, 8913155, 8913159, 10092800, 10092801, 10092803, 10092807],
  active3: [10944768, 10944769, 10944771, 10948867],
  activemax: [10813697, 10813699],
  trex3: [8716544, 8716545, 8716547],
  'cheetah-pro': [8126720, 8126721],
  gts4: [7995648, 7995649],
  bip5: [8454400, 8454401],
};

type FileMap = Record<string, Uint8Array>;

interface GoogleFontNeed {
  family: string;
  weight: number;
  path: string;
}

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

const isHandLike = (el: WatchElement): boolean => el.type === 'hand' || !!el.rotateWith;

const isLiveWeather = (el: WatchElement): boolean =>
  el.type === 'weatherIcon' && el.condition === 'live' && !el.rotateWith;

/** Elements baked into the static background (chrome of dynamic ones included via staticOnly) */
const isBaked = (el: WatchElement): boolean =>
  !isHandLike(el) && !isLiveText(el) && !isLiveWeather(el);

// Elements that create at least one native live-updating widget on the watch,
// on top of (or instead of) anything baked into the flattened background.
const producesLiveWidget = (el: WatchElement): boolean =>
  !isBaked(el) || el.type === 'progressBar' || el.type === 'complication';

/**
 * Zepp OS only has two effective layers around a live widget: the single
 * flattened background image (bottom) and every native widget it creates
 * (arcs/bars/texts/weather/hands), which always draws above that image. A
 * baked element placed above a progress bar/complication/live text/hand in
 * the editor's layer stack would otherwise get flattened into that same
 * bottom image and be covered by the live widget's on-top draw. Elements
 * that come after the first live-producing element are pulled into a
 * separate overlay image instead, composited above every live widget at the
 * end of build() — see runtime.ts.
 */
function splitBaked(elements: WatchElement[]): { base: WatchElement[]; overlay: WatchElement[] } {
  const base: WatchElement[] = [];
  const overlay: WatchElement[] = [];
  let seenLive = false;
  for (const el of elements) {
    if (producesLiveWidget(el)) {
      if (isBaked(el)) base.push(el);
      seenLive = true;
      continue;
    }
    (seenLive ? overlay : base).push(el);
  }
  return { base, overlay };
}

function complicationSource(kind: ComplicationElement['kind']): DataSource {
  return kind === 'weather' ? 'weather' : (kind as DataSource);
}

export async function generateZeppProject(
  project: WatchfaceProject,
  onProgress: (step: string, current: number, total: number) => void,
): Promise<ZeppExportResult> {
  const warnings: string[] = [];
  const language = project.language ?? DEFAULT_LANGUAGE;
  const previewData: LiveData = { ...PREVIEW_DATA, language };
  const device = getDevice(project.deviceId);
  if (device.id === 'balance3') {
    warnings.push(
      'Amazfit Balance 3 is not in the Zepp device list yet — exported with Balance 2 device IDs.',
    );
  }
  const st = device.shape === 'round' ? 'r' : 's';
  const targetKey = device.id;
  // Explicit-deviceSource targets resolve assets by plain target key;
  // screen-type wildcard targets use the `<key>.<st>` convention.
  const assetsDir = DEVICE_SOURCES[device.id]
    ? `assets/${targetKey}`
    : `assets/${targetKey}.${st}`;
  const files: FileMap = {};

  const customFontPath = (family: string): string | undefined => {
    const font = (project.fonts ?? []).find((f) => f.family === family);
    return font ? `fonts/${slugify(font.family)}.ttf` : undefined;
  };

  /* --------------------- total step count, for progress ------------------ */
  // Computed up front (reusing the same splits/filters the real work below
  // uses) so onProgress can report a real fraction instead of just a label.
  const { base: baseNormal, overlay: overlayNormal } = splitBaked(project.normal);
  const hasOverlay = overlayNormal.length > 0;
  const hasAod = project.aod.length > 0;
  const { base: baseAod, overlay: overlayAod } = hasAod
    ? splitBaked(project.aod)
    : { base: [], overlay: [] };
  const hasAodOverlay = hasAod && overlayAod.length > 0;
  const handCount =
    project.normal.filter((el) => isHandLike(el) && el.visible).length +
    project.aod.filter((el) => isHandLike(el) && el.visible).length;
  const liveWeatherEls = [
    ...project.normal.filter(isLiveWeather).map((el) => ({ el, aod: false })),
    ...project.aod.filter(isLiveWeather).map((el) => ({ el, aod: true })),
  ];
  const weatherIconCount = liveWeatherEls.filter(({ el }) => el.visible).length;
  const nativeWeatherCount = [...project.normal, ...project.aod].filter(
    (el) => el.visible && el.type === 'number' && el.source === 'weather' && el.nativeWeather,
  ).length;
  const totalSteps =
    1 + // background
    (hasOverlay ? 1 : 0) +
    (hasAod ? 1 : 0) +
    (hasAodOverlay ? 1 : 0) +
    1 + // preview icon
    handCount +
    weatherIconCount +
    nativeWeatherCount +
    1 + // generating code
    1; // zipping
  let stepIndex = 0;
  const step = (label: string) => onProgress(label, ++stepIndex, totalSteps);

  /* ------------------------- static backgrounds ------------------------- */
  step('Rendering background');
  files[`${assetsDir}/bg.png`] = await renderNodeToPng(
    <WatchfaceSVG
      device={device}
      elements={baseNormal}
      background={project.backgroundColor}
      data={previewData}
      width={device.width}
      staticOnly
    />,
    device.width,
    device.height,
  );
  if (hasOverlay) {
    step('Rendering overlay');
    files[`${assetsDir}/overlay.png`] = await renderNodeToPng(
      <WatchfaceSVG
        device={device}
        elements={overlayNormal}
        background="transparent"
        data={previewData}
        width={device.width}
        staticOnly
      />,
      device.width,
      device.height,
    );
  }

  if (hasAod) {
    step('Rendering AOD background');
    files[`${assetsDir}/aod-bg.png`] = await renderNodeToPng(
      <WatchfaceSVG
        device={device}
        elements={baseAod}
        background={project.aodBackgroundColor}
        data={previewData}
        width={device.width}
        staticOnly
      />,
      device.width,
      device.height,
    );
    if (hasAodOverlay) {
      step('Rendering AOD overlay');
      files[`${assetsDir}/aod-overlay.png`] = await renderNodeToPng(
        <WatchfaceSVG
          device={device}
          elements={overlayAod}
          background="transparent"
          data={previewData}
          width={device.width}
          staticOnly
        />,
        device.width,
        device.height,
      );
    }
  }

  /* --------------------- shadow export-limitation warnings -------------- */
  // Progress bars/complications bake their static chrome (track, ring,
  // label) with the shadow intact, but their live-updating fill/value is a
  // separate native widget with no shadow support. Live digitalTime/number
  // text (not rotating, so not baked at all — see renderRotatingElement
  // below) has no static image behind it whatsoever.
  for (const el of [...project.normal, ...project.aod]) {
    if (!el.shadows?.length) continue;
    if (hasPartialShadowSupport(el)) {
      warnings.push(
        `"${el.name}" has a shadow set, but only its static chrome (track/ring/label) can show it — Zepp OS renders its live-updating fill/value as a native widget with no shadow support.`,
      );
    } else if (!supportsShadow(el)) {
      warnings.push(
        `"${el.name}" has a shadow set, but it's a fully live Zepp OS text widget with no static image behind it — the shadow won't appear on the device.`,
      );
    }
  }

  /* ------------------------------- preview ------------------------------ */
  step('Rendering preview icon');
  files[`${assetsDir}/icon.png`] = await renderNodeToPng(
    <WatchfaceSVG
      device={device}
      elements={project.normal}
      background={project.backgroundColor}
      data={previewData}
      width={240}
    />,
    240,
    Math.round((240 * device.height) / device.width),
  );

  /* ---------------------------- rotating elements ------------------------ */
  // Hour/minute/second sources use Zepp's native TIME_POINTER (efficient,
  // built-in clock binding). weekday/battery sources have no native widget,
  // so they render as a plain rotating IMG whose angle the runtime updates
  // periodically (see runtime.ts's `rotators`).
  const pointers: {
    kind: HandKind;
    path: string;
    cx: number;
    cy: number;
    px: number;
    py: number;
    aod: boolean;
  }[] = [];
  const rotators: {
    source: 'weekday' | 'battery';
    path: string;
    cx: number;
    cy: number;
    px: number;
    py: number;
    offset: number;
    aod: boolean;
  }[] = [];

  const renderRotatingElement = async (el: WatchElement, aod: boolean, index: number) => {
    const source = el.type === 'hand' ? el.hand : el.rotateWith;
    if (!source) return;
    if (el.type === 'digitalTime' || el.type === 'number') {
      warnings.push(
        `"${el.name}" rotates, but Zepp OS text widgets can't rotate and stay live at the same time — it's baked as a static snapshot showing the preview value instead.`,
      );
    } else if (el.type === 'weatherIcon') {
      warnings.push(
        `"${el.name}" rotates, but can't also keep updating its live weather icon — baked showing the preview condition.`,
      );
    }
    const margin = Math.ceil(shadowFilterMargin(el.shadows));
    const w = Math.max(2, Math.round(el.width)) + margin * 2;
    const h = Math.max(2, Math.round(el.height)) + margin * 2;
    step(`Rendering ${source} rotator`);
    const png = await renderNodeToPng(
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} xmlns="http://www.w3.org/2000/svg">
        <g
          transform={`translate(${w / 2} ${h / 2})`}
          opacity={el.opacity}
          filter={el.shadows?.length ? 'url(#rot-shadow)' : undefined}
        >
          {el.shadows?.length ? (
            <defs>
              <ShadowDefs id="rot-shadow" shadows={el.shadows} />
            </defs>
          ) : null}
          <ElementRenderer el={el} data={previewData} />
        </g>
      </svg>,
      w,
      h,
    );
    const name = `hands/${aod ? 'aod-' : ''}${source}-${index}.png`;
    files[`${assetsDir}/${name}`] = png;
    const world = resolvePivot(el, aod ? project.aod : project.normal);
    const cx = Math.round(world.x);
    const cy = Math.round(world.y);
    const px = Math.round(w / 2 + (world.x - el.x));
    const py = Math.round(h / 2 + (world.y - el.y));

    if (source === 'hour' || source === 'minute' || source === 'second') {
      if (el.rotation !== 0) {
        warnings.push(
          `"${el.name}" has a manual rotation of ${el.rotation}° — Zepp OS pointers ignore it (time drives the angle).`,
        );
      }
      pointers.push({ kind: source, path: name, cx, cy, px, py, aod });
    } else {
      rotators.push({ source, path: name, cx, cy, px, py, offset: el.rotation, aod });
    }
  };

  let handIndex = 0;
  for (const el of project.normal.filter(isHandLike)) {
    if (!el.visible) continue;
    await renderRotatingElement(el, false, handIndex++);
  }
  for (const el of project.aod.filter(isHandLike)) {
    if (!el.visible) continue;
    await renderRotatingElement(el, true, handIndex++);
  }

  /* -------------------------- live weather icons ------------------------ */
  const weathers: { x: number; y: number; dir: string; aod: boolean }[] = [];
  for (let i = 0; i < liveWeatherEls.length; i++) {
    const { el, aod } = liveWeatherEls[i];
    if (el.type !== 'weatherIcon' || !el.visible) continue;
    step('Rendering weather icons');
    const dir = `weather-${i}`;
    const margin = Math.ceil(shadowFilterMargin(el.shadows));
    const w = Math.round(el.width) + margin * 2;
    const h = Math.round(el.height) + margin * 2;
    for (const cond of WEATHER_CONDITIONS) {
      files[`${assetsDir}/${dir}/${cond.value}.png`] = await renderNodeToPng(
        <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} xmlns="http://www.w3.org/2000/svg">
          <g
            transform={`translate(${w / 2} ${h / 2})`}
            opacity={el.opacity}
            filter={el.shadows?.length ? 'url(#weather-shadow)' : undefined}
          >
            {el.shadows?.length ? (
              <defs>
                <ShadowDefs id="weather-shadow" shadows={el.shadows} />
              </defs>
            ) : null}
            <ElementRenderer
              el={{ ...el, condition: cond.value as never }}
              data={previewData}
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
    // Segmented linear bars: geometry above is for segment 0; runtime.ts
    // expands this into `segments` separate FILL_RECT widgets spaced `gap`
    // apart, since Zepp OS has no native multi-block fill widget.
    segments?: number; gap?: number;
  }[] = [];
  // TEXT_IMG widgets, used only for the opt-in "live device temperature"
  // path — bound natively to the OS's own current-weather data type, with
  // no polling code needed (see runtime.ts). fontArray is a digit-sprite
  // set (0-9) baked from the element's own font/color, since TEXT_IMG has
  // no system-font text mode of its own.
  const textImgs: {
    x: number; y: number; w: number; h: number; hSpace: number;
    fontArray: string[]; negImage: string; unitEn: string; imperialUnitEn: string;
    aod: boolean;
  }[] = [];
  let textImgIndex = 0;

  // Google Fonts aren't TTF files we already have — the build server fetches
  // the real font binary from Google before compiling (see server/index.js).
  const googleFonts = new Map<string, GoogleFontNeed>();
  const resolveFont = (family: string, weight = 400): string | undefined => {
    const uploaded = customFontPath(family);
    if (uploaded) return uploaded;
    const key = `${family}-${weight}`;
    let need = googleFonts.get(key);
    if (!need) {
      need = { family, weight, path: `fonts/google-${slugify(family)}-${weight}.ttf` };
      googleFonts.set(key, need);
    }
    return need.path;
  };

  const collect = async (elements: WatchElement[], aod: boolean) => {
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
          font: resolveFont(el.fontFamily, el.fontWeight),
          twelve: el.format.startsWith('hh'),
          seconds: el.format.endsWith('ss'),
          ampm: el.showAmPm && el.format.startsWith('hh'),
          aod,
        });
        if (el.rotation !== 0) {
          warnings.push(`"${el.name}" rotation is ignored — Zepp OS text widgets can't rotate.`);
        }
      } else if (el.type === 'number' && el.source === 'weather' && el.nativeWeather) {
        step('Rendering temperature digits');
        // Per-glyph sprite box (one digit character), not the overall widget
        // box below — TEXT_IMG lays glyphs out itself from these.
        const glyphH = Math.round(el.height);
        const glyphW = Math.round(el.height * 0.62);
        const fontSize = Math.round(glyphH * FONT_HEIGHT_RATIO);
        const idx = textImgIndex++;
        const renderGlyph = (ch: string) =>
          renderGlyphToPng(ch, glyphW, glyphH, el.fontFamily, el.fontWeight, fontSize, el.color);
        const fontArray: string[] = [];
        for (const digit of '0123456789') {
          const name = `fontimg/${idx}/${digit}.png`;
          files[`${assetsDir}/${name}`] = await renderGlyph(digit);
          fontArray.push(name);
        }
        const negName = `fontimg/${idx}/neg.png`;
        files[`${assetsDir}/${negName}`] = await renderGlyph('-');
        textImgs.push({
          x: Math.round(el.x - el.width / 2),
          y: Math.round(el.y - el.height / 2),
          w: Math.round(el.width),
          h: Math.round(el.height),
          hSpace: Math.round(glyphW * 0.06),
          fontArray,
          negImage: negName,
          unitEn: '°C',
          imperialUnitEn: '°F',
          aod,
        });
      } else if (el.type === 'number') {
        texts.push({
          kind: 'source',
          x: Math.round(el.x - el.width / 2),
          y: Math.round(el.y - el.height / 2),
          w: Math.round(el.width),
          h: Math.round(el.height),
          size: Math.round(el.height * FONT_HEIGHT_RATIO),
          color: cssToZeppColor(el.color),
          font: resolveFont(el.fontFamily, el.fontWeight),
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
              // Zepp arcs: 0° = 3 o'clock; Sylar: 0° = 12 o'clock
              start: -90,
              end: 270,
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
            // Zepp arcs: 0° = 3 o'clock; Sylar: 0° = 12 o'clock → shift -90
            start: el.startAngle - 90,
            end: el.startAngle - 90 + Math.max(10, Math.min(360, el.sweep)),
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
          const radius = el.cornerRadius ?? (el.rounded ? t / 2 : 0);
          if (el.segmented) {
            const n = Math.max(1, Math.round(el.segmentCount ?? 5));
            const gap = el.segmentGap ?? 4;
            const segW = Math.max(1, (el.width - gap * (n - 1)) / n);
            const segRx = Math.min(radius, segW / 2, t / 2);
            bars.push({
              x: Math.round(el.x - el.width / 2),
              y: Math.round(el.y - t / 2),
              w: Math.round(segW),
              h: Math.round(t),
              radius: Math.round(segRx),
              color: cssToZeppColor(el.fillColor),
              source: el.source,
              aod,
              segments: n,
              gap: Math.round(gap),
            });
            if (n > 8) {
              warnings.push(
                `"${el.name}" uses ${n} segments — each is a separate native widget; very high segment counts across many bars may add up.`,
              );
            }
          } else {
            bars.push({
              x: Math.round(el.x - el.width / 2),
              y: Math.round(el.y - t / 2),
              w: Math.round(el.width),
              h: Math.round(t),
              radius: Math.round(radius),
              color: cssToZeppColor(el.fillColor),
              source: el.source,
              aod,
            });
          }
          if (el.rotation !== 0) {
            warnings.push(`"${el.name}" rotation is ignored — linear bars export axis-aligned.`);
          }
        }
      }
    }
  };

  await collect(project.normal, false);
  if (hasAod) await collect(project.aod, true);

  /* ------------------------------ code files ---------------------------- */
  step('Generating code');
  const spec = {
    width: device.width,
    height: device.height,
    hasAod,
    hasOverlay,
    hasAodOverlay,
    week: WEEKDAY_NAMES[language],
    months: MONTH_NAMES[language],
    texts,
    arcs,
    bars,
    weathers,
    pointers,
    rotators,
    textImgs,
  };
  const indexJs = RUNTIME_TEMPLATE.replace('__SPEC__', JSON.stringify(spec, null, 2));

  if (googleFonts.size > 0) {
    // Not pushed as an export warning: the build server fetches these
    // automatically on every build as long as it has internet access (true
    // for both local dev and the deployed build server), so this fires on
    // every export using a Google Font regardless of whether anything will
    // actually go wrong — pure noise once that's confirmed working.
    files['google-fonts.json'] = strToU8(
      JSON.stringify(
        [...googleFonts.values()].map((f) => ({ ...f, path: `${assetsDir}/${f.path}` })),
        null,
        2,
      ),
    );
  }

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
    permissions: [
      'device:os.local_storage',
      'data:user.hd.workout',
      'data:user.hd.heart_rate',
      'data:user.hd.step',
      'data:user.hd.calorie',
      'data:user.hd.distance',
      'data:user.hd.spo2',
      'data:user.hd.stress',
      'data:user.hd.sleep',
      'data:user.hd.pai',
      'data:user.hd.stand',
      'data:user.hd.weather',
    ],
    runtime: { apiVersion: { compatible: '3.0', target: '3.0', minVersion: '3.0' } },
    targets: {
      [targetKey]: {
        module: {
          // lockscreen: 1 enables the Always-On Display rendering of this page
          watchface: { path: 'watchface/index', main: 1, editable: 0, lockscreen: hasAod ? 1 : 0 },
        },
        platforms: DEVICE_SOURCES[device.id]
          ? DEVICE_SOURCES[device.id].map((deviceSource) => ({ deviceSource }))
          : [{ st }],
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
- Any element set to "Rotate as" hour/minute/second/day-of-week/battery spins
  continuously on the watch, not just hands — day-of-week uses 7 evenly-spaced
  positions (Monday first), battery sweeps a full turn from 0% to 100%.
- Sensor access is defensive — if a data source isn't available on your model it
  shows \`--\` instead of crashing.
- Live text using a Google Font references \`google-fonts.json\` — the Sylar build
  server downloads the real font file at build time (needs internet access on
  that machine). Building manually with \`zeus build\`/\`zeus preview\` yourself?
  Fetch those files first and place them at the paths listed in that manifest,
  or the watch falls back to its system font.
${warnings.length ? `\n## Export warnings\n\n${warnings.map((w) => `- ${w}`).join('\n')}\n` : ''}`;

  files['app.json'] = strToU8(JSON.stringify(appJson, null, 2));
  files['app.js'] = strToU8(appJs);
  files['watchface/index.js'] = strToU8(indexJs);
  files['README.md'] = strToU8(readme);

  step('Zipping');
  const zip = zipSync(files, { level: 6 });
  return { zip, filename: `${slugify(project.name)}-zeppos.zip`, warnings };
}
