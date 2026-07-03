import type { Device } from '@/types/watchface';

export const DEVICES: Device[] = [
  { id: 'balance', name: 'Amazfit Balance', screen: '1.5" AMOLED', width: 480, height: 480, shape: 'round' },
  { id: 'balance2', name: 'Amazfit Balance 2', screen: '1.5" AMOLED', width: 480, height: 480, shape: 'round' },
  { id: 'balance3', name: 'Amazfit Balance 3', screen: '1.5" AMOLED', width: 480, height: 480, shape: 'round' },
  { id: 'gtr4', name: 'Amazfit GTR 4', screen: '1.43" AMOLED', width: 466, height: 466, shape: 'round' },
  { id: 'active2', name: 'Amazfit Active 2', screen: '1.32" AMOLED', width: 466, height: 466, shape: 'round', zeppName: 'Amazfit Active 2 (Round)' },
  { id: 'trex3', name: 'Amazfit T-Rex 3', screen: '1.5" AMOLED', width: 480, height: 480, shape: 'round' },
  { id: 'cheetah-pro', name: 'Amazfit Cheetah Pro', screen: '1.45" AMOLED', width: 480, height: 480, shape: 'round' },
  { id: 'gts4', name: 'Amazfit GTS 4', screen: '1.75" AMOLED', width: 390, height: 450, shape: 'rect', cornerRadius: 96 },
  { id: 'bip5', name: 'Amazfit Bip 5', screen: '1.91" TFT', width: 320, height: 380, shape: 'rect', cornerRadius: 64 },
];

export const DEFAULT_DEVICE_ID = 'balance';

export function getDevice(id: string): Device {
  return DEVICES.find((d) => d.id === id) ?? DEVICES[0];
}
