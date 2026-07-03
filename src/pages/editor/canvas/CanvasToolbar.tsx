import { DEVICES, getDevice } from '@/data/devices';
import { useEditor } from '@/store/editorStore';
import { Svg, Switch, UI_ICONS } from '@/components/common/Ui';

export function CanvasToolbar({ onFit }: { onFit: () => void }) {
  const project = useEditor((s) => s.project);
  const mode = useEditor((s) => s.mode);
  const zoom = useEditor((s) => s.zoom);
  const showGrid = useEditor((s) => s.showGrid);
  const snap = useEditor((s) => s.snap);
  const setDevice = useEditor((s) => s.setDevice);
  const setMode = useEditor((s) => s.setMode);
  const setZoom = useEditor((s) => s.setZoom);
  const toggleGrid = useEditor((s) => s.toggleGrid);
  const toggleSnap = useEditor((s) => s.toggleSnap);
  const renameProject = useEditor((s) => s.renameProject);
  const setLeftPanelOpen = useEditor((s) => s.setLeftPanelOpen);
  const setRightPanelOpen = useEditor((s) => s.setRightPanelOpen);
  const leftPanelOpen = useEditor((s) => s.leftPanelOpen);
  const rightPanelOpen = useEditor((s) => s.rightPanelOpen);
  const device = getDevice(project.deviceId);

  return (
    <div className="canvas-toolbar">
      <div className="canvas-toolbar__group canvas-toolbar__group--left">
        <button
          className={`icon-btn canvas-toolbar__panel-toggle ${leftPanelOpen ? 'is-active' : ''}`}
          onClick={() => setLeftPanelOpen(!leftPanelOpen)}
          title="Components panel"
        >
          <Svg d={UI_ICONS.panelLeft} />
        </button>
        <input
          className="canvas-toolbar__name"
          value={project.name}
          onChange={(e) => renameProject(e.target.value)}
          spellCheck={false}
          aria-label="Watchface name"
        />
        <span className="canvas-toolbar__device-label">Device:</span>
        <select
          className="canvas-toolbar__device"
          value={project.deviceId}
          onChange={(e) => setDevice(e.target.value)}
        >
          {DEVICES.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} · {d.screen} {d.width}×{d.height}
            </option>
          ))}
        </select>
      </div>

      <div className="canvas-toolbar__group canvas-toolbar__group--center">
        <span className="canvas-toolbar__aod">
          <Svg d={UI_ICONS.moon} size={13} />
          <Switch checked={mode === 'aod'} onChange={(v) => setMode(v ? 'aod' : 'normal')} label="AOD" />
        </span>
      </div>

      <div className="canvas-toolbar__group canvas-toolbar__group--right">
        <button
          className={`icon-btn ${showGrid ? 'is-active' : ''}`}
          onClick={toggleGrid}
          title="Toggle grid (Ctrl+G)"
        >
          <Svg d={UI_ICONS.grid} />
        </button>
        <button
          className={`icon-btn ${snap ? 'is-active' : ''}`}
          onClick={toggleSnap}
          title="Snap to grid"
        >
          <Svg d={UI_ICONS.magnet} />
        </button>
        <span className="canvas-toolbar__sep" />
        <button className="icon-btn" onClick={() => setZoom(zoom - 0.1)} title="Zoom out">
          <Svg d={UI_ICONS.zoomOut} />
        </button>
        <span className="canvas-toolbar__zoom">{Math.round(zoom * 100)}%</span>
        <button className="icon-btn" onClick={() => setZoom(zoom + 0.1)} title="Zoom in">
          <Svg d={UI_ICONS.zoomIn} />
        </button>
        <button className="icon-btn" onClick={onFit} title={`Fit ${device.name} to view`}>
          <Svg d={UI_ICONS.fit} />
        </button>
        <button
          className={`icon-btn canvas-toolbar__panel-toggle ${rightPanelOpen ? 'is-active' : ''}`}
          onClick={() => setRightPanelOpen(!rightPanelOpen)}
          title="Layers & properties"
        >
          <Svg d={UI_ICONS.panelRight} />
        </button>
      </div>
    </div>
  );
}
