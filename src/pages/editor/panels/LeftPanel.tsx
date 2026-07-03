import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createIconElement, LIBRARY, type LibraryCategory, type LibraryItem } from '@/data/library';
import { registerCustomFont } from '@/data/fonts';
import { buildImageElement } from '@/lib/imageElement';
import { IconPicker } from '@/components/common/IconPicker';
import { getDevice } from '@/data/devices';
import { useEditor } from '@/store/editorStore';
import { PREVIEW_DATA } from '@/store/liveDataStore';
import { toast } from '@/store/toastStore';
import { uid } from '@/lib/uid';
import { ElementNode } from '@/components/watchface/renderers';
import { Svg, UI_ICONS } from '@/components/common/Ui';

const CATEGORIES: { id: LibraryCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'complications', label: 'Complications' },
  { id: 'hands', label: 'Hands' },
  { id: 'text', label: 'Text' },
  { id: 'bars', label: 'Bars' },
  { id: 'marks', label: 'Marks' },
  { id: 'icons', label: 'Icons' },
];

const CATEGORY_TITLES: Record<LibraryCategory, string> = {
  complications: 'Complications',
  hands: 'Hands',
  text: 'Text & Numbers',
  bars: 'Progress Bars',
  marks: 'Tick Marks',
  icons: 'Icons',
};

function ItemPreview({ item }: { item: LibraryItem }) {
  const el = useMemo(() => item.create(0, 0), [item]);
  const scale = 58 / Math.max(el.width, el.height);
  return (
    <svg viewBox="-36 -36 72 72" className="lib-card__preview">
      <g transform={`scale(${scale})`}>
        <ElementNode el={el} data={PREVIEW_DATA} />
      </g>
    </svg>
  );
}

function LibraryCard({ item, index }: { item: LibraryItem; index: number }) {
  const addAtCenter = () => {
    const { project } = useEditor.getState();
    const device = getDevice(project.deviceId);
    useEditor.getState().addElement(item.create(device.width / 2, device.height / 2));
  };
  return (
    <motion.button
      className="lib-card"
      draggable
      onDragStart={(e) => {
        const de = e as unknown as React.DragEvent;
        de.dataTransfer?.setData('application/x-sylar-item', item.id);
      }}
      onClick={addAtCenter}
      title={`${item.label} — click or drag onto the canvas`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.3) }}
      whileHover={{ y: -3, boxShadow: '0 6px 20px rgba(30,155,255,0.18)' }}
      whileTap={{ scale: 0.95 }}
    >
      <ItemPreview item={item} />
      <span className="lib-card__label">{item.label}</span>
    </motion.button>
  );
}

function ComponentsTab() {
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<LibraryCategory | 'all'>('all');
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  const filtered = LIBRARY.filter(
    (i) =>
      (cat === 'all' || i.category === cat) &&
      i.label.toLowerCase().includes(query.toLowerCase()),
  );
  const groups = new Map<LibraryCategory, LibraryItem[]>();
  for (const item of filtered) {
    const list = groups.get(item.category) ?? [];
    list.push(item);
    groups.set(item.category, list);
  }

  return (
    <>
      <div className="left-panel__search">
        <Svg d={UI_ICONS.search} size={14} />
        <input
          placeholder="Search components"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="left-panel__cats">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            className={cat === c.id ? 'is-active' : ''}
            onClick={() => setCat(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="left-panel__scroll">
        {[...groups.entries()].map(([category, items]) => (
          <section key={category} className="left-panel__group">
            <h3>{CATEGORY_TITLES[category]}</h3>
            <div className="left-panel__grid">
              {items.map((item, i) => (
                <LibraryCard key={item.id} item={item} index={i} />
              ))}
            </div>
            {category === 'icons' && (
              <button
                className="btn btn--outline left-panel__more-icons"
                onClick={() => setIconPickerOpen(true)}
              >
                <Svg d={UI_ICONS.search} size={13} />
                Browse all icons
              </button>
            )}
          </section>
        ))}
        {filtered.length === 0 && <p className="left-panel__empty">No components match “{query}”.</p>}
      </div>
      <IconPicker
        open={iconPickerOpen}
        onClose={() => setIconPickerOpen(false)}
        onPick={(name, glyph) => {
          const { project } = useEditor.getState();
          const device = getDevice(project.deviceId);
          useEditor
            .getState()
            .addElement(createIconElement(device.width / 2, device.height / 2, name, glyph));
        }}
      />
    </>
  );
}

function AssetsTab() {
  const assets = useEditor((s) => s.project.assets);
  const removeAsset = useEditor((s) => s.removeAsset);
  const fonts = useEditor((s) => s.project.fonts ?? []);
  const removeFont = useEditor((s) => s.removeFont);
  const addFont = useEditor((s) => s.addFont);
  const fontInputRef = useRef<HTMLInputElement>(null);

  const onFontFiles = (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!/\.(ttf|otf|woff2?)$/i.test(file.name)) {
        toast(`${file.name} is not a TTF/OTF font`, 'error');
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast(`${file.name} is over 5 MB`, 'error');
        continue;
      }
      const family = file.name
        .replace(/\.(ttf|otf|woff2?)$/i, '')
        .replace(/[_-]+/g, ' ')
        .replace(/[^\w ]/g, '')
        .trim();
      if (!family) continue;
      if (fonts.some((f) => f.family.toLowerCase() === family.toLowerCase())) {
        toast(`Font “${family}” is already uploaded`, 'info');
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const src = String(reader.result);
        registerCustomFont(family, src);
        addFont({ id: uid(), family, src });
        toast(`Font “${family}” added`, 'success');
      };
      reader.readAsDataURL(file);
    }
  };

  const addAssetAtCenter = (asset: (typeof assets)[number]) => {
    const { project } = useEditor.getState();
    const device = getDevice(project.deviceId);
    buildImageElement(
      asset,
      device.width / 2,
      device.height / 2,
      Math.min(device.width, device.height) * 0.6,
      (el) => useEditor.getState().addElement(el),
    );
  };

  return (
    <div className="left-panel__scroll">
      <section className="left-panel__group">
        <h3>Custom Fonts</h3>
        <p className="left-panel__hint">
          Upload TTF or OTF files — they appear under “My Fonts” in every font dropdown and are
          embedded in your project.
        </p>
        {fonts.map((font) => (
          <div key={font.id} className="font-row">
            <span className="font-row__preview" style={{ fontFamily: `'${font.family}'` }}>
              Ag 10:08
            </span>
            <span className="font-row__name">{font.family}</span>
            <button
              className="icon-btn font-row__delete"
              title="Remove font"
              onClick={() => removeFont(font.id)}
            >
              <Svg d={UI_ICONS.trash} size={13} />
            </button>
          </div>
        ))}
        <input
          ref={fontInputRef}
          type="file"
          accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf"
          multiple
          hidden
          onChange={(e) => {
            onFontFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <button
          className="btn btn--outline left-panel__more-icons"
          onClick={() => fontInputRef.current?.click()}
        >
          <Svg d={UI_ICONS.upload} size={13} />
          Upload font
        </button>
      </section>
      <section className="left-panel__group">
        <h3>Images</h3>
      </section>
      <p className="left-panel__hint">
        Upload PNG, JPG or SVG images and click them to place on the canvas — perfect for custom
        backgrounds, hands and icons.
      </p>
      <div className="left-panel__assets">
        <AnimatePresence>
          {assets.map((asset) => (
            <motion.div
              key={asset.id}
              className="asset-card"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              whileHover={{ y: -2 }}
            >
              <button
                className="asset-card__img"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/x-sylar-asset', asset.id);
                }}
                onClick={() => addAssetAtCenter(asset)}
                title="Click or drag onto the canvas"
              >
                <img src={asset.src} alt={asset.name} draggable={false} />
              </button>
              <span className="asset-card__name">{asset.name}</span>
              <button
                className="asset-card__delete icon-btn"
                onClick={() => removeAsset(asset.id)}
                title="Remove asset"
              >
                <Svg d={UI_ICONS.trash} size={13} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {assets.length === 0 && <p className="left-panel__empty">No assets uploaded yet.</p>}
    </div>
  );
}

export function LeftPanel() {
  const [tab, setTab] = useState<'components' | 'assets'>('components');
  const open = useEditor((s) => s.leftPanelOpen);
  const addAsset = useEditor((s) => s.addAsset);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        toast(`${file.name} is not an image`, 'error');
        continue;
      }
      if (file.size > 2 * 1024 * 1024) {
        toast(`${file.name} is over 2 MB — please use smaller assets`, 'error');
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        addAsset({ id: uid(), name: file.name, src: String(reader.result) });
        toast(`Added ${file.name}`, 'success');
        setTab('assets');
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <aside className={`left-panel ${open ? 'is-open' : ''}`}>
      <div className="panel-tabs">
        <button className={tab === 'components' ? 'is-active' : ''} onClick={() => setTab('components')}>
          Components
        </button>
        <button className={tab === 'assets' ? 'is-active' : ''} onClick={() => setTab('assets')}>
          Assets
        </button>
      </div>
      {tab === 'components' ? <ComponentsTab /> : <AssetsTab />}
      <div className="left-panel__footer">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            onFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <button className="btn btn--outline left-panel__upload" onClick={() => fileRef.current?.click()}>
          <Svg d={UI_ICONS.upload} size={14} />
          Upload asset
        </button>
      </div>
    </aside>
  );
}
