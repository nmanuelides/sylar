import { useState } from 'react';
import { motion } from 'framer-motion';
import { getDevice } from '@/data/devices';
import { useEditor } from '@/store/editorStore';
import { useLiveData } from '@/store/liveDataStore';
import { WatchfaceSVG } from '@/components/watchface/WatchfaceSVG';
import { Modal } from '@/components/common/Ui';
import './modals.scss';

export function PreviewModal() {
  const open = useEditor((s) => s.previewOpen);
  const setOpen = useEditor((s) => s.setPreviewOpen);
  const project = useEditor((s) => s.project);
  const data = useLiveData();
  const [mode, setMode] = useState<'normal' | 'aod'>('normal');
  const device = getDevice(project.deviceId);
  const aod = mode === 'aod';

  return (
    <Modal open={open} onClose={() => setOpen(false)} title={`Preview — ${project.name}`} width={560}>
      <div className="preview">
        <div className="preview__toggle segment-field">
          <button className={!aod ? 'is-active' : ''} onClick={() => setMode('normal')}>
            Active
          </button>
          <button className={aod ? 'is-active' : ''} onClick={() => setMode('aod')}>
            Always-On
          </button>
        </div>
        <motion.div
          key={mode}
          className={`preview__bezel preview__bezel--${device.shape}`}
          initial={{ opacity: 0, scale: 0.92, rotateY: 20 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          style={{ aspectRatio: `${device.width} / ${device.height}` }}
        >
          <WatchfaceSVG
            device={device}
            elements={aod ? project.aod : project.normal}
            background={aod ? project.aodBackgroundColor : project.backgroundColor}
            data={data}
            aodDim={aod}
          />
        </motion.div>
        <p className="preview__caption">
          {device.name} · {device.screen} · live data
          {aod && project.aod.length === 0 && ' — AOD layout is empty'}
        </p>
      </div>
    </Modal>
  );
}
