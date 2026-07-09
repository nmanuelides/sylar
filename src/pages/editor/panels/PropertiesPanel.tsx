import { useState } from 'react';
import type { WatchElement } from '@/types/watchface';
import {
  backgroundBindingKey,
  elementBindingKey,
  selectBackground,
  selectCurrentElements,
  useEditor,
  type AlignKind,
} from '@/store/editorStore';
import { DEVICES, getDevice } from '@/data/devices';
import { nearestWeight, weightsFor } from '@/data/fonts';
import { WEATHER_CONDITIONS } from '@/data/icons';
import { DATA_SOURCES } from '@/lib/time';
import { hasPartialShadowSupport, supportsShadow } from '@/lib/elementClassification';
import { DEFAULT_LANGUAGE, LANGUAGES } from '@/lib/i18n';
import { FONT_HEIGHT_RATIO } from '@/components/watchface/renderers';
import {
  ColorField,
  FieldGroup,
  FieldRow,
  FontField,
  NumberField,
  SegmentField,
  SelectField,
  SliderField,
  SwitchField,
  TextField,
} from '@/components/common/PropertyFields';
import { IconPicker } from '@/components/common/IconPicker';
import { Svg, UI_ICONS } from '@/components/common/Ui';
import { ShadowListField } from './ShadowFields';

const ALIGN_BUTTONS: { kind: AlignKind; icon: string; title: string }[] = [
  { kind: 'left', icon: UI_ICONS.alignL, title: 'Align left' },
  { kind: 'centerH', icon: UI_ICONS.alignCH, title: 'Center horizontally' },
  { kind: 'right', icon: UI_ICONS.alignR, title: 'Align right' },
  { kind: 'top', icon: UI_ICONS.alignT, title: 'Align top' },
  { kind: 'centerV', icon: UI_ICONS.alignCV, title: 'Center vertically' },
  { kind: 'bottom', icon: UI_ICONS.alignB, title: 'Align bottom' },
];

type ElementPatch =
  | Record<string, unknown>
  | ((el: WatchElement) => Record<string, unknown>);

function useElementPatch(id: string) {
  const updateElements = useEditor((s) => s.updateElements);
  const commit = useEditor((s) => s.commit);
  return {
    patch: (p: ElementPatch) => updateElements([id], p as Partial<WatchElement>),
    commitPatch: (p: ElementPatch) => {
      commit();
      updateElements([id], p as Partial<WatchElement>);
    },
    commit,
  };
}

function FontFields({
  el,
  elementId,
  patch,
  commitPatch,
  commit,
}: {
  el: {
    fontFamily: string;
    fontWeight?: number;
    color: string;
    letterSpacing?: number;
    height?: number;
  };
  elementId: string;
  patch: (p: Record<string, unknown>) => void;
  commitPatch: (p: Record<string, unknown>) => void;
  commit: () => void;
}) {
  const changeFamily = (family: string) => {
    const patchObj: Record<string, unknown> = { fontFamily: family };
    if (el.fontWeight !== undefined) {
      const available = weightsFor(family).map((o) => o.value);
      if (!available.includes(el.fontWeight)) {
        patchObj.fontWeight = nearestWeight(family, el.fontWeight);
      }
    }
    commitPatch(patchObj);
  };
  return (
    <>
      {el.height !== undefined && (
        <NumberField
          label="Text size"
          value={Math.round(el.height * FONT_HEIGHT_RATIO)}
          min={2}
          max={400}
          suffix="px"
          onStart={commit}
          onChange={(v) => patch({ height: Math.round(v / FONT_HEIGHT_RATIO) })}
        />
      )}
      <FontField label="Font" value={el.fontFamily} onChange={changeFamily} />
      {el.fontWeight !== undefined && (
        <SelectField
          label="Style"
          value={el.fontWeight}
          options={weightsFor(el.fontFamily)}
          onChange={(v) => commitPatch({ fontWeight: v })}
        />
      )}
      <ColorField
        label="Color"
        value={el.color}
        onStart={commit}
        onChange={(v) => patch({ color: v })}
        bindingKey={elementBindingKey(elementId, 'color')}
      />
      {el.letterSpacing !== undefined && (
        <SliderField
          label="Letter spacing"
          value={el.letterSpacing}
          min={-4}
          max={20}
          step={0.5}
          onStart={commit}
          onChange={(v) => patch({ letterSpacing: v })}
        />
      )}
    </>
  );
}


function ElementProperties({ el }: { el: WatchElement }) {
  const { patch, commitPatch, commit } = useElementPatch(el.id);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const elements = useEditor(selectCurrentElements);
  // Matches the tick-marks renderer's `r * 0.16` base font size (renderers.tsx)
  // so the "Text size" field can show/set the label's actual on-canvas px.
  const labelBaseSize = (Math.min(el.width, el.height) / 2) * 0.16;

  return (
    <>
      <FieldGroup title="Transform">
        <NumberField label="X" value={el.x} onStart={commit} onChange={(v) => patch({ x: v })} />
        <NumberField label="Y" value={el.y} onStart={commit} onChange={(v) => patch({ y: v })} />
        <NumberField
          label="Width"
          value={el.width}
          min={4}
          onStart={commit}
          onChange={(v) => patch({ width: v })}
        />
        <NumberField
          label="Height"
          value={el.height}
          min={4}
          onStart={commit}
          onChange={(v) => patch({ height: v })}
        />
        <SliderField
          label="Rotation"
          value={el.rotation}
          min={0}
          max={359}
          onStart={commit}
          onChange={(v) => patch({ rotation: v })}
          suffix="°"
        />
        <FieldRow label="Flip">
          <div className="props__flip">
            <button
              type="button"
              className={`icon-btn ${el.flipX ? 'is-active' : ''}`}
              title="Flip horizontal"
              onClick={() => commitPatch((e) => ({ flipX: !e.flipX }))}
            >
              <Svg d={UI_ICONS.flipH} size={15} />
            </button>
            <button
              type="button"
              className={`icon-btn ${el.flipY ? 'is-active' : ''}`}
              title="Flip vertical"
              onClick={() => commitPatch((e) => ({ flipY: !e.flipY }))}
            >
              <Svg d={UI_ICONS.flipV} size={15} />
            </button>
          </div>
        </FieldRow>
        {(el.type === 'hand' || !!el.rotateWith) && (
          <>
            <SliderField
              label="Pivot X"
              value={el.pivotX ?? 0.5}
              min={-1}
              max={2}
              step={0.001}
              disabled={!!el.pivotTargetId}
              onStart={commit}
              onChange={(v) => patch({ pivotX: v })}
              displayScale={100}
              suffix="%"
            />
            <SliderField
              label="Pivot Y"
              value={el.pivotY ?? 0.5}
              min={-1}
              max={2}
              step={0.001}
              disabled={!!el.pivotTargetId}
              onStart={commit}
              onChange={(v) => patch({ pivotY: v })}
              displayScale={100}
              suffix="%"
            />
            <SelectField
              label="Pivot target"
              value={el.pivotTargetId ?? 'none'}
              options={[
                { value: 'none', label: 'None (use Pivot X/Y)' },
                ...elements
                  .filter((e) => e.id !== el.id)
                  .map((e) => ({ value: e.id, label: e.name })),
              ]}
              onChange={(v) => commitPatch({ pivotTargetId: v === 'none' ? undefined : v })}
            />
            {el.pivotTargetId && (
              <p className="props__note">
                Rotates around "{elements.find((e) => e.id === el.pivotTargetId)?.name}"'s
                center. Pivot X/Y above are ignored while a target is set.
              </p>
            )}
          </>
        )}
        <SliderField
          label="Opacity"
          value={el.opacity}
          min={0}
          max={1}
          step={0.01}
          onStart={commit}
          onChange={(v) => patch({ opacity: v })}
          displayScale={100}
          suffix="%"
        />
        {el.type !== 'hand' && (
          <SelectField
            label="Rotate as"
            value={el.rotateWith ?? 'none'}
            options={[
              { value: 'none', label: 'Static' },
              { value: 'hour', label: 'Hour' },
              { value: 'minute', label: 'Minute' },
              { value: 'second', label: 'Second' },
              { value: 'weekday', label: 'Day of week' },
              { value: 'battery', label: 'Battery' },
            ]}
            onChange={(v) => commitPatch({ rotateWith: v === 'none' ? undefined : v })}
          />
        )}
        {el.rotateWith && (
          <p className="props__note">
            Rotates continuously around its pivot point (Pivot X/Y above) to track{' '}
            {el.rotateWith === 'weekday'
              ? 'the current day of the week (7 evenly-spaced positions, Monday first)'
              : el.rotateWith === 'battery'
                ? 'battery level (0% = 0°, 100% = full turn)'
                : `the ${el.rotateWith} hand angle`}
            . “Rotation” above fine-tunes the zero angle.
          </p>
        )}
      </FieldGroup>

      {supportsShadow(el) ? (
        <ShadowListField el={el} patch={patch} commitPatch={commitPatch} commit={commit} />
      ) : (
        <p className="props__note">
          Shadows aren't available on this element — Zepp OS renders live-updating text as a bare
          native widget with no image behind it for a shadow to attach to.
        </p>
      )}

      {el.type === 'complication' && (
        <>
          <FieldGroup title="Complication">
            <ColorField
              label="Accent"
              value={el.accentColor}
              onStart={commit}
              onChange={(v) => patch({ accentColor: v })}
              bindingKey={elementBindingKey(el.id, 'accentColor')}
            />
            {el.kind !== 'date' && (
              <>
                <SwitchField
                  label="Progress ring"
                  checked={el.showRing}
                  onChange={(v) => commitPatch({ showRing: v })}
                />
                <SwitchField
                  label="Icon"
                  checked={el.showIcon}
                  onChange={(v) => commitPatch({ showIcon: v })}
                />
                <SwitchField
                  label="Title"
                  checked={el.showLabel}
                  onChange={(v) => commitPatch({ showLabel: v })}
                />
              </>
            )}
          </FieldGroup>
          <FieldGroup title={el.kind === 'date' ? 'Day number' : 'Value text'}>
            <ColorField
              label="Color"
              value={el.valueColor ?? el.textColor}
              onStart={commit}
              onChange={(v) => patch({ valueColor: v })}
              bindingKey={elementBindingKey(el.id, 'valueColor')}
            />
            <FontField
              label="Font"
              value={el.valueFont ?? el.fontFamily}
              onChange={(v) => commitPatch({ valueFont: v })}
            />
            <SliderField
              label="Size"
              value={el.valueScale ?? el.textScale ?? 1}
              min={0.1}
              max={2.5}
              step={0.01}
              onStart={commit}
              onChange={(v) => patch({ valueScale: v })}
              displayScale={100}
              suffix="%"
            />
            <NumberField
              label="Offset X"
              value={el.valueDx ?? 0}
              min={-300}
              max={300}
              suffix="px"
              onStart={commit}
              onChange={(v) => patch({ valueDx: v })}
            />
            <NumberField
              label="Offset Y"
              value={el.valueDy ?? 0}
              min={-300}
              max={300}
              suffix="px"
              onStart={commit}
              onChange={(v) => patch({ valueDy: v })}
            />
          </FieldGroup>
          {(el.kind === 'date' || el.showLabel) && (
            <FieldGroup title={el.kind === 'date' ? 'Weekday title' : 'Title text'}>
              <ColorField
                label="Color"
                value={el.labelColor ?? (el.kind === 'date' ? el.accentColor : el.textColor)}
                onStart={commit}
                onChange={(v) => patch({ labelColor: v })}
                bindingKey={elementBindingKey(el.id, 'labelColor')}
              />
              <FontField
                label="Font"
                value={el.labelFont ?? el.fontFamily}
                onChange={(v) => commitPatch({ labelFont: v })}
              />
              <SliderField
                label="Size"
                value={el.labelScale ?? el.textScale ?? 1}
                min={0.1}
                max={2.5}
                step={0.01}
                onStart={commit}
                onChange={(v) => patch({ labelScale: v })}
                displayScale={100}
                suffix="%"
              />
              <NumberField
                label="Offset X"
                value={el.labelDx ?? 0}
                min={-300}
                max={300}
                suffix="px"
                onStart={commit}
                onChange={(v) => patch({ labelDx: v })}
              />
              <NumberField
                label="Offset Y"
                value={el.labelDy ?? 0}
                min={-300}
                max={300}
                suffix="px"
                onStart={commit}
                onChange={(v) => patch({ labelDy: v })}
              />
            </FieldGroup>
          )}
        </>
      )}

      {el.type === 'hand' && (
        <FieldGroup title="Watch hand">
          <SegmentField
            label="Shape"
            value={el.style}
            options={[
              { value: 'classic', label: 'Classic' },
              { value: 'sword', label: 'Sword' },
              { value: 'thin', label: 'Thin' },
            ]}
            onChange={(v) => commitPatch({ style: v })}
          />
          <ColorField
            label="Color"
            value={el.color}
            onStart={commit}
            onChange={(v) => patch({ color: v })}
            bindingKey={elementBindingKey(el.id, 'color')}
          />
          <ColorField
            label="Accent"
            value={el.accentColor}
            onStart={commit}
            onChange={(v) => patch({ accentColor: v })}
            bindingKey={elementBindingKey(el.id, 'accentColor')}
          />
          <SwitchField label="Center cap" checked={el.showCap} onChange={(v) => commitPatch({ showCap: v })} />
        </FieldGroup>
      )}

      {el.type === 'digitalTime' && (
        <FieldGroup title="Digital time">
          <SelectField
            label="Format"
            value={el.format}
            options={[
              { value: 'HH:mm', label: '24h — 10:08' },
              { value: 'HH:mm:ss', label: '24h — 10:08:36' },
              { value: 'hh:mm', label: '12h — 10:08' },
              { value: 'hh:mm:ss', label: '12h — 10:08:36' },
            ]}
            onChange={(v) => commitPatch({ format: v })}
          />
          {el.format.startsWith('hh') && (
            <SwitchField
              label="AM / PM"
              checked={el.showAmPm}
              onChange={(v) => commitPatch({ showAmPm: v })}
            />
          )}
          <FontFields el={el} elementId={el.id} patch={patch} commitPatch={commitPatch} commit={commit} />
        </FieldGroup>
      )}

      {el.type === 'number' && (
        <FieldGroup title="Data">
          <SelectField
            label="Source"
            value={el.source}
            options={DATA_SOURCES}
            onChange={(v) => commitPatch({ source: v })}
          />
          {el.source === 'weather' && (
            <>
              <SwitchField
                label="Live device temperature"
                checked={el.nativeWeather ?? false}
                onChange={(v) => commitPatch({ nativeWeather: v })}
              />
              <p className="props__note">
                {el.nativeWeather
                  ? "Renders as a native widget bound to the watch's own live current-temperature reading — more accurate than the approximation below, but the editor preview can't simulate it, so it'll keep showing the estimate here."
                  : 'Zepp OS has no live "current temperature" sensor reading — this estimates it from a diurnal curve between the daily high and low. Enable above for the more accurate, device-native reading instead (support varies by watch model).'}
              </p>
            </>
          )}
          <SwitchField label="Unit" checked={el.showUnit} onChange={(v) => commitPatch({ showUnit: v })} />
          <FontFields el={el} elementId={el.id} patch={patch} commitPatch={commitPatch} commit={commit} />
        </FieldGroup>
      )}

      {el.type === 'text' && (
        <FieldGroup title="Text">
          <TextField label="Content" value={el.text} onStart={commit} onChange={(v) => patch({ text: v })} />
          <SwitchField
            label="Uppercase"
            checked={el.uppercase}
            onChange={(v) => commitPatch({ uppercase: v })}
          />
          <FontFields el={el} elementId={el.id} patch={patch} commitPatch={commitPatch} commit={commit} />
        </FieldGroup>
      )}

      {el.type === 'icon' && (
        <FieldGroup title="Icon">
          <div className="props__icon-current">
            {el.iconPath && (
              <svg viewBox={`0 0 ${el.iconWidth ?? 512} 512`}>
                <path d={el.iconPath} fill="currentColor" />
              </svg>
            )}
            <span>{el.icon}</span>
          </div>
          <button className="btn btn--outline props__wide-btn" onClick={() => setIconPickerOpen(true)}>
            <Svg d={UI_ICONS.search} size={13} />
            Browse Font Awesome icons
          </button>
          <ColorField
            label="Color"
            value={el.color}
            onStart={commit}
            onChange={(v) => patch({ color: v })}
            bindingKey={elementBindingKey(el.id, 'color')}
          />
          <IconPicker
            open={iconPickerOpen}
            onClose={() => setIconPickerOpen(false)}
            onPick={(name, glyph) =>
              commitPatch({
                icon: name,
                iconPath: glyph.path,
                iconWidth: glyph.width,
                name: `Icon · ${name}`,
              })
            }
          />
        </FieldGroup>
      )}

      {el.type === 'weatherIcon' && (
        <FieldGroup title="Weather icon">
          <SelectField
            label="Condition"
            value={el.condition}
            options={[
              { value: 'live', label: 'Live weather' },
              ...WEATHER_CONDITIONS.map((c) => ({ value: c.value, label: c.label })),
            ]}
            onChange={(v) => commitPatch({ condition: v })}
          />
          <ColorField
            label="Color"
            value={el.color}
            onStart={commit}
            onChange={(v) => patch({ color: v })}
            bindingKey={elementBindingKey(el.id, 'color')}
          />
          <p className="props__note">
            “Live weather” follows the current condition (mocked as partly cloudy in the editor).
            Pin a condition to preview or force a specific icon.
          </p>
        </FieldGroup>
      )}

      {el.type === 'progressBar' && (
        <FieldGroup title="Progress bar">
          <SegmentField
            label="Type"
            value={el.variant}
            options={[
              { value: 'linear', label: 'Linear' },
              { value: 'circular', label: 'Circular' },
            ]}
            onChange={(v) => commitPatch({ variant: v })}
          />
          <SelectField
            label="Data"
            value={el.source}
            options={DATA_SOURCES}
            onChange={(v) => commitPatch({ source: v })}
          />
          <ColorField
            label="Fill"
            value={el.fillColor}
            onStart={commit}
            onChange={(v) => patch({ fillColor: v })}
            bindingKey={elementBindingKey(el.id, 'fillColor')}
          />
          <ColorField
            label="Track"
            value={el.trackColor}
            onStart={commit}
            onChange={(v) => patch({ trackColor: v })}
            bindingKey={elementBindingKey(el.id, 'trackColor')}
          />
          <SliderField
            label="Thickness"
            value={el.thickness}
            min={2}
            max={40}
            onStart={commit}
            onChange={(v) => patch({ thickness: v })}
          />
          {el.variant === 'linear' && (
            <>
              <SliderField
                label="Corner radius"
                value={el.cornerRadius ?? (el.rounded ? Math.min(el.thickness, el.height) / 2 : 0)}
                min={0}
                max={Math.min(el.thickness, el.height) / 2}
                step={0.5}
                onStart={commit}
                onChange={(v) => patch({ cornerRadius: v })}
                suffix="px"
              />
              <SegmentField
                label="Fill style"
                value={el.segmented ? 'segmented' : 'continuous'}
                options={[
                  { value: 'continuous', label: 'Continuous' },
                  { value: 'segmented', label: 'Segmented' },
                ]}
                onChange={(v) => commitPatch({ segmented: v === 'segmented' })}
              />
              {el.segmented && (
                <>
                  <SliderField
                    label="Segments"
                    value={el.segmentCount ?? 5}
                    min={2}
                    max={12}
                    step={1}
                    onStart={commit}
                    onChange={(v) => patch({ segmentCount: Math.round(v) })}
                  />
                  <SliderField
                    label="Segment gap"
                    value={el.segmentGap ?? 4}
                    min={0}
                    max={20}
                    step={1}
                    onStart={commit}
                    onChange={(v) => patch({ segmentGap: v })}
                    suffix="px"
                  />
                </>
              )}
            </>
          )}
          {el.variant === 'circular' && (
            <>
              <SwitchField
                label="Rounded"
                checked={el.rounded}
                onChange={(v) => commitPatch({ rounded: v })}
              />
              <SliderField
                label="Start angle"
                value={el.startAngle}
                min={-180}
                max={180}
                onStart={commit}
                onChange={(v) => patch({ startAngle: v })}
                suffix="°"
              />
              <SliderField
                label="Sweep"
                value={el.sweep}
                min={30}
                max={360}
                onStart={commit}
                onChange={(v) => patch({ sweep: v })}
                suffix="°"
              />
              <SwitchField
                label="Show value"
                checked={el.showValue}
                onChange={(v) => commitPatch({ showValue: v })}
              />
              {el.showValue && (
                <>
                  <SliderField
                    label="Text size"
                    value={el.textScale ?? 1}
                    min={0.1}
                    max={2}
                    step={0.01}
                    onStart={commit}
                    onChange={(v) => patch({ textScale: v })}
                    displayScale={100}
                    suffix="%"
                  />
                  <FontField
                    label="Font"
                    value={el.fontFamily}
                    onChange={(v) => commitPatch({ fontFamily: v })}
                  />
                </>
              )}
            </>
          )}
        </FieldGroup>
      )}

      {el.type === 'tickMarks' && (
        <FieldGroup title="Tick marks">
          <SwitchField
            label="Tick lines"
            checked={el.showTicks ?? true}
            onChange={(v) => commitPatch({ showTicks: v })}
          />
          {(el.showTicks ?? true) && (
            <>
              <NumberField
                label="Count"
                value={el.count}
                min={1}
                max={120}
                onStart={commit}
                onChange={(v) => patch({ count: Math.round(v) })}
              />
              <NumberField
                label="Major every"
                value={el.majorEvery}
                min={0}
                max={30}
                onStart={commit}
                onChange={(v) => patch({ majorEvery: Math.round(v) })}
              />
              <SegmentField
                label="Layout"
                value={el.layout ?? 'circle'}
                options={[
                  { value: 'circle', label: 'Circle' },
                  { value: 'rect', label: 'Rectangle' },
                ]}
                onChange={(v) => commitPatch({ layout: v })}
              />
              {el.layout === 'rect' && (
                <SliderField
                  label="Track radius"
                  value={el.pathCornerRadius ?? 0}
                  min={0}
                  max={Math.min(el.width, el.height) / 2}
                  step={1}
                  onStart={commit}
                  onChange={(v) => patch({ pathCornerRadius: v })}
                  suffix="px"
                />
              )}
              <SegmentField
                label="Shape"
                value={el.shape}
                options={[
                  { value: 'line', label: 'Lines' },
                  { value: 'dot', label: 'Dots' },
                  { value: 'rect', label: 'Rectangles' },
                ]}
                onChange={(v) => commitPatch({ shape: v })}
              />
              {el.shape === 'rect' && (
                <SliderField
                  label="Corner radius"
                  value={el.cornerRadius ?? 0}
                  min={0}
                  max={Math.max(el.thickness, el.majorLength) / 2}
                  step={0.5}
                  onStart={commit}
                  onChange={(v) => patch({ cornerRadius: v })}
                  suffix="px"
                />
              )}
              <ColorField
                label="Color"
                value={el.color}
                onStart={commit}
                onChange={(v) => patch({ color: v })}
                bindingKey={elementBindingKey(el.id, 'color')}
              />
              <ColorField
                label="Major color"
                value={el.majorColor}
                onStart={commit}
                onChange={(v) => patch({ majorColor: v })}
                bindingKey={elementBindingKey(el.id, 'majorColor')}
              />
              <SliderField
                label="Length"
                value={el.length}
                min={2}
                max={60}
                onStart={commit}
                onChange={(v) => patch({ length: v })}
              />
              <SliderField
                label="Major length"
                value={el.majorLength}
                min={2}
                max={80}
                onStart={commit}
                onChange={(v) => patch({ majorLength: v })}
              />
              <SliderField
                label="Thickness"
                value={el.thickness}
                min={1}
                max={12}
                onStart={commit}
                onChange={(v) => patch({ thickness: v })}
              />
            </>
          )}
          <SwitchField
            label="Labels"
            checked={el.showNumbers}
            onChange={(v) => commitPatch({ showNumbers: v })}
          />
          {el.showNumbers && (
            <>
              <NumberField
                label="Count"
                value={el.numberCount ?? 12}
                min={1}
                max={60}
                onStart={commit}
                onChange={(v) => patch({ numberCount: Math.round(v) })}
              />
              <FieldRow label="Custom text">
                <textarea
                  className="props__textarea"
                  rows={4}
                  placeholder={'Leave blank for 1, 2, 3…\nOr enter one label per line,\ne.g. Mon / Tue / Wed…'}
                  value={(el.labels ?? []).join('\n')}
                  onFocus={commit}
                  onChange={(e) => patch({ labels: e.target.value.split('\n') })}
                />
              </FieldRow>
              {!el.labels?.some((s) => s.length > 0) && (
                <>
                  <NumberField
                    label="Step"
                    value={el.numberStep ?? 1}
                    min={1}
                    max={1000}
                    onStart={commit}
                    onChange={(v) => patch({ numberStep: Math.round(v) })}
                  />
                  <SwitchField
                    label="Zero at top"
                    checked={el.zeroAtTop ?? false}
                    onChange={(v) => commitPatch({ zeroAtTop: v })}
                  />
                </>
              )}
              <SwitchField
                label="Curve around ring"
                checked={el.curveLabels ?? false}
                onChange={(v) => commitPatch({ curveLabels: v })}
              />
              <NumberField
                label="Text size"
                value={Math.round(labelBaseSize * (el.numberScale ?? 1))}
                min={2}
                max={400}
                suffix="px"
                onStart={commit}
                onChange={(v) => patch({ numberScale: v / labelBaseSize })}
              />
              <FontField
                label="Font"
                value={el.fontFamily}
                onChange={(family) => {
                  const patchObj: Record<string, unknown> = { fontFamily: family };
                  const available = weightsFor(family).map((o) => o.value);
                  if (!available.includes(el.numberWeight ?? 600)) {
                    patchObj.numberWeight = nearestWeight(family, el.numberWeight ?? 600);
                  }
                  commitPatch(patchObj);
                }}
              />
              <SelectField
                label="Style"
                value={el.numberWeight ?? 600}
                options={weightsFor(el.fontFamily)}
                onChange={(v) => commitPatch({ numberWeight: v })}
              />
              <ColorField
                label="Text color"
                value={el.numberColor}
                onStart={commit}
                onChange={(v) => patch({ numberColor: v })}
                bindingKey={elementBindingKey(el.id, 'numberColor')}
              />
            </>
          )}
        </FieldGroup>
      )}

      {el.type === 'image' && (
        <FieldGroup title="Image">
          <SegmentField
            label="Fit"
            value={el.fit}
            options={[
              { value: 'contain', label: 'Contain' },
              { value: 'cover', label: 'Cover' },
              { value: 'stretch', label: 'Stretch' },
            ]}
            onChange={(v) => commitPatch({ fit: v })}
          />
          {el.rotateWith && (
            <p className="props__note">
              For a hand pointing at 12, set Pivot Y (in Transform above) to where the axle sits
              (e.g. 85% for a short tail), then use the center-align buttons below to snap the
              pivot to the dial center.
            </p>
          )}
        </FieldGroup>
      )}

      {el.type === 'shape' && (
        <FieldGroup title="Shape">
          <SegmentField
            label="Kind"
            value={el.shapeKind}
            options={[
              { value: 'circle', label: 'Circle' },
              { value: 'rectangle', label: 'Rectangle' },
              { value: 'polygon', label: 'Polygon' },
            ]}
            onChange={(v) => commitPatch({ shapeKind: v })}
          />
          {el.shapeKind === 'polygon' && (
            <NumberField
              label="Sides"
              value={el.sides ?? 3}
              min={3}
              max={12}
              onStart={commit}
              onChange={(v) => patch({ sides: Math.round(v) })}
            />
          )}
          {el.shapeKind !== 'circle' && (
            <SliderField
              label="Corner radius"
              value={el.cornerRadius ?? 0}
              min={0}
              max={Math.max(1, Math.min(el.width, el.height) / 2)}
              onStart={commit}
              onChange={(v) => patch({ cornerRadius: v })}
              suffix="px"
            />
          )}
          <ColorField
            label="Fill"
            value={el.fill}
            onStart={commit}
            onChange={(v) => patch({ fill: v })}
            bindingKey={elementBindingKey(el.id, 'fill')}
          />
          <NumberField
            label="Stroke width"
            value={el.strokeWidth ?? 0}
            min={0}
            max={40}
            suffix="px"
            onStart={commit}
            onChange={(v) => patch({ strokeWidth: v })}
          />
          {(el.strokeWidth ?? 0) > 0 && (
            <ColorField
              label="Stroke color"
              value={el.strokeColor ?? '#000000'}
              onStart={commit}
              onChange={(v) => patch({ strokeColor: v })}
              bindingKey={elementBindingKey(el.id, 'strokeColor')}
            />
          )}
        </FieldGroup>
      )}
    </>
  );
}

function ThemePanel() {
  const theme = useEditor((s) => s.project.theme ?? []);
  const addThemeColor = useEditor((s) => s.addThemeColor);
  const renameThemeColor = useEditor((s) => s.renameThemeColor);
  const setThemeColor = useEditor((s) => s.setThemeColor);
  const removeThemeColor = useEditor((s) => s.removeThemeColor);
  const commit = useEditor((s) => s.commit);

  return (
    <FieldGroup title="Theme">
      {theme.map((t) => (
        <div key={t.id} className="theme-row">
          <span className="theme-row__swatch" style={{ background: t.color }}>
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(t.color) ? t.color : '#4fc3ff'}
              onFocus={commit}
              onChange={(e) => setThemeColor(t.id, e.target.value)}
            />
          </span>
          <input
            className="theme-row__name"
            type="text"
            value={t.name}
            spellCheck={false}
            onFocus={commit}
            onChange={(e) => renameThemeColor(t.id, e.target.value)}
          />
          <button
            type="button"
            className="icon-btn theme-row__delete"
            title="Delete theme color"
            onClick={() => {
              commit();
              removeThemeColor(t.id);
            }}
          >
            <Svg d={UI_ICONS.trash} size={13} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn--outline props__wide-btn"
        onClick={() => {
          commit();
          addThemeColor('New color', '#4fc3ff');
        }}
      >
        <Svg d={UI_ICONS.plus} size={13} />
        Add theme color
      </button>
      <p className="props__note">
        Any color field across your design can link to one of these — editing it here updates every
        linked field at once. Look for the palette icon next to a color.
      </p>
    </FieldGroup>
  );
}

function CanvasProperties() {
  const project = useEditor((s) => s.project);
  const mode = useEditor((s) => s.mode);
  const background = useEditor(selectBackground);
  const gridSize = useEditor((s) => s.gridSize);
  const setGridSize = useEditor((s) => s.setGridSize);
  const setDevice = useEditor((s) => s.setDevice);
  const setLanguage = useEditor((s) => s.setLanguage);
  const setBackground = useEditor((s) => s.setBackground);
  const copyNormalToAod = useEditor((s) => s.copyNormalToAod);
  const commit = useEditor((s) => s.commit);
  const device = getDevice(project.deviceId);

  return (
    <>
      <FieldGroup title={mode === 'aod' ? 'Canvas — Always-On Display' : 'Canvas'}>
        <SelectField
          label="Device"
          value={project.deviceId}
          options={DEVICES.map((d) => ({ value: d.id, label: `${d.name} (${d.width}×${d.height})` }))}
          onChange={(v) => setDevice(v)}
        />
        <SelectField
          label="Language"
          value={project.language ?? DEFAULT_LANGUAGE}
          options={LANGUAGES}
          onChange={(v) => setLanguage(v === DEFAULT_LANGUAGE ? undefined : v)}
        />
        <ColorField
          label="Background"
          value={background}
          onStart={commit}
          onChange={(v) => setBackground(v)}
          bindingKey={backgroundBindingKey(mode)}
        />
        <NumberField
          label="Grid size"
          value={gridSize}
          min={2}
          max={100}
          onStart={() => undefined}
          onChange={(v) => setGridSize(v)}
          suffix="px"
        />
      </FieldGroup>
      <ThemePanel />
      {mode === 'aod' && (
        <FieldGroup title="AOD tools">
          <button className="btn btn--outline props__wide-btn" onClick={copyNormalToAod}>
            <Svg d={UI_ICONS.copy} size={13} />
            Copy from main watchface
          </button>
          <p className="props__note">
            AOD faces should stay mostly black to save battery — keep bright pixels under ~10% of the
            screen.
          </p>
        </FieldGroup>
      )}
      <FieldGroup title="Info">
        <p className="props__note">
          {device.name} · {device.screen} · {device.shape === 'round' ? 'Round' : 'Rectangular'} ·{' '}
          {device.width}×{device.height}px
        </p>
        <p className="props__note">Select an element on the canvas or in Layers to edit it.</p>
      </FieldGroup>
    </>
  );
}

export function PropertiesPanel() {
  const elements = useEditor(selectCurrentElements);
  const selectedIds = useEditor((s) => s.selectedIds);
  const alignSelected = useEditor((s) => s.alignSelected);
  const removeElements = useEditor((s) => s.removeElements);
  const updateElements = useEditor((s) => s.updateElements);
  const commit = useEditor((s) => s.commit);
  const selected = elements.filter((el) => selectedIds.includes(el.id));

  return (
    <div className="props">
      {selected.length === 0 && <CanvasProperties />}
      {selected.length === 1 && (
        <>
          <FieldGroup title={selected[0].name}>
            <TextField
              label="Name"
              value={selected[0].name}
              onStart={commit}
              onChange={(v) => updateElements([selected[0].id], { name: v })}
            />
          </FieldGroup>
          <ElementProperties el={selected[0]} />
        </>
      )}
      {selected.length > 1 && (
        <FieldGroup title={`${selected.length} elements selected`}>
          <p className="props__note">
            Drag to move all selected elements together. The align tools below line everything up
            with the first-selected element (tagged “Anchor” on the canvas).
          </p>
        </FieldGroup>
      )}
      {selected.length > 0 && (
        <div className="props__footer">
          {ALIGN_BUTTONS.map((b) => (
            <button
              key={b.kind}
              className="icon-btn"
              title={b.title}
              onClick={() => alignSelected(b.kind)}
            >
              <Svg d={b.icon} size={15} />
            </button>
          ))}
          <span className="props__footer-spacer" />
          <button
            className="icon-btn props__delete"
            title="Delete (Del)"
            onClick={() => removeElements(selectedIds)}
          >
            <Svg d={UI_ICONS.trash} size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
