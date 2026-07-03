export type DeviceShape = 'round' | 'rect';

export interface Device {
  id: string;
  name: string;
  screen: string;
  width: number;
  height: number;
  shape: DeviceShape;
  cornerRadius?: number;
  /** Device display name in the Zepp OS toolchain (zeus -t), when different from name */
  zeppName?: string;
}

export type DataSource =
  | 'hour'
  | 'hour12'
  | 'minute'
  | 'second'
  | 'ampm'
  | 'dayNumber'
  | 'dayName'
  | 'month'
  | 'monthName'
  | 'year'
  | 'heartRate'
  | 'steps'
  | 'battery'
  | 'calories'
  | 'distance'
  | 'weather'
  | 'weatherMin'
  | 'weatherMax'
  | 'humidity'
  | 'uvIndex'
  | 'pai'
  | 'spo2'
  | 'stress'
  | 'standHours'
  | 'sleepScore'
  | 'sleepDuration'
  | 'floors';

export type HandKind = 'hour' | 'minute' | 'second';
export type HandStyle = 'classic' | 'sword' | 'thin';

export type ComplicationKind =
  | 'heartRate'
  | 'steps'
  | 'battery'
  | 'calories'
  | 'weather'
  | 'date'
  | 'distance';

export interface ElementBase {
  id: string;
  name: string;
  /** Center position in canvas units */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees, user-set offset (hands add live time rotation on top) */
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
}

export interface ComplicationElement extends ElementBase {
  type: 'complication';
  kind: ComplicationKind;
  accentColor: string;
  /** Fallback color/font/scale for both texts (value/label overrides win) */
  textColor: string;
  fontFamily: string;
  textScale?: number;
  showRing: boolean;
  showIcon: boolean;
  showLabel: boolean;
  /** Value text (or day number on the date card) */
  valueColor?: string;
  valueFont?: string;
  valueScale?: number;
  valueDx?: number;
  valueDy?: number;
  /** Title/label text (or weekday on the date card) */
  labelColor?: string;
  labelFont?: string;
  labelScale?: number;
  labelDx?: number;
  labelDy?: number;
}

export interface HandElement extends ElementBase {
  type: 'hand';
  hand: HandKind;
  style: HandStyle;
  color: string;
  accentColor: string;
  showCap: boolean;
}

export type TimeFormat = 'HH:mm' | 'hh:mm' | 'HH:mm:ss' | 'hh:mm:ss';

export interface DigitalTimeElement extends ElementBase {
  type: 'digitalTime';
  format: TimeFormat;
  showAmPm: boolean;
  fontFamily: string;
  fontWeight: number;
  color: string;
  letterSpacing: number;
}

export interface TextElement extends ElementBase {
  type: 'text';
  text: string;
  fontFamily: string;
  fontWeight: number;
  color: string;
  letterSpacing: number;
  uppercase: boolean;
}

export interface NumberElement extends ElementBase {
  type: 'number';
  source: DataSource;
  fontFamily: string;
  fontWeight: number;
  color: string;
  letterSpacing: number;
  showUnit: boolean;
}

export type WeatherCondition =
  | 'sunny'
  | 'partly'
  | 'cloudy'
  | 'rain'
  | 'showers'
  | 'storm'
  | 'snow'
  | 'fog'
  | 'wind'
  | 'night'
  | 'partlyNight';

export interface WeatherIconElement extends ElementBase {
  type: 'weatherIcon';
  color: string;
  /** 'live' follows the watch's weather; any other value pins a fixed condition */
  condition: WeatherCondition | 'live';
}

export interface IconElement extends ElementBase {
  type: 'icon';
  /** Font Awesome icon name (or legacy built-in key) */
  icon: string;
  color: string;
  /** Font Awesome SVG path data (viewBox `iconWidth` × 512); legacy elements omit it */
  iconPath?: string;
  iconWidth?: number;
}

export interface ProgressBarElement extends ElementBase {
  type: 'progressBar';
  variant: 'linear' | 'circular';
  source: DataSource;
  trackColor: string;
  fillColor: string;
  thickness: number;
  rounded: boolean;
  /** Circular only: degrees, 0 = 12 o'clock */
  startAngle: number;
  sweep: number;
  showValue: boolean;
  fontFamily: string;
  /** Multiplier applied to the value text size (default 1) */
  textScale?: number;
}

export interface TickMarksElement extends ElementBase {
  type: 'tickMarks';
  count: number;
  majorEvery: number;
  shape: 'line' | 'dot';
  color: string;
  majorColor: string;
  length: number;
  majorLength: number;
  thickness: number;
  /** Draw the tick lines/dots (default true; the Numerals preset turns this off) */
  showTicks?: boolean;
  showNumbers: boolean;
  fontFamily: string;
  numberColor: string;
  /** Multiplier applied to the numeral size (default 1) */
  numberScale?: number;
  /** How many numerals ring the circle (default 12) */
  numberCount?: number;
  /** Increment between adjacent numerals (default 1) */
  numberStep?: number;
  /** Show 0 at the 12 o'clock position instead of the full value (count × step) */
  zeroAtTop?: boolean;
}

export type ImageFit = 'contain' | 'cover' | 'stretch';

export interface ImageElement extends ElementBase {
  type: 'image';
  assetId: string;
  src: string;
  fit: ImageFit;
  /** When set, the image rotates with live time like a watch hand */
  rotateWith?: HandKind;
  /** Rotation pivot as a fraction of the box (0–1); defaults to the center (0.5, 0.5) */
  pivotX?: number;
  pivotY?: number;
}

export type WatchElement =
  | ComplicationElement
  | HandElement
  | DigitalTimeElement
  | TextElement
  | NumberElement
  | IconElement
  | WeatherIconElement
  | ProgressBarElement
  | TickMarksElement
  | ImageElement;

export type ElementType = WatchElement['type'];

export interface AssetItem {
  id: string;
  name: string;
  src: string;
}

/** User-uploaded TTF/OTF font, embedded as a data URL */
export interface CustomFontItem {
  id: string;
  family: string;
  src: string;
}

export type EditorMode = 'normal' | 'aod';

export interface WatchfaceProject {
  id: string;
  name: string;
  deviceId: string;
  backgroundColor: string;
  aodBackgroundColor: string;
  normal: WatchElement[];
  aod: WatchElement[];
  assets: AssetItem[];
  /** Optional for projects saved before custom fonts existed */
  fonts?: CustomFontItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  deviceId: string;
  updatedAt: string;
  thumbnail?: string;
  /** Full design data — present for locally stored projects, used for live previews */
  project?: WatchfaceProject;
}

export interface LiveData {
  now: Date;
  heartRate: number;
  steps: number;
  battery: number;
  calories: number;
  distance: number;
  weatherTemp: number;
  weatherTempMin: number;
  weatherTempMax: number;
  weatherCondition: WeatherCondition;
  humidity: number;
  uvIndex: number;
  pai: number;
  spo2: number;
  stress: number;
  standHours: number;
  sleepScore: number;
  /** Total sleep in minutes */
  sleepMinutes: number;
  floors: number;
}
