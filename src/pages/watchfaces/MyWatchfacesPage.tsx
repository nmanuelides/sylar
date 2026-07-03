import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { ProjectSummary } from '@/types/watchface';
import { DEVICES, getDevice } from '@/data/devices';
import { createProject, useEditor } from '@/store/editorStore';
import {
  deleteProject,
  duplicateProject,
  listProjects,
  saveProject,
} from '@/services/projectService';
import { supabaseConfigured } from '@/lib/supabase';
import { PREVIEW_DATA } from '@/store/liveDataStore';
import { toast } from '@/store/toastStore';
import { WatchfaceSVG } from '@/components/watchface/WatchfaceSVG';
import { Modal, Svg, UI_ICONS } from '@/components/common/Ui';
import '../pages.scss';

function NewWatchfaceModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const setProject = useEditor((s) => s.setProject);
  const [name, setName] = useState('My watchface');
  const [deviceId, setDeviceId] = useState(DEVICES[0].id);

  const createNew = async () => {
    const project = createProject(deviceId, name.trim() || 'My watchface');
    try {
      await saveProject(project);
    } catch {
      /* saving later is fine */
    }
    setProject(project);
    onClose();
    navigate(`/create/${project.id}`);
  };

  return (
    <Modal open={open} onClose={onClose} title="New watchface" width={440}>
      <div className="new-face">
        <label className="new-face__field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <label className="new-face__field">
          <span>Device</span>
          <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
            {DEVICES.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} · {d.screen} · {d.width}×{d.height}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn--primary new-face__create" onClick={createNew}>
          <Svg d={UI_ICONS.plus} size={14} />
          Create watchface
        </button>
      </div>
    </Modal>
  );
}

export function MyWatchfacesPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const refresh = () => {
    listProjects()
      .then(setProjects)
      .catch((err) => {
        toast(`Failed to list watchfaces: ${err instanceof Error ? err.message : 'unknown'}`, 'error');
        setProjects([]);
      });
  };

  useEffect(refresh, []);

  const remove = async (id: string, name: string) => {
    if (!window.confirm(`Delete “${name}”? This cannot be undone.`)) return;
    await deleteProject(id);
    toast('Watchface deleted', 'info');
    refresh();
  };

  const duplicate = async (id: string) => {
    await duplicateProject(id);
    toast('Watchface duplicated', 'success');
    refresh();
  };

  return (
    <div className="page">
      <motion.header
        className="page__header"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h1>My Watchfaces</h1>
          <p>
            {supabaseConfigured()
              ? 'Synced with Supabase.'
              : 'Stored in this browser — add Supabase keys to sync across devices.'}
          </p>
        </div>
        <button className="btn btn--primary" onClick={() => setModalOpen(true)}>
          <Svg d={UI_ICONS.plus} size={14} />
          New watchface
        </button>
      </motion.header>

      <div className="faces-grid">
        <AnimatePresence>
          {projects?.map((p, i) => {
            const device = getDevice(p.deviceId);
            return (
              <motion.article
                key={p.id}
                className="face-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -4 }}
              >
                <button className="face-card__thumb" onClick={() => navigate(`/create/${p.id}`)}>
                  {p.project ? (
                    <WatchfaceSVG
                      device={device}
                      elements={p.project.normal}
                      background={p.project.backgroundColor}
                      data={PREVIEW_DATA}
                      className="face-card__live"
                    />
                  ) : p.thumbnail ? (
                    <img src={p.thumbnail} alt={p.name} />
                  ) : (
                    <span className="face-card__placeholder">
                      <Svg d={UI_ICONS.watch} size={42} />
                    </span>
                  )}
                </button>
                <div className="face-card__meta">
                  <h3>{p.name}</h3>
                  <p>
                    {device.name} · {new Date(p.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="face-card__actions">
                  <button className="btn btn--outline" onClick={() => navigate(`/create/${p.id}`)}>
                    Edit
                  </button>
                  <button className="icon-btn" title="Duplicate" onClick={() => duplicate(p.id)}>
                    <Svg d={UI_ICONS.copy} size={14} />
                  </button>
                  <button
                    className="icon-btn face-card__delete"
                    title="Delete"
                    onClick={() => remove(p.id, p.name)}
                  >
                    <Svg d={UI_ICONS.trash} size={14} />
                  </button>
                </div>
              </motion.article>
            );
          })}
        </AnimatePresence>

        {projects !== null && (
          <motion.button
            className="face-card face-card--new"
            onClick={() => setModalOpen(true)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (projects.length + 1) * 0.05 }}
            whileHover={{ y: -4 }}
          >
            <Svg d={UI_ICONS.plus} size={28} />
            <span>New watchface</span>
          </motion.button>
        )}
      </div>

      {projects === null && <p className="page__loading">Loading…</p>}
      <NewWatchfaceModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
