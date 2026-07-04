import { useState } from 'react';
import type { WatchElement } from '@/types/watchface';
import {
  selectBackground,
  selectCurrentElements,
  useEditor,
  type AlignKind,
} from '@/store/editorStore';
import { DEVICES, getDevice } from '@/data/devices';
import { nearestWeight, weightsFor } from '@/data/fonts';
import { WEATHER_CONDITIONS } from '@/data/icons';
import { DATA_SOURCES } from '@/lib/time';
import { FONT_HEIGHT_RATIO } from '@/components/watchface/renderers';
import {
  ColorField,
  FieldGroup,
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

const ALIGN_BUTTONS: { kind: AlignKind; icon: string; title: string }[] = [
  { kind: 'left', icon: UI_ICONS.alignL, title: 'Align left' },
  { kind: 'centerH', icon: UI_ICONS.alignCH, title: 'Center horizontally' },
  { kind: 'right', icon: UI_ICONS.alignR, title: 'Align right' },
  { kind: 'top', icon: UI_ICONS.alignT, title: 'Align top' },
  { kind: 'centerV', icon: UI_ICONS.alignCV, title: 'Center vertically' },
  { kind: 'bottom', icon: UI_ICONS.alignB, title: 'Align bottom' },
];

function useElementPatch(id: string) {
  const updateElements = useEditor((s) => s.updateElements);
  const commit = useEditor((s) => s.commit);
  return {
    patch: (p: Record<string, unknown>) =>
      updateElements([id], p as Partial<WatchElement>),
    commitPatch: (p: Record<string, unknown>) => {
      commit();
      updateElements([id], p as Partial<WatchElement>);
    },
    commit,
  };
}

function FontFields({
  el,
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
      <ColorField label="Color" value={el.color} onStart={commit} onChange={(v) => patch({ color: v })} />
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
        <SliderField
          label="Pivot X"
          value={el.pivotX ?? 0.5}
          min={0}
          max={1}
          step={0.001}
          onStart={commit}
          onChange={(v) => patch({ pivotX: v })}
          displayScale={100}
          suffix="%"
        />
        <SliderField
          label="Pivot Y"
          value={el.pivotY ?? 0.5}
          min={0}
          max={1}
          step={0.001}
          onStart={commit}
          onChange={(v) => patch({ pivotY: v })}
          displayScale={100}
          suffix="%"
        />
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

      {el.type === 'complication' && (
        <>
          <FieldGroup title="Complication">
            <ColorField
              label="Accent"
              value={el.accentColor}
              onStart={commit}
              onChange={(v) => patch({ accentColor: v })}
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
          <ColorField label="Color" value={el.color} onStart={commit} onChange={(v) => patch({ color: v })} />
          <ColorField
            label="Accent"
            value={el.accentColor}
            onStart={commit}
            onChange={(v) => patch({ accentColor: v })}
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
          <FontFields el={el} patch={patch} commitPatch={commitPatch} commit={commit} />
        </FieldGroup>
      )}

      {el.type === 'number' && (
        <FieldGroup title="Number">
          <SelectField
            label="Data"
            value={el.source}
            options={DATA_SOURCES}
            onChange={(v) => commitPatch({ source: v })}
          />
          <SwitchField label="Unit" checked={el.showUnit} onChange={(v) => commitPatch({ showUnit: v })} />
          <FontFields el={el} patch={patch} commitPatch={commitPatch} commit={commit} />
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
          <FontFields el={el} patch={patch} commitPatch={commitPatch} commit={commit} />
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
          <ColorField label="Color" value={el.color} onStart={commit} onChange={(v) => patch({ color: v })} />
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
          <ColorField label="Color" value={el.color} onStart={commit} onChange={(v) => patch({ color: v })} />
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
          />
          <ColorField
            label="Track"
            value={el.trackColor}
            onStart={commit}
            onChange={(v) => patch({ trackColor: v })}
          />
          <SliderField
            label="Thickness"
            value={el.thickness}
            min={2}
            max={40}
            onStart={commit}
            onChange={(v) => patch({ thickness: v })}
          />
          <SwitchField label="Rounded" checked={el.rounded} onChange={(v) => commitPatch({ rounded: v })} />
          {el.variant === 'circular' && (
            <>
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
                min={2}
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
              />
              <ColorField
                label="Major color"
                value={el.majorColor}
                onStart={commit}
                onChange={(v) => patch({ majorColor: v })}
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
            label="Numerals"
            checked={el.showNumbers}
            onChange={(v) => commitPatch({ showNumbers: v })}
          />
          {el.showNumbers && (
            <>
              <NumberField
                label="Numerals"
                value={el.numberCount ?? 12}
                min={1}
                max={60}
                onStart={commit}
                onChange={(v) => patch({ numberCount: Math.round(v) })}
              />
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
              <SliderField
                label="Text size"
                value={el.numberScale ?? 1}
                min={0.1}
                max={2.5}
                step={0.01}
                onStart={commit}
                onChange={(v) => patch({ numberScale: v })}
                displayScale={100}
                suffix="%"
              />
              <FontField
                label="Font"
                value={el.fontFamily}
                onChange={(v) => commitPatch({ fontFamily: v })}
              />
              <ColorField
                label="Number color"
                value={el.numberColor}
                onStart={commit}
                onChange={(v) => patch({ numberColor: v })}
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
    </>
  );
}

function CanvasProperties() {
  const project = useEditor((s) => s.project);
  const mode = useEditor((s) => s.mode);
  const background = useEditor(selectBackground);
  const gridSize = useEditor((s) => s.gridSize);
  const setGridSize = useEditor((s) => s.setGridSize);
  const setDevice = useEditor((s) => s.setDevice);
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
        <ColorField
          label="Background"
          value={background}
          onStart={commit}
          onChange={(v) => setBackground(v)}
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
