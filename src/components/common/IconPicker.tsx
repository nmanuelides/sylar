import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { Glyph } from '@/data/icons';
import { Modal, Svg, UI_ICONS } from './Ui';
import './iconpicker.scss';

interface PickerIcon extends Glyph {
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (name: string, glyph: Glyph) => void;
}

const MAX_SHOWN = 240;

let catalogCache: PickerIcon[] | null = null;

async function loadCatalog(): Promise<PickerIcon[]> {
  if (catalogCache) return catalogCache;
  // Lazy-load the full Font Awesome solid set (~1.4k icons) only when the picker opens
  const mod = await import('@fortawesome/free-solid-svg-icons');
  const seen = new Set<string>();
  const list: PickerIcon[] = [];
  for (const value of Object.values(mod)) {
    const def = value as { iconName?: string; icon?: [number, number, string[], string, string | string[]] };
    if (!def || typeof def !== 'object' || !def.iconName || !def.icon) continue;
    if (seen.has(def.iconName)) continue;
    seen.add(def.iconName);
    const path = def.icon[4];
    list.push({
      name: def.iconName,
      width: def.icon[0],
      path: Array.isArray(path) ? path.join(' ') : path,
    });
  }
  list.sort((a, b) => a.name.localeCompare(b.name));
  catalogCache = list;
  return list;
}

export function IconPicker({ open, onClose, onPick }: Props) {
  const [icons, setIcons] = useState<PickerIcon[] | null>(catalogCache);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open || icons) return;
    loadCatalog().then(setIcons);
  }, [open, icons]);

  const filtered = useMemo(() => {
    if (!icons) return [];
    const q = query.trim().toLowerCase();
    return q ? icons.filter((i) => i.name.includes(q)) : icons;
  }, [icons, query]);

  const shown = filtered.slice(0, MAX_SHOWN);

  return (
    <Modal open={open} onClose={onClose} title="Font Awesome icons" width={660}>
      <div className="icon-picker">
        <div className="icon-picker__search">
          <Svg d={UI_ICONS.search} size={14} />
          <input
            placeholder="Search icons (e.g. heart, run, weather)…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <span className="icon-picker__count">
            {icons ? `${filtered.length} icons` : 'Loading…'}
          </span>
        </div>
        <div className="icon-picker__grid">
          {shown.map((icon, i) => (
            <motion.button
              key={icon.name}
              className="icon-picker__item"
              title={icon.name}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: Math.min(i * 0.004, 0.25) }}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                onPick(icon.name, { path: icon.path, width: icon.width });
                onClose();
              }}
            >
              <svg viewBox={`0 0 ${icon.width} 512`}>
                <path d={icon.path} fill="currentColor" />
              </svg>
              <span>{icon.name}</span>
            </motion.button>
          ))}
        </div>
        {filtered.length > MAX_SHOWN && (
          <p className="icon-picker__more">
            Showing {MAX_SHOWN} of {filtered.length} — refine your search to see more.
          </p>
        )}
        {icons && filtered.length === 0 && (
          <p className="icon-picker__more">No icons match “{query}”.</p>
        )}
      </div>
    </Modal>
  );
}
