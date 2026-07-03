import type {
  ComplicationElement,
  DigitalTimeElement,
  HandElement,
  IconElement,
  ImageElement,
  LiveData,
  NumberElement,
  ProgressBarElement,
  TextElement,
  TickMarksElement,
  WatchElement,
  WeatherIconElement,
} from '@/types/watchface';
import { COMPLICATION_GLYPHS, ICONS, WEATHER_GLYPHS, type Glyph } from '@/data/icons';
import { describeArc, pivotOffset, polar } from '@/lib/geometry';
import { formatTime, handAngle, sourceValue, WEEKDAYS } from '@/lib/time';

/** Ratio between rendered font size and element box height for text elements */
export const FONT_HEIGHT_RATIO = 0.78;

/** Renders a Font Awesome glyph centered at (0, y), scaled to `size` height. */
function GlyphIcon({ glyph, size, y, fill }: { glyph: Glyph; size: number; y: number; fill: string }) {
  const scale = size / 512;
  return (
    <g transform={`translate(0 ${y}) scale(${scale}) translate(${-glyph.width / 2} -256)`}>
      <path d={glyph.path} fill={fill} />
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Complications                                                       */
/* ------------------------------------------------------------------ */

/** Resolved per-part text settings with legacy fallbacks */
function textParts(el: ComplicationElement) {
  const base = el.textScale ?? 1;
  return {
    value: {
      color: el.valueColor ?? el.textColor,
      font: el.valueFont ?? el.fontFamily,
      scale: el.valueScale ?? base,
      dx: el.valueDx ?? 0,
      dy: el.valueDy ?? 0,
    },
    label: {
      color: el.labelColor ?? el.textColor,
      font: el.labelFont ?? el.fontFamily,
      scale: el.labelScale ?? base,
      dx: el.labelDx ?? 0,
      dy: el.labelDy ?? 0,
    },
  };
}

function DateCard({ el, data }: { el: ComplicationElement; data: LiveData }) {
  const s = Math.min(el.width, el.height);
  const { value, label } = textParts(el);
  const w = s * 0.82;
  const h = s * 0.92;
  const headerH = h * 0.32;
  return (
    <g>
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        rx={s * 0.14}
        fill="rgba(0,0,0,0.35)"
        stroke={el.accentColor}
        strokeWidth={Math.max(1.5, s * 0.02)}
      />
      <path
        d={`M ${-w / 2} ${-h / 2 + headerH} h ${w}`}
        stroke={el.accentColor}
        strokeWidth={Math.max(1, s * 0.014)}
      />
      <text
        x={label.dx}
        y={-h / 2 + headerH / 2 + label.dy}
        textAnchor="middle"
        dominantBaseline="central"
        fill={el.labelColor ?? el.accentColor}
        fontFamily={label.font}
        fontWeight={600}
        fontSize={h * 0.17 * label.scale}
        letterSpacing={s * 0.01}
      >
        {WEEKDAYS[data.now.getDay()]}
      </text>
      <text
        x={value.dx}
        y={headerH / 2 + h * 0.02 + value.dy}
        textAnchor="middle"
        dominantBaseline="central"
        fill={value.color}
        fontFamily={value.font}
        fontWeight={700}
        fontSize={h * 0.4 * value.scale}
      >
        {data.now.getDate()}
      </text>
    </g>
  );
}

function Complication({ el, data }: { el: ComplicationElement; data: LiveData }) {
  if (el.kind === 'date') return <DateCard el={el} data={data} />;
  const s = Math.min(el.width, el.height);
  const { value, label } = textParts(el);
  const source = el.kind === 'weather' ? 'weather' : el.kind;
  const info = sourceValue(source, data);
  const ringW = Math.max(2, s * 0.055);
  const r = s / 2 - ringW / 2 - 1;
  const circumference = 2 * Math.PI * r;
  const fraction = Math.max(0.02, Math.min(1, info.fraction));
  const glyph = COMPLICATION_GLYPHS[el.kind];
  return (
    <g>
      {el.showRing && (
        <>
          <circle
            r={r}
            fill="rgba(0,0,0,0.28)"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth={ringW}
          />
          <circle
            r={r}
            fill="none"
            stroke={el.accentColor}
            strokeWidth={ringW}
            strokeLinecap="round"
            strokeDasharray={`${circumference * fraction} ${circumference}`}
            transform="rotate(-90)"
          />
        </>
      )}
      {el.showIcon && glyph && (
        <GlyphIcon glyph={glyph} size={s * 0.2} y={-s * 0.235} fill={el.accentColor} />
      )}
      <text
        x={value.dx}
        y={s * 0.035 + value.dy}
        textAnchor="middle"
        dominantBaseline="central"
        fill={value.color}
        fontFamily={value.font}
        fontWeight={700}
        fontSize={s * 0.24 * value.scale}
      >
        {info.value}
      </text>
      {el.showLabel && (
        <text
          x={label.dx}
          y={s * 0.29 + label.dy}
          textAnchor="middle"
          dominantBaseline="central"
          fill={label.color}
          opacity={el.labelColor ? 1 : 0.6}
          fontFamily={label.font}
          fontWeight={500}
          fontSize={s * 0.095 * label.scale}
          letterSpacing={s * 0.008}
        >
          {info.label}
        </text>
      )}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Hands                                                               */
/* ------------------------------------------------------------------ */

function Hand({ el }: { el: HandElement }) {
  const L = el.height / 2;
  const W = el.width;
  const tail = L * 0.22;
  let body: JSX.Element;
  switch (el.style) {
    case 'classic':
      body = (
        <>
          <path
            d={`M 0 ${-L} L ${W * 0.5} ${-L * 0.18} L ${W * 0.32} ${tail} L ${-W * 0.32} ${tail} L ${-W * 0.5} ${-L * 0.18} Z`}
            fill={el.color}
          />
          <path
            d={`M 0 ${-L * 0.92} L ${W * 0.18} ${-L * 0.2} L ${-W * 0.18} ${-L * 0.2} Z`}
            fill={el.accentColor}
          />
        </>
      );
      break;
    case 'sword':
      body = (
        <>
          <path
            fillRule="evenodd"
            d={
              `M 0 ${-L} L ${W * 0.5} ${-L * 0.68} L ${W * 0.4} ${tail} L ${-W * 0.4} ${tail} L ${-W * 0.5} ${-L * 0.68} Z ` +
              `M 0 ${-L * 0.8} L ${W * 0.2} ${-L * 0.6} L ${W * 0.16} ${tail * 0.35} L ${-W * 0.16} ${tail * 0.35} L ${-W * 0.2} ${-L * 0.6} Z`
            }
            fill={el.color}
          />
          <path
            d={`M 0 ${-L} L ${W * 0.5} ${-L * 0.68} L 0 ${-L * 0.74} L ${-W * 0.5} ${-L * 0.68} Z`}
            fill={el.accentColor}
          />
        </>
      );
      break;
    default:
      body = (
        <>
          <rect
            x={-W * 0.16}
            y={-L}
            width={W * 0.32}
            height={L + tail}
            rx={W * 0.16}
            fill={el.color}
          />
          <circle cy={tail} r={W * 0.55} fill={el.color} />
        </>
      );
  }
  return (
    <g>
      {body}
      {el.showCap && (
        <>
          <circle r={Math.max(3, W * 0.5)} fill={el.color} />
          <circle r={Math.max(1.5, W * 0.24)} fill={el.accentColor} />
        </>
      )}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Text-like                                                           */
/* ------------------------------------------------------------------ */

function DigitalTime({ el, data }: { el: DigitalTimeElement; data: LiveData }) {
  const { main, ampm } = formatTime(data.now, el.format);
  const fontSize = el.height * FONT_HEIGHT_RATIO;
  return (
    <text
      textAnchor="middle"
      dominantBaseline="central"
      fill={el.color}
      fontFamily={el.fontFamily}
      fontWeight={el.fontWeight}
      fontSize={fontSize}
      letterSpacing={el.letterSpacing}
    >
      {main}
      {el.showAmPm && ampm && (
        <tspan fontSize={fontSize * 0.34} dx={fontSize * 0.1} dy={-fontSize * 0.18}>
          {ampm}
        </tspan>
      )}
    </text>
  );
}

function NumberText({ el, data }: { el: NumberElement; data: LiveData }) {
  const info = sourceValue(el.source, data);
  return (
    <text
      textAnchor="middle"
      dominantBaseline="central"
      fill={el.color}
      fontFamily={el.fontFamily}
      fontWeight={el.fontWeight}
      fontSize={el.height * FONT_HEIGHT_RATIO}
      letterSpacing={el.letterSpacing}
    >
      {info.value}
      {el.showUnit && info.unit}
    </text>
  );
}

function TextLabel({ el }: { el: TextElement }) {
  return (
    <text
      textAnchor="middle"
      dominantBaseline="central"
      fill={el.color}
      fontFamily={el.fontFamily}
      fontWeight={el.fontWeight}
      fontSize={el.height * FONT_HEIGHT_RATIO}
      letterSpacing={el.letterSpacing}
    >
      {el.uppercase ? el.text.toUpperCase() : el.text}
    </text>
  );
}

/* ------------------------------------------------------------------ */
/* Icon / Image                                                        */
/* ------------------------------------------------------------------ */

function Icon({ el }: { el: IconElement }) {
  if (el.iconPath) {
    const gw = el.iconWidth ?? 512;
    const scale = Math.min(el.width / gw, el.height / 512);
    return (
      <g transform={`scale(${scale}) translate(${-gw / 2} -256)`}>
        <path d={el.iconPath} fill={el.color} />
      </g>
    );
  }
  // Legacy built-in 24×24 icons
  const s = Math.min(el.width, el.height);
  const path = ICONS[el.icon] ?? ICONS.star;
  return (
    <g transform={`scale(${s / 24}) translate(-12 -12)`}>
      <path d={path} fill={el.color} />
    </g>
  );
}

function WeatherIcon({ el, data }: { el: WeatherIconElement; data: LiveData }) {
  const condition = el.condition === 'live' ? data.weatherCondition : el.condition;
  const glyph = WEATHER_GLYPHS[condition] ?? WEATHER_GLYPHS.sunny;
  const scale = Math.min(el.width / glyph.width, el.height / 512);
  return (
    <g transform={`scale(${scale}) translate(${-glyph.width / 2} -256)`}>
      <path d={glyph.path} fill={el.color} />
    </g>
  );
}

const FIT_MAP = {
  contain: 'xMidYMid meet',
  cover: 'xMidYMid slice',
  stretch: 'none',
} as const;

function ImageEl({ el }: { el: ImageElement }) {
  return (
    <image
      href={el.src}
      x={-el.width / 2}
      y={-el.height / 2}
      width={el.width}
      height={el.height}
      preserveAspectRatio={FIT_MAP[el.fit]}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Progress bars                                                       */
/* ------------------------------------------------------------------ */

function ProgressBar({ el, data }: { el: ProgressBarElement; data: LiveData }) {
  const info = sourceValue(el.source, data);
  const fraction = Math.max(0, Math.min(1, info.fraction));
  const cap = el.rounded ? 'round' : 'butt';
  if (el.variant === 'linear') {
    const w = el.width;
    const t = Math.min(el.thickness, el.height);
    const rx = el.rounded ? t / 2 : 0;
    return (
      <g>
        <rect x={-w / 2} y={-t / 2} width={w} height={t} rx={rx} fill={el.trackColor} />
        <rect
          x={-w / 2}
          y={-t / 2}
          width={Math.max(t, w * fraction)}
          height={t}
          rx={rx}
          fill={el.fillColor}
        />
      </g>
    );
  }
  const r = Math.min(el.width, el.height) / 2 - el.thickness / 2;
  const sweep = Math.max(10, Math.min(360, el.sweep));
  const start = el.startAngle;
  return (
    <g>
      <path
        d={describeArc(0, 0, r, start, start + sweep)}
        fill="none"
        stroke={el.trackColor}
        strokeWidth={el.thickness}
        strokeLinecap={cap}
      />
      {fraction > 0.005 && (
        <path
          d={describeArc(0, 0, r, start, start + sweep * fraction)}
          fill="none"
          stroke={el.fillColor}
          strokeWidth={el.thickness}
          strokeLinecap={cap}
        />
      )}
      {el.showValue && (
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fill={el.fillColor}
          fontFamily={el.fontFamily}
          fontWeight={700}
          fontSize={r * 0.42 * (el.textScale ?? 1)}
        >
          {info.value}
        </text>
      )}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Tick marks                                                          */
/* ------------------------------------------------------------------ */

function TickMarks({ el }: { el: TickMarksElement }) {
  const r = Math.min(el.width, el.height) / 2;
  const showTicks = el.showTicks ?? true;
  const ticks: JSX.Element[] = [];
  for (let i = 0; showTicks && i < el.count; i++) {
    const angle = (i * 360) / el.count;
    const major = el.majorEvery > 0 && i % el.majorEvery === 0;
    const len = major ? el.majorLength : el.length;
    const color = major ? el.majorColor : el.color;
    const thickness = major ? el.thickness : Math.max(1, el.thickness * 0.6);
    if (el.shape === 'dot') {
      const p = polar(0, 0, r - len / 2, angle);
      ticks.push(<circle key={i} cx={p.x} cy={p.y} r={thickness} fill={color} />);
    } else {
      const p1 = polar(0, 0, r, angle);
      const p2 = polar(0, 0, r - len, angle);
      ticks.push(
        <line
          key={i}
          x1={p1.x}
          y1={p1.y}
          x2={p2.x}
          y2={p2.y}
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
        />,
      );
    }
  }
  const numbers: JSX.Element[] = [];
  if (el.showNumbers) {
    const count = Math.max(1, Math.round(el.numberCount ?? 12));
    const step = el.numberStep ?? 1;
    const fontSize = r * 0.16 * (el.numberScale ?? 1);
    // Without ticks the numerals hug the outer edge instead of sitting inside them
    const nr = showTicks ? r - el.majorLength - fontSize * 0.9 : r - fontSize * 0.65;
    for (let i = 0; i < count; i++) {
      const p = polar(0, 0, nr, (i * 360) / count);
      const value = i === 0 ? (el.zeroAtTop ? 0 : count * step) : i * step;
      numbers.push(
        <text
          key={`n${i}`}
          x={p.x}
          y={p.y}
          textAnchor="middle"
          dominantBaseline="central"
          fill={el.numberColor}
          fontFamily={el.fontFamily}
          fontWeight={600}
          fontSize={fontSize}
        >
          {value}
        </text>,
      );
    }
  }
  return (
    <g>
      {ticks}
      {numbers}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Dispatcher                                                          */
/* ------------------------------------------------------------------ */

export function ElementRenderer({ el, data }: { el: WatchElement; data: LiveData }) {
  switch (el.type) {
    case 'complication':
      return <Complication el={el} data={data} />;
    case 'hand':
      return <Hand el={el} />;
    case 'digitalTime':
      return <DigitalTime el={el} data={data} />;
    case 'number':
      return <NumberText el={el} data={data} />;
    case 'text':
      return <TextLabel el={el} />;
    case 'icon':
      return <Icon el={el} />;
    case 'weatherIcon':
      return <WeatherIcon el={el} data={data} />;
    case 'progressBar':
      return <ProgressBar el={el} data={data} />;
    case 'tickMarks':
      return <TickMarks el={el} />;
    case 'image':
      return <ImageEl el={el} />;
  }
}

/** Live time rotation for hands and hand-like images (0 for everything else). */
export function elementTimeRotation(el: WatchElement, now: Date): number {
  if (el.type === 'hand') return handAngle(el.hand, now);
  if (el.type === 'image' && el.rotateWith) return handAngle(el.rotateWith, now);
  return 0;
}

/** Positions + rotates an element; hands add live time rotation. */
export function ElementNode({ el, data }: { el: WatchElement; data: LiveData }) {
  if (!el.visible) return null;
  const rotation = el.rotation + elementTimeRotation(el, data.now);
  const pivot = pivotOffset(el);
  return (
    <g
      transform={`translate(${el.x} ${el.y}) rotate(${rotation} ${pivot.x} ${pivot.y})`}
      opacity={el.opacity}
    >
      <ElementRenderer el={el} data={data} />
    </g>
  );
}
