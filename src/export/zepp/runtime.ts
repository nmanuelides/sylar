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

const WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
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
    return {
      cur: findField(f, ['current', 'temperature', 'temp', 'curTemp']),
      min: findField(today || f, ['low', 'tempLow', 'min', 'minTemp']),
      max: findField(today || f, ['high', 'tempHigh', 'max', 'maxTemp']),
      index: findField(today || f, ['index', 'weatherType', 'condition', 'weather']),
    }
  } catch (e) {
    return {}
  }
}

// Zepp weather index → Sylar condition asset name (defensive best-effort)
function weatherAsset(index) {
  const map = {
    0: 'sunny', 1: 'partly', 2: 'cloudy', 3: 'showers', 4: 'storm', 5: 'snow',
    6: 'snow', 7: 'rain', 8: 'rain', 9: 'rain', 10: 'showers', 11: 'storm',
    12: 'snow', 13: 'snow', 14: 'snow', 15: 'snow', 16: 'snow', 17: 'showers',
    18: 'fog', 19: 'showers', 20: 'wind', 21: 'partly', 22: 'showers',
    23: 'showers', 24: 'wind', 25: 'rain', 26: 'snow',
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
        return { text: v == null ? '--' : '' + v, frac: (v || 0) / 10000, unit: '' }
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

    // static background(s)
    ui.createWidget(ui.widget.IMG, {
      x: 0, y: 0, src: 'bg.png', show_level: SL_NORMAL,
    })
    if (SPEC.hasAod) {
      ui.createWidget(ui.widget.IMG, {
        x: 0, y: 0, src: 'aod-bg.png', show_level: SL_AOD,
      })
    }

    // progress arcs (under texts, over background)
    SPEC.arcs.forEach((a) => {
      const w = ui.createWidget(ui.widget.ARC_PROGRESS, {
        center_x: a.cx, center_y: a.cy, radius: a.r,
        start_angle: a.start, end_angle: a.end,
        line_width: a.width, color: a.color, level: 0,
        corner_flag: a.rounded ? 1 : 0,
        show_level: level(a.aod),
      })
      updaters.push(() => {
        const pct = Math.round(Math.max(0, Math.min(1, sourceVal(a.source).frac)) * 100)
        try { w.setProperty(ui.prop.LEVEL, pct) } catch (e) {
          try { w.setProperty(ui.prop.MORE, { level: pct }) } catch (e2) { /* ignore */ }
        }
      })
    })

    // linear bars
    SPEC.bars.forEach((b) => {
      const w = ui.createWidget(ui.widget.FILL_RECT, {
        x: b.x, y: b.y, w: 1, h: b.h, radius: b.radius, color: b.color,
        show_level: level(b.aod),
      })
      updaters.push(() => {
        const frac = Math.max(0, Math.min(1, sourceVal(b.source).frac))
        const width = Math.max(b.h, Math.round(b.w * frac))
        try { w.setProperty(ui.prop.MORE, { x: b.x, y: b.y, w: width, h: b.h }) } catch (e) { /* ignore */ }
      })
    })

    // live weather condition icons
    SPEC.weathers.forEach((wi) => {
      const w = ui.createWidget(ui.widget.IMG, {
        x: wi.x, y: wi.y, src: wi.dir + '/partly.png', show_level: level(wi.aod),
      })
      updaters.push(() => {
        const idx = weatherInfo().index
        const name = idx == null ? 'partly' : weatherAsset(idx)
        try { w.setProperty(ui.prop.SRC, wi.dir + '/' + name + '.png') } catch (e) { /* ignore */ }
      })
    })

    // live texts
    SPEC.texts.forEach((t) => {
      const cfg = {
        x: t.x, y: t.y, w: t.w, h: t.h,
        color: t.color, text_size: t.size,
        align_h: ui.align.CENTER_H, align_v: ui.align.CENTER_V,
        text_style: ui.text_style.NONE,
        text: '',
        show_level: level(t.aod),
      }
      if (t.font) cfg.font = t.font
      const w = ui.createWidget(ui.widget.TEXT, cfg)
      const update = () => {
        let str
        if (t.kind === 'time') {
          str = timeText(t)
        } else {
          const v = sourceVal(t.source)
          str = v.text + (t.showUnit && v.unit ? v.unit : '')
        }
        try { w.setProperty(ui.prop.MORE, { text: str }) } catch (e) { /* ignore */ }
      }
      updaters.push(update)
      if ((t.kind === 'time' && t.seconds) || t.source === 'second') needSeconds = true
    })

    // analog hands
    SPEC.pointers.forEach((p) => {
      const cfg = { show_level: level(p.aod) }
      cfg[p.kind + '_centerX'] = p.cx
      cfg[p.kind + '_centerY'] = p.cy
      cfg[p.kind + '_posX'] = p.px
      cfg[p.kind + '_posY'] = p.py
      cfg[p.kind + '_path'] = p.path
      ui.createWidget(ui.widget.TIME_POINTER, cfg)
    })

    const refreshAll = () => updaters.forEach((u) => u())
    refreshAll()
    if (time && time.onPerMinute) time.onPerMinute(refreshAll)
    if (needSeconds) setInterval(refreshAll, 1000)
    ui.createWidget(ui.widget.WIDGET_DELEGATE, { resume_call: refreshAll })
  },
})
`;
