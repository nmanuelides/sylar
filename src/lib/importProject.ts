import type { WatchfaceProject } from '@/types/watchface';
import { DEVICES, DEFAULT_DEVICE_ID } from '@/data/devices';
import { projectId } from './uid';

/**
 * Parses an exported `.sylar.json` file (or a bare project object) into a
 * fresh project. Always assigns a new id so imports never silently overwrite
 * an existing watchface.
 */
export function parseProjectFile(text: string): WatchfaceProject {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Not a valid JSON file');
  }
  const container = raw as { format?: string; project?: unknown };
  const candidate = (container.project ?? raw) as Partial<WatchfaceProject>;

  if (!Array.isArray(candidate.normal)) {
    throw new Error('Not a Sylar watchface file (missing element data)');
  }
  const deviceId = DEVICES.some((d) => d.id === candidate.deviceId)
    ? (candidate.deviceId as string)
    : DEFAULT_DEVICE_ID;

  const now = new Date().toISOString();
  return {
    id: projectId(),
    name: typeof candidate.name === 'string' && candidate.name.trim() ? candidate.name : 'Imported watchface',
    deviceId,
    backgroundColor:
      typeof candidate.backgroundColor === 'string' ? candidate.backgroundColor : '#060d18',
    aodBackgroundColor:
      typeof candidate.aodBackgroundColor === 'string' ? candidate.aodBackgroundColor : '#000000',
    normal: candidate.normal,
    aod: Array.isArray(candidate.aod) ? candidate.aod : [],
    assets: Array.isArray(candidate.assets) ? candidate.assets : [],
    fonts: Array.isArray(candidate.fonts) ? candidate.fonts : [],
    createdAt: now,
    updatedAt: now,
  };
}
