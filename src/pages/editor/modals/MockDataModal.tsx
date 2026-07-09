import { useEditor } from '@/store/editorStore';
import { useMockData } from '@/store/liveDataStore';
import { Modal } from '@/components/common/Ui';
import { FieldGroup, FieldRow, NumberField, SelectField, SwitchField } from '@/components/common/PropertyFields';
import type { WeatherCondition } from '@/types/watchface';
import './modals.scss';

const WEATHER_OPTIONS: { value: WeatherCondition; label: string }[] = [
  { value: 'sunny', label: 'Sunny' },
  { value: 'partly', label: 'Partly cloudy' },
  { value: 'cloudy', label: 'Cloudy' },
  { value: 'rain', label: 'Rain' },
  { value: 'showers', label: 'Showers' },
  { value: 'storm', label: 'Storm' },
  { value: 'snow', label: 'Snow' },
  { value: 'fog', label: 'Fog' },
  { value: 'wind', label: 'Wind' },
  { value: 'night', label: 'Clear night' },
  { value: 'partlyNight', label: 'Partly cloudy night' },
];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** `datetime-local` inputs want local wall-clock time with no timezone info. */
function toLocalInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function MockDataModal() {
  const open = useEditor((s) => s.mockDataOpen);
  const setOpen = useEditor((s) => s.setMockDataOpen);
  const enabled = useMockData((s) => s.enabled);
  const values = useMockData((s) => s.values);
  const setEnabled = useMockData((s) => s.setEnabled);
  const setValue = useMockData((s) => s.setValue);
  const reset = useMockData((s) => s.reset);

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Mock data" width={420}>
      <FieldGroup title="Test scenario">
        <SwitchField label="Use mock data" checked={enabled} onChange={setEnabled} />
        <p className="props__note">
          {enabled
            ? 'The canvas and preview now use the values below instead of live/random data.'
            : 'Turn this on to pin battery, steps, weather and more to fixed test values.'}
        </p>
      </FieldGroup>

      {enabled && (
        <>
          <FieldGroup title="Date & time">
            <FieldRow label="Date & time">
              <input
                type="datetime-local"
                step={1}
                value={toLocalInputValue(values.now)}
                onChange={(e) => {
                  const d = new Date(e.target.value);
                  if (!Number.isNaN(d.getTime())) setValue('now', d);
                }}
              />
            </FieldRow>
          </FieldGroup>

          <FieldGroup title="Vitals & activity">
            <NumberField
              label="Battery"
              value={values.battery}
              min={0}
              max={100}
              suffix="%"
              onChange={(v) => setValue('battery', v)}
            />
            <NumberField
              label="Steps"
              value={values.steps}
              min={0}
              max={50000}
              step={100}
              onChange={(v) => setValue('steps', v)}
            />
            <NumberField
              label="Heart rate"
              value={values.heartRate}
              min={30}
              max={220}
              suffix="bpm"
              onChange={(v) => setValue('heartRate', v)}
            />
            <NumberField
              label="Calories"
              value={values.calories}
              min={0}
              max={5000}
              onChange={(v) => setValue('calories', v)}
            />
            <NumberField
              label="Distance"
              value={values.distance}
              min={0}
              max={100}
              step={0.1}
              suffix="km"
              onChange={(v) => setValue('distance', v)}
            />
            <NumberField
              label="SpO2"
              value={values.spo2}
              min={0}
              max={100}
              suffix="%"
              onChange={(v) => setValue('spo2', v)}
            />
            <NumberField
              label="Stress"
              value={values.stress}
              min={0}
              max={100}
              onChange={(v) => setValue('stress', v)}
            />
            <NumberField
              label="PAI"
              value={values.pai}
              min={0}
              max={150}
              onChange={(v) => setValue('pai', v)}
            />
            <NumberField
              label="Stand hours"
              value={values.standHours}
              min={0}
              max={12}
              onChange={(v) => setValue('standHours', v)}
            />
            <NumberField
              label="Sleep score"
              value={values.sleepScore}
              min={0}
              max={100}
              onChange={(v) => setValue('sleepScore', v)}
            />
            <NumberField
              label="Sleep duration"
              value={values.sleepMinutes}
              min={0}
              max={720}
              suffix="min"
              onChange={(v) => setValue('sleepMinutes', v)}
            />
            <NumberField
              label="Floors"
              value={values.floors}
              min={0}
              max={100}
              onChange={(v) => setValue('floors', v)}
            />
          </FieldGroup>

          <FieldGroup title="Weather">
            <SelectField
              label="Condition"
              value={values.weatherCondition}
              options={WEATHER_OPTIONS}
              onChange={(v) => setValue('weatherCondition', v)}
            />
            <NumberField
              label="Temperature"
              value={values.weatherTemp}
              min={-40}
              max={60}
              suffix="°"
              onChange={(v) => setValue('weatherTemp', v)}
            />
            <NumberField
              label="Min temp"
              value={values.weatherTempMin}
              min={-40}
              max={60}
              suffix="°"
              onChange={(v) => setValue('weatherTempMin', v)}
            />
            <NumberField
              label="Max temp"
              value={values.weatherTempMax}
              min={-40}
              max={60}
              suffix="°"
              onChange={(v) => setValue('weatherTempMax', v)}
            />
            <NumberField
              label="Humidity"
              value={values.humidity}
              min={0}
              max={100}
              suffix="%"
              onChange={(v) => setValue('humidity', v)}
            />
            <NumberField
              label="UV index"
              value={values.uvIndex}
              min={0}
              max={11}
              onChange={(v) => setValue('uvIndex', v)}
            />
          </FieldGroup>

          <button type="button" className="btn btn--outline props__wide-btn" onClick={reset}>
            Reset to current live values
          </button>
        </>
      )}
    </Modal>
  );
}
