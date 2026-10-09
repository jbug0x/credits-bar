import { expect, mock, test } from 'claude-code/testing'


const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 5, columns: 120 }
} as const

test('band draws nothing of its own until a usage measurement exists', async ($, on) => {
  // The engine's own band, standing beneath the plugin.
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine band</Text>
  })

  const ui = await $.ui.mount({ plugin: 'credits-bar', surface: 'terminal', ...BAND } as never)
  expect(await ui.find({ type: 'Text', text: /left/ })).toBeUndefined()
  await ui.unmount()
})

test('panel says so when there is no reading yet', async $ => {
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'credits-bar',
      surface,
      component: 'Pane',
      requestId: 'credits',
      props: {}
    } as never)
    expect(await ui.find({ type: 'Text', text: /No usage reading yet/ })).toBeDefined()
    await ui.unmount()
  }
})

// What the engine would answer to $.session.usage() mid-session.
const USAGE = {
  startedAt: 0,
  context: { window: 1_000_000, tokens: 160_000, percent: 16 },
  rateLimits: [
    { kind: 'five_hour', percentUsed: 71, resetsAt: new Date(Date.now() + 48 * 60000).toISOString() },
    { kind: 'seven_day', percentUsed: 78, resetsAt: new Date(Date.now() + 40 * 3600000).toISOString() }
  ],
  cost: { usd: 1.42 }
}

test('panel and band draw a real reading on both surfaces', async ($, on) => {
  mock.clock(on)
  on('session.usage', () => ({ value: USAGE }) as never)
  on('prompt.submit', (_$, e) => e as never)
  await $.prompt.submit({ text: 'hello' } as never)

  for (const surface of ['terminal', 'desktop'] as const) {
    const pane = await $.ui.mount({
      plugin: 'credits-bar',
      surface,
      component: 'Pane',
      requestId: 'credits',
      props: {}
    } as never)
    expect(await pane.find({ type: 'Text', text: /29% left/ })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: /Context/ })).toBeDefined()
    // the prompt was submitted and no turn has completed: the pet is at work
    // (the vector panel has no pet, so only the text panel shows it)
    if (surface === 'terminal') expect(await pane.find({ type: 'Text', text: /working/ })).toBeDefined()
    await pane.unmount()
  }
})

test('the icon button is always on the band, with or without a reading', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine band</Text>
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'credits-bar', surface, ...BAND } as never)
    expect(await ui.find({ key: 'credits-chip' })).toBeDefined()
    await ui.unmount()
  }
})

test('the text panel shows the pet and its name', async $ => {
  const pane = await $.ui.mount({
    plugin: 'credits-bar',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'credits',
    props: {}
  } as never)
  expect(await pane.find({ type: 'Text', text: /Pip/ })).toBeDefined()
  await pane.unmount()
})

test('the desktop panel draws vectors and has no pet; the terminal panel keeps its text and its pet', async ($, on) => {
  mock.clock(on)
  on('session.usage', () => ({ value: USAGE }) as never)
  on('prompt.submit', (_$, e) => e as never)
  await $.prompt.submit({ text: 'hello' } as never)

  const mount = (surface: 'terminal' | 'desktop') =>
    $.ui.mount({ plugin: 'credits-bar', surface, component: 'Pane', requestId: 'credits', props: {} } as never)

  const desktop = await mount('desktop')
  expect(await desktop.find({ type: 'Svg' })).toBeDefined()
  expect(await desktop.find({ type: 'Text', text: /29% left/ })).toBeDefined()
  expect(await desktop.find({ type: 'Text', text: /Pip/ })).toBeUndefined()
  await desktop.unmount()

  const terminal = await mount('terminal')
  expect(await terminal.find({ type: 'Svg' })).toBeUndefined()
  expect(await terminal.find({ type: 'Text', text: /█/ })).toBeDefined()
  expect(await terminal.find({ type: 'Text', text: /Pip/ })).toBeDefined()
  await terminal.unmount()
})
