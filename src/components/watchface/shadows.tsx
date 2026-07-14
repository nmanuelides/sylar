import { Fragment, useId } from 'react';
import type { BevelSpec, ShadowSpec } from '@/types/watchface';

/**
 * A bevel is two mirrored inner shadows: a light band on the edges facing the
 * light and a dark band on the edges facing away. Emboss flips the pair so the
 * shape reads as pressed in instead of raised.
 */
export function bevelShadows(bevel: BevelSpec | undefined): ShadowSpec[] {
  if (!bevel) return [];
  const rad = (bevel.angle * Math.PI) / 180;
  // Light from `angle` (clockwise from top): offsetting an inner shadow by
  // (-sin, cos)·depth puts its band on the lit edges; the mirror offset shades
  // the opposite edges.
  const flip = bevel.style === 'emboss' ? -1 : 1;
  const dx = -Math.sin(rad) * bevel.depth * flip;
  const dy = Math.cos(rad) * bevel.depth * flip;
  const band = (id: string, sign: number, color: string, opacity: number): ShadowSpec => ({
    id,
    offsetX: dx * sign,
    offsetY: dy * sign,
    blur: bevel.blur,
    spread: 0,
    color,
    opacity,
    inner: true,
  });
  return [
    band('bevel-shade', -1, bevel.shadowColor, bevel.shadowOpacity),
    band('bevel-light', 1, bevel.highlightColor, bevel.highlightOpacity),
  ];
}

/** An element's drop-shadows plus its bevel's synthesized inner shadows, or undefined when it has neither. */
export function effectiveShadows(el: {
  shadows?: ShadowSpec[];
  bevel?: BevelSpec;
}): ShadowSpec[] | undefined {
  const combined = [...(el.shadows ?? []), ...bevelShadows(el.bevel)];
  return combined.length > 0 ? combined : undefined;
}

/** Extra pixels needed on every side so a shadow isn't clipped by a tightly-sized canvas. */
export function shadowFilterMargin(shadows: ShadowSpec[] | undefined): number {
  if (!shadows || shadows.length === 0) return 0;
  return Math.max(
    ...shadows.map((s) => s.blur * 1.5 + Math.max(0, s.spread) + Math.max(Math.abs(s.offsetX), Math.abs(s.offsetY))),
  );
}

/** `useId()`-based unique filter id, or undefined when there's nothing to filter. */
export function useShadowFilterId(shadows: ShadowSpec[] | undefined): string | undefined {
  const rawId = useId();
  if (!shadows || shadows.length === 0) return undefined;
  return `wfshadow-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
}

/** One `<filter>` chaining every shadow for an element, outer and inner alike. */
export function ShadowDefs({ id, shadows }: { id: string; shadows: ShadowSpec[] }) {
  return (
    // sRGB keeps the SourceGraphic's gradients from being quantized through a
    // linearRGB round-trip (the filter default), which shows up as banding.
    <filter id={id} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
      {shadows.map((s, i) => (s.inner ? innerShadowNodes(s, i) : outerShadowNodes(s, i)))}
      <feMerge>
        {shadows.map((s, i) => (s.inner ? null : <feMergeNode key={i} in={`shadow-${i}`} />))}
        <feMergeNode in="SourceGraphic" />
        {shadows.map((s, i) => (s.inner ? <feMergeNode key={i} in={`shadow-${i}`} /> : null))}
      </feMerge>
    </filter>
  );
}

function outerShadowNodes(s: ShadowSpec, i: number) {
  const flood = `flood-${i}`;
  const color = `color-${i}`;
  const spread = `spread-${i}`;
  const blur = `blur-${i}`;
  return (
    <Fragment key={i}>
      <feFlood floodColor={s.color} floodOpacity={s.opacity} result={flood} />
      <feComposite in={flood} in2="SourceAlpha" operator="in" result={color} />
      {s.spread !== 0 ? (
        <feMorphology
          in={color}
          operator={s.spread > 0 ? 'dilate' : 'erode'}
          radius={Math.abs(s.spread)}
          result={spread}
        />
      ) : null}
      <feGaussianBlur in={s.spread !== 0 ? spread : color} stdDeviation={s.blur / 2} result={blur} />
      <feOffset in={blur} dx={s.offsetX} dy={s.offsetY} result={`shadow-${i}`} />
    </Fragment>
  );
}

function innerShadowNodes(s: ShadowSpec, i: number) {
  const flood = `iflood-${i}`;
  const outside = `icolor-${i}`;
  const spread = `ispread-${i}`;
  const blur = `iblur-${i}`;
  const offset = `ioffset-${i}`;
  return (
    <Fragment key={i}>
      <feFlood floodColor={s.color} floodOpacity={s.opacity} result={flood} />
      <feComposite in={flood} in2="SourceAlpha" operator="out" result={outside} />
      {s.spread !== 0 ? (
        <feMorphology
          in={outside}
          operator={s.spread >= 0 ? 'erode' : 'dilate'}
          radius={Math.abs(s.spread)}
          result={spread}
        />
      ) : null}
      <feGaussianBlur in={s.spread !== 0 ? spread : outside} stdDeviation={s.blur / 2} result={blur} />
      <feOffset in={blur} dx={s.offsetX} dy={s.offsetY} result={offset} />
      <feComposite in={offset} in2="SourceAlpha" operator="in" result={`shadow-${i}`} />
    </Fragment>
  );
}
