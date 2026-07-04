import { useEffect, useState, type ReactNode } from 'react';
import { ensureFontLoaded, FONT_CATEGORIES, FONTS } from '@/data/fonts';
import { useEditor } from '@/store/editorStore';
import { isValidColor, useColorHistory } from '@/store/colorHistoryStore';
import { FontPicker } from './FontPicker';
import { Svg, UI_ICONS } from './Ui';
import './fields.scss';

interface CommonProps {
  label: string;
  /** Called once when the user starts editing — used to push an undo snapshot */
  onStart?: () => void;
}

export function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field-row">
      <span className="field-row__label">{label}</span>
      <div className="field-row__control">{children}</div>
    </div>
  );
}

export function FieldGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="field-group">
      <h3 className="field-group__title">{title}</h3>
      {children}
    </section>
  );
}

/* ------------------------------ NumberField ------------------------------ */

export function NumberField({
  label,
  value,
  onChange,
  onStart,
  min = -Infinity,
  max = Infinity,
  step = 1,
  suffix,
}: CommonProps & {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  useEffect(() => setDraft(null), [value]);
  const shown = draft ?? String(Math.round(value * 100) / 100);
  return (
    <FieldRow label={label}>
      <div className="number-field">
        <input
          type="number"
          value={shown}
          min={min === -Infinity ? undefined : min}
          max={max === Infinity ? undefined : max}
          step={step}
          onFocus={onStart}
          onChange={(e) => {
            setDraft(e.target.value);
            const n = parseFloat(e.target.value);
            if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
          }}
          onBlur={() => setDraft(null)}
        />
        {suffix && <span className="number-field__suffix">{suffix}</span>}
      </div>
    </FieldRow>
  );
}

/* ------------------------------ SliderField ------------------------------ */

export function SliderField({
  label,
  value,
  onChange,
  onStart,
  min,
  max,
  step = 1,
  suffix,
  displayScale = 1,
}: CommonProps & {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Unit shown after the editable number (e.g. "%", "°") */
  suffix?: string;
  /** Multiplier between stored value and displayed number (e.g. 100 for fractions shown as %) */
  displayScale?: number;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  useEffect(() => setDraft(null), [value]);
  const dispStep = step * displayScale;
  const decimals = dispStep >= 1 ? 0 : dispStep >= 0.1 ? 1 : 2;
  const shown = draft ?? String(parseFloat((value * displayScale).toFixed(decimals)));
  return (
    <FieldRow label={label}>
      <div className="slider-field">
        <input
          className="slider-field__num"
          type="number"
          value={shown}
          min={min * displayScale}
          max={max * displayScale}
          step={dispStep}
          onFocus={onStart}
          onChange={(e) => {
            setDraft(e.target.value);
            const n = parseFloat(e.target.value);
            if (!Number.isNaN(n)) {
              onChange(Math.min(max, Math.max(min, n / displayScale)));
            }
          }}
          onBlur={() => setDraft(null)}
        />
        {suffix && <span className="slider-field__suffix">{suffix}</span>}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onPointerDown={onStart}
          onChange={(e) => onChange(parseFloat(e.target.value))}
        />
      </div>
    </FieldRow>
  );
}

/* ------------------------------- ColorField ------------------------------ */

function toHexColor(v: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : '#4fc3ff';
}

export function ColorField({
  label,
  value,
  onChange,
  onStart,
}: CommonProps & { value: string; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  useEffect(() => setDraft(null), [value]);
  const recent = useColorHistory((s) => s.recent);
  const favorites = useColorHistory((s) => s.favorites);
  const addRecent = useColorHistory((s) => s.addRecent);
  const toggleFavorite = useColorHistory((s) => s.toggleFavorite);
  const isFav = isValidColor(value) && favorites.includes(value.trim().toLowerCase());
  const chips = [...favorites, ...recent].slice(0, 12);

  const applyChip = (c: string) => {
    onStart?.();
    onChange(c);
  };

  return (
    <FieldRow label={label}>
      <div className="color-field">
        <div className="color-field__main">
          <span className="color-field__swatch" style={{ background: value }}>
            <input
              type="color"
              value={toHexColor(value)}
              onFocus={onStart}
              onChange={(e) => onChange(e.target.value)}
              onBlur={(e) => addRecent(e.target.value)}
            />
          </span>
          <input
            className="color-field__hex"
            type="text"
            value={draft ?? value}
            spellCheck={false}
            onFocus={onStart}
            onChange={(e) => {
              setDraft(e.target.value);
              const v = e.target.value.trim();
              if (isValidColor(v)) onChange(v);
            }}
            onBlur={() => {
              addRecent(value);
              setDraft(null);
            }}
          />
          <button
            type="button"
            className={`color-field__fav ${isFav ? 'is-active' : ''}`}
            title={isFav ? 'Remove from favorite colors' : 'Save as a favorite color'}
            onClick={() => toggleFavorite(value)}
          >
            <Svg d={UI_ICONS.star} size={13} />
          </button>
        </div>
        {chips.length > 0 && (
          <div className="color-field__swatches">
            {chips.map((c) => (
              <button
                key={c}
                type="button"
                className={`color-field__chip ${favorites.includes(c) ? 'is-fav' : ''}`}
                style={{ background: c }}
                title={c}
                onClick={() => applyChip(c)}
              />
            ))}
          </div>
        )}
      </div>
    </FieldRow>
  );
}

/* ------------------------------ SelectField ------------------------------ */

export function SelectField<T extends string | number>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <FieldRow label={label}>
      <select
        value={String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          const match = options.find((o) => String(o.value) === raw);
          if (match) onChange(match.value);
        }}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldRow>
  );
}

/* ------------------------------- FontField ------------------------------- */

export function FontField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const customFonts = useEditor((s) => s.project.fonts ?? []);
  const [pickerOpen, setPickerOpen] = useState(false);
  const known =
    FONTS.some((f) => f.value === value) || customFonts.some((f) => f.family === value);
  return (
    <FieldRow label={label}>
      <div className="font-field">
        <select
          value={value}
          onChange={(e) => {
            ensureFontLoaded(e.target.value);
            onChange(e.target.value);
          }}
        >
          {!known && <option value={value}>{value}</option>}
          {customFonts.length > 0 && (
            <optgroup label="My Fonts">
              {customFonts.map((f) => (
                <option key={f.id} value={f.family}>
                  {f.family}
                </option>
              ))}
            </optgroup>
          )}
          {FONT_CATEGORIES.map((cat) => (
            <optgroup key={cat} label={cat}>
              {FONTS.filter((f) => f.category === cat).map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button
          type="button"
          className="icon-btn font-field__browse"
          title="Search all Google Fonts"
          onClick={() => setPickerOpen(true)}
        >
          <Svg d={UI_ICONS.search} size={14} />
        </button>
        <FontPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          current={value}
          onPick={onChange}
        />
      </div>
    </FieldRow>
  );
}

/* ------------------------------ SwitchField ------------------------------ */

export function SwitchField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <FieldRow label={label}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`mini-switch ${checked ? 'is-on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </FieldRow>
  );
}

/* ------------------------------- TextField ------------------------------- */

export function TextField({
  label,
  value,
  onChange,
  onStart,
  placeholder,
}: CommonProps & {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <FieldRow label={label}>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onFocus={onStart}
        onChange={(e) => onChange(e.target.value)}
      />
    </FieldRow>
  );
}

/* ------------------------------ SegmentField ----------------------------- */

export function SegmentField<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <FieldRow label={label}>
      <div className="segment-field">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className={value === o.value ? 'is-active' : ''}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </FieldRow>
  );
}
