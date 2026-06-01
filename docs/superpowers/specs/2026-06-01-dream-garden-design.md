# Dream Garden — Web Recreation Design

**Date:** 2026-06-01
**Source:** 2010 Thai Facebook game "ดรีมการ์เด้น" by SNS+, captured in the blog review at `ดรีมการ์เด้น _ MOCAIL-SPY.html` in this directory.

## Goal

Recreate the core farming-sim loop of Dream Garden as a single-player browser demo. The original was a multi-day, social Facebook game; this recreation is a self-contained playable distillation of its core experience that runs in one sitting.

## Scope

**In scope:**
- Core gameplay loop: plant seed → water → add sunlight → wait → harvest → auto-sell for coins
- Coin economy, XP, levels
- Level-gated flower unlocks (6 flower types)
- Expanding garden grid (3×3 starting, purchasable expansions to 4×4 and 5×5)
- Persistent state across page reloads via `localStorage`
- English UI
- SVG cartoon visual style

**Explicitly out of scope (no v2 hooks needed):**
- Friend / social / visit-other-gardens mechanics
- Rare flower variants
- Quest / order delivery system
- Decoration items
- Multi-language support
- Backend, accounts, real-time multi-day pacing

## Architecture

Zero-build static site. User double-clicks `index.html` and plays. No npm, no bundler, no server.

```
garden/
├── index.html          Entry point; <div id="app"></div>
├── styles.css          All styling
└── js/
    ├── main.js         Bootstrap: load state, initial render, start render-tick loop
    ├── state.js        Game state object + pure mutation functions
    ├── flowers.js      Flower catalog (static data)
    ├── render.js       DOM updates: top bar, grid, seed shelf
    ├── svg.js          SVG markup keyed by (flowerId, growthStage)
    └── storage.js      load() / save() against localStorage with version check
```

**Module responsibilities:**

- `state.js` — functions that mutate `state` in place: `plant(state, plotIdx, flowerId)`, `water(state, plotIdx)`, `sun(state, plotIdx)`, `harvest(state, plotIdx)`, `expandGrid(state)`. No DOM access. Each returns a small result describing what changed (e.g. `{ ok: true, leveledUp: true }`) for the render layer to react to. Also exports derived helpers: `getStage(plot, now)` returns the runtime stage of a plot.
- `flowers.js` — exports `FLOWERS` array. Each entry: `{ id, name, levelReq, seedCost, sellPrice, growMs }`.
- `render.js` — `renderAll(state)`, `renderTopBar(state)`, `renderGrid(state)`, `renderSeedShelf(state)`. Reads state, updates DOM. Owns click handlers, which dispatch to `state.js` mutations.
- `svg.js` — `flowerSvg(flowerId, stage)` returns an SVG string. Stages: `seed`, `watered`, `sunned`, `growing`, `bloomed`. Empty plots render no SVG.
- `storage.js` — `load()` returns parsed state or fresh state if missing/invalid/wrong-version. `save(state)` serializes to localStorage, swallows errors.
- `main.js` — calls `load()`, attaches `renderAll` as initial paint, then sets a `setInterval(renderAll, 500)` so growth timers and "bloomed" markers update without explicit events. Player actions also call `renderAll` immediately for snappy feedback.

**Why this split:** Each file has one job. `state.js` has no DOM imports, so its logic is easy to reason about and could be unit-tested if we ever wanted to. `render.js` is the only place that touches the DOM. The 500ms render tick keeps state-vs-display in sync without needing per-plot timers.

## Data model

State persisted to `localStorage` under key `"dreamgarden.v1"`:

```js
{
  version: 1,
  coins: 100,
  xp: 0,
  level: 1,
  gridSize: 3,            // 3 | 4 | 5
  plots: [                // length = gridSize * gridSize
    null,                 // empty plot
    {                     // planted plot
      flowerId: "rose",
      stage: "seed",      // "seed" | "watered" | "sunned"
      plantedAt: 1748793600000,
      bloomAt: null       // set when transitioning to "sunned"
    }
  ]
}
```

**Invariants:**
- `plots.length === gridSize * gridSize` at all times
- `coins >= 0`, `xp >= 0`, `level >= 1`
- A plot's stored `stage` only takes the values `seed`, `watered`, `sunned`. The runtime stages `growing` and `bloomed` are derived from `bloomAt` vs `Date.now()`:
  - `sunned` + `now < bloomAt` → `growing`
  - `sunned` + `now >= bloomAt` → `bloomed`
- `bloomAt` is `null` until the player adds sun; then set to `Date.now() + flower.growMs`. This means time only counts after the player has watered AND sunned — same as the original game.

**Save behavior:** `state.js` mutations do not call save directly. The click handlers in `render.js` are the single save site: after a mutation completes (including any cascading effects like level-up inside `harvest`), the handler calls `save(state)` and then `renderAll(state)`. The 500ms render tick does NOT save (no state changes there — only derived display).

**Ephemeral UI state** (not persisted): `selectedSeedId` lives in a module-scoped variable in `render.js`. It resets to the first unlocked flower on page load. It is not part of `state` and is not saved.

**Version migration:** none. If `version !== 1`, treat as missing and start fresh. This is a demo.

## Gameplay rules

### Flower catalog

| id | name | level req | seed cost | sell price | grow time |
|----|------|----------:|----------:|-----------:|----------:|
| `daisy` | Daisy | 1 | 5 | 12 | 10s |
| `tulip` | Tulip | 2 | 15 | 35 | 20s |
| `rose` | Rose | 4 | 40 | 90 | 35s |
| `jasmine` | Jasmine | 7 | 90 | 200 | 60s |
| `sunflower` | Sunflower | 10 | 200 | 450 | 90s |
| `calceolaria` | Calceolaria | 14 | 450 | 1000 | 120s |

XP earned per harvest = `floor(sellPrice / 5)`.

### Leveling

XP to reach level `L+1` from level `L`: `L² × 50`.
- L1 → L2: 50 XP
- L2 → L3: 200 XP
- L3 → L4: 450 XP
- L4 → L5: 800 XP
- ...

On level-up, the next flower unlock (if any) appears in the seed shelf. No bonuses, no carry-over banner — just the shelf updating.

### Plot expansion

| current | target | cost | min level |
|--------:|-------:|-----:|----------:|
| 3×3 (9) | 4×4 (16) | 500 | 5 |
| 4×4 (16) | 5×5 (25) | 2000 | 10 |

Expansion button appears in the top bar when the player meets the level requirement. Clicking it spends coins and pads `plots` with `null` entries.

### Starting state

`coins: 100, xp: 0, level: 1, gridSize: 3, plots: [null × 9]`. Daisy unlocked.

### Plot interactions

Player clicks a plot. Behavior depends on derived stage:

| Plot state | Click action |
|------------|--------------|
| `null` (empty) + seed selected + coins ≥ seedCost | Deduct seedCost, set plot to `{flowerId, stage: "seed", plantedAt: now, bloomAt: null}` |
| `null` (empty) + seed selected + coins < seedCost | No-op |
| `null` (empty) + no seed selected | No-op |
| `seed` | Set `stage: "watered"` |
| `watered` | Set `stage: "sunned"`, `bloomAt: now + growMs` |
| `growing` (derived) | No-op (just waiting) |
| `bloomed` (derived) | Add `sellPrice` coins, add `xp`, recompute level, set plot to `null` |

### Seed selection

The seed shelf shows all flowers. Unlocked = clickable; locked = grayed out with "🔒 Lv N". Clicking an unlocked seed sets the global `selectedSeedId`. Visual indicator: orange border around the selected card.

## Visual design

SVG cartoon style. All artwork is inline SVG generated by `svg.js`. Each flower has 5 stage drawings (`seed`, `watered`, `sunned`, `growing`, `bloomed`) — small (~24–56px) SVG markup. Pot is rendered with CSS (rounded brown square with drop shadow). Background is a gradient: sky on top, grass on bottom.

Top bar uses a parchment / cream color (`#fff4d6`) to match the gentle Facebook-game aesthetic of the original. Coins icon is a small gold circle. XP bar is a green-gradient progress bar.

## Error handling

- **localStorage unavailable / quota exceeded:** `storage.save` wraps in try/catch and silently no-ops. Game continues in-memory for the session. No user-facing error UI.
- **Corrupt save data:** `storage.load` wraps `JSON.parse` in try/catch; on failure returns fresh state. Effectively a reset.
- **Wrong version:** treated identically to corrupt save (fresh state).
- **Insufficient coins / locked seed:** UI prevents the interaction (disabled button, grayed seed) — the state functions still defensively check and return unchanged state if called incorrectly.
- **Long tab closure:** acceptable — `bloomAt` is absolute time, so flowers planted before closing the tab are correctly marked `bloomed` on reopen.

## Testing

Manual playtest checklist (no automated test framework — overkill for this scope):

1. Start fresh game (clear localStorage): see 100 coins, level 1, 3×3 grid, daisy selectable.
2. Plant daisy: coins drop to 95, plot shows seed.
3. Click seeded plot: shows watered icon.
4. Click watered plot: timer starts (growing).
5. Wait 10s: plot shows full daisy with ✓ badge (bloomed).
6. Click bloomed plot: coins go to 95 + 12 = 107, XP increases by 2.
7. Plant and harvest enough daisies to hit 50 XP: level 2, tulip unlocks visually.
8. Try clicking a locked seed: nothing happens, card stays grayed.
9. Try planting with insufficient coins: plant action is blocked.
10. Reload page mid-growth: state restored, timer continues correctly.
11. Reach level 5 with ≥ 500 coins: expansion button appears; click it, grid grows to 4×4 (16 plots), coins drop by 500.
12. Open devtools, run `localStorage.clear()`, reload: starting state appears.

## Open questions

None at design time. Gameplay numbers (prices, times, level reqs) are easy to retune in `flowers.js` after playtesting.

## File deliverables

| File | Purpose |
|------|---------|
| `index.html` | Mounted on `<div id="app">`, includes styles and module scripts |
| `styles.css` | Layout, colors, fonts, top bar / grid / shelf styles |
| `js/main.js` | Bootstrap and render-tick loop |
| `js/state.js` | State mutations and derived helpers |
| `js/flowers.js` | Static flower catalog |
| `js/render.js` | DOM rendering |
| `js/svg.js` | SVG markup table |
| `js/storage.js` | localStorage I/O |
