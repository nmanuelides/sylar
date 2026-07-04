import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { getDevice } from '@/data/devices';
import { useEditor } from '@/store/editorStore';
import { trackPointer } from '@/lib/drag';
import { Svg, UI_ICONS } from '@/components/common/Ui';
import { CanvasToolbar } from './CanvasToolbar';
import { WatchCanvas } from './WatchCanvas';
import { Ruler } from './Rulers';

const STAGE_PAD = 70;

const FEATURES = [
  { icon: UI_ICONS.drag, title: 'Drag & Drop', text: 'Place components anywhere on the canvas' },
  { icon: UI_ICONS.fit, title: 'Fully customizable', text: 'Resize, rotate and layer elements freely' },
  { icon: UI_ICONS.play, title: 'Live preview', text: 'Watch data ticks in real time' },
  { icon: UI_ICONS.export, title: 'Export & share', text: 'Export your design and share it' },
];

export function CanvasArea() {
  const deviceId = useEditor((s) => s.project.deviceId);
  const mode = useEditor((s) => s.mode);
  const zoom = useEditor((s) => s.zoom);
  const setZoom = useEditor((s) => s.setZoom);
  const device = getDevice(deviceId);
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageInnerRef = useRef<HTMLDivElement>(null);
  const [rulerState, setRulerState] = useState({ w: 0, h: 0, ox: 0, oy: 0 });

  const syncRulers = useCallback(() => {
    const viewport = viewportRef.current;
    const inner = stageInnerRef.current;
    if (!viewport || !inner) return;
    const vr = viewport.getBoundingClientRect();
    const ir = inner.getBoundingClientRect();
    setRulerState({ w: vr.width, h: vr.height, ox: ir.left - vr.left, oy: ir.top - vr.top });
  }, []);

  const fit = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const z = Math.min(
      (viewport.clientWidth - STAGE_PAD * 2) / device.width,
      (viewport.clientHeight - STAGE_PAD * 2) / device.height,
    );
    setZoom(Math.max(0.15, z));
  }, [device.width, device.height, setZoom]);

  useLayoutEffect(() => {
    fit();
  }, [fit]);

  useLayoutEffect(() => {
    syncRulers();
  }, [syncRulers, zoom, deviceId]);

  // Clicking anywhere in the canvas area that isn't an element (empty margin,
  // rulers, the space around the device) clears the selection. Element/canvas
  // background clicks are handled first and stop propagation before this fires.
  const onOutsidePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    useEditor.getState().clearSelection();
  }, []);

  // Middle-mouse drag pans the canvas
  const onViewportPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 1) return;
    e.preventDefault();
    const viewport = viewportRef.current;
    if (!viewport) return;
    const startLeft = viewport.scrollLeft;
    const startTop = viewport.scrollTop;
    viewport.classList.add('is-panning');
    trackPointer(
      e,
      (dx, dy) => {
        viewport.scrollLeft = startLeft - dx;
        viewport.scrollTop = startTop - dy;
      },
      () => viewport.classList.remove('is-panning'),
    );
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(syncRulers);
    observer.observe(viewport);
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const current = useEditor.getState().zoom;
      useEditor.getState().setZoom(current * (1 - e.deltaY * 0.0015));
    };
    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      observer.disconnect();
      viewport.removeEventListener('wheel', onWheel);
    };
  }, [syncRulers]);

  return (
    <div className={`canvas-area ${mode === 'aod' ? 'is-aod' : ''}`}>
      <CanvasToolbar onFit={fit} />
      <div className="canvas-area__viewport-wrap" onPointerDown={onOutsidePointerDown}>
        <div
          className="canvas-area__viewport"
          ref={viewportRef}
          onScroll={syncRulers}
          onPointerDown={onViewportPointerDown}
        >
          <div
            className="canvas-area__stage"
            style={{
              width: device.width * zoom + STAGE_PAD * 2,
              height: device.height * zoom + STAGE_PAD * 2 + 40,
            }}
          >
            <div
              className="canvas-area__stage-inner"
              ref={stageInnerRef}
              style={{ left: STAGE_PAD, top: STAGE_PAD }}
            >
              <WatchCanvas />
            </div>
            <div
              className="canvas-area__size-chip"
              style={{ top: STAGE_PAD + device.height * zoom + 12 }}
            >
              <Svg d={UI_ICONS.grid} size={12} />
              {device.width} × {device.height}
            </div>
          </div>
        </div>
        <Ruler
          orientation="h"
          viewportPx={rulerState.w}
          origin={rulerState.ox}
          zoom={zoom}
          canvasLength={device.width}
        />
        <Ruler
          orientation="v"
          viewportPx={rulerState.h}
          origin={rulerState.oy}
          zoom={zoom}
          canvasLength={device.height}
        />
        <span className="canvas-area__ruler-corner" />
        {mode === 'aod' && (
          <motion.span
            className="canvas-area__aod-badge"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Svg d={UI_ICONS.moon} size={12} />
            Always-On Display
          </motion.span>
        )}
      </div>
      <div className="canvas-area__tipbar">
        <span className="canvas-area__tip-key">TIP</span>
        Drag & drop components to the canvas. Resize and rotate freely. Hold Shift for 15° rotation steps.
      </div>
      <div className="canvas-area__features">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
            className="canvas-area__feature"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.08 }}
          >
            <span className="canvas-area__feature-icon">
              <Svg d={f.icon} size={18} />
            </span>
            <span>
              <strong>{f.title}</strong>
              <small>{f.text}</small>
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
