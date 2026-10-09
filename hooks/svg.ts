// Vector drawings for the surfaces that have an Svg element (the desktop app, the editor, mobile):
// smooth bars, a bar chart and the pet as a real little animated character. Pure functions that
// return markup strings. Animation is SMIL, which the desktop plays when the Svg is interactive.
import type { PetState } from './pet'
import type { Level, Options } from './usage'

type Palette = Options['palette']

const COLORS: Record<Palette, Record<Level, string>> = {
  default: { good: '#4caf6a', warn: '#e0a526', bad: '#e5534b' },
  colorblind: { good: '#3b82c4', warn: '#e0a526', bad: '#c0489a' },
  mono: { good: '#9aa0a6', warn: '#9aa0a6', bad: '#9aa0a6' }
}

export function levelColor(level: Level, palette: Palette): string {
  return COLORS[palette][level]
}

const TRACK = 'rgba(128,128,128,0.28)'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

// A rounded progress bar: `percent` of the track filled (0 to 100).
export function barSvg(percent: number, color: string, width = 260, height = 10): string {
  const p = Math.max(0, Math.min(100, percent))
  const fill = (p / 100) * width
  const r = height / 2

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" rx="${r}" fill="${TRACK}"/>` +
    (fill > 0 ? `<rect width="${Math.max(height, fill).toFixed(1)}" height="${height}" rx="${r}" fill="${color}"/>` : '') +
    `</svg>`
  )
}

// Vertical bars, one per value, the last one highlighted. `title` per bar shows on hover.
export function chartSvg(
  values: number[],
  color: string,
  titles: string[] = [],
  width = 260,
  height = 56
): string {
  const max = Math.max(...values, 0)
  const n = Math.max(1, values.length)
  const gap = 4
  const bw = (width - gap * (n - 1)) / n
  const bars = values
    .map((v, i) => {
      const h = max > 0 ? Math.max(v > 0 ? 3 : 1.5, (v / max) * (height - 4)) : 1.5
      const x = i * (bw + gap)
      const isLast = i === n - 1
      return (
        `<rect x="${x.toFixed(1)}" y="${(height - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="2" ` +
        `fill="${isLast ? color : TRACK}"${isLast ? '' : ' opacity="1"'}><title>${esc(titles[i] ?? '')}</title></rect>`
      )
    })
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${bars}</svg>`
}

const BODY = '#d97757'
const BODY_DARK = '#b85f42'
const INK = '#2b2118'

// Smooth looping motion: translate a group up and down.
const bob = (dy: number, dur: string) =>
  `<animateTransform attributeName="transform" type="translate" values="0 0;0 ${-dy};0 0" dur="${dur}" repeatCount="indefinite"/>`

const shake = `<animateTransform attributeName="transform" type="translate" values="-2 0;2 0;-2 0" dur="0.16s" repeatCount="indefinite"/>`

const eye = (cx: number, mood: PetState) => {
  switch (mood) {
    case 'sleep':
      return `<path d="M${cx - 6} 52 Q${cx} 58 ${cx + 6} 52" stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`
    case 'party':
      return `<path d="M${cx - 6} 55 Q${cx} 46 ${cx + 6} 55" stroke="${INK}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`
    case 'scared':
      return (
        `<circle cx="${cx}" cy="52" r="8" fill="#fff"/><circle cx="${cx}" cy="52" r="3" fill="${INK}">` +
        `<animate attributeName="r" values="3;2;3" dur="0.3s" repeatCount="indefinite"/></circle>`
      )
    case 'tired':
      return (
        `<circle cx="${cx}" cy="53" r="5" fill="${INK}"/>` +
        `<rect x="${cx - 7}" y="45" width="14" height="7.5" fill="${BODY}"/>`
      )
    case 'work':
      return `<circle cx="${cx}" cy="55" r="5" fill="${INK}"/>`
    default:
      // idle: blinks every few seconds
      return (
        `<ellipse cx="${cx}" cy="52" rx="5" ry="5.5" fill="${INK}">` +
        `<animate attributeName="ry" values="5.5;5.5;0.6;5.5" keyTimes="0;0.9;0.94;1" dur="4s" repeatCount="indefinite"/></ellipse>`
      )
  }
}

const mouth = (mood: PetState) => {
  switch (mood) {
    case 'party':
      return `<path d="M52 64 Q60 76 68 64 Z" fill="${INK}"/>`
    case 'scared':
      return `<ellipse cx="60" cy="68" rx="4" ry="5" fill="${INK}"/>`
    case 'tired':
      return `<path d="M54 68 Q60 64 66 68" stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`
    case 'sleep':
      return `<path d="M56 66 Q60 69 64 66" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`
    default:
      return `<path d="M54 64 Q60 70 66 64" stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`
  }
}

// The pet, 120 x 110. Orange blob with a twinkling antenna; each mood has its own motion:
// breathing and blinking (idle), Zs rising (sleep), typing on a keyboard (work), swaying with a
// sweat drop (tired), trembling (scared) and bouncing with confetti (party).
export function petSvg(mood: PetState): string {
  const motion = {
    idle: bob(2, '2.6s'),
    sleep: bob(1.5, '3.6s'),
    work: bob(1.5, '0.5s'),
    tired: `<animateTransform attributeName="transform" type="rotate" values="-3 60 90;3 60 90;-3 60 90" dur="3s" repeatCount="indefinite"/>`,
    scared: shake,
    party: bob(14, '0.55s')
  }[mood]

  const star =
    `<g><line x1="60" y1="30" x2="60" y2="18" stroke="${BODY_DARK}" stroke-width="3" stroke-linecap="round"/>` +
    `<circle cx="60" cy="14" r="5" fill="#f4c542"><animate attributeName="r" values="5;6.5;5" dur="1.6s" repeatCount="indefinite"/>` +
    `<animate attributeName="opacity" values="1;0.55;1" dur="1.6s" repeatCount="indefinite"/></circle></g>`

  const body =
    `<rect x="22" y="30" width="76" height="58" rx="26" fill="${BODY}"/>` +
    `<rect x="22" y="30" width="76" height="58" rx="26" fill="none" stroke="${BODY_DARK}" stroke-width="2"/>` +
    `<ellipse cx="38" cy="66" rx="6" ry="4" fill="#f0a58c" opacity="0.7"/><ellipse cx="82" cy="66" rx="6" ry="4" fill="#f0a58c" opacity="0.7"/>`

  const feet =
    `<rect x="34" y="86" width="18" height="10" rx="5" fill="${BODY_DARK}"/><rect x="68" y="86" width="18" height="10" rx="5" fill="${BODY_DARK}"/>`

  // arms: up while celebrating, on the keys while working
  let arms = ''
  if (mood === 'party') {
    arms =
      `<path d="M24 56 Q10 44 12 30" stroke="${BODY_DARK}" stroke-width="7" fill="none" stroke-linecap="round"/>` +
      `<path d="M96 56 Q110 44 108 30" stroke="${BODY_DARK}" stroke-width="7" fill="none" stroke-linecap="round"/>`
  } else if (mood === 'work') {
    arms =
      `<circle cx="42" cy="96" r="6" fill="${BODY_DARK}"><animate attributeName="cy" values="96;92;96" dur="0.3s" repeatCount="indefinite"/></circle>` +
      `<circle cx="78" cy="96" r="6" fill="${BODY_DARK}"><animate attributeName="cy" values="92;96;92" dur="0.3s" repeatCount="indefinite"/></circle>`
  }

  let extras = ''
  if (mood === 'work') {
    extras = `<rect x="26" y="98" width="68" height="9" rx="3" fill="#4a4a52"/><rect x="30" y="100" width="60" height="2.5" rx="1" fill="#8a8a96"/>`
  } else if (mood === 'sleep') {
    const z = (x: number, y: number, size: number, begin: string) =>
      `<text x="${x}" y="${y}" font-size="${size}" font-family="sans-serif" font-weight="bold" fill="#9aa0a6" opacity="0">z` +
      `<animate attributeName="opacity" values="0;1;0" dur="2.4s" begin="${begin}" repeatCount="indefinite"/>` +
      `<animateTransform attributeName="transform" type="translate" values="0 6;-6 -10" dur="2.4s" begin="${begin}" repeatCount="indefinite"/></text>`
    extras = z(92, 34, 16, '0s') + z(100, 24, 12, '0.8s') + z(106, 16, 9, '1.6s')
  } else if (mood === 'tired') {
    extras =
      `<path d="M94 38 Q98 46 94 50 Q90 46 94 38 Z" fill="#6ab0e8">` +
      `<animateTransform attributeName="transform" type="translate" values="0 0;0 10" dur="1.4s" repeatCount="indefinite"/>` +
      `<animate attributeName="opacity" values="1;0" dur="1.4s" repeatCount="indefinite"/></path>`
  } else if (mood === 'scared') {
    extras =
      `<text x="100" y="30" font-size="20" font-weight="bold" fill="${'#e5534b'}" font-family="sans-serif">!` +
      `<animate attributeName="opacity" values="1;0.2;1" dur="0.4s" repeatCount="indefinite"/></text>` +
      `<text x="8" y="30" font-size="20" font-weight="bold" fill="${'#e5534b'}" font-family="sans-serif">!` +
      `<animate attributeName="opacity" values="0.2;1;0.2" dur="0.4s" repeatCount="indefinite"/></text>`
  } else if (mood === 'party') {
    const dot = (x: number, c: string, d: string) =>
      `<circle cx="${x}" cy="0" r="3" fill="${c}"><animateTransform attributeName="transform" type="translate" values="0 6;0 100" dur="${d}" repeatCount="indefinite"/>` +
      `<animate attributeName="opacity" values="1;1;0" dur="${d}" repeatCount="indefinite"/></circle>`
    extras = dot(14, '#f4c542', '1.3s') + dot(36, '#4caf6a', '1.7s') + dot(84, '#e5534b', '1.5s') + dot(106, '#6ab0e8', '1.9s')
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="110" viewBox="0 0 120 110">` +
    `<ellipse cx="60" cy="101" rx="30" ry="4" fill="rgba(128,128,128,0.25)"/>` +
    extras +
    `<g>${motion}${star}${feet}${body}${eye(46, mood)}${eye(74, mood)}${mouth(mood)}${arms}</g>` +
    `</svg>`
  )
}
