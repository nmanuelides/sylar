import { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import QRCode from 'qrcode';
import { motion } from 'framer-motion';
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
  const [installStep, setInstallStep] = useState<string | null>(null);
  const [installQr, setInstallQr] = useState<{ qr: string; url: string } | null>(null);
  const [exportWarnings, setExportWarnings] = useState<string[]>([]);
  const buildServer = (import.meta.env.VITE_BUILD_SERVER_URL as string | undefined)?.replace(
    /\/$/,
    '',
  );

  const installOnWatch = async () => {
    if (!buildServer) return;
    setInstallQr(null);
    setExportWarnings([]);
    try {
      setInstallStep('Rendering…');
      const { zip, warnings } = await generateZeppProject(project, setInstallStep);
      setExportWarnings(warnings);
      setInstallStep('Compiling on server…');
      const res = await fetch(
        `${buildServer}/api/build?mode=qr&res=${device.width}x${device.height}`,
        {
        method: 'POST',
        headers: { 'Content-Type': 'application/zip' },
        body: zip as unknown as BodyInit,
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(detail.error ?? res.statusText);
      }
      const { url } = (await res.json()) as { url: string };
      const qr = await QRCode.toDataURL(url, {
        width: 232,
        margin: 1,
        color: { dark: '#04121f', light: '#eaf6ff' },
      });
      setInstallQr({ qr, url });
    } catch (err) {
      toast(`Install build failed: ${err instanceof Error ? err.message : 'unknown'}`, 'error');
    } finally {
      setInstallStep(null);
    }
  };

  const exportZepp = async () => {
    setZeppStep('Preparing…');
    setExportWarnings([]);
    try {
      const { zip, filename, warnings } = await generateZeppProject(project, setZeppStep);
      setExportWarnings(warnings);
      const url = URL.createObjectURL(
        new Blob([zip as unknown as BlobPart], { type: 'application/zip' }),
      );
      downloadDataUrl(url, filename);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast(
        warnings.length
          ? `Zepp OS project exported with ${warnings.length} warning(s) — see below`
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
        {buildServer ? (
          <div className="export__row export__row--primary">
            <div>
              <h4>Install on watch</h4>
              <p>
                Compiles the watchface and shows a QR code — scan it with the Zepp app (developer
                mode) to install. No tools needed.
              </p>
            </div>
            <button
              className="btn btn--primary"
              disabled={installStep !== null}
              onClick={installOnWatch}
            >
              <Svg d={UI_ICONS.export} size={13} />
              {installStep ?? 'Install'}
            </button>
          </div>
        ) : (
          <p className="export__note">
            Tip: run the bundled build server (see <code>server/README.md</code>) and set{' '}
            <code>VITE_BUILD_SERVER_URL</code> to get a one-click “Install on watch” QR here.
          </p>
        )}
        {installQr && (
          <motion.div
            className="export__qr"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <img src={installQr.qr} alt="Install QR code" />
            <div>
              <h4>Scan with the Zepp app</h4>
              <ol>
                <li>Zepp app → Profile → enable Developer Mode (one-time)</li>
                <li>Open the scanner in Developer Mode</li>
                <li>Scan this code — the watchface installs over Bluetooth</li>
              </ol>
              <p className="export__note">Served by your Sylar build server · {installQr.url}</p>
            </div>
          </motion.div>
        )}
        {exportWarnings.length > 0 && (
          <motion.div
            className="export__warnings"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h4>
              {exportWarnings.length} export warning{exportWarnings.length > 1 ? 's' : ''}
            </h4>
            <ul>
              {exportWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </motion.div>
        )}
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
