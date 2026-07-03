import { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { getDevice } from '@/data/devices';
import { useEditor } from '@/store/editorStore';
import { PREVIEW_DATA } from '@/store/liveDataStore';
import { toast } from '@/store/toastStore';
import { downloadDataUrl, downloadJson, slugify } from '@/lib/download';
import { generateZeppProject } from '@/export/zepp/generator';
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
  const [zeppStep, setZeppStep] = useState<string | null>(null);

  const exportZepp = async () => {
    setZeppStep('Preparing…');
    try {
      const { zip, filename, warnings } = await generateZeppProject(project, setZeppStep);
      const url = URL.createObjectURL(
        new Blob([zip as unknown as BlobPart], { type: 'application/zip' }),
      );
      downloadDataUrl(url, filename);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast(
        warnings.length
          ? `Zepp OS project exported with ${warnings.length} warning(s) — see README.md inside`
          : 'Zepp OS project exported',
        warnings.length ? 'info' : 'success',
      );
    } catch (err) {
      toast(`Export failed: ${err instanceof Error ? err.message : 'unknown'}`, 'error');
    } finally {
      setZeppStep(null);
    }
  };

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
        <div className="export__row export__row--primary">
          <div>
            <h4>Zepp OS project (.zip)</h4>
            <p>
              Ready-to-build watchface source for {device.name}. Unzip, run{' '}
              <code>zeus preview</code>, scan the QR with the Zepp app (developer mode) — see the
              README inside.
            </p>
          </div>
          <button className="btn btn--primary" disabled={zeppStep !== null} onClick={exportZepp}>
            <Svg d={UI_ICONS.watch} size={13} />
            {zeppStep ?? 'Zepp OS'}
          </button>
        </div>
        <p className="export__note">
          Live values (time, health, weather) are rendered by the watch; everything static is baked
          pixel-perfect at device resolution. Custom uploaded fonts ship with the project.
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
