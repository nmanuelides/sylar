import type { WatchElement } from '@/types/watchface';

// Zepp OS TEXT widgets can't both stay "live" and rotate, so an element with
// rotateWith set takes the rotating-baked-snapshot export path instead (see
// generator.tsx's renderRotatingElement) rather than the live-updating path.
export const isLiveText = (el: WatchElement): boolean =>
  (el.type === 'digitalTime' || el.type === 'number') && !el.rotateWith;

/**
 * Whether this element can carry a shadow at all once exported to Zepp OS.
 * Live text (digitalTime/number without rotateWith) renders as a bare native
 * TEXT widget with zero backing image — there's nothing to attach a shadow
 * to on the actual device, even though the editor preview can draw one.
 */
export const supportsShadow = (el: WatchElement): boolean => !isLiveText(el);

/**
 * Whether a shadow on this element only reaches its static chrome
 * (a progress bar's track, a complication's ring/label) — never the
 * live-updating fill or value, which is a separate native widget.
 */
export const hasPartialShadowSupport = (el: WatchElement): boolean =>
  el.type === 'progressBar' || el.type === 'complication';
