import { useMemo, type ReactNode } from 'react';
import type { WatchElement } from '@/types/watchface';
import { decodeGradient, isGradientValue, type GradientSpec } from '@/lib/gradient';

export function GradientDef({ id, spec }: { id: string; spec: GradientSpec }) {
  const stops = [...spec.stops].sort((a, b) => a.offset - b.offset);
  const stopNodes = stops.map((s, i) => (
    <stop key={i} offset={`${s.offset * 100}%`} stopColor={s.color} />
  ));
  if (spec.kind === 'radial') {
    return (
      <radialGradient id={id} cx="50%" cy="50%" r="50%">
        {stopNodes}
      </radialGradient>
    );
  }
  // objectBoundingBox (the SVG default) makes x1/y1/x2/y2 fractions of the
  // shape's own box, so a plain unit vector from the angle works for any
  // element size/kind with no per-shape geometry needed.
  const rad = (spec.angle * Math.PI) / 180;
  const dx = Math.cos(rad) * 0.5;
  const dy = Math.sin(rad) * 0.5;
  return (
    <linearGradient id={id} x1={0.5 - dx} y1={0.5 - dy} x2={0.5 + dx} y2={0.5 + dy}>
      {stopNodes}
    </linearGradient>
  );
}

/**
 * Generic per-element gradient resolution: any own string field encoded as a
 * gradient (see lib/gradient.ts) is swapped for a `url(#id)` reference, and
 * the matching `<linearGradient>`/`<radialGradient>` defs are returned
 * alongside — so every renderer's existing `fill={el.someColor}` usage picks
 * up gradients automatically with no per-field changes anywhere else.
 */
export function resolveElementGradients<T extends WatchElement>(
  el: T,
): { el: T; defs: ReactNode[] } {
  const defs: ReactNode[] = [];
  let clone: T | null = null;
  const bag = el as unknown as Record<string, unknown>;
  for (const key of Object.keys(bag)) {
    const v = bag[key];
    if (typeof v !== 'string' || !isGradientValue(v)) continue;
    const spec = decodeGradient(v);
    if (!spec) continue;
    const id = `grad-${el.id}-${key}`.replace(/[^a-zA-Z0-9-]/g, '');
    defs.push(<GradientDef key={id} id={id} spec={spec} />);
    clone ??= { ...el };
    (clone as unknown as Record<string, unknown>)[key] = `url(#${id})`;
  }
  return { el: clone ?? el, defs };
}

/** React-render-path wrapper around {@link resolveElementGradients}, memoized per element identity. */
export function useResolvedElement<T extends WatchElement>(el: T): { el: T; defs: ReactNode[] } {
  return useMemo(() => resolveElementGradients(el), [el]);
}
