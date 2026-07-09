import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toPng } from 'html-to-image';
import { useEditor } from '@/store/editorStore';
import { saveProject } from '@/services/projectService';
import { supabaseConfigured } from '@/lib/supabase';
import { toast } from '@/store/toastStore';
import { Svg, UI_ICONS } from '@/components/common/Ui';
import './topbar.scss';

const NAV = [
  { to: '/create', label: 'Create' },
  { to: '/watchfaces', label: 'My Watchfaces' },
  { to: '/community', label: 'Community' },
  { to: '/docs', label: 'Docs' },
];

async function captureThumbnail(): Promise<string | undefined> {
  const node = document.getElementById('thumb-render');
  if (!node) return undefined;
  try {
    return await toPng(node, { pixelRatio: 1, cacheBust: false });
  } catch {
    return undefined;
  }
}

export function TopBar() {
  const location = useLocation();
  const isEditor = location.pathname.startsWith('/create');
  const project = useEditor((s) => s.project);
  const dirty = useEditor((s) => s.dirty);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const setPreviewOpen = useEditor((s) => s.setPreviewOpen);
  const setExportOpen = useEditor((s) => s.setExportOpen);
  const setDirty = useEditor((s) => s.setDirty);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const thumbnail = await captureThumbnail();
      await saveProject(project, thumbnail);
      setDirty(false);
      toast(
        supabaseConfigured() ? 'Saved to Supabase' : 'Saved locally (Supabase not configured)',
        'success',
      );
    } catch (err) {
      toast(`Save failed: ${err instanceof Error ? err.message : 'unknown error'}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <header className="topbar">
      <NavLink to="/watchfaces" className="topbar__brand">
        <motion.span
          className="topbar__logo"
          animate={{ rotate: 360 }}
          transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
        >
          <Svg d={UI_ICONS.watch} size={20} />
        </motion.span>
        <span className="topbar__name">
          Sylar <em>Watchface Studio</em>
        </span>
      </NavLink>

      <nav className="topbar__nav">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `topbar__link ${isActive ? 'is-active' : ''}`}
          >
            {({ isActive }) => (
              <>
                {item.label}
                {isActive && (
                  <motion.span
                    className="topbar__link-underline"
                    layoutId="nav-underline"
                    transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="topbar__actions">
        {isEditor && (
          <>
            <div className="topbar__history">
              <button className="icon-btn" disabled={!canUndo} onClick={undo} title="Undo (Ctrl+Z)">
                <Svg d={UI_ICONS.undo} />
              </button>
              <button className="icon-btn" disabled={!canRedo} onClick={redo} title="Redo (Ctrl+Y)">
                <Svg d={UI_ICONS.redo} />
              </button>
            </div>
            <button
              className={`btn btn--outline topbar__save ${dirty ? 'is-dirty' : ''}`}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save'}
              {dirty && <span className="topbar__dirty-dot" />}
            </button>
            <button className="btn btn--outline" onClick={() => setPreviewOpen(true)}>
              <Svg d={UI_ICONS.play} size={14} />
              Preview
            </button>
            <button className="btn btn--primary" onClick={() => setExportOpen(true)}>
              <Svg d={UI_ICONS.export} size={14} />
              Export
            </button>
          </>
        )}
      </div>
    </header>
  );
}
