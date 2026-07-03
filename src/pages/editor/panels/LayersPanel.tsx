import { Reorder } from 'framer-motion';
import type { ElementType, WatchElement } from '@/types/watchface';
import { selectCurrentElements, useEditor } from '@/store/editorStore';
import { Svg, UI_ICONS } from '@/components/common/Ui';
import { ICONS } from '@/data/icons';

const TYPE_GLYPHS: Record<ElementType, string> = {
  complication: ICONS.heart,
  hand: ICONS.watch,
  digitalTime: ICONS.calendar,
  text: ICONS.message,
  number: ICONS.star,
  icon: ICONS.star,
  progressBar: ICONS.bolt,
  tickMarks: ICONS.compass,
  image: ICONS.cloud,
};

function LayerRow({ el }: { el: WatchElement }) {
  const selectedIds = useEditor((s) => s.selectedIds);
  const select = useEditor((s) => s.select);
  const toggleSelect = useEditor((s) => s.toggleSelect);
  const toggleVisible = useEditor((s) => s.toggleVisible);
  const toggleLocked = useEditor((s) => s.toggleLocked);
  const isSelected = selectedIds.includes(el.id);

  return (
    <div
      className={`layer-row ${isSelected ? 'is-selected' : ''} ${el.visible ? '' : 'is-hidden'} ${
        el.locked ? 'is-locked' : ''
      }`}
      onClick={(e) => (e.shiftKey ? toggleSelect(el.id) : select([el.id]))}
    >
      <span className="layer-row__drag">
        <Svg d={UI_ICONS.drag} size={13} />
      </span>
      <span className="layer-row__glyph">
        <svg viewBox="0 0 24 24" width={13} height={13}>
          <path d={TYPE_GLYPHS[el.type]} fill="currentColor" />
        </svg>
      </span>
      <span className="layer-row__name">{el.name}</span>
      <button
        className={`icon-btn layer-row__action layer-row__lock ${el.locked ? 'is-on' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          toggleLocked(el.id);
        }}
        title={el.locked ? 'Locked — click to unlock' : 'Unlocked — click to lock'}
      >
        <Svg d={el.locked ? UI_ICONS.lock : UI_ICONS.unlock} size={13} />
      </button>
      <button
        className="icon-btn layer-row__action layer-row__eye"
        onClick={(e) => {
          e.stopPropagation();
          toggleVisible(el.id);
        }}
        title={el.visible ? 'Hide' : 'Show'}
      >
        <Svg d={el.visible ? UI_ICONS.eye : UI_ICONS.eyeOff} size={14} />
      </button>
    </div>
  );
}

export function LayersPanel() {
  const elements = useEditor(selectCurrentElements);
  const setOrder = useEditor((s) => s.setOrder);
  const commit = useEditor((s) => s.commit);
  // Layers are shown top-most first (last in render order = top)
  const reversedIds = [...elements].reverse().map((el) => el.id);
  const byId = new Map(elements.map((el) => [el.id, el]));

  if (elements.length === 0) {
    return <p className="layers-panel__empty">No layers yet — add components from the left panel.</p>;
  }

  return (
    <Reorder.Group
      axis="y"
      values={reversedIds}
      onReorder={(ids: string[]) => setOrder([...ids].reverse())}
      className="layers-panel"
      as="div"
    >
      {reversedIds.map((id) => {
        const el = byId.get(id);
        if (!el) return null;
        return (
          <Reorder.Item
            key={id}
            value={id}
            as="div"
            onDragStart={() => commit()}
            whileDrag={{ scale: 1.02, boxShadow: '0 8px 24px rgba(0,0,0,0.45)' }}
          >
            <LayerRow el={el} />
          </Reorder.Item>
        );
      })}
    </Reorder.Group>
  );
}
