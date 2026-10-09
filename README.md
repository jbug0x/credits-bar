# credits-bar

A small open-source mod for Claude Code that keeps your **usage in a side panel**.

**In the panel**
- **Limit bars** (5-hour and 7-day) that drain as you spend, with a live "resets in" clock.
- **Pace warning** when your burn rate would empty a window before it resets (`! out in 40m`).
- **Daily goal**: set a USD goal and get its own bar plus a toast when it is reached.
- **Context window**: fill and what is filling it. It refreshes every 30s, not only after replies.
- **Session tokens**, prompt-cache hit rate and **cost per model** for the session.
- **Cost**: session total, last reply and a mini chart of recent replies.
- **Spend per project** (top folders over the last 7 days).
- **History**: 7-day sparklines, growing into a 14-day bar chart once there is data and room.
- **Toasts** at 80% / 95% (configurable), when a window goes on pace to run dry, and a
  **summary when the session ends** (total spent and limits used).

**The pet**
- A small original critter (name configurable, `Pip` by default) lives at the top of the panel
  and, in a one-line version `(•ᴗ•)`, next to the icon button above the prompt.
- It strolls around the panel when idle, mutters a line now and then, and has moods. It **works** while Claude is running a turn, **celebrates** when a reply finishes or the daily goal
  is reached, gets **tired** past your first alert threshold and **panics** past the second, and
  **falls asleep** after a minute of nothing going on.
- `/credits-pet` sends it off for a nap or brings it back; the `pet` setting turns it off for good.
- The sprites live in `hooks/pet.ts` and are plain strings, so swapping the character is a one-file change.

```
     ✻
  .-"""-.
 (  •ᴗ•  )
  '-U-U-'
```

**Layout**
- Wide window (144+ columns): the panel opens by itself at session start.
- Narrow window: a one-line band above the prompt stands in
  (`5h ██████░░░░ 29% left  7d ████░░░░░░ 22% left  ctx 16%  $1.42`).
- Short panel: switches to a compact view (`compact: auto`).
- A small **icon button** (`◔ 29% left`) always sits above the prompt: it shows your tightest limit, and a click opens or closes the panel.
- `/credits-panel` opens or closes the side panel (it opens at any width when you ask).
- `/credits` prints the whole summary as plain text (pet included). It works on every surface, even where the app does not draw the panel or the bar.
- `/credits-debug` reports where the mod is loaded and drawn (for bug reports).
- `/credits-export` writes the spend history to `credits-history.csv` in the current folder
  (`date,project,usd,peak_percent`).
- `/credits-bar` shows or hides the one-line bar above the prompt (it can be shown even with the panel open).

**Settings** (`userConfig`, shown in the plugin config menu): alert thresholds, compact mode,
colors (`default`, `colorblind`, `mono`), language (`en`, `pt`), daily goal, alert sound and
which blocks to show.

> **Sound:** the alert sound uses the engine's audio player, which exists on macOS only. On
> Windows and Linux the option does nothing.

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

- Plan limits per model (needs the engine to expose them; today only per-model *spend* is shown)
- Spend per project over longer ranges and per-session history
- Cross-platform sound (the engine plays audio on macOS only)
- More languages (add a table in `hooks/strings.ts`)
- Weekly/monthly goals

Contributions welcome. MIT licensed.
