import { useState } from 'react';
import type { ShadowSpec, WatchElement } from '@/types/watchface';
import { uid } from '@/lib/uid';
import { hasPartialShadowSupport } from '@/lib/elementClassification';
import {
  ColorField,
  FieldGroup,
  NumberField,
  SegmentField,
  SliderField,
} from '@/components/common/PropertyFields';
import { Svg, UI_ICONS } from '@/components/common/Ui';

const DEFAULT_SHADOW: Omit<ShadowSpec, 'id'> = {
  offsetX: 4,
  offsetY: 4,
  blur: 6,
  spread: 0,
  color: '#000000',
  opacity: 0.5,
  inner: false,
};

export function ShadowListField({
  el,
  patch,
  commitPatch,
  commit,
}: {
  el: WatchElement;
  patch: (p: Record<string, unknown>) => void;
  commitPatch: (p: Record<string, unknown>) => void;
  commit: () => void;
}) {
  const shadows = el.shadows ?? [];
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const updateShadow = (id: string, next: Partial<ShadowSpec>, live: boolean) => {
    const arr = shadows.map((s) => (s.id === id ? { ...s, ...next } : s));
    if (live) patch({ shadows: arr });
    else commitPatch({ shadows: arr });
  };

  const removeShadow = (id: string) => {
    commitPatch({ shadows: shadows.filter((s) => s.id !== id) });
  };

  const addShadow = () => {
    commit();
    patch({ shadows: [...shadows, { id: uid(), ...DEFAULT_SHADOW }] });
  };

  return (
    <FieldGroup title="Shadows">
      {shadows.length > 0 && hasPartialShadowSupport(el) && (
        <p className="props__note">
          Only this element's static chrome (track/ring/label) can show a shadow — the
          live-updating fill/value is a separate native widget with no shadow support.
        </p>
      )}
      {shadows.map((s) => {
        const isOpen = !collapsed[s.id];
        return (
          <div key={s.id} className="shadow-row">
            <div className="shadow-row__header">
              <button
                type="button"
                className="shadow-row__toggle"
                onClick={() => setCollapsed((prev) => ({ ...prev, [s.id]: isOpen }))}
              >
                <Svg
                  d={UI_ICONS.chevronDown}
                  size={11}
                  className={`shadow-row__chevron ${isOpen ? 'is-open' : ''}`}
                />
                <span className="theme-row__swatch" style={{ background: s.color }}>
                  <input
                    type="color"
                    value={s.color}
                    onFocus={commit}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => updateShadow(s.id, { color: e.target.value }, true)}
                  />
                </span>
                <span className="shadow-row__summary">
                  {s.inner ? 'Inner' : 'Outer'} · {s.offsetX}, {s.offsetY} · blur {s.blur}
                </span>
              </button>
              <button
                type="button"
                className="icon-btn theme-row__delete"
                title="Remove shadow"
                onClick={() => removeShadow(s.id)}
              >
                <Svg d={UI_ICONS.trash} size={13} />
              </button>
            </div>
            {isOpen && (
              <div className="shadow-row__fields">
                <SegmentField
                  label="Style"
                  value={s.inner ? 'inner' : 'outer'}
                  options={[
                    { value: 'outer', label: 'Outer' },
                    { value: 'inner', label: 'Inner' },
                  ]}
                  onChange={(v) => updateShadow(s.id, { inner: v === 'inner' }, false)}
                />
                <NumberField
                  label="Offset X"
                  value={s.offsetX}
                  onStart={commit}
                  onChange={(v) => updateShadow(s.id, { offsetX: v }, true)}
                  suffix="px"
                />
                <NumberField
                  label="Offset Y"
                  value={s.offsetY}
                  onStart={commit}
                  onChange={(v) => updateShadow(s.id, { offsetY: v }, true)}
                  suffix="px"
                />
                <SliderField
                  label="Blur"
                  value={s.blur}
                  min={0}
                  max={60}
                  step={1}
                  onStart={commit}
                  onChange={(v) => updateShadow(s.id, { blur: v }, true)}
                  suffix="px"
                />
                <SliderField
                  label="Spread"
                  value={s.spread}
                  min={-50}
                  max={50}
                  step={1}
                  onStart={commit}
                  onChange={(v) => updateShadow(s.id, { spread: v }, true)}
                  suffix="px"
                />
                <SliderField
                  label="Opacity"
                  value={s.opacity}
                  min={0}
                  max={1}
                  step={0.01}
                  onStart={commit}
                  onChange={(v) => updateShadow(s.id, { opacity: v }, true)}
                  displayScale={100}
                  suffix="%"
                />
                <ColorField
                  label="Color"
                  value={s.color}
                  onStart={commit}
                  onChange={(v) => updateShadow(s.id, { color: v }, true)}
                />
              </div>
            )}
          </div>
        );
      })}
      <button type="button" className="btn btn--outline props__wide-btn" onClick={addShadow}>
        <Svg d={UI_ICONS.plus} size={13} />
        Add shadow
      </button>
    </FieldGroup>
  );
}
