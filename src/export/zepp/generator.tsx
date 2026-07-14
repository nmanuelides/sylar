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
import { ShadowDefs, effectiveShadows, shadowFilterMargin } from '@/components/watchface/shadows';
import { resolveElementGradients } from '@/components/watchface/gradientDefs';
import { decodeGradient, isGradientValue, gradientFallbackColor } from '@/lib/gradient';
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
  textKind: 'time' | 'source';
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

interface ArcSpec {
  cx: number; cy: number; r: number; width: number; color: number;
  start: number; end: number; source: DataSource; rounded: boolean; aod: boolean;
}

interface BarSpec {
  x: number; y: number; w: number; h: number; color: number;
  radius: number; source: DataSource; aod: boolean;
  // Segmented linear bars: geometry above is for segment 0; runtime.ts
  // expands this into `segments` separate FILL_RECT widgets spaced `gap`
  // apart, since Zepp OS has no native multi-block fill widget.
  segments?: number; gap?: number;
}

interface TextImgSpec {
  x: number; y: number; w: number; h: number; hSpace: number;
  fontArray: string[]; negImage: string; unitEn: string; imperialUnitEn: string;
  aod: boolean;
}

interface WeatherSpec {
  x: number; y: number; dir: string; aod: boolean;
}

interface PointerSpec {
  hand: HandKind; path: string; cx: number; cy: number; px: number; py: number; aod: boolean;
}

interface RotatorSpec {
  source: 'weekday' | 'monthday' | 'battery';
  path: string; cx: number; cy: number; px: number; py: number; offset: number; aod: boolean;
  /** Rotate counterclockwise as the value grows (CCW dial artwork) */
  reverse?: boolean;
}

/**
 * One ordered stack of layers per mode, each either a flattened background
 * image or a native widget spec — created in exactly this order at runtime
 * so Zepp OS's creation-order-is-z-order stacking matches the design's own
 * element order (see buildModeLayers).
 */
type LayerSpec =
  | ({ kind: 'bg'; path: string; aod: boolean })
  | ({ kind: 'arc' } & ArcSpec)
  | ({ kind: 'bar' } & BarSpec)
  | ({ kind: 'text' } & TextSpec)
  | ({ kind: 'textImg' } & TextImgSpec)
  | ({ kind: 'weather' } & WeatherSpec)
  | ({ kind: 'pointer' } & PointerSpec)
  | ({ kind: 'rotator' } & RotatorSpec);

/** '#rrggbb' / '#rgb' / 'rgb(a)(...)' → 0xRRGGBB (alpha dropped) */
function cssToZeppColor(css: string): number {
  let hex = css.trim();
  if (isGradientValue(hex)) {
    const spec = decodeGradient(hex);
    if (spec) hex = gradientFallbackColor(spec);
  }
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
 * Every visible native widget (arc/bar/text/weather/hand) draws above
 * whatever image was created before it — Zepp OS has no other z-order
 * control. So instead of one flat background + one shared overlay (which
 * could only cut the design's layer stack once), each *run* of consecutive
 * baked-only elements becomes its own image, interleaved with the live
 * widgets in exactly the design's element order — see buildModeLayers below.
 * This pure counter mirrors that segmenting logic (without rendering
 * anything) purely so the progress bar knows the real step count upfront.
 */
function countBakeSegments(elements: WatchElement[]): number {
  let count = 0;
  let hasContent = false;
  for (const el of elements) {
    if (!el.visible) continue;
    if (producesLiveWidget(el)) {
      if (isBaked(el)) hasContent = true;
      if (hasContent || count === 0) count++;
      hasContent = false;
      continue;
    }
    hasContent = true;
  }
  if (hasContent || count === 0) count++;
  return count;
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
  const previewData: LiveData = { ...PREVIEW_DATA, language, stepsGoal: project.stepsGoal ?? 10000 };
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
  // Computed up front (reusing the same filters the real work below uses)
  // so onProgress can report a real fraction instead of just a label.
  const hasAod = project.aod.length > 0;
  const bakeSegmentCount =
    countBakeSegments(project.normal) + (hasAod ? countBakeSegments(project.aod) : 0);
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
    bakeSegmentCount +
    1 + // preview icon
    handCount +
    weatherIconCount +
    nativeWeatherCount +
    1 + // generating code
    1; // zipping
  let stepIndex = 0;
  const step = (label: string) => onProgress(label, ++stepIndex, totalSteps);

  /* ------------------- interleaved layers (bake + live) ------------------ */
  // Builds one ordered layer list per mode: consecutive baked-only elements
  // become a flattened image, and every live-producing element becomes its
  // own widget spec — interleaved in exactly the design's element order, so
  // Zepp OS's creation-order-is-z-order stacking matches the layer stack.
  let handIndex = 0;
  let textImgIndex = 0;
  let weatherIndex = 0;
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

  const buildModeLayers = async (
    elements: WatchElement[],
    aod: boolean,
    bgColor: string,
  ): Promise<LayerSpec[]> => {
    const layers: LayerSpec[] = [];
    let segment: WatchElement[] = [];
    let segIndex = 0;

    const flushSegment = async (allowEmpty: boolean) => {
      if (segment.length === 0 && !allowEmpty) return;
      const isFirst = segIndex === 0;
      step(
        isFirst
          ? aod
            ? 'Rendering AOD background'
            : 'Rendering background'
          : aod
            ? 'Rendering AOD overlay'
            : 'Rendering overlay',
      );
      const png = await renderNodeToPng(
        <WatchfaceSVG
          device={device}
          elements={segment}
          background={isFirst ? bgColor : 'transparent'}
          data={previewData}
          width={device.width}
          staticOnly
        />,
        device.width,
        device.height,
      );
      const name = `${aod ? 'aod-' : ''}bg-${segIndex}.png`;
      files[`${assetsDir}/${name}`] = png;
      layers.push({ kind: 'bg', path: name, aod });
      segIndex++;
      segment = [];
    };

    for (const el of elements) {
      if (!el.visible) continue;

      if (isHandLike(el)) {
        if (el.type === 'digitalTime' || el.type === 'number') {
          warnings.push(
            `"${el.name}" rotates, but Zepp OS text widgets can't rotate and stay live at the same time — it's baked as a static snapshot showing the preview value instead.`,
          );
        } else if (el.type === 'weatherIcon') {
          warnings.push(
            `"${el.name}" rotates, but can't also keep updating its live weather icon — baked showing the preview condition.`,
          );
        }
        await flushSegment(segIndex === 0);
        const source = el.type === 'hand' ? el.hand : el.rotateWith;
        if (!source) continue;
        const shadows = effectiveShadows(el);
        const margin = Math.ceil(shadowFilterMargin(shadows));
        const w = Math.max(2, Math.round(el.width)) + margin * 2;
        const h = Math.max(2, Math.round(el.height)) + margin * 2;
        step(`Rendering ${source} rotator`);
        const flip = el.flipX || el.flipY ? ` scale(${el.flipX ? -1 : 1} ${el.flipY ? -1 : 1})` : '';
        const { el: resolvedEl, defs: gradientDefs } = resolveElementGradients(el);
        const png = await renderNodeToPng(
          <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} xmlns="http://www.w3.org/2000/svg">
            <g
              transform={`translate(${w / 2} ${h / 2})${flip}`}
              opacity={el.opacity}
              filter={shadows ? 'url(#rot-shadow)' : undefined}
            >
              {(shadows || gradientDefs.length > 0) && (
                <defs>
                  {shadows ? <ShadowDefs id="rot-shadow" shadows={shadows} /> : null}
                  {gradientDefs}
                </defs>
              )}
              <ElementRenderer el={resolvedEl} data={previewData} />
            </g>
          </svg>,
          w,
          h,
        );
        const index = handIndex++;
        const name = `hands/${aod ? 'aod-' : ''}${source}-${index}.png`;
        files[`${assetsDir}/${name}`] = png;
        const world = resolvePivot(el, elements);
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
          layers.push({ kind: 'pointer', hand: source, path: name, cx, cy, px, py, aod });
        } else {
          layers.push({
            kind: 'rotator', source, path: name, cx, cy, px, py, offset: el.rotation, aod,
            reverse: el.rotateReverse || undefined,
          });
        }
        continue;
      }

      if (isLiveWeather(el) && el.type === 'weatherIcon') {
        await flushSegment(segIndex === 0);
        step('Rendering weather icons');
        const dir = `weather-${weatherIndex++}`;
        const shadows = effectiveShadows(el);
        const margin = Math.ceil(shadowFilterMargin(shadows));
        const w = Math.round(el.width) + margin * 2;
        const h = Math.round(el.height) + margin * 2;
        const flip = el.flipX || el.flipY ? ` scale(${el.flipX ? -1 : 1} ${el.flipY ? -1 : 1})` : '';
        const { el: resolvedEl, defs: gradientDefs } = resolveElementGradients(el);
        for (const cond of WEATHER_CONDITIONS) {
          files[`${assetsDir}/${dir}/${cond.value}.png`] = await renderNodeToPng(
            <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} xmlns="http://www.w3.org/2000/svg">
              <g
                transform={`translate(${w / 2} ${h / 2})${flip}`}
                opacity={el.opacity}
                filter={shadows ? 'url(#weather-shadow)' : undefined}
              >
                {(shadows || gradientDefs.length > 0) && (
                  <defs>
                    {shadows ? <ShadowDefs id="weather-shadow" shadows={shadows} /> : null}
                    {gradientDefs}
                  </defs>
                )}
                <ElementRenderer el={{ ...resolvedEl, condition: cond.value as never }} data={previewData} />
              </g>
            </svg>,
            w,
            h,
          );
        }
        layers.push({
          kind: 'weather',
          x: Math.round(el.x - w / 2),
          y: Math.round(el.y - h / 2),
          dir,
          aod,
        });
        continue;
      }

      if (el.type === 'digitalTime') {
        await flushSegment(segIndex === 0);
        const size = Math.round(el.height * FONT_HEIGHT_RATIO);
        layers.push({
          kind: 'text',
          textKind: 'time',
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
        continue;
      }

      if (el.type === 'number' && el.source === 'weather' && el.nativeWeather) {
        await flushSegment(segIndex === 0);
        step('Rendering temperature digits');
        // Per-glyph sprite box (one digit character), not the overall widget
        // box below — TEXT_IMG lays glyphs out itself from these.
        const glyphH = Math.round(el.height);
        // Tight enough to avoid noticeable dead space around most fonts'
        // digit glyphs (which are usually narrower than this), so adjacent
        // digits don't render with a big gap between them.
        const glyphW = Math.round(el.height * 0.52);
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
        layers.push({
          kind: 'textImg',
          x: Math.round(el.x - el.width / 2),
          y: Math.round(el.y - el.height / 2),
          w: Math.round(el.width),
          h: Math.round(el.height),
          hSpace: Math.round(glyphW * 0.02),
          fontArray,
          negImage: negName,
          unitEn: '°C',
          imperialUnitEn: '°F',
          aod,
        });
        continue;
      }

      if (el.type === 'number') {
        await flushSegment(segIndex === 0);
        layers.push({
          kind: 'text',
          textKind: 'source',
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
        continue;
      }

      if (el.type === 'complication') {
        if (isBaked(el)) segment.push(el);
        await flushSegment(segIndex === 0);
        const s = Math.min(el.width, el.height);
        const valueColor = cssToZeppColor(el.valueColor ?? el.textColor);
        const valueFont = resolveFont(el.valueFont ?? el.fontFamily);
        const valueScale = el.valueScale ?? el.textScale ?? 1;
        if (el.kind === 'date') {
          const h = s * 0.92;
          const headerH = h * 0.32;
          const labelScale = el.labelScale ?? el.textScale ?? 1;
          layers.push({
            kind: 'text',
            textKind: 'source',
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
          layers.push({
            kind: 'text',
            textKind: 'source',
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
          layers.push({
            kind: 'text',
            textKind: 'source',
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
            layers.push({
              kind: 'arc',
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
        continue;
      }

      if (el.type === 'progressBar') {
        if (isBaked(el)) segment.push(el);
        await flushSegment(segIndex === 0);
        if (el.variant === 'circular') {
          const r = Math.min(el.width, el.height) / 2 - el.thickness / 2;
          layers.push({
            kind: 'arc',
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
            layers.push({
              kind: 'text',
              textKind: 'source',
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
            layers.push({
              kind: 'bar',
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
            layers.push({
              kind: 'bar',
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
        continue;
      }

      // Anything else is fully baked (icon, text, tickMarks, shape, image).
      segment.push(el);
    }

    await flushSegment(segIndex === 0);
    return layers;
  };

  const normalLayers = await buildModeLayers(project.normal, false, project.backgroundColor);
  const aodLayers = hasAod
    ? await buildModeLayers(project.aod, true, project.aodBackgroundColor)
    : [];
  const layers = [...normalLayers, ...aodLayers];

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

  /* --------------------- shadow export-limitation warnings -------------- */
  // Progress bars/complications bake their static chrome (track, ring,
  // label) with the shadow intact, but their live-updating fill/value is a
  // separate native widget with no shadow support. Live digitalTime/number
  // text (not rotating, so not baked at all) has no static image behind it
  // whatsoever.
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

  /* ---------------------- flip export-limitation warnings ---------------- */
  // Same underlying constraint as shadows above: only baked pixels can
  // reflect a flip. Hands/rotators and baked live-weather icons are baked
  // per-element and flip fully there; progress bars/complications only
  // mirror their static chrome; fully-live text has no baked image at all.
  for (const el of [...project.normal, ...project.aod]) {
    if (!el.flipX && !el.flipY) continue;
    if (hasPartialShadowSupport(el)) {
      warnings.push(
        `"${el.name}" is flipped, but only its static chrome (track/ring/label) mirrors — Zepp OS renders its live-updating fill/value as a native widget with no flip support.`,
      );
    } else if (!supportsShadow(el)) {
      warnings.push(
        `"${el.name}" is flipped, but it's a fully live Zepp OS text widget with no image behind it — the flip has no effect on the device.`,
      );
    }
  }

  /* -------------------------------- fonts ------------------------------- */
  for (const font of project.fonts ?? []) {
    files[`${assetsDir}/fonts/${slugify(font.family)}.ttf`] = dataUrlToBytes(font.src);
  }

  /* ------------------------------ code files ---------------------------- */
  step('Generating code');
  const spec = {
    width: device.width,
    height: device.height,
    hasAod,
    week: WEEKDAY_NAMES[language],
    months: MONTH_NAMES[language],
    stepsGoal: project.stepsGoal ?? 10000,
    layers,
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
