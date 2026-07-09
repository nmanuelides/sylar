export type GradientKind = 'linear' | 'radial';

export interface GradientStop {
  /** 0-1 */
  offset: number;
  color: string;
}

export interface GradientSpec {
  kind: GradientKind;
  /** Degrees, linear only. 0 = left-to-right, clockwise (90 = top-to-bottom). */
  angle: number;
  stops: GradientStop[];
}

// Any color field can hold either a plain CSS color or one of these encoded
// strings — this keeps every existing `string` color field on WatchElement
// untouched, and lets a single generic resolver (gradientDefs.tsx) find and
// replace them without knowing which fields are "color fields" ahead of time.
const PREFIX = '@gradient:';

export function isGradientValue(v: string): boolean {
  return v.startsWith(PREFIX);
}

export function encodeGradient(spec: GradientSpec): string {
  return PREFIX + JSON.stringify(spec);
}

export function decodeGradient(v: string): GradientSpec | null {
  if (!v.startsWith(PREFIX)) return null;
  try {
    const parsed = JSON.parse(v.slice(PREFIX.length)) as GradientSpec;
    if (parsed && Array.isArray(parsed.stops) && parsed.stops.length >= 2) return parsed;
  } catch {
    /* not a valid gradient payload — treat as a plain color string */
  }
  return null;
}

export function defaultGradient(seedColor: string): GradientSpec {
  return {
    kind: 'linear',
    angle: 90,
    stops: [
      { offset: 0, color: seedColor },
      { offset: 1, color: '#ffffff' },
    ],
  };
}

/** Representative solid color for contexts that can't render a gradient (native Zepp OS widgets). */
export function gradientFallbackColor(spec: GradientSpec): string {
  return [...spec.stops].sort((a, b) => a.offset - b.offset)[0]?.color ?? '#ffffff';
}
