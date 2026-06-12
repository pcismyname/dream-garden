# Daily Engagement System — Design

**Date:** 2026-06-12
**Status:** Approved
**Goal:** Improve day-2+ retention by giving players a reason to return every calendar day: a login streak calendar, daily quests, a free lucky draw, and a "while you were away" recap — all surfaced through a single Morning Report ritual modal.

## Context

Dream Garden v1.11 has the full core loop (plant → water → sun → bloom → harvest/wilt), rare variants + catalog, rolling quests, decorations, pot skins, and consumable potions with an inventory. Nothing currently changes between visits on different days, so there is no comeback driver. This feature set adds one.

Out of scope (unchanged from project scope): multiplayer, backend, real-time multi-hour pacing. Also out of scope here: tutorial/onboarding, audio, achievements, NPC gardens (still on the deferred roadmap).

## Day boundary & state foundation

New module `js/daily.js` owns all day logic.

- **A day is a local calendar date**, keyed as `"YYYY-MM-DD"` from local time. No 24h cooldowns (those drift later each day).
- New state field, defensively defaulted on load like `inventory` was. **No storage version bump** — `storage.js` rejects mismatched versions outright, which would wipe saves.

```js
daily: {
  streakCount: 0,        // 0..7 position in the reward cycle
  lastClaimDay: null,    // "2026-06-12" — streak claimed today?
  lastSpinDay: null,     // lucky draw used today?
  questsDay: null,       // day key the current quest set belongs to
  lastSeenAt: 0,         // ms timestamp, updated on every save — powers the recap
}
```

`lastSeenAt` is refreshed inside the save path so it tracks "last time the game was open" without extra timers.

## Login streak (7-day repeating cycle)

Reward track (escalating):

| Day | Reward |
|-----|--------|
| 1 | 50 coins |
| 2 | 100 coins |
| 3 | 1 speed potion |
| 4 | 200 coins |
| 5 | 1 revival potion |
| 6 | 400 coins |
| 7 | 1 mystery seed + 500 coins |

- After day 7 the cycle repeats from day 1. The calendar UI shows the 7-day cycle position only.
- **Claiming:** once per calendar day via the Claim button in the Morning Report. Sets `lastClaimDay = today`, then advances `streakCount`.
- **Rewind rule (miss penalty):** if the gap since `lastClaimDay` is more than 1 calendar day, `streakCount = max(0, streakCount - 1)` is applied before the claim. One missed day slips you back one step — never a full reset.
- The rewind is keyed to the last **claim**, not the last visit: a player who opens the game but dismisses the Morning Report without claiming is treated as having missed that day. This is intentional — the Claim button is front-and-center in an auto-opening modal, so visiting and claiming are effectively the same action.

## Daily quests (replaces rolling quests)

- On first load of a new day, all 3 quests are regenerated via the existing `generateQuest` logic and `questsDay = today`.
- Quests **no longer regenerate on completion**. A completed quest stays visibly checked ✓ until the next day. "All done — come back tomorrow" is the intended stopping point.
- Quest rewards are 1.5× the current rolling-quest bonus formulas (coins and XP, rounded), since players now get only 3 per day.
- **All-3 chest:** completing the third quest grants a bonus chest: level-scaled coins (`100 + level * 25`) + 1 random potion (speed or revival, 50/50). Awarded instantly with a toast; a chest icon under the quest panel shows claimed/unclaimed state for the day.
- The quest sidebar shows a NEW badge on days with a fresh, untouched quest set.
- Existing saves: old rolling quests are replaced wholesale on the first new-day rollover; until then they keep functioning as-is.

## Lucky draw

- One free spin per calendar day (`lastSpinDay` guard). Lives in the Morning Report.
- Weighted prize table:

| Prize | Amount | Weight |
|-------|--------|--------|
| Small coins | `40 + level * 5` | 40% |
| Medium coins | `100 + level * 10` | 25% |
| Speed potion | 1 | 15% |
| Revival potion | 1 | 10% |
| Large coins | `300 + level * 20` | 5% |
| Mystery seed | 1 | 5% |

- Presentation: cycling-highlight animation across the prize icons (~1.5s) that lands on the result, then the existing toast/float juice. No external libraries.

## Mystery seed

- New inventory item reusing `state.inventory` (`inventory.mysterySeed`), like potions.
- Appears in the seed bar as a "?" card **only when count > 0**, with a count badge. Selectable like a normal seed; planting costs 0 coins and decrements the count.
- **Resolution on plant:** the actual flower is chosen at plant time and stored on the plot, but rendered as a "?" sprout until bloom:
  - Pick a random flower from the player's currently unlocked normal flowers.
  - If that flower has a rare cousin: **25% chance the plot is the rare variant** (bypassing the every-Nth-planting interval). Rare discovery is recorded at bloom reveal, with the existing rare fanfare.
- The resolved flower uses its own `growMs` and the normal wilt window. Mystery plantings do not increment `plantCounts` (they bypass the interval system).

## While-you-were-away recap

- On load, for each occupied plot compare event times against `daily.lastSeenAt`:
  - `bloomAt` crossed during absence → counts as "bloomed while away".
  - `bloomAt + growMs` (wilt time) crossed during absence → counts as "wilted while away".
- Displayed as the top section of the Morning Report: e.g. "🌸 2 bloomed · 🥀 1 wilted · 3 ready now".
- Skipped entirely if the absence was under 10 minutes or no events occurred.

## Morning Report modal + Daily button

- **Auto-opens** on load when it's the first visit of a new calendar day, or whenever an unclaimed streak claim or unspun draw exists.
- Section order: recap → streak calendar with Claim button → lucky draw. Footer button "Start gardening" closes; Esc also closes (consistent with the shop modal and potion use-mode Esc pattern).
- New top-bar **Daily button** next to Shop reopens the modal anytime. It carries a badge counting remaining claimables today (unclaimed streak + unused spin, 0–2). The badge disappears when both are used.

## Persistence & migration

- All new fields (`state.daily`, `inventory.mysterySeed`, quest-set shape) are defensively defaulted on load, following the existing pattern in `state.js`. No storage version bump.
- Plot objects gain an optional `mystery: true` flag for unresolved-display rendering; absent on all existing plots, so old saves render unchanged.

## Architecture

| File | Change |
|------|--------|
| `js/daily.js` (new) | Day-key helpers, streak claim logic, draw logic + prize table, daily quest rollover, recap computation, dev day-offset helper |
| `js/state.js` | `daily` default in `createInitialState` + defensive default on load; mystery-seed plant path; quest completion → chest logic |
| `js/render.js` | Morning Report modal, Daily button + badge, streak calendar UI, draw spin UI, "?" seed card + "?" sprout rendering, quest ✓/chest UI |
| `js/svg.js` | Art: mystery seed "?" card, "?" sprout, chest, draw prize icons |
| `js/storage.js` | No structural change; `lastSeenAt` refreshed in save path |
| `js/main.js` | Boot-time day-rollover check + Morning Report trigger |
| `css/*.css` | Modal sections, calendar strip, badge, spin highlight animation |

State logic stays in pure functions on `Garden.state` / `Garden.daily` (testable via console), rendering stays in `render.js` — same separation the codebase already uses.

## Testing

Zero-build project with no test runner; testing is manual, aided by a dev hook:

- `Garden.daily._setDayOffset(n)` — shifts the computed day key by `n` days so rollover behavior is testable without waiting 24h.
- Manual test plan:
  1. Fresh save → Morning Report shows day-1 claim, spin available, 3 quests.
  2. Same-day reload → no auto-open once claim + spin used; Daily button badge empty.
  3. `+1` day → auto-open, day-2 claim, fresh quests, NEW badge.
  4. `+2` day gap → streak rewinds one step before claim.
  5. Day 7 claim → mystery seed + coins; day 8 → cycle back to day-1 reward.
  6. Double-claim / double-spin attempts → rejected.
  7. Mystery seed: plant ("?" sprout), bloom reveal, rare path (force via repeated draws or console), wilt path.
  8. Recap: leave plots mid-grow, advance time, reload → correct bloomed/wilted counts; under-10-minute absence shows no recap.
  9. Complete all 3 daily quests → chest awarded once; quests stay ✓ until next day.
  10. Old save (pre-feature) loads without errors; rolling quests survive until first rollover.
