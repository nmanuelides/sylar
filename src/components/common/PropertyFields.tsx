import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { ensureFontLoaded, FONT_CATEGORIES, FONTS } from '@/data/fonts';
import { useEditor } from '@/store/editorStore';
import { isValidColor, useColorHistory } from '@/store/colorHistoryStore';
import {
  decodeGradient,
  defaultGradient,
  encodeGradient,
  gradientFallbackColor,
  isGradientValue,
  type GradientSpec,
  type GradientStop,
} from '@/lib/gradient';
import { FontPicker } from './FontPicker';
import { Svg, UI_ICONS } from './Ui';
import './fields.scss';

interface CommonProps {
  label: string;
  /** Called once when the user starts editing — used to push an undo snapshot */
  onStart?: () => void;
}

/**
 * Lets a focused number input be adjusted by scrolling over it, without also
 * scrolling the page/panel underneath. Only engages while the input is
 * focused (an unfocused input lets the wheel event scroll the panel as
 * normal) — React's synthetic onWheel can't reliably preventDefault (it's
 * attached passively), so this wires a real DOM listener instead.
 */
function useWheelAdjust(
  ref: RefObject<HTMLInputElement>,
  opts: {
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (v: number) => void;
    onStart?: () => void;
  },
): void {
  const latest = useRef(opts);
  latest.current = opts;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (document.activeElement !== el) return;
      e.preventDefault();
      const { value, min, max, step, onChange, onStart } = latest.current;
      onStart?.();
      const delta = e.deltaY < 0 ? step : -step;
      const next = Math.min(max, Math.max(min, value + delta));
      if (next !== value) onChange(next);
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [ref]);
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
  const commit = () => {
    // `value` (not `draft`) is authoritative here: live typing already pushed
    // every valid keystroke into it, and `draft` may already have been reset
    // to null by the effect above by the time blur fires.
    const clamped = Math.min(max, Math.max(min, value));
    if (clamped !== value) onChange(clamped);
    setDraft(null);
  };
  const inputRef = useRef<HTMLInputElement>(null);
  useWheelAdjust(inputRef, { value, min, max, step, onChange, onStart });
  return (
    <FieldRow label={label}>
      <div className="number-field">
        <input
          ref={inputRef}
          type="number"
          value={shown}
          min={min === -Infinity ? undefined : min}
          max={max === Infinity ? undefined : max}
          step={step}
          onFocus={onStart}
          onChange={(e) => {
            setDraft(e.target.value);
            // Clamp only on commit (blur/Enter) — clamping mid-keystroke corrupts
            // multi-digit entry whenever a typed prefix dips below `min`.
            const n = parseFloat(e.target.value);
            if (!Number.isNaN(n)) onChange(n);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          onBlur={commit}
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
  disabled = false,
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
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  useEffect(() => setDraft(null), [value]);
  const dispStep = step * displayScale;
  const decimals = dispStep >= 1 ? 0 : dispStep >= 0.1 ? 1 : 2;
  const shown = draft ?? String(parseFloat((value * displayScale).toFixed(decimals)));
  const commit = () => {
    // `value` (not `draft`) is authoritative here — see NumberField's commit for why.
    const clamped = Math.min(max, Math.max(min, value));
    if (clamped !== value) onChange(clamped);
    setDraft(null);
  };
  const inputRef = useRef<HTMLInputElement>(null);
  useWheelAdjust(inputRef, {
    value: value * displayScale,
    min: min * displayScale,
    max: max * displayScale,
    step: dispStep,
    onChange: (v) => onChange(v / displayScale),
    onStart,
  });
  return (
    <FieldRow label={label}>
      <div className="slider-field">
        <input
          ref={inputRef}
          className="slider-field__num"
          type="number"
          value={shown}
          min={min * displayScale}
          max={max * displayScale}
          step={dispStep}
          disabled={disabled}
          onFocus={onStart}
          onChange={(e) => {
            setDraft(e.target.value);
            // Clamp only on commit (blur/Enter) — clamping mid-keystroke corrupts
            // multi-digit entry whenever a typed prefix dips below `min`.
            const n = parseFloat(e.target.value);
            if (!Number.isNaN(n)) onChange(n / displayScale);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          onBlur={commit}
        />
        {suffix && <span className="slider-field__suffix">{suffix}</span>}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
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
  bindingKey,
  allowGradient = true,
}: CommonProps & {
  value: string;
  onChange: (v: string) => void;
  /** Enables "bind to theme color" when provided — a stable id like `elementBindingKey(el.id, 'color')` */
  bindingKey?: string;
  /** Set false for paints that can't take a gradient (e.g. an SVG feFlood shadow color). */
  allowGradient?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  useEffect(() => setDraft(null), [value]);
  const recent = useColorHistory((s) => s.recent);
  const favorites = useColorHistory((s) => s.favorites);
  const addRecent = useColorHistory((s) => s.addRecent);
  const toggleFavorite = useColorHistory((s) => s.toggleFavorite);
  const isFav = isValidColor(value) && favorites.includes(value.trim().toLowerCase());
  const chips = [...favorites, ...recent].slice(0, 12);
  const gradientSpec = allowGradient ? decodeGradient(value) : null;
  const isGradient = gradientSpec !== null;

  const theme = useEditor((s) => s.project.theme ?? []);
  const boundThemeId = useEditor((s) =>
    bindingKey ? s.project.themeBindings?.[bindingKey] : undefined,
  );
  const bindToTheme = useEditor((s) => s.bindToTheme);
  const unbindTheme = useEditor((s) => s.unbindTheme);
  const commit = useEditor((s) => s.commit);
  const boundTheme = theme.find((t) => t.id === boundThemeId);
  const isBound = !!boundTheme;

  const applyChip = (c: string) => {
    onStart?.();
    onChange(c);
  };

  const switchToSolid = () => {
    if (!gradientSpec) return;
    onStart?.();
    onChange(gradientFallbackColor(gradientSpec));
  };
  const switchToGradient = () => {
    if (gradientSpec) return;
    onStart?.();
    onChange(encodeGradient(defaultGradient(isValidColor(value) ? value : '#4fc3ff')));
  };

  return (
    <FieldRow label={label}>
      <div className="color-field">
        {!isBound && allowGradient && (
          <div className="color-field__mode segment-field">
            <button type="button" className={!isGradient ? 'is-active' : ''} onClick={switchToSolid}>
              Solid
            </button>
            <button type="button" className={isGradient ? 'is-active' : ''} onClick={switchToGradient}>
              Gradient
            </button>
          </div>
        )}
        {isGradient && gradientSpec ? (
          <GradientEditor
            spec={gradientSpec}
            onStart={onStart}
            onChange={(spec) => onChange(encodeGradient(spec))}
          />
        ) : (
          <>
        <div className="color-field__main">
          <span
            className={`color-field__swatch ${isBound ? 'is-bound' : ''}`}
            style={{ background: value }}
            title={isBound ? `Linked to theme color “${boundTheme!.name}”` : undefined}
          >
            {!isBound && (
              <input
                type="color"
                value={toHexColor(value)}
                onFocus={onStart}
                onChange={(e) => onChange(e.target.value)}
                onBlur={(e) => addRecent(e.target.value)}
              />
            )}
          </span>
          <input
            className="color-field__hex"
            type="text"
            value={isBound ? boundTheme!.name : (draft ?? value)}
            spellCheck={false}
            readOnly={isBound}
            onFocus={onStart}
            onChange={(e) => {
              setDraft(e.target.value);
              const v = e.target.value.trim();
              if (isValidColor(v)) onChange(v);
            }}
            onBlur={() => {
              if (!isBound) addRecent(value);
              setDraft(null);
            }}
          />
          {bindingKey && (
            <span
              className={`color-field__theme-btn ${isBound ? 'is-active' : ''}`}
              title={
                isBound
                  ? `Linked to “${boundTheme!.name}” — pick to change or unlink`
                  : theme.length > 0
                    ? 'Link to a theme color'
                    : 'Add theme colors in Canvas → Theme to link this field'
              }
            >
              <Svg d={UI_ICONS.palette} size={13} />
              <select
                value={boundThemeId ?? ''}
                disabled={theme.length === 0}
                onChange={(e) => {
                  commit();
                  if (e.target.value) bindToTheme(bindingKey, e.target.value);
                  else unbindTheme(bindingKey);
                }}
              >
                <option value="">{theme.length > 0 ? 'Custom color' : 'No theme colors yet'}</option>
                {theme.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </span>
          )}
          <button
            type="button"
            className={`color-field__fav ${isFav ? 'is-active' : ''}`}
            title={isFav ? 'Remove from favorite colors' : 'Save as a favorite color'}
            onClick={() => toggleFavorite(value)}
            disabled={isBound}
          >
            <Svg d={UI_ICONS.star} size={13} />
          </button>
        </div>
        {!isBound && chips.length > 0 && (
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
          </>
        )}
      </div>
    </FieldRow>
  );
}

/* --------------------------- GradientEditor ------------------------------ */

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function cssGradientPreview(spec: GradientSpec): string {
  const stops = [...spec.stops]
    .sort((a, b) => a.offset - b.offset)
    .map((s) => `${s.color} ${Math.round(s.offset * 100)}%`)
    .join(', ');
  return spec.kind === 'radial' ? `radial-gradient(circle, ${stops})` : `linear-gradient(${spec.angle}deg, ${stops})`;
}

function GradientEditor({
  spec,
  onChange,
  onStart,
}: {
  spec: GradientSpec;
  onChange: (spec: GradientSpec) => void;
  onStart?: () => void;
}) {
  const setStop = (i: number, patch: Partial<GradientStop>) => {
    onChange({ ...spec, stops: spec.stops.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  };
  const addStop = () => {
    onStart?.();
    const last = spec.stops[spec.stops.length - 1];
    onChange({ ...spec, stops: [...spec.stops, { offset: 1, color: last?.color ?? '#ffffff' }] });
  };
  const removeStop = (i: number) => {
    if (spec.stops.length <= 2) return;
    onStart?.();
    onChange({ ...spec, stops: spec.stops.filter((_, idx) => idx !== i) });
  };

  return (
    <div className="gradient-editor">
      <div className="gradient-editor__preview" style={{ background: cssGradientPreview(spec) }} />
      <div className="segment-field">
        <button
          type="button"
          className={spec.kind === 'linear' ? 'is-active' : ''}
          onClick={() => {
            onStart?.();
            onChange({ ...spec, kind: 'linear' });
          }}
        >
          Linear
        </button>
        <button
          type="button"
          className={spec.kind === 'radial' ? 'is-active' : ''}
          onClick={() => {
            onStart?.();
            onChange({ ...spec, kind: 'radial' });
          }}
        >
          Radial
        </button>
      </div>
      {spec.kind === 'linear' && (
        <div className="gradient-editor__angle">
          <input
            type="range"
            min={0}
            max={360}
            value={spec.angle}
            onPointerDown={onStart}
            onChange={(e) => onChange({ ...spec, angle: parseFloat(e.target.value) })}
          />
          <span>{Math.round(spec.angle)}°</span>
        </div>
      )}
      <div className="gradient-editor__stops">
        {spec.stops.map((s, i) => (
          <div className="gradient-editor__stop" key={i}>
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(s.color) ? s.color : '#ffffff'}
              onFocus={onStart}
              onChange={(e) => setStop(i, { color: e.target.value })}
            />
            <input
              type="number"
              min={0}
              max={100}
              value={Math.round(s.offset * 100)}
              onFocus={onStart}
              onChange={(e) => setStop(i, { offset: clamp01(parseFloat(e.target.value) / 100) })}
            />
            <span>%</span>
            <button
              type="button"
              className="icon-btn"
              disabled={spec.stops.length <= 2}
              title="Remove stop"
              onClick={() => removeStop(i)}
            >
              <Svg d={UI_ICONS.close} size={12} />
            </button>
          </div>
        ))}
        <button type="button" className="btn btn--outline gradient-editor__add" onClick={addStop}>
          <Svg d={UI_ICONS.plus} size={12} />
          Add stop
        </button>
      </div>
    </div>
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
