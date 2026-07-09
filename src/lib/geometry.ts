import type { WatchElement } from '@/types/watchface';

export const deg2rad = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Rotation pivot offset from the element's center, in canvas units.
 * Every element type supports a custom pivot; unset defaults to the center.
 */
export function pivotOffset(el: WatchElement): { x: number; y: number } {
  return {
    x: ((el.pivotX ?? 0.5) - 0.5) * el.width,
    y: ((el.pivotY ?? 0.5) - 0.5) * el.height,
  };
}

/**
 * World-space (canvas-unit) pivot point for an element: either its own
 * center + pivotX/pivotY-derived offset, or — when pivotTargetId is set and
 * resolvable — the exact center (x, y) of the target element. Reading only
 * the target's raw x/y (never recursing into the target's own resolvePivot)
 * makes A→B→A pivot cycles harmless by construction, not something to guard
 * against.
 */
export function resolvePivot(
  el: WatchElement,
  allElements: WatchElement[],
): { x: number; y: number } {
  if (el.pivotTargetId) {
    const target = allElements.find((e) => e.id === el.pivotTargetId);
    if (target) return { x: target.x, y: target.y };
  }
  const off = pivotOffset(el);
  return { x: el.x + off.x, y: el.y + off.y };
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

/**
 * SVG path for a regular N-gon (first vertex at the top, clockwise) inscribed
 * in a width×height box centered at the origin, with each corner rounded by
 * `cornerRadius` (clamped per-vertex to half its shortest adjacent edge so
 * radii can't overlap on small/high-radius shapes).
 */
export function roundedPolygonPath(
  sides: number,
  width: number,
  height: number,
  cornerRadius: number,
): string {
  const n = Math.max(3, Math.round(sides));
  const rx = width / 2;
  const ry = height / 2;
  const pts = Array.from({ length: n }, (_, i) => {
    const u = polar(0, 0, 1, (i * 360) / n);
    return { x: u.x * rx, y: u.y * ry };
  });
  if (cornerRadius <= 0) {
    return `M ${pts.map((p) => `${p.x} ${p.y}`).join(' L ')} Z`;
  }
  const segments: string[] = [];
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];
    const toPrev = { x: prev.x - curr.x, y: prev.y - curr.y };
    const toNext = { x: next.x - curr.x, y: next.y - curr.y };
    const lenPrev = Math.hypot(toPrev.x, toPrev.y);
    const lenNext = Math.hypot(toNext.x, toNext.y);
    const r = Math.min(cornerRadius, lenPrev / 2, lenNext / 2);
    const start = { x: curr.x + (toPrev.x / lenPrev) * r, y: curr.y + (toPrev.y / lenPrev) * r };
    const end = { x: curr.x + (toNext.x / lenNext) * r, y: curr.y + (toNext.y / lenNext) * r };
    segments.push(i === 0 ? `M ${start.x} ${start.y}` : `L ${start.x} ${start.y}`);
    segments.push(`Q ${curr.x} ${curr.y} ${end.x} ${end.y}`);
  }
  segments.push('Z');
  return segments.join(' ');
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
