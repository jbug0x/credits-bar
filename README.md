# credits-bar

A small open-source mod for Claude Code that keeps a **usage bar above the prompt**:
how much of your 5-hour and 7-day limits is left (the bar drains as you spend), when
each one resets, and what the current session has cost. It refreshes after every
response and when you send a prompt.

```
5h ████████████░░░░░░░░ 62% left resets in 3h   7d ██████████████████░░ 91% left resets in 5d   session $1.42  [Hide]
```

Hide it with the button or `/credits-bar`; it comes back on the next session or when you run `/credits-bar` again.

Also shown: **context window fill** (`ctx 16%`), a **pace warning** when your current burn
rate would empty a window before it resets (`(out in 40m)`), and a **toast** the first time a
limit passes 80% and 95%.

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
