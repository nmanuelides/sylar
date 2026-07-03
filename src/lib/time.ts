import type { DataSource, HandKind, LiveData, TimeFormat } from '@/types/watchface';

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

const pad = (n: number): string => String(n).padStart(2, '0');

export function formatTime(d: Date, format: TimeFormat): { main: string; ampm: string } {
  const h24 = d.getHours();
  const twelve = format.startsWith('hh');
  const h = twelve ? h24 % 12 || 12 : h24;
  const withSeconds = format.endsWith('ss');
  const main = `${pad(h)}:${pad(d.getMinutes())}${withSeconds ? `:${pad(d.getSeconds())}` : ''}`;
  return { main, ampm: twelve ? (h24 < 12 ? 'AM' : 'PM') : '' };
}

export const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
export const MONTHS = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

export interface SourceValue {
  value: string;
  unit: string;
  label: string;
  fraction: number;
}

export function sourceValue(source: DataSource, data: LiveData): SourceValue {
  switch (source) {
    case 'heartRate':
      return { value: String(data.heartRate), unit: ' BPM', label: 'HEART RATE', fraction: data.heartRate / 180 };
    case 'steps':
      return { value: String(data.steps), unit: '', label: 'STEPS', fraction: data.steps / 10000 };
    case 'battery':
      return { value: `${data.battery}%`, unit: '', label: 'BATTERY', fraction: data.battery / 100 };
    case 'calories':
      return { value: String(data.calories), unit: ' KCAL', label: 'CALORIES', fraction: data.calories / 600 };
    case 'distance':
      return { value: data.distance.toFixed(2), unit: ' KM', label: 'DISTANCE', fraction: data.distance / 10 };
    case 'weather':
      return { value: `${data.weatherTemp}°`, unit: '', label: 'WEATHER', fraction: data.weatherTemp / 40 };
  }
}

export const DATA_SOURCES: { value: DataSource; label: string }[] = [
  { value: 'heartRate', label: 'Heart rate' },
  { value: 'steps', label: 'Steps' },
  { value: 'battery', label: 'Battery' },
  { value: 'calories', label: 'Calories' },
  { value: 'distance', label: 'Distance' },
  { value: 'weather', label: 'Weather' },
];
