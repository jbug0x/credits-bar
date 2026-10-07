# credits-bar

A small open-source mod for Claude Code that shows your **usage at a glance in a side panel**:
how much of your 5-hour and 7-day limits is left (the bars drain as you spend), when each
one resets, a **pace warning** when your current burn rate would empty a window before it
resets (`out in 40m`), the **context window fill** and what the session has cost. A **toast**
fires the first time a limit passes 80% and 95%.

- **Wide window (144+ columns):** the panel opens by itself at session start.
- **Narrow window:** a one-line band above the prompt stands in
  (`5h ██████░░░░ 29% left  7d ████░░░░░░ 22% left  ctx 16%  $1.42`).
- **`/credits-bar`** hides everything, or brings it back (the panel opens at any width when you ask).

Colors: green above 50% left, yellow above 20%, red below.

## Install

```
/plugin install credits-bar --marketplace jbug0x/credits-bar
```

Or, for development: `claude --plugin-dir ./credits-bar`.

## Notes

- Limit windows come from the rate-limit data Claude Code receives, so they only appear
  on a subscription. Otherwise you only see the session cost.
- Nothing is sent anywhere: the mod only reads figures the engine already has.
- Layout: `hooks/register.tsx` (all logic), `types/index.d.ts` (state contract).

## Ideas / roadmap

- Daily/weekly spend history stored with `$.store`
- Configurable colors and alert thresholds (`userConfig`)
- Compact one-line mode
- Cost of the last response
- A `/credits` command with a detailed pane

Contributions welcome. MIT licensed.
