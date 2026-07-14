import type { DataSource, HandKind, LiveData, RotationSource, TimeFormat } from '@/types/watchface';
import { DEFAULT_LANGUAGE, MONTH_NAMES, WEEKDAY_NAMES } from '@/lib/i18n';

export function handAngle(hand: HandKind, d: Date): number {
  const s = d.getSeconds();
  const m = d.getMinutes();
  const h = d.getHours() % 12;
  switch (hand) {
    case 'second':
      return s * 6;
    case 'minute':
      return m * 6 + s * 0.1;
    default:
      return h * 30 + m * 0.5;
  }
}

/** Angle (Sylar convention: 0 = up, clockwise) for any live rotation source. */
export function rotationSourceAngle(source: RotationSource, data: LiveData): number {
  if (source === 'hour' || source === 'minute' || source === 'second') {
    return handAngle(source, data.now);
  }
  if (source === 'battery') {
    return (Math.max(0, Math.min(100, data.battery)) / 100) * 360;
  }
  // monthday: the 1st = 0°, one of 31 fixed positions — like a printed 1–31
  // date ring, which can't adapt to shorter months either.
  if (source === 'monthday') {
    return (data.now.getDate() - 1) * (360 / 31);
  }
  // weekday: Monday = 0°, one of 7 evenly-spaced positions, matching JS's
  // Sunday-first getDay() remapped to a Monday-first index.
  const mondayIndex = (data.now.getDay() + 6) % 7;
  return mondayIndex * (360 / 7);
}

const pad = (n: number): string => String(n).padStart(2, '0');

export function formatTime(d: Date, format: TimeFormat): { main: string; ampm: string } {
  const h24 = d.getHours();
  const twelve = format.startsWith('hh');
  const h = twelve ? h24 % 12 || 12 : h24;
  const withSeconds = format.endsWith('ss');
  const main = `${pad(h)}:${pad(d.getMinutes())}${withSeconds ? `:${pad(d.getSeconds())}` : ''}`;
  return { main, ampm: twelve ? (h24 < 12 ? 'AM' : 'PM') : '' };
}


export interface SourceValue {
  value: string;
  unit: string;
  label: string;
  fraction: number;
}

export function sourceValue(source: DataSource, data: LiveData): SourceValue {
  const d = data.now;
  const lang = data.language ?? DEFAULT_LANGUAGE;
  switch (source) {
    case 'hour':
      return { value: pad(d.getHours()), unit: '', label: 'HOUR', fraction: d.getHours() / 24 };
    case 'hour12':
      return { value: pad(d.getHours() % 12 || 12), unit: '', label: 'HOUR', fraction: (d.getHours() % 12) / 12 };
    case 'minute':
      return { value: pad(d.getMinutes()), unit: '', label: 'MINUTES', fraction: d.getMinutes() / 60 };
    case 'second':
      return { value: pad(d.getSeconds()), unit: '', label: 'SECONDS', fraction: d.getSeconds() / 60 };
    case 'ampm':
      return { value: d.getHours() < 12 ? 'AM' : 'PM', unit: '', label: 'AM/PM', fraction: d.getHours() < 12 ? 0 : 1 };
    case 'dayNumber':
      return { value: String(d.getDate()), unit: '', label: 'DAY', fraction: d.getDate() / 31 };
    case 'dayName':
      return { value: WEEKDAY_NAMES[lang][d.getDay()], unit: '', label: 'WEEKDAY', fraction: (d.getDay() || 7) / 7 };
    case 'month':
      return { value: pad(d.getMonth() + 1), unit: '', label: 'MONTH', fraction: (d.getMonth() + 1) / 12 };
    case 'monthName':
      return { value: MONTH_NAMES[lang][d.getMonth()], unit: '', label: 'MONTH', fraction: (d.getMonth() + 1) / 12 };
    case 'year':
      return { value: String(d.getFullYear()), unit: '', label: 'YEAR', fraction: 1 };
    case 'heartRate':
      return { value: String(data.heartRate), unit: ' BPM', label: 'HEART RATE', fraction: data.heartRate / 180 };
    case 'steps': {
      const goal = data.stepsGoal ?? 10000;
      return { value: String(data.steps), unit: '', label: 'STEPS', fraction: data.steps / goal };
    }
    case 'stepsGoal':
      return { value: String(data.stepsGoal ?? 10000), unit: '', label: 'STEP GOAL', fraction: 1 };
    case 'battery':
      return { value: `${data.battery}%`, unit: '', label: 'BATTERY', fraction: data.battery / 100 };
    case 'calories':
      return { value: String(data.calories), unit: ' KCAL', label: 'CALORIES', fraction: data.calories / 600 };
    case 'distance':
      return { value: data.distance.toFixed(2), unit: ' KM', label: 'DISTANCE', fraction: data.distance / 10 };
    case 'weather':
      return { value: `${data.weatherTemp}°`, unit: '', label: 'WEATHER', fraction: data.weatherTemp / 40 };
    case 'weatherMin':
      return { value: `${data.weatherTempMin}°`, unit: '', label: 'MIN TEMP', fraction: data.weatherTempMin / 40 };
    case 'weatherMax':
      return { value: `${data.weatherTempMax}°`, unit: '', label: 'MAX TEMP', fraction: data.weatherTempMax / 40 };
    case 'humidity':
      return { value: `${data.humidity}%`, unit: '', label: 'HUMIDITY', fraction: data.humidity / 100 };
    case 'uvIndex':
      return { value: String(data.uvIndex), unit: ' UV', label: 'UV INDEX', fraction: data.uvIndex / 11 };
    case 'pai':
      return { value: String(data.pai), unit: '', label: 'PAI', fraction: data.pai / 100 };
    case 'spo2':
      return { value: `${data.spo2}%`, unit: '', label: 'SPO2', fraction: data.spo2 / 100 };
    case 'stress':
      return { value: String(data.stress), unit: '', label: 'STRESS', fraction: data.stress / 100 };
    case 'standHours':
      return { value: String(data.standHours), unit: '/12', label: 'STAND', fraction: data.standHours / 12 };
    case 'sleepScore':
      return { value: String(data.sleepScore), unit: '', label: 'SLEEP SCORE', fraction: data.sleepScore / 100 };
    case 'sleepDuration': {
      const h = Math.floor(data.sleepMinutes / 60);
      const m = data.sleepMinutes % 60;
      return { value: `${h}:${pad(m)}`, unit: ' H', label: 'SLEEP', fraction: data.sleepMinutes / 480 };
    }
    case 'floors':
      return { value: String(data.floors), unit: ' FL', label: 'FLOORS', fraction: data.floors / 20 };
  }
}

export const DATA_SOURCES: { value: DataSource; label: string }[] = [
  { value: 'hour', label: 'Hour (24h)' },
  { value: 'hour12', label: 'Hour (12h)' },
  { value: 'minute', label: 'Minutes' },
  { value: 'second', label: 'Seconds' },
  { value: 'ampm', label: 'AM / PM' },
  { value: 'dayNumber', label: 'Day number' },
  { value: 'dayName', label: 'Day name' },
  { value: 'month', label: 'Month number' },
  { value: 'monthName', label: 'Month name' },
  { value: 'year', label: 'Year' },
  { value: 'heartRate', label: 'Heart rate' },
  { value: 'steps', label: 'Steps' },
  { value: 'stepsGoal', label: 'Step goal' },
  { value: 'battery', label: 'Battery' },
  { value: 'calories', label: 'Calories' },
  { value: 'distance', label: 'Distance' },
  { value: 'weather', label: 'Temperature' },
  { value: 'weatherMin', label: 'Min temperature' },
  { value: 'weatherMax', label: 'Max temperature' },
  { value: 'humidity', label: 'Humidity' },
  { value: 'uvIndex', label: 'UV index' },
  { value: 'pai', label: 'PAI' },
  { value: 'spo2', label: 'SpO2' },
  { value: 'stress', label: 'Stress' },
  { value: 'standHours', label: 'Stand hours' },
  { value: 'sleepScore', label: 'Sleep score' },
  { value: 'sleepDuration', label: 'Sleep duration' },
  { value: 'floors', label: 'Floors climbed' },
];
