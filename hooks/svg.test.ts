import { expect, test } from 'claude-code/testing'

import { barSvg, chartSvg, levelColor, petSvg } from './svg'
import type { PetState } from './pet'

const STATES: PetState[] = ['idle', 'sleep', 'work', 'tired', 'scared', 'party']

// Every tag opened is closed (or self-closed): a cheap well-formedness check for the markup.
function isBalanced(svg: string): boolean {
  const stack: string[] = []
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z]+)[^>]*?(\/?)>/g)) {
    const [, closing, name, selfClosing] = m
    if (selfClosing) continue
    if (closing) {
      if (stack.pop() !== name) return false
    } else stack.push(name as string)
  }

  return stack.length === 0
}

test('bars: filled share, empty and full', async () => {
  expect(barSvg(40, '#abc', 200, 10)).toContain('width="80.0"')
  expect(barSvg(0, '#abc')).not.toContain('#abc')
  expect(barSvg(250, '#abc', 200, 10)).toContain('width="200.0"')
  expect(isBalanced(barSvg(40, '#abc'))).toBe(true)
})

test('chart: one bar per value, the last highlighted, titles on hover', async () => {
  const svg = chartSvg([0, 1, 2], '#123456', ['a', 'b', 'c'])
  expect(svg.match(/<rect /g)?.length).toBe(3)
  expect(svg).toContain('<title>c</title>')
  expect(svg.match(/#123456/g)?.length).toBe(1)
  expect(isBalanced(svg)).toBe(true)
  expect(isBalanced(chartSvg([0, 0], '#123456'))).toBe(true)
})

test('the pet is well-formed in every mood, moves, and each mood has its own tell', async () => {
  for (const mood of STATES) {
    const svg = petSvg(mood)
    expect(isBalanced(svg)).toBe(true)
    expect(svg).toContain('<animate')
    expect(svg.length).toBeLessThan(20000)
  }
  expect(petSvg('work')).toContain('#4a4a52') // the keyboard
  expect(petSvg('sleep')).toContain('>z<')
  expect(petSvg('party')).toContain('#f4c542')
  expect(petSvg('scared')).toContain('>!<')
  expect(petSvg('tired')).toContain('#6ab0e8') // sweat drop
  expect(new Set(STATES.map(petSvg)).size).toBe(6)
})

test('palettes recolor the bars', async () => {
  expect(levelColor('bad', 'default')).not.toBe(levelColor('bad', 'colorblind'))
  expect(levelColor('good', 'mono')).toBe(levelColor('bad', 'mono'))
})
