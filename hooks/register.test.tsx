import { expect, test } from 'claude-code/testing'

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
