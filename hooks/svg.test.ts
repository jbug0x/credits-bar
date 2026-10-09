import { expect, test } from 'claude-code/testing'

import { barSvg, chartSvg, levelColor } from './svg'

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

test('palettes recolor the bars', async () => {
  expect(levelColor('bad', 'default')).not.toBe(levelColor('bad', 'colorblind'))
  expect(levelColor('good', 'mono')).toBe(levelColor('bad', 'mono'))
})
