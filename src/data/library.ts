import type {
  ComplicationElement,
  ComplicationKind,
  Device,
  HandElement,
  HandKind,
  WatchElement,
} from '@/types/watchface';
import { uid } from '@/lib/uid';
import { DEFAULT_FONT } from '@/data/fonts';
import { STARTER_ICONS, type Glyph } from '@/data/icons';

export type LibraryCategory =
  | 'complications'
  | 'hands'
  | 'text'
  | 'icons'
  | 'bars'
  | 'marks';

export interface LibraryItem {
  id: string;
  label: string;
  category: LibraryCategory;
  create: (x: number, y: number) => WatchElement;
}

const ACCENT = '#4fc3ff';
const WHITE = '#eaf6ff';

const COMPLICATION_LABELS: Record<ComplicationKind, string> = {
  heartRate: 'Heart Rate',
  steps: 'Steps',
  battery: 'Battery',
  calories: 'Calories',
  weather: 'Weather',
  date: 'Date',
  distance: 'Distance',
};

function complication(kind: ComplicationKind, x: number, y: number): ComplicationElement {
  return {
    id: uid(),
    type: 'complication',
    kind,
    name: COMPLICATION_LABELS[kind],
    x,
    y,
    width: 120,
    height: 120,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    accentColor: ACCENT,
    textColor: WHITE,
    fontFamily: DEFAULT_FONT,
    showRing: kind !== 'date',
    showIcon: true,
    showLabel: true,
  };
}

const HAND_DEFAULTS: Record<HandKind, { width: number; height: number; name: string }> = {
  hour: { width: 18, height: 250, name: 'Hour Hand' },
  minute: { width: 14, height: 350, name: 'Minute Hand' },
  second: { width: 8, height: 420, name: 'Second Hand' },
};

function hand(kind: HandKind, x: number, y: number): HandElement {
  const d = HAND_DEFAULTS[kind];
  return {
    id: uid(),
    type: 'hand',
    hand: kind,
    name: d.name,
    x,
    y,
    width: d.width,
    height: d.height,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    style: kind === 'second' ? 'thin' : 'sword',
    color: kind === 'second' ? ACCENT : WHITE,
    accentColor: kind === 'second' ? WHITE : ACCENT,
    showCap: true,
  };
}

export const LIBRARY: LibraryItem[] = [
  ...(Object.keys(COMPLICATION_LABELS) as ComplicationKind[]).map((kind) => ({
    id: `comp-${kind}`,
    label: COMPLICATION_LABELS[kind],
    category: 'complications' as const,
    create: (x: number, y: number) => complication(kind, x, y),
  })),
  {
    id: 'weather-icon',
    label: 'Weather Icon',
    category: 'complications' as const,
    create: (x: number, y: number): WatchElement => ({
      id: uid(),
      type: 'weatherIcon',
      name: 'Weather Icon',
      x,
      y,
      width: 64,
      height: 64,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      color: ACCENT,
      condition: 'live',
    }),
  },
  ...(['hour', 'minute', 'second'] as HandKind[]).map((kind) => ({
    id: `hand-${kind}`,
    label: HAND_DEFAULTS[kind].name,
    category: 'hands' as const,
    create: (x: number, y: number) => hand(kind, x, y),
  })),
  {
    id: 'digital-time',
    label: 'Digital Time',
    category: 'text',
    create: (x, y) => ({
      id: uid(),
      type: 'digitalTime',
      name: 'Digital Time',
      x,
      y,
      width: 240,
      height: 72,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      format: 'HH:mm',
      showAmPm: false,
      fontFamily: DEFAULT_FONT,
      fontWeight: 700,
      color: WHITE,
      letterSpacing: 2,
    }),
  },
  {
    id: 'number',
    label: 'Number',
    category: 'text',
    create: (x, y) => ({
      id: uid(),
      type: 'number',
      name: 'Number',
      x,
      y,
      width: 140,
      height: 44,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      source: 'steps',
      fontFamily: DEFAULT_FONT,
      fontWeight: 600,
      color: WHITE,
      letterSpacing: 1,
      showUnit: false,
    }),
  },
  {
    id: 'text',
    label: 'Text Label',
    category: 'text',
    create: (x, y) => ({
      id: uid(),
      type: 'text',
      name: 'Text',
      x,
      y,
      width: 160,
      height: 32,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      text: 'TEXT',
      fontFamily: 'Rajdhani',
      fontWeight: 600,
      color: ACCENT,
      letterSpacing: 3,
      uppercase: true,
    }),
  },
  {
    id: 'bar-linear',
    label: 'Linear Bar',
    category: 'bars',
    create: (x, y) => ({
      id: uid(),
      type: 'progressBar',
      name: 'Linear Bar',
      x,
      y,
      width: 180,
      height: 24,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      variant: 'linear',
      source: 'battery',
      trackColor: 'rgba(79,195,255,0.18)',
      fillColor: ACCENT,
      thickness: 10,
      rounded: true,
      startAngle: -120,
      sweep: 240,
      showValue: false,
      fontFamily: DEFAULT_FONT,
    }),
  },
  {
    id: 'bar-circular',
    label: 'Circular Bar',
    category: 'bars',
    create: (x, y) => ({
      id: uid(),
      type: 'progressBar',
      name: 'Circular Bar',
      x,
      y,
      width: 140,
      height: 140,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      variant: 'circular',
      source: 'steps',
      trackColor: 'rgba(79,195,255,0.18)',
      fillColor: ACCENT,
      thickness: 10,
      rounded: true,
      startAngle: -120,
      sweep: 240,
      showValue: true,
      fontFamily: DEFAULT_FONT,
    }),
  },
  {
    id: 'marks-hours',
    label: 'Hour Marks',
    category: 'marks',
    create: (x, y) => ({
      id: uid(),
      type: 'tickMarks',
      name: 'Hour Marks',
      x,
      y,
      width: 440,
      height: 440,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      count: 12,
      majorEvery: 3,
      shape: 'line',
      color: 'rgba(234,246,255,0.55)',
      majorColor: ACCENT,
      length: 14,
      majorLength: 24,
      thickness: 4,
      showNumbers: false,
      fontFamily: DEFAULT_FONT,
      numberColor: WHITE,
    }),
  },
  {
    id: 'marks-minutes',
    label: 'Minute Marks',
    category: 'marks',
    create: (x, y) => ({
      id: uid(),
      type: 'tickMarks',
      name: 'Minute Marks',
      x,
      y,
      width: 440,
      height: 440,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      count: 60,
      majorEvery: 5,
      shape: 'line',
      color: 'rgba(234,246,255,0.35)',
      majorColor: 'rgba(234,246,255,0.8)',
      length: 8,
      majorLength: 16,
      thickness: 2,
      showNumbers: false,
      fontFamily: DEFAULT_FONT,
      numberColor: WHITE,
    }),
  },
  {
    id: 'marks-labels',
    label: 'Labels',
    category: 'marks',
    create: (x, y) => ({
      id: uid(),
      type: 'tickMarks',
      name: 'Labels',
      x,
      y,
      width: 440,
      height: 440,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      count: 12,
      majorEvery: 3,
      shape: 'line',
      color: 'rgba(234,246,255,0.4)',
      majorColor: ACCENT,
      length: 10,
      majorLength: 16,
      thickness: 3,
      showTicks: false,
      showNumbers: true,
      fontFamily: DEFAULT_FONT,
      numberColor: WHITE,
    }),
  },
  {
    id: 'marks-weekdays',
    label: 'Days of Week',
    category: 'marks',
    create: (x, y) => ({
      id: uid(),
      type: 'tickMarks',
      name: 'Days of Week',
      x,
      y,
      width: 440,
      height: 440,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      count: 7,
      majorEvery: 1,
      shape: 'line',
      color: 'rgba(234,246,255,0.4)',
      majorColor: ACCENT,
      length: 10,
      majorLength: 16,
      thickness: 3,
      showTicks: false,
      showNumbers: true,
      numberCount: 7,
      labels: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
      curveLabels: true,
      fontFamily: DEFAULT_FONT,
      numberColor: WHITE,
    }),
  },
  ...STARTER_ICONS.map((ic) => ({
    id: `icon-${ic.name}`,
    label: ic.label,
    category: 'icons' as const,
    create: (x: number, y: number): WatchElement =>
      createIconElement(x, y, ic.name, ic.glyph),
  })),
];

export function createIconElement(
  x: number,
  y: number,
  name: string,
  glyph: Glyph,
): WatchElement {
  return {
    id: uid(),
    type: 'icon',
    name: `Icon · ${name}`,
    x,
    y,
    width: 48,
    height: 48,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    icon: name,
    iconPath: glyph.path,
    iconWidth: glyph.width,
    color: ACCENT,
  };
}

export function getLibraryItem(id: string): LibraryItem | undefined {
  return LIBRARY.find((i) => i.id === id);
}

/** Elements a fresh project starts with — a minimal analog face. */
export function starterElements(device: Device): WatchElement[] {
  const cx = device.width / 2;
  const cy = device.height / 2;
  const size = Math.min(device.width, device.height) - 40;
  const marks = getLibraryItem('marks-minutes')!.create(cx, cy);
  marks.width = size;
  marks.height = size;
  return [
    marks,
    hand('hour', cx, cy),
    hand('minute', cx, cy),
    hand('second', cx, cy),
  ];
}
