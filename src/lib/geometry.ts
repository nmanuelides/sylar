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

/** A point on a shape's boundary, plus the outward-facing direction there (Sylar angle convention: 0 = up, clockwise). */
export interface BoundaryPoint {
  x: number;
  y: number;
  angle: number;
}

/** Point on a circle boundary. t in [0,1) = fraction of the way around, clockwise from the top. */
export function circleBoundaryPoint(radius: number, t: number): BoundaryPoint {
  const angle = t * 360;
  const p = polar(0, 0, radius, angle);
  return { x: p.x, y: p.y, angle };
}

/**
 * Point on a rounded-rectangle boundary, walked clockwise starting at
 * top-center (matching circleBoundaryPoint's 0 = top convention).
 * t in [0,1). cornerRadius is clamped to fit within the rectangle.
 */
export function roundedRectBoundaryPoint(
  width: number,
  height: number,
  cornerRadius: number,
  t: number,
): BoundaryPoint {
  const halfW = width / 2;
  const halfH = height / 2;
  const r = Math.max(0, Math.min(cornerRadius, halfW, halfH));
  const straightTop = Math.max(0, width - 2 * r);
  const straightSide = Math.max(0, height - 2 * r);
  const cornerArc = (Math.PI / 2) * r;
  const perimeter = 2 * straightTop + 2 * straightSide + 4 * cornerArc;
  if (perimeter <= 0) return { x: 0, y: -halfH, angle: 0 };

  let d = (((t % 1) + 1) % 1) * perimeter;
  const corner = (startAngle: number, cx: number, cy: number): BoundaryPoint => {
    const frac = d / cornerArc;
    const a = deg2rad(startAngle - 90 + frac * 90);
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), angle: startAngle + frac * 90 };
  };

  const seg1 = straightTop / 2;
  if (d < seg1) return { x: d, y: -halfH, angle: 0 };
  d -= seg1;

  if (d < cornerArc) return corner(0, halfW - r, -halfH + r);
  d -= cornerArc;

  if (d < straightSide) return { x: halfW, y: -halfH + r + d, angle: 90 };
  d -= straightSide;

  if (d < cornerArc) return corner(90, halfW - r, halfH - r);
  d -= cornerArc;

  if (d < straightTop) return { x: halfW - r - d, y: halfH, angle: 180 };
  d -= straightTop;

  if (d < cornerArc) return corner(180, -halfW + r, halfH - r);
  d -= cornerArc;

  if (d < straightSide) return { x: -halfW, y: halfH - r - d, angle: 270 };
  d -= straightSide;

  if (d < cornerArc) return corner(270, -halfW + r, -halfH + r);
  d -= cornerArc;

  return { x: -halfW + r + d, y: -halfH, angle: 0 };
}

/** Offsets a boundary point by `dist` along its outward-normal direction (negative = inward). */
export function offsetAlongNormal(p: BoundaryPoint, dist: number): { x: number; y: number } {
  const a = deg2rad(p.angle - 90);
  return { x: p.x + dist * Math.cos(a), y: p.y + dist * Math.sin(a) };
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
