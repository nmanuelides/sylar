import { create } from 'zustand';
import type { LiveData } from '@/types/watchface';

/** Fixed snapshot used for component thumbnails and static previews */
export const PREVIEW_DATA: LiveData = {
  now: new Date(2026, 4, 12, 10, 8, 36),
  heartRate: 102,
  steps: 7645,
  battery: 80,
  calories: 328,
  distance: 5.62,
  weatherTemp: 24,
  weatherTempMin: 18,
  weatherTempMax: 27,
  humidity: 62,
  uvIndex: 5,
  pai: 78,
  spo2: 98,
  stress: 34,
  standHours: 8,
  sleepScore: 82,
  sleepMinutes: 452,
  floors: 12,
};

export const useLiveData = create<LiveData>(() => ({
  ...PREVIEW_DATA,
  now: new Date(),
}));

let hr = 102;
let started = false;

export function startLiveData(): void {
  if (started) return;
  started = true;
  setInterval(() => {
    hr = Math.max(62, Math.min(150, hr + (Math.random() * 6 - 3)));
    useLiveData.setState((s) => ({
      now: new Date(),
      heartRate: Math.round(hr),
      steps: s.steps + (Math.random() < 0.25 ? Math.round(Math.random() * 9) : 0),
    }));
  }, 1000);
}
