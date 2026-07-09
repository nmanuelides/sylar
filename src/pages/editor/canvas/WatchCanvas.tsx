import { useId, useRef } from 'react';
import type { WatchElement } from '@/types/watchface';
import { getDevice } from '@/data/devices';
import { getLibraryItem } from '@/data/library';
import {
  selectBackground,
  selectCurrentElements,
  useEditor,
} from '@/store/editorStore';
import { useEffectiveLiveData } from '@/store/liveDataStore';
import { ElementNode, elementTimeRotation } from '@/components/watchface/renderers';
import { deviceShapePath } from '@/components/watchface/WatchfaceSVG';
import { GradientDef } from '@/components/watchface/gradientDefs';
import { decodeGradient, isGradientValue } from '@/lib/gradient';
import { trackPointer } from '@/lib/drag';
import { resolvePivot } from '@/lib/geometry';
import { buildImageElement } from '@/lib/imageElement';
import { SelectionOverlay } from './SelectionOverlay';

function snapValue(v: number): number {
  const { snap, showGrid, gridSize } = useEditor.getState();
  return snap && showGrid ? Math.round(v / gridSize) * gridSize : Math.round(v);
}

export function WatchCanvas() {
  const rawId = useId();
  const clipId = `canvasclip-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const gridId = `canvasgrid-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const bgId = `canvasbg-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const project = useEditor((s) => s.project);
  const mode = useEditor((s) => s.mode);
  const elements = useEditor(selectCurrentElements);
  const background = useEditor(selectBackground);
  const bgGradient = isGradientValue(background) ? decodeGradient(background) : null;
  const zoom = useEditor((s) => s.zoom);
  const showGrid = useEditor((s) => s.showGrid);
  const gridSize = useEditor((s) => s.gridSize);
  const selectedIds = useEditor((s) => s.selectedIds);
  const liveData = useEffectiveLiveData();
  const data = { ...liveData, language: project.language };
  const device = getDevice(project.deviceId);
  const wrapRef = useRef<HTMLDivElement>(null);

  const toCanvas = (clientX: number, clientY: number) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    return { x: (clientX - rect.left) / zoom, y: (clientY - rect.top) / zoom };
  };

  const onElementPointerDown = (e: React.PointerEvent, el: WatchElement) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const store = useEditor.getState();
    if (e.shiftKey) {
      store.toggleSelect(el.id);
      return;
    }
    if (!store.selectedIds.includes(el.id)) store.select([el.id]);
    if (el.locked) return;

    const ids = useEditor
      .getState()
      .selectedIds.filter((id) => {
        const target = selectCurrentElements(useEditor.getState()).find((x) => x.id === id);
        return target && !target.locked;
      });
    const starts = new Map(
      selectCurrentElements(useEditor.getState())
        .filter((x) => ids.includes(x.id))
        .map((x) => [x.id, { x: x.x, y: x.y }]),
    );
    let committed = false;
    trackPointer(e, (dx, dy) => {
      if (!committed) {
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
        useEditor.getState().commit();
        committed = true;
      }
      const z = useEditor.getState().zoom;
      useEditor.getState().updateElements([...starts.keys()], (elm) => {
        const s0 = starts.get(elm.id)!;
        return { x: snapValue(s0.x + dx / z), y: snapValue(s0.y + dy / z) };
      });
    });
  };

  const onBackgroundPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if (!e.shiftKey) useEditor.getState().clearSelection();
  };

  const onDrop = (e: React.DragEvent) => {
    const itemId = e.dataTransfer.getData('application/x-sylar-item');
    const assetId = e.dataTransfer.getData('application/x-sylar-asset');
    if (!itemId && !assetId) return;
    e.preventDefault();
    const pos = toCanvas(e.clientX, e.clientY);
    const x = snapValue(pos.x);
    const y = snapValue(pos.y);
    if (itemId) {
      const item = getLibraryItem(itemId);
      if (item) useEditor.getState().addElement(item.create(x, y));
      return;
    }
    const asset = useEditor.getState().project.assets.find((a) => a.id === assetId);
    if (!asset) return;
    buildImageElement(asset, x, y, Math.min(device.width, device.height) * 0.6, (el) =>
      useEditor.getState().addElement(el),
    );
  };

  return (
    <div
      ref={wrapRef}
      className="watch-canvas"
      style={{ width: device.width * zoom, height: device.height * zoom }}
      onDragOver={(e) => {
        if (
          e.dataTransfer.types.includes('application/x-sylar-item') ||
          e.dataTransfer.types.includes('application/x-sylar-asset')
        ) {
          e.preventDefault();
        }
      }}
      onDrop={onDrop}
    >
      <svg
        viewBox={`0 0 ${device.width} ${device.height}`}
        width={device.width * zoom}
        height={device.height * zoom}
        onPointerDown={onBackgroundPointerDown}
      >
        <defs>
          <clipPath id={clipId}>{deviceShapePath(device)}</clipPath>
          <pattern id={gridId} width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
            <path
              d={`M ${gridSize} 0 H 0 V ${gridSize}`}
              fill="none"
              stroke="#4fc3ff"
              strokeOpacity="0.16"
              strokeWidth={1 / zoom}
            />
          </pattern>
          {bgGradient && <GradientDef id={bgId} spec={bgGradient} />}
        </defs>
        <g clipPath={`url(#${clipId})`}>
          <rect
            width={device.width}
            height={device.height}
            fill={bgGradient ? `url(#${bgId})` : background}
          />
          {elements.map((el) => {
            const world = resolvePivot(el, elements);
            const pivot = { x: world.x - el.x, y: world.y - el.y };
            return (
              <g
                key={el.id}
                onPointerDown={(e) => onElementPointerDown(e, el)}
                style={{
                  cursor: el.locked ? 'default' : 'move',
                  display: el.visible ? undefined : 'none',
                }}
                className={selectedIds.includes(el.id) ? 'is-selected' : undefined}
              >
                <ElementNode el={{ ...el, visible: true }} data={data} allElements={elements} />
                {/* generous invisible hit area for thin elements */}
                <g
                  transform={`translate(${el.x} ${el.y}) rotate(${
                    el.rotation + elementTimeRotation(el, data)
                  } ${pivot.x} ${pivot.y})`}
                >
                  <rect
                    x={-Math.max(el.width, 16) / 2}
                    y={-Math.max(el.height, 16) / 2}
                    width={Math.max(el.width, 16)}
                    height={Math.max(el.height, 16)}
                    fill="transparent"
                  />
                </g>
              </g>
            );
          })}
          {mode === 'aod' && (
            <rect
              width={device.width}
              height={device.height}
              fill="rgba(0,0,0,0.22)"
              pointerEvents="none"
            />
          )}
          {showGrid && (
            <g pointerEvents="none">
              <rect width={device.width} height={device.height} fill={`url(#${gridId})`} />
              <line
                x1={device.width / 2}
                y1={0}
                x2={device.width / 2}
                y2={device.height}
                stroke="#4fc3ff"
                strokeOpacity="0.35"
                strokeWidth={1 / zoom}
                strokeDasharray={`${6 / zoom} ${6 / zoom}`}
              />
              <line
                x1={0}
                y1={device.height / 2}
                x2={device.width}
                y2={device.height / 2}
                stroke="#4fc3ff"
                strokeOpacity="0.35"
                strokeWidth={1 / zoom}
                strokeDasharray={`${6 / zoom} ${6 / zoom}`}
              />
            </g>
          )}
        </g>
        {/* device bezel outline */}
        <g
          pointerEvents="none"
          fill="none"
          stroke="#4fc3ff"
          strokeOpacity="0.5"
          strokeWidth={2 / zoom}
        >
          {deviceShapePath(device)}
        </g>
      </svg>
      <SelectionOverlay />
      {mode === 'aod' && elements.length === 0 && (
        <div className="watch-canvas__aod-hint">
          <p>Always-On Display is empty</p>
          <button
            className="btn btn--outline"
            onClick={() => useEditor.getState().copyNormalToAod()}
          >
            Copy layout from main watchface
          </button>
        </div>
      )}
    </div>
  );
}
