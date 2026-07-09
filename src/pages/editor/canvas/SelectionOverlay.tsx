import { useRef } from 'react';
import { selectCurrentElements, useEditor } from '@/store/editorStore';
import { resolvePivot, rotateVec } from '@/lib/geometry';
import { trackPointer } from '@/lib/drag';

const HANDLE_DIRS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
type HandleDir = (typeof HANDLE_DIRS)[number];

const PROPORTIONAL_TYPES = new Set(['complication', 'icon', 'tickMarks']);

export function SelectionOverlay() {
  const elements = useEditor(selectCurrentElements);
  const selectedIds = useEditor((s) => s.selectedIds);
  const zoom = useEditor((s) => s.zoom);
  const overlayRef = useRef<HTMLDivElement>(null);

  const selected = elements.filter((el) => selectedIds.includes(el.id));
  if (selected.length === 0) return <div ref={overlayRef} className="selection-overlay" />;

  const single = selected.length === 1 && !selected[0].locked ? selected[0] : null;

  const startResize = (e: React.PointerEvent, dir: HandleDir) => {
    if (!single || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const { id, x, y, width, height, rotation, type } = single;
    const proportional =
      PROPORTIONAL_TYPES.has(type) ||
      (type === 'progressBar' && single.variant === 'circular');
    const sx = dir.includes('e') ? 1 : dir.includes('w') ? -1 : 0;
    const sy = dir.includes('s') ? 1 : dir.includes('n') ? -1 : 0;
    useEditor.getState().commit();
    trackPointer(e, (dxs, dys, ev) => {
      const z = useEditor.getState().zoom;
      const local = rotateVec(dxs / z, dys / z, -rotation);
      // Alt = resize from center (both sides move, center stays), like Photoshop
      const fromCenter = ev.altKey;
      const mult = fromCenter ? 2 : 1;
      let newW = Math.max(6, width + local.x * sx * mult);
      let newH = Math.max(6, height + local.y * sy * mult);
      if (proportional && sx !== 0 && sy !== 0) {
        newH = Math.max(6, newW * (height / width));
      }
      if (sx === 0) newW = width;
      if (sy === 0) newH = height;
      const shift = fromCenter
        ? { x: 0, y: 0 }
        : rotateVec((sx * (newW - width)) / 2, (sy * (newH - height)) / 2, rotation);
      useEditor.getState().updateElements([id], {
        width: Math.round(newW),
        height: Math.round(newH),
        x: Math.round(x + shift.x),
        y: Math.round(y + shift.y),
      });
    });
  };

  const startRotate = (e: React.PointerEvent) => {
    if (!single || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const { id } = single;
    const { x: cx, y: cy } = resolvePivot(single, elements);
    const rect = overlayRef.current!.getBoundingClientRect();
    useEditor.getState().commit();
    trackPointer(e, (_dx, _dy, ev) => {
      const z = useEditor.getState().zoom;
      const px = (ev.clientX - rect.left) / z;
      const py = (ev.clientY - rect.top) / z;
      let angle = (Math.atan2(py - cy, px - cx) * 180) / Math.PI + 90;
      angle = ev.shiftKey ? Math.round(angle / 15) * 15 : Math.round(angle);
      useEditor.getState().updateElements([id], { rotation: ((angle % 360) + 360) % 360 });
    });
  };

  return (
    <div ref={overlayRef} className="selection-overlay">
      {selected.map((el) => {
        const world = resolvePivot(el, elements);
        const px = ((world.x - (el.x - el.width / 2)) / el.width) * 100;
        const py = ((world.y - (el.y - el.height / 2)) / el.height) * 100;
        const style: React.CSSProperties = {
          left: (el.x - el.width / 2) * zoom,
          top: (el.y - el.height / 2) * zoom,
          width: el.width * zoom,
          height: el.height * zoom,
          transform: `rotate(${el.rotation}deg)`,
          transformOrigin: `${px}% ${py}%`,
        };
        const isSingle = single?.id === el.id;
        const isAnchor = selected.length > 1 && selectedIds[0] === el.id;
        const showPivot = isSingle && (!!el.pivotTargetId || px !== 50 || py !== 50);
        return (
          <div
            key={el.id}
            className={`selection-box ${el.locked ? 'is-locked' : ''} ${
              isAnchor ? 'is-anchor' : ''
            }`}
            style={style}
          >
            {isAnchor && <span className="selection-box__anchor-tag">Anchor</span>}
            {showPivot && (
              <span className="selection-box__pivot" style={{ left: `${px}%`, top: `${py}%` }} />
            )}
            {isSingle && (
              <>
                <div className="selection-box__rotate-line" />
                <button
                  className="selection-box__rotate"
                  onPointerDown={startRotate}
                  title="Rotate (Shift = 15° steps)"
                />
                {HANDLE_DIRS.map((dir) => (
                  <button
                    key={dir}
                    className={`selection-box__handle selection-box__handle--${dir}`}
                    onPointerDown={(e) => startResize(e, dir)}
                  />
                ))}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
