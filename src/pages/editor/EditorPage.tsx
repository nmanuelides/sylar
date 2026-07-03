import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getDevice } from '@/data/devices';
import { ensureFontLoaded, registerCustomFont } from '@/data/fonts';
import { useEditor } from '@/store/editorStore';
import { PREVIEW_DATA } from '@/store/liveDataStore';
import { loadProject } from '@/services/projectService';
import { toast } from '@/store/toastStore';
import { WatchfaceSVG } from '@/components/watchface/WatchfaceSVG';
import { LeftPanel } from './panels/LeftPanel';
import { RightPanel } from './panels/RightPanel';
import { CanvasArea } from './canvas/CanvasArea';
import { PreviewModal } from './modals/PreviewModal';
import { ExportModal } from './modals/ExportModal';
import { useShortcuts } from './hooks/useShortcuts';
import './editor.scss';

export function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const project = useEditor((s) => s.project);
  const setProject = useEditor((s) => s.setProject);
  useShortcuts();

  useEffect(() => {
    if (!id || id === project.id) return;
    loadProject(id)
      .then((loaded) => {
        if (loaded) setProject(loaded);
        else toast('Watchface not found', 'error');
      })
      .catch((err) =>
        toast(`Failed to load: ${err instanceof Error ? err.message : 'unknown'}`, 'error'),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Register uploaded fonts, then load every Google Font the project references
  useEffect(() => {
    for (const font of project.fonts ?? []) registerCustomFont(font.family, font.src);
    for (const el of [...project.normal, ...project.aod]) {
      if ('fontFamily' in el) ensureFontLoaded(el.fontFamily);
      if (el.type === 'complication') {
        if (el.valueFont) ensureFontLoaded(el.valueFont);
        if (el.labelFont) ensureFontLoaded(el.labelFont);
      }
    }
  }, [project]);

  const device = getDevice(project.deviceId);

  return (
    <motion.div
      className="editor"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <LeftPanel />
      <CanvasArea />
      <RightPanel />
      <PreviewModal />
      <ExportModal />
      {/* Hidden render used for save thumbnails */}
      <div className="offscreen" id="thumb-render" style={{ width: 240, height: (240 * device.height) / device.width }}>
        <WatchfaceSVG
          device={device}
          elements={project.normal}
          background={project.backgroundColor}
          data={PREVIEW_DATA}
          width={240}
        />
      </div>
    </motion.div>
  );
}
