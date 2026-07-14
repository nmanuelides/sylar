/**
 * Template for the generated Zepp OS watchface page.
 * `__SPEC__` is replaced with the JSON widget spec at export time.
 * All sensor access is defensive: a missing/changed API degrades to '--'
 * instead of crashing the watchface.
 */
export const RUNTIME_TEMPLATE = `import ui from '@zos/ui'
import * as S from '@zos/sensor'
import { setInterval } from '@zos/timer'

const SPEC = __SPEC__

const SL_NORMAL = ui.show_level.ONLY_NORMAL
const SL_AOD = ui.show_level.ONAL_AOD || ui.show_level.ONLY_AOD || SL_NORMAL
const level = (aod) => (aod ? SL_AOD : SL_NORMAL)

const WEEK = SPEC.week || ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTHS = SPEC.months || ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const STEPS_GOAL = SPEC.stepsGoal || 10000
const pad = (n) => (n < 10 ? '0' + n : '' + n)

function makeSensor(name) {
  try {
    const Ctor = S[name]
    return Ctor ? new Ctor() : null
  } catch (e) {
    return null
  }
}

const sensors = {}
function sensor(name) {
  if (!(name in sensors)) sensors[name] = makeSensor(name)
  return sensors[name]
}

function num(v) {
  if (v == null) return null
  if (typeof v === 'number') return v
  if (typeof v === 'object' && typeof v.value === 'number') return v.value
  if (typeof v === 'object' && typeof v.current === 'number') return v.current
  return null
}

function tryCall(obj, names) {
  if (!obj) return null
  for (let i = 0; i < names.length; i++) {
    try {
      if (typeof obj[names[i]] === 'function') {
        const v = obj[names[i]]()
        if (v != null) return v
      }
    } catch (e) { /* keep trying */ }
  }
  return null
}

// Best-effort field finder: Zepp's Weather return shape has drifted across
// API versions/devices, so search shallowly by key name instead of trusting
// one hardcoded path.
function findField(obj, names, depth) {
  if (!obj || typeof obj !== 'object' || depth > 3) return null
  for (let i = 0; i < names.length; i++) {
    const v = obj[names[i]]
    if (typeof v === 'number') return v
  }
  for (const key in obj) {
    const v = obj[key]
    if (v && typeof v === 'object') {
      const found = findField(v, names, depth + 1)
      if (found != null) return found
    }
  }
  return null
}

function weatherInfo() {
  try {
    const w = sensor('Weather')
    if (!w) return {}
    const f = tryCall(w, ['getForecastWeather', 'getForecast'])
    if (!f) return {}
    const list =
      (f.forecastData && (f.forecastData.data || f.forecastData)) ||
      f.forecast ||
      f.dailyForecast
    const today = Array.isArray(list) ? list[0] : null
    const tomorrow = Array.isArray(list) ? list[1] : null
    const max = findField(today || f, ['high', 'tempHigh', 'max', 'maxTemp'])
    const min = findField(today || f, ['low', 'tempLow', 'min', 'minTemp'])
    // Zepp's Weather sensor has no live "current" reading, on-device or
    // documented — only forecast high/low per day (confirmed against a real
    // device dump, not just docs). Approximate it with a diurnal curve:
    // rising from today's low near dawn to today's high in the afternoon,
    // then falling back toward tomorrow's low overnight — matches what
    // other community watchfaces show as "current" from this same data.
    let cur = findField(f, ['current', 'temperature', 'temp', 'curTemp'])
    if (cur == null && max != null && min != null) {
      const nextLow = tomorrow ? findField(tomorrow, ['low', 'tempLow', 'min', 'minTemp']) : null
      const lowEnd = nextLow != null ? nextLow : min
      const now = time ? time.getHours() + time.getMinutes() / 60 : 12
      const trough = 6 // assumed dawn low
      const peak = 15 // assumed mid-afternoon high
      const span = 24 - (peak - trough)
      if (now >= trough && now < peak) {
        const t = (now - trough) / (peak - trough)
        cur = min + (max - min) * (1 - Math.cos(t * Math.PI)) / 2
      } else {
        const t = now >= peak ? (now - peak) / span : (now + 24 - peak) / span
        cur = max - (max - lowEnd) * (1 - Math.cos(t * Math.PI)) / 2
      }
      cur = Math.round(cur)
    }
    return {
      cur: cur != null ? cur : max,
      min,
      max,
      index: findField(today || f, ['index', 'weatherType', 'condition', 'weather']),
    }
  } catch (e) {
    return {}
  }
}

// Zepp weather index → Sylar condition asset name. Per Zepp's official
// @zos/sensor Weather.getForecastWeather() index enum (0=Cloudy, 1=Showers,
// 2=Snow Showers, 3=Sunny, 4=Overcast, 5=Light Rain, 6=Light Snow,
// 7=Moderate Rain, 8=Moderate Snow, 9=Heavy Snow, 10=Heavy Rain,
// 11=Sandstorm, 12=Rain and Snow, 13=Fog, 14=Hazy, 15=T-Storms,
// 16=Snowstorm, 17=Floating Dust, 18=Very Heavy Rainstorm, 19=Rain and Hail,
// 20=T-Storms and Hail, 21=Heavy Rainstorm, 22=Dust, 23=Heavy Sandstorm,
// 24=Rainstorm, 25=Unknown, 26=Cloudy Night, 27=Showers Night,
// 28=Sunny Night) — the previous map didn't match this enum at all.
function weatherAsset(index) {
  const map = {
    0: 'cloudy', 1: 'showers', 2: 'snow', 3: 'sunny', 4: 'cloudy', 5: 'rain',
    6: 'snow', 7: 'rain', 8: 'snow', 9: 'snow', 10: 'showers', 11: 'wind',
    12: 'snow', 13: 'fog', 14: 'fog', 15: 'storm', 16: 'snow', 17: 'wind',
    18: 'storm', 19: 'storm', 20: 'storm', 21: 'storm', 22: 'wind',
    23: 'wind', 24: 'storm', 25: 'partly', 26: 'partlyNight', 27: 'partlyNight',
    28: 'night',
  }
  return map[index] || 'partly'
}

const time = sensor('Time')

function timeVal(kind) {
  if (!time) return { text: '--', frac: 0 }
  const h = time.getHours()
  switch (kind) {
    case 'hour': return { text: pad(h), frac: h / 24 }
    case 'hour12': return { text: pad(h % 12 || 12), frac: (h % 12) / 12 }
    case 'minute': return { text: pad(time.getMinutes()), frac: time.getMinutes() / 60 }
    case 'second': return { text: pad(time.getSeconds()), frac: time.getSeconds() / 60 }
    case 'ampm': return { text: h < 12 ? 'AM' : 'PM', frac: h < 12 ? 0 : 1 }
    case 'dayNumber': return { text: '' + time.getDate(), frac: time.getDate() / 31 }
    case 'dayName': return { text: WEEK[time.getDay() % 7], frac: time.getDay() / 7 }
    case 'month': return { text: pad(time.getMonth()), frac: time.getMonth() / 12 }
    case 'monthName': return { text: MONTHS[(time.getMonth() - 1 + 12) % 12], frac: time.getMonth() / 12 }
    case 'year': return { text: '' + time.getFullYear(), frac: 1 }
  }
  return { text: '--', frac: 0 }
}

function sourceVal(source) {
  try {
    switch (source) {
      case 'hour': case 'hour12': case 'minute': case 'second': case 'ampm':
      case 'dayNumber': case 'dayName': case 'month': case 'monthName': case 'year':
        return timeVal(source)
      case 'heartRate': {
        const v = num(tryCall(sensor('HeartRate'), ['getLast', 'getCurrent']))
        return { text: v == null ? '--' : '' + v, frac: (v || 0) / 180, unit: ' BPM' }
      }
      case 'steps': {
        const v = num(tryCall(sensor('Step'), ['getCurrent']))
        // Prefer the device's own daily goal when the sensor exposes one; the
        // designer-configured value (or 10000) is the fallback.
        const goal = num(tryCall(sensor('Step'), ['getTarget', 'getGoal'])) || STEPS_GOAL
        return { text: v == null ? '--' : '' + v, frac: (v || 0) / goal, unit: '' }
      }
      case 'stepsGoal': {
        const goal = num(tryCall(sensor('Step'), ['getTarget', 'getGoal'])) || STEPS_GOAL
        return { text: '' + goal, frac: 1, unit: '' }
      }
      case 'battery': {
        const v = num(tryCall(sensor('Battery'), ['getCurrent']))
        return { text: v == null ? '--' : v + '%', frac: (v || 0) / 100, unit: '' }
      }
      case 'calories': {
        const v = num(tryCall(sensor('Calorie'), ['getCurrent']))
        return { text: v == null ? '--' : '' + v, frac: (v || 0) / 600, unit: ' KCAL' }
      }
      case 'distance': {
        const v = num(tryCall(sensor('Distance'), ['getCurrent']))
        const km = v == null ? null : v / 1000
        return { text: km == null ? '--' : km.toFixed(2), frac: (km || 0) / 10, unit: ' KM' }
      }
      case 'weather': {
        const v = weatherInfo().cur
        return { text: v == null ? '--' : v + '\\u00b0', frac: (v || 0) / 40, unit: '' }
      }
      case 'weatherMin': {
        const v = weatherInfo().min
        return { text: v == null ? '--' : v + '\\u00b0', frac: (v || 0) / 40, unit: '' }
      }
      case 'weatherMax': {
        const v = weatherInfo().max
        return { text: v == null ? '--' : v + '\\u00b0', frac: (v || 0) / 40, unit: '' }
      }
      case 'pai': {
        const v = num(tryCall(sensor('Pai'), ['getTotal', 'getDaily']))
        return { text: v == null ? '--' : '' + Math.round(v), frac: (v || 0) / 100, unit: '' }
      }
      case 'spo2': {
        const v = num(tryCall(sensor('BloodOxygen'), ['getCurrent', 'getLast']))
        return { text: v == null ? '--' : v + '%', frac: (v || 0) / 100, unit: '' }
      }
      case 'stress': {
        const v = num(tryCall(sensor('Stress'), ['getCurrent', 'getValue']))
        return { text: v == null ? '--' : '' + v, frac: (v || 0) / 100, unit: '' }
      }
      case 'standHours': {
        const v = num(tryCall(sensor('Stand'), ['getCurrent']))
        return { text: v == null ? '--' : '' + v, frac: (v || 0) / 12, unit: '/12' }
      }
      case 'sleepScore': {
        const info = tryCall(sensor('Sleep'), ['getInfo'])
        const v = info ? num(info.score) : null
        return { text: v == null ? '--' : '' + v, frac: (v || 0) / 100, unit: '' }
      }
      case 'sleepDuration': {
        const info = tryCall(sensor('Sleep'), ['getInfo'])
        const mins = info ? num(info.duration) : null
        if (mins == null) return { text: '--', frac: 0, unit: ' H' }
        return { text: Math.floor(mins / 60) + ':' + pad(mins % 60), frac: mins / 480, unit: ' H' }
      }
      case 'floors': {
        const v = num(tryCall(sensor('FloorsClimbed') || sensor('Floor'), ['getCurrent']))
        return { text: v == null ? '--' : '' + v, frac: (v || 0) / 20, unit: ' FL' }
      }
      case 'humidity': case 'uvIndex':
        return { text: '--', frac: 0, unit: '' }
    }
  } catch (e) { /* fall through */ }
  return { text: '--', frac: 0, unit: '' }
}

function timeText(spec) {
  if (!time) return '--:--'
  const h = spec.twelve ? time.getHours() % 12 || 12 : time.getHours()
  let out = pad(h) + ':' + pad(time.getMinutes())
  if (spec.seconds) out += ':' + pad(time.getSeconds())
  if (spec.ampm) out += time.getHours() < 12 ? ' AM' : ' PM'
  return out
}

WatchFace({
  build() {
    const updaters = []
    let needSeconds = false

    // Every layer is created in exactly the design's own element order, so
    // Zepp OS's creation-order-is-z-order stacking always matches the layer
    // stack — a baked image between two live widgets stays between them,
    // not shoved above (or below) both.
    SPEC.layers.forEach((l) => {
      if (l.kind === 'bg') {
        ui.createWidget(ui.widget.IMG, { x: 0, y: 0, src: l.path, show_level: level(l.aod) })
        return
      }

      if (l.kind === 'arc') {
        const w = ui.createWidget(ui.widget.ARC_PROGRESS, {
          center_x: l.cx, center_y: l.cy, radius: l.r,
          start_angle: l.start, end_angle: l.end,
          line_width: l.width, color: l.color, level: 0,
          corner_flag: l.rounded ? 1 : 0,
          show_level: level(l.aod),
        })
        updaters.push(() => {
          const pct = Math.round(Math.max(0, Math.min(1, sourceVal(l.source).frac)) * 100)
          try { w.setProperty(ui.prop.LEVEL, pct) } catch (e) {
            try { w.setProperty(ui.prop.MORE, { level: pct }) } catch (e2) { /* ignore */ }
          }
        })
        return
      }

      if (l.kind === 'bar') {
        if (l.segments) {
          // Zepp OS has no native multi-block fill widget — one FILL_RECT
          // per segment, each independently sized from the overall fraction.
          const n = l.segments
          const gap = l.gap || 0
          for (let i = 0; i < n; i++) {
            const segX = l.x + i * (l.w + gap)
            const w = ui.createWidget(ui.widget.FILL_RECT, {
              x: segX, y: l.y, w: 1, h: l.h, radius: l.radius, color: l.color,
              show_level: level(l.aod),
            })
            updaters.push(() => {
              const frac = Math.max(0, Math.min(1, sourceVal(l.source).frac))
              const segFrac = Math.max(0, Math.min(1, frac * n - i))
              const width = segFrac > 0 ? Math.max(l.radius * 2, Math.round(l.w * segFrac)) : 1
              try { w.setProperty(ui.prop.MORE, { x: segX, y: l.y, w: width, h: l.h }) } catch (e) { /* ignore */ }
            })
          }
          return
        }
        const w = ui.createWidget(ui.widget.FILL_RECT, {
          x: l.x, y: l.y, w: 1, h: l.h, radius: l.radius, color: l.color,
          show_level: level(l.aod),
        })
        updaters.push(() => {
          const frac = Math.max(0, Math.min(1, sourceVal(l.source).frac))
          const width = Math.max(l.h, Math.round(l.w * frac))
          try { w.setProperty(ui.prop.MORE, { x: l.x, y: l.y, w: width, h: l.h }) } catch (e) { /* ignore */ }
        })
        return
      }

      if (l.kind === 'weather') {
        const w = ui.createWidget(ui.widget.IMG, {
          x: l.x, y: l.y, src: l.dir + '/partly.png', show_level: level(l.aod),
        })
        updaters.push(() => {
          const idx = weatherInfo().index
          const name = idx == null ? 'partly' : weatherAsset(idx)
          try { w.setProperty(ui.prop.SRC, l.dir + '/' + name + '.png') } catch (e) { /* ignore */ }
        })
        return
      }

      if (l.kind === 'text') {
        const cfg = {
          x: l.x, y: l.y, w: l.w, h: l.h,
          color: l.color, text_size: l.size,
          align_h: ui.align.CENTER_H, align_v: ui.align.CENTER_V,
          text_style: ui.text_style.NONE,
          text: '',
          show_level: level(l.aod),
        }
        if (l.font) cfg.font = l.font
        const w = ui.createWidget(ui.widget.TEXT, cfg)
        const update = () => {
          let str
          if (l.textKind === 'time') {
            str = timeText(l)
          } else {
            const v = sourceVal(l.source)
            str = v.text + (l.showUnit && v.unit ? v.unit : '')
          }
          try { w.setProperty(ui.prop.MORE, { text: str }) } catch (e) { /* ignore */ }
        }
        updaters.push(update)
        if ((l.textKind === 'time' && l.seconds) || l.source === 'second') needSeconds = true
        return
      }

      if (l.kind === 'textImg') {
        // Bound directly to the OS's own current-weather data type via
        // TEXT_IMG's \`type\`, which the firmware keeps updated itself. No
        // updater on purpose: setting \`text\` on a TEXT_IMG disables its
        // \`type\` binding entirely, so this widget must never be touched
        // again after creation.
        ui.createWidget(ui.widget.TEXT_IMG, {
          x: l.x, y: l.y, w: l.w, h: l.h,
          align_h: ui.align.CENTER_H, align_v: ui.align.CENTER_V,
          font_array: l.fontArray,
          negative_image: l.negImage,
          h_space: l.hSpace,
          unit_en: l.unitEn, unit_sc: l.unitEn, unit_tc: l.unitEn,
          imperial_unit_en: l.imperialUnitEn, imperial_unit_sc: l.imperialUnitEn, imperial_unit_tc: l.imperialUnitEn,
          type: ui.data_type && ui.data_type.WEATHER_CURRENT,
          show_level: level(l.aod),
        })
        return
      }

      if (l.kind === 'pointer') {
        const cfg = { show_level: level(l.aod) }
        cfg[l.hand + '_centerX'] = l.cx
        cfg[l.hand + '_centerY'] = l.cy
        cfg[l.hand + '_posX'] = l.px
        cfg[l.hand + '_posY'] = l.py
        cfg[l.hand + '_path'] = l.path
        ui.createWidget(ui.widget.TIME_POINTER, cfg)
        return
      }

      if (l.kind === 'rotator') {
        // No native pointer widget for weekday/monthday/battery — a plain
        // IMG's angle is updated by hand. Unlike TIME_POINTER's posX/posY
        // (pivot within the image), IMG's pos_x/pos_y is the image's top-left,
        // so offset it to land the in-image pivot (px,py) on the rotation
        // center (cx,cy).
        const w = ui.createWidget(ui.widget.IMG, {
          x: 0, y: 0, w: SPEC.width, h: SPEC.height,
          pos_x: l.cx - l.px, pos_y: l.cy - l.py,
          center_x: l.cx, center_y: l.cy,
          src: l.path, angle: l.offset,
          show_level: level(l.aod),
        })
        updaters.push(() => {
          let delta = 0
          if (l.source === 'battery') {
            const v = num(tryCall(sensor('Battery'), ['getCurrent'])) || 0
            delta = (Math.max(0, Math.min(100, v)) / 100) * 360
          } else if (l.source === 'weekday') {
            const day = time ? time.getDay() : 1 // Zepp Time sensor: 1=Monday..7=Sunday
            const idx = ((day - 1) % 7 + 7) % 7
            delta = idx * (360 / 7)
          } else if (l.source === 'monthday') {
            const date = num(time && time.getDate ? time.getDate() : 1) || 1 // 1..31
            delta = (((date - 1) % 31 + 31) % 31) * (360 / 31)
          }
          const deg = l.offset + (l.reverse ? -delta : delta)
          try { w.setProperty(ui.prop.ANGLE, ((deg % 360) + 360) % 360) } catch (e) { /* ignore */ }
        })
      }
    })

    const refreshAll = () => updaters.forEach((u) => u())
    refreshAll()
    if (time && time.onPerMinute) time.onPerMinute(refreshAll)
    if (needSeconds) setInterval(refreshAll, 1000)
    ui.createWidget(ui.widget.WIDGET_DELEGATE, { resume_call: refreshAll })
  },
})
`;
