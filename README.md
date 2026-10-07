# credits-bar

A small open-source mod for Claude Code that keeps your **usage in a side panel**.

**In the panel**
- **Limit bars** (5-hour and 7-day) that drain as you spend, with a live "resets in" clock.
- **Pace warning** when your burn rate would empty a window before it resets (`! out in 40m`).
- **Context window**: fill and what is filling it (messages, MCP tools, skills...).
- **Session tokens**: input, output and prompt-cache hit rate.
- **Cost**: session total, cost of the last reply and a mini chart of recent replies.
- **7-day history**: daily spend and peak usage, kept across sessions.
- **Toasts** at 80% / 95% (configurable) and when a window goes on pace to run dry.

**Layout**
- Wide window (144+ columns): the panel opens by itself at session start.
- Narrow window: a one-line band above the prompt stands in
  (`5h ██████░░░░ 29% left  7d ████░░░░░░ 22% left  ctx 16%  $1.42`).
- Short panel: switches to a compact view (`compact: auto`).
- `/credits-panel` opens or closes the side panel (it opens at any width when you ask).
- `/credits-bar` shows or hides the one-line bar above the prompt (it can be shown even with the panel open).

**Settings** (`userConfig`, shown in the plugin config menu): alert thresholds, compact mode,
colors (`default`, `colorblind`, `mono`) and which blocks to show.

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

- Per-model usage breakdown
- Export history as CSV
- Sound alerts
- More languages for the labels

Contributions welcome. MIT licensed.
