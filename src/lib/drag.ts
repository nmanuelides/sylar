interface PointerLike {
  clientX: number;
  clientY: number;
}

/**
 * Track a pointer gesture from a pointerdown event until release.
 * onMove receives deltas in screen px plus the raw event.
 */
export function trackPointer(
  start: PointerLike,
  onMove: (dx: number, dy: number, ev: PointerEvent) => void,
  onEnd?: () => void,
): void {
  const sx = start.clientX;
  const sy = start.clientY;
  const move = (ev: PointerEvent) => onMove(ev.clientX - sx, ev.clientY - sy, ev);
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    onEnd?.();
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}
