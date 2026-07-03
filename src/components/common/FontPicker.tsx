import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ensureFontLoaded,
  loadFontCatalog,
  registerDynamicFamily,
  type CatalogFont,
} from '@/data/fonts';
import { Modal, Svg, UI_ICONS } from './Ui';
import './fontpicker.scss';

const CATEGORIES = ['All', 'Sans', 'Serif', 'Display', 'Handwriting', 'Mono'];
const MAX_SHOWN = 200;

interface Props {
  open: boolean;
  onClose: () => void;
  /** Currently applied family, highlighted in the list */
  current: string;
  onPick: (family: string) => void;
}

export function FontPicker({ open, onClose, current, onPick }: Props) {
  const [catalog, setCatalog] = useState<CatalogFont[] | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [selected, setSelected] = useState<CatalogFont | null>(null);

  useEffect(() => {
    if (!open || catalog) return;
    loadFontCatalog().then(setCatalog);
  }, [open, catalog]);

  const filtered = useMemo(() => {
    if (!catalog) return [];
    const q = query.trim().toLowerCase();
    return catalog.filter(
      (font) =>
        (category === 'All' || font.category === category) &&
        (!q || font.family.toLowerCase().includes(q)),
    );
  }, [catalog, query, category]);

  const shown = filtered.slice(0, MAX_SHOWN);

  const preview = (font: CatalogFont) => {
    registerDynamicFamily(font.family, font.weights);
    ensureFontLoaded(font.family);
    setSelected(font);
  };

  const apply = (font: CatalogFont) => {
    registerDynamicFamily(font.family, font.weights);
    ensureFontLoaded(font.family);
    onPick(font.family);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Google Fonts" width={640}>
      <div className="font-picker">
        <div className="font-picker__search">
          <Svg d={UI_ICONS.search} size={14} />
          <input
            placeholder="Search all Google Fonts…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <span className="font-picker__count">
            {catalog ? `${filtered.length} fonts` : 'Loading…'}
          </span>
        </div>
        <div className="font-picker__cats">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={category === cat ? 'is-active' : ''}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
        {selected && (
          <motion.div
            key={selected.family}
            className="font-picker__preview"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span
              className="font-picker__preview-sample"
              style={{ fontFamily: `'${selected.family}'` }}
            >
              10:08 · WED 12 · 7645 STEPS
            </span>
            <button className="btn btn--primary" onClick={() => apply(selected)}>
              Use {selected.family}
            </button>
          </motion.div>
        )}
        <div className="font-picker__list">
          {shown.map((font) => (
            <button
              key={font.family}
              className={`font-picker__row ${
                font.family === current ? 'is-current' : ''
              } ${font.family === selected?.family ? 'is-selected' : ''}`}
              onClick={() => preview(font)}
              onDoubleClick={() => apply(font)}
            >
              <span className="font-picker__row-name">{font.family}</span>
              <span className="font-picker__row-meta">
                {font.category} · {font.weights.length} weight{font.weights.length > 1 ? 's' : ''}
              </span>
            </button>
          ))}
        </div>
        {filtered.length > MAX_SHOWN && (
          <p className="font-picker__more">
            Showing {MAX_SHOWN} of {filtered.length} — refine your search to see more.
          </p>
        )}
        <p className="font-picker__more">Click to preview · double-click to apply</p>
      </div>
    </Modal>
  );
}
