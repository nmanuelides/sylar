// Per-icon deep imports keep the ~1.4k-icon package out of the main bundle;
// the full catalog is only dynamically imported by the IconPicker.
import type { IconDefinition } from '@fortawesome/fontawesome-common-types';
import { faBatteryFull } from '@fortawesome/free-solid-svg-icons/faBatteryFull';
import { faBatteryHalf } from '@fortawesome/free-solid-svg-icons/faBatteryHalf';
import { faBell } from '@fortawesome/free-solid-svg-icons/faBell';
import { faBolt } from '@fortawesome/free-solid-svg-icons/faBolt';
import { faCalendarDays } from '@fortawesome/free-solid-svg-icons/faCalendarDays';
import { faCamera } from '@fortawesome/free-solid-svg-icons/faCamera';
import { faCloud } from '@fortawesome/free-solid-svg-icons/faCloud';
import { faCloudBolt } from '@fortawesome/free-solid-svg-icons/faCloudBolt';
import { faCloudMoon } from '@fortawesome/free-solid-svg-icons/faCloudMoon';
import { faCloudRain } from '@fortawesome/free-solid-svg-icons/faCloudRain';
import { faCloudShowersHeavy } from '@fortawesome/free-solid-svg-icons/faCloudShowersHeavy';
import { faCloudSun } from '@fortawesome/free-solid-svg-icons/faCloudSun';
import { faSmog } from '@fortawesome/free-solid-svg-icons/faSmog';
import { faCommentDots } from '@fortawesome/free-solid-svg-icons/faCommentDots';
import { faCompass } from '@fortawesome/free-solid-svg-icons/faCompass';
import { faCrown } from '@fortawesome/free-solid-svg-icons/faCrown';
import { faDroplet } from '@fortawesome/free-solid-svg-icons/faDroplet';
import { faDumbbell } from '@fortawesome/free-solid-svg-icons/faDumbbell';
import { faEnvelope } from '@fortawesome/free-solid-svg-icons/faEnvelope';
import { faFire } from '@fortawesome/free-solid-svg-icons/faFire';
import { faGamepad } from '@fortawesome/free-solid-svg-icons/faGamepad';
import { faGear } from '@fortawesome/free-solid-svg-icons/faGear';
import { faGem } from '@fortawesome/free-solid-svg-icons/faGem';
import { faGhost } from '@fortawesome/free-solid-svg-icons/faGhost';
import { faHeadphones } from '@fortawesome/free-solid-svg-icons/faHeadphones';
import { faHeart } from '@fortawesome/free-solid-svg-icons/faHeart';
import { faHeartPulse } from '@fortawesome/free-solid-svg-icons/faHeartPulse';
import { faHourglassHalf } from '@fortawesome/free-solid-svg-icons/faHourglassHalf';
import { faLocationDot } from '@fortawesome/free-solid-svg-icons/faLocationDot';
import { faMoon } from '@fortawesome/free-solid-svg-icons/faMoon';
import { faMountain } from '@fortawesome/free-solid-svg-icons/faMountain';
import { faMusic } from '@fortawesome/free-solid-svg-icons/faMusic';
import { faPersonBiking } from '@fortawesome/free-solid-svg-icons/faPersonBiking';
import { faPersonRunning } from '@fortawesome/free-solid-svg-icons/faPersonRunning';
import { faPersonSwimming } from '@fortawesome/free-solid-svg-icons/faPersonSwimming';
import { faPersonWalking } from '@fortawesome/free-solid-svg-icons/faPersonWalking';
import { faPhone } from '@fortawesome/free-solid-svg-icons/faPhone';
import { faPlane } from '@fortawesome/free-solid-svg-icons/faPlane';
import { faRocket } from '@fortawesome/free-solid-svg-icons/faRocket';
import { faRoute } from '@fortawesome/free-solid-svg-icons/faRoute';
import { faShoePrints } from '@fortawesome/free-solid-svg-icons/faShoePrints';
import { faSignal } from '@fortawesome/free-solid-svg-icons/faSignal';
import { faSkull } from '@fortawesome/free-solid-svg-icons/faSkull';
import { faSnowflake } from '@fortawesome/free-solid-svg-icons/faSnowflake';
import { faStar } from '@fortawesome/free-solid-svg-icons/faStar';
import { faStopwatch } from '@fortawesome/free-solid-svg-icons/faStopwatch';
import { faSun } from '@fortawesome/free-solid-svg-icons/faSun';
import { faTemperatureHalf } from '@fortawesome/free-solid-svg-icons/faTemperatureHalf';
import { faWifi } from '@fortawesome/free-solid-svg-icons/faWifi';
import { faWind } from '@fortawesome/free-solid-svg-icons/faWind';

/** A renderable Font Awesome glyph (SVG path in a `width` × 512 viewBox). */
export interface Glyph {
  path: string;
  width: number;
}

export function defToGlyph(def: IconDefinition): Glyph {
  const [width, , , , path] = def.icon;
  return { path: Array.isArray(path) ? path.join(' ') : path, width };
}

/** Icons offered directly in the component library (full catalog via the icon picker). */
export const STARTER_ICONS: { name: string; label: string; glyph: Glyph }[] = (
  [
    ['heart', 'Heart', faHeart],
    ['heart-pulse', 'Heart Pulse', faHeartPulse],
    ['person-running', 'Running', faPersonRunning],
    ['person-walking', 'Walking', faPersonWalking],
    ['person-biking', 'Cycling', faPersonBiking],
    ['person-swimming', 'Swimming', faPersonSwimming],
    ['shoe-prints', 'Steps', faShoePrints],
    ['dumbbell', 'Dumbbell', faDumbbell],
    ['fire', 'Fire', faFire],
    ['bolt', 'Bolt', faBolt],
    ['battery-full', 'Battery', faBatteryFull],
    ['battery-half', 'Battery ½', faBatteryHalf],
    ['moon', 'Moon', faMoon],
    ['sun', 'Sun', faSun],
    ['cloud', 'Cloud', faCloud],
    ['cloud-sun', 'Cloud Sun', faCloudSun],
    ['cloud-rain', 'Rain', faCloudRain],
    ['snowflake', 'Snow', faSnowflake],
    ['wind', 'Wind', faWind],
    ['droplet', 'Droplet', faDroplet],
    ['temperature-half', 'Temp', faTemperatureHalf],
    ['music', 'Music', faMusic],
    ['headphones', 'Headphones', faHeadphones],
    ['phone', 'Phone', faPhone],
    ['bell', 'Bell', faBell],
    ['envelope', 'Mail', faEnvelope],
    ['comment-dots', 'Message', faCommentDots],
    ['star', 'Star', faStar],
    ['gear', 'Gear', faGear],
    ['compass', 'Compass', faCompass],
    ['location-dot', 'Location', faLocationDot],
    ['route', 'Route', faRoute],
    ['mountain', 'Mountain', faMountain],
    ['stopwatch', 'Stopwatch', faStopwatch],
    ['hourglass-half', 'Hourglass', faHourglassHalf],
    ['calendar-days', 'Calendar', faCalendarDays],
    ['wifi', 'Wi-Fi', faWifi],
    ['signal', 'Signal', faSignal],
    ['plane', 'Plane', faPlane],
    ['camera', 'Camera', faCamera],
    ['gamepad', 'Gamepad', faGamepad],
    ['rocket', 'Rocket', faRocket],
    ['crown', 'Crown', faCrown],
    ['gem', 'Gem', faGem],
    ['ghost', 'Ghost', faGhost],
    ['skull', 'Skull', faSkull],
  ] as [string, string, IconDefinition][]
).map(([name, label, def]) => ({ name, label, glyph: defToGlyph(def) }));

/** Weather condition → Font Awesome glyph */
export const WEATHER_GLYPHS: Record<string, Glyph> = {
  sunny: defToGlyph(faSun),
  partly: defToGlyph(faCloudSun),
  cloudy: defToGlyph(faCloud),
  rain: defToGlyph(faCloudRain),
  showers: defToGlyph(faCloudShowersHeavy),
  storm: defToGlyph(faCloudBolt),
  snow: defToGlyph(faSnowflake),
  fog: defToGlyph(faSmog),
  wind: defToGlyph(faWind),
  night: defToGlyph(faMoon),
  partlyNight: defToGlyph(faCloudMoon),
};

export const WEATHER_CONDITIONS: { value: string; label: string }[] = [
  { value: 'sunny', label: 'Sunny' },
  { value: 'partly', label: 'Partly cloudy' },
  { value: 'cloudy', label: 'Cloudy' },
  { value: 'rain', label: 'Rain' },
  { value: 'showers', label: 'Heavy showers' },
  { value: 'storm', label: 'Storm' },
  { value: 'snow', label: 'Snow' },
  { value: 'fog', label: 'Fog' },
  { value: 'wind', label: 'Wind' },
  { value: 'night', label: 'Clear night' },
  { value: 'partlyNight', label: 'Cloudy night' },
];

/** Glyphs used inside complication widgets. */
export const COMPLICATION_GLYPHS: Record<string, Glyph> = {
  heartRate: defToGlyph(faHeart),
  steps: defToGlyph(faShoePrints),
  battery: defToGlyph(faBolt),
  calories: defToGlyph(faFire),
  weather: defToGlyph(faSun),
  distance: defToGlyph(faRoute),
  date: defToGlyph(faCalendarDays),
};

/**
 * Legacy 24×24 Material paths — kept so icon elements saved before the
 * Font Awesome migration still render, and for internal UI glyphs.
 */
export const ICONS: Record<string, string> = {
  heart:
    'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
  steps:
    'M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7',
  flame:
    'M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z',
  battery:
    'M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z',
  bolt: 'M7 2v11h3v9l7-12h-4l4-8z',
  moon:
    'M9 2c-1.05 0-2.05.16-3 .46 4.06 1.27 7 5.06 7 9.54 0 4.48-2.94 8.27-7 9.54.95.3 1.95.46 3 .46 5.52 0 10-4.48 10-10S14.52 2 9 2z',
  sun:
    'M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z',
  cloud:
    'M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z',
  watch:
    'M20 12c0-2.54-1.19-4.81-3.04-6.27L16 0H8l-.95 5.73C5.19 7.19 4 9.45 4 12s1.19 4.81 3.05 6.27L8 24h8l.96-5.73C18.81 16.81 20 14.54 20 12zM6 12c0-3.31 2.69-6 6-6s6 2.69 6 6-2.69 6-6 6-6-2.69-6-6z',
  music:
    'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z',
  phone:
    'M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z',
  bell:
    'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z',
  star:
    'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
  drop:
    'M17.66 8L12 2.35 6.34 8C4.78 9.56 4 11.64 4 13.64s.78 4.11 2.34 5.67 3.61 2.35 5.66 2.35 4.1-.79 5.66-2.35S20 15.64 20 13.64 19.22 9.56 17.66 8z',
  run:
    'M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z',
  compass:
    'M12 10.9c-.61 0-1.1.49-1.1 1.1s.49 1.1 1.1 1.1c.61 0 1.1-.49 1.1-1.1s-.49-1.1-1.1-1.1zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm2.19 12.19L6 18l3.81-8.19L18 6l-3.81 8.19z',
  calendar:
    'M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z',
  message:
    'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z',
  square: 'M3 3h18v18H3V3z',
};
