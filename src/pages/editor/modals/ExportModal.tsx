import { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { getDevice } from '@/data/devices';
import { useEditor } from '@/store/editorStore';
import { PREVIEW_DATA } from '@/store/liveDataStore';
import { toast } from '@/store/toastStore';
import { downloadDataUrl, downloadJson, slugify } from '@/lib/download';
import { WatchfaceSVG } from '@/components/watchface/WatchfaceSVG';
import { Modal, Svg, UI_ICONS } from '@/components/common/Ui';
import './modals.scss';

export function ExportModal() {
  const open = useEditor((s) => s.exportOpen);
  const setOpen = useEditor((s) => s.setExportOpen);
  const project = useEditor((s) => s.project);
  const device = getDevice(project.deviceId);
  const normalRef = useRef<HTMLDivElement>(null);
  const aodRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const exportPng = async (aod: boolean) => {
    const node = (aod ? aodRef : normalRef).current;
    if (!node) return;
    setBusy(true);
    try {
      const dataUrl = await toPng(node, {
        width: device.width,
        height: device.height,
        pixelRatio: 1,
      });
      downloadDataUrl(dataUrl, `${slugify(project.name)}${aod ? '-aod' : ''}.png`);
      toast('PNG exported', 'success');
    } catch (err) {
      toast(`Export failed: ${err instanceof Error ? err.message : 'unknown'}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const exportJson = () => {
    downloadJson(
      { format: 'sylar-watchface', version: 1, exportedAt: new Date().toISOString(), project },
      `${slugify(project.name)}.sylar.json`,
    );
    toast('Project JSON exported', 'success');
  };

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Export watchface" width={520}>
      <div className="export">
        <div className="export__row">
          <div>
            <h4>Project file (.json)</h4>
            <p>Full design data — layers, assets and both display modes. Re-importable later.</p>
          </div>
          <button className="btn btn--primary" onClick={exportJson}>
            <Svg d={UI_ICONS.export} size={13} />
            JSON
          </button>
        </div>
        <div className="export__row">
          <div>
            <h4>Watchface render (.png)</h4>
            <p>
              {device.width}×{device.height} raster of the active design.
            </p>
          </div>
          <button className="btn btn--outline" disabled={busy} onClick={() => exportPng(false)}>
            PNG
          </button>
        </div>
        <div className="export__row">
          <div>
            <h4>AOD render (.png)</h4>
            <p>Always-On Display variant{project.aod.length === 0 ? ' (currently empty)' : ''}.</p>
          </div>
          <button
            className="btn btn--outline"
            disabled={busy || project.aod.length === 0}
            onClick={() => exportPng(true)}
          >
            PNG
          </button>
        </div>
        <p className="export__note">
          Compiling to an installable Amazfit <code>.bin</code>/<code>.wfz</code> is on the roadmap —
          the JSON format keeps every property needed for it.
        </p>
      </div>

      {/* Off-screen render targets at native device resolution */}
      <div className="offscreen">
        <div ref={normalRef} style={{ width: device.width, height: device.height }}>
          <WatchfaceSVG
            device={device}
            elements={project.normal}
            background={project.backgroundColor}
            data={PREVIEW_DATA}
            width={device.width}
          />
        </div>
        <div ref={aodRef} style={{ width: device.width, height: device.height }}>
          <WatchfaceSVG
            device={device}
            elements={project.aod}
            background={project.aodBackgroundColor}
            data={PREVIEW_DATA}
            width={device.width}
          />
        </div>
      </div>
    </Modal>
  );
}
