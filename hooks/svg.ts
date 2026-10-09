// Vector drawings for the surfaces that have an Svg element (the desktop app, the editor, mobile):
// smooth bars and bar charts. Pure functions that return markup strings.
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
