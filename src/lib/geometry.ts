import type { WatchElement } from '@/types/watchface';

export const deg2rad = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Rotation pivot offset from the element's center, in canvas units.
 * Only images have a configurable pivot; everything else rotates around center.
 */
export function pivotOffset(el: WatchElement): { x: number; y: number } {
  if (el.type === 'image') {
    return {
      x: ((el.pivotX ?? 0.5) - 0.5) * el.width,
      y: ((el.pivotY ?? 0.5) - 0.5) * el.height,
    };
  }
  return { x: 0, y: 0 };
}

export const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));

/** Rotate a vector by `deg` degrees */
export function rotateVec(x: number, y: number, deg: number): { x: number; y: number } {
  const r = deg2rad(deg);
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: x * c - y * s, y: x * s + y * c };
}

/** Point on a circle. Angle in degrees, 0 = 12 o'clock, clockwise. */
export function polar(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  const a = deg2rad(angleDeg - 90);
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

/** SVG arc path from startAngle to endAngle (deg, clockwise from 12 o'clock). */
export function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const sweep = Math.min(endAngle - startAngle, 359.99);
  const start = polar(cx, cy, r, startAngle);
  const end = polar(cx, cy, r, startAngle + sweep);
  const large = sweep > 180 ? 1 : 0;
  return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${r} ${r} 0 ${large} 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`;
}
