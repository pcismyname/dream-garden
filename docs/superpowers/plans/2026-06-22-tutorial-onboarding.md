# Tutorial Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the ambient-hints tutorial described in `docs/superpowers/specs/2026-06-22-tutorial-onboarding-design.md` — a brand-new player sees a pre-spawned bloomed daisy with a green pulse and a one-line hint below the garden, the pulse follows them through plant → water → sun, then hints turn off forever.

**Architecture:** Three additive touches across the existing code: state extension (new `tutorialDone` boolean + transient `tutorialCycle` counter, plus a pre-spawn on plot index 4), CSS (one keyframe + two classes), and render-side logic (a pure `computeTutorialHint` function consumed by `renderGrid`, plus cycle-counter writes in `handlePlotClick`).

**Tech Stack:** Vanilla JS using the `window.Garden` namespace via plain `<script>` tags, no build, no test framework. CSS in `styles.css`. Manual verification in a browser.

## Global Constraints

- Zero-build vanilla JS — no ES modules, no bundler. New code attaches to `window.Garden` inside the existing IIFE pattern.
- Script order in `index.html` is fixed: flowers → decorations → pots → potions → storage → state → daily → svg → fx → audio → render → cg → main. New code must not introduce new files that break this order.
- Scope is core loop only: harvest → plant → water → sun. Once `tutorialDone` is `true`, no tutorial code path runs and no DOM artifacts remain.
- Dismissal is implicit — no skip button, no settings toggle.
- All UI strings English only.
- Verification is manual in a browser with DevTools. No automated tests.
- Existing saves never see the tutorial — migration in `start()` defaults `tutorialDone` to `true` for any state missing the field.
- Pre-spawn flower is `daisy` (`growMs: 10000` → bloomed for ~10s before wilting; design accepts the wilting fallback).

## File Structure

- **Modify `js/state.js`** — Extend `createInitialState()` with `tutorialDone: false`, `tutorialCycle: { planted: false, watered: false, sunned: false }`, and pre-spawn a bloomed daisy on `s.plots[4]`.
- **Modify `js/main.js`** — Add migration line in `start()` next to the existing `musicVolume` migration.
- **Modify `js/render.js`** — Add `computeTutorialHint(state, now)` helper, apply `.tutorial-target` class + append `.tutorial-hint` element inside `renderGrid`, and write `tutorialCycle` flags + flip `tutorialDone` inside `handlePlotClick`.
- **Modify `styles.css`** — Add `@keyframes tutorial-pulse`, `.plot.tutorial-target` animation, and `.tutorial-hint` label styling.

No new files. No new script tags in `index.html`.

---

### Task 1: State extension, pre-spawn, and migration

**Files:**
- Modify: `js/state.js:6-26` (the `createInitialState()` function)
- Modify: `js/main.js:73-148` (the `start()` function — add migration alongside the existing `musicVolume` block at lines 92-103)

**Interfaces:**
- Consumes: `Garden.flowerById("daisy")` (already exists in `js/flowers.js`)
- Produces (read by later tasks):
  - `state.tutorialDone: boolean` — `false` on fresh state, `true` on migrated old saves
  - `state.tutorialCycle: { planted: boolean, watered: boolean, sunned: boolean }` — present only while `tutorialDone === false`
  - `state.plots[4]` — pre-populated as `{ flowerId: "daisy", bloomAt: <ms timestamp at fresh-state creation> }` on fresh states only

- [ ] **Step 1: Extend `createInitialState()` in `js/state.js`**

Open `js/state.js`. Locate `createInitialState()` (starts at line 6, currently ends around line 26 with `return s;`). Replace the body so the returned object has the two new tutorial fields and one pre-spawned plot.

Find:

```js
  function createInitialState() {
    const s = {
      version: VERSION,
      coins: 100,
      xp: 0,
      level: 1,
      gridSize: 3,
      plots: new Array(9).fill(null),
      plantCounts: {},   // { flowerId: int } — counts plantings of NORMAL flowers
      discovered: {},    // { rareFlowerId: true } — rares the player has grown
      quests: [],
      settings: { floatingNumbers: true, musicVolume: 100, sfxVolume: 100 },
      decorations: new Array(Garden.DECORATION_SLOTS).fill(null),
      ownedPots: [Garden.DEFAULT_POT],
      activePotId: Garden.DEFAULT_POT,
      inventory: {},
      daily: Garden.daily ? Garden.daily.defaultDaily() : null,
    };
    for (let i = 0; i < 3; i++) s.quests.push(generateQuest(s));
    return s;
  }
```

Replace with:

```js
  function createInitialState() {
    const s = {
      version: VERSION,
      coins: 100,
      xp: 0,
      level: 1,
      gridSize: 3,
      plots: new Array(9).fill(null),
      plantCounts: {},   // { flowerId: int } — counts plantings of NORMAL flowers
      discovered: {},    // { rareFlowerId: true } — rares the player has grown
      quests: [],
      settings: { floatingNumbers: true, musicVolume: 100, sfxVolume: 100 },
      decorations: new Array(Garden.DECORATION_SLOTS).fill(null),
      ownedPots: [Garden.DEFAULT_POT],
      activePotId: Garden.DEFAULT_POT,
      inventory: {},
      daily: Garden.daily ? Garden.daily.defaultDaily() : null,
      tutorialDone: false,
      tutorialCycle: { planted: false, watered: false, sunned: false },
    };
    // Tutorial pre-spawn: place a bloomed daisy on the center plot so a
    // brand-new player has a satisfying first action queued up.
    const daisy = Garden.flowerById("daisy");
    if (daisy) {
      s.plots[4] = { flowerId: "daisy", bloomAt: Date.now() };
    }
    for (let i = 0; i < 3; i++) s.quests.push(generateQuest(s));
    return s;
  }
```

- [ ] **Step 2: Add migration in `js/main.js`**

Open `js/main.js`. Locate the migration block in `start()` — it starts around line 85 with `if (!state.settings) state.settings = ...` and ends around line 103 with the `sfxVolume` clamp.

Insert two new lines immediately after the `sfxVolume` clamp line (`state.settings.sfxVolume = Math.max(0, Math.min(100, Math.round(state.settings.sfxVolume)));`) and before the audio block (`if (Garden.audio) {`):

```js
    // Tutorial migration: any save predating the tutorial system is treated
    // as a returning player and skips onboarding.
    if (typeof state.tutorialDone !== "boolean") state.tutorialDone = true;
```

Do NOT touch `state.tutorialCycle` in the migration — its absence is handled by `computeTutorialHint` (which checks `if (!cycle) return null;`).

- [ ] **Step 3: Verify the new state shape on a fresh load**

In a browser with the live site open via `index.html` (file:// or local server):

1. Open DevTools → Application → Local Storage → delete the `garden` key (or whatever the storage key is — check `js/storage.js` if unsure).
2. Reload the page.
3. In DevTools console, run:
   ```js
   JSON.parse(localStorage.getItem("dream-garden-v1"))
   ```
   (or whatever key `Garden.storage` uses — adjust if the key name differs).

Expected:
- `tutorialDone: false`
- `tutorialCycle: { planted: false, watered: false, sunned: false }`
- `plots[4]: { flowerId: "daisy", bloomAt: <a recent timestamp> }`
- `plots[0..3, 5..8]: null`

Visually: the center plot should show a bloomed daisy with the ✓ ready-badge and a wilt countdown (it's bloomed from t=0, wilts at t=10s for daisy). No pulse yet — Task 2 adds that.

- [ ] **Step 4: Verify migration on a simulated old save**

In DevTools:

1. With the fresh state in localStorage, delete the `tutorialDone` field manually:
   ```js
   const raw = localStorage.getItem("dream-garden-v1");
   const s = JSON.parse(raw);
   delete s.tutorialDone;
   localStorage.setItem("dream-garden-v1", JSON.stringify(s));
   ```
2. Reload.
3. Inspect storage again — `tutorialDone` should be `true`.
4. No bloomed daisy should appear (the pre-spawn doesn't re-run; the loaded save's `plots[4]` is whatever it was before the delete).

If `tutorialDone` is still `false` after reload, the migration line is in the wrong place — verify it's inside `start()` and runs before the storage.save call near the end of `start()`.

- [ ] **Step 5: Commit**

```bash
git add js/state.js js/main.js
git commit -m "feat: tutorial state extension + pre-spawn + migration

Fresh state now starts with tutorialDone: false, a tutorialCycle
counter, and a bloomed daisy pre-spawned on the center plot.
Existing saves migrate to tutorialDone: true in main.js start()."
```

---

### Task 2: Visual styles, inference function, and render hookup

**Files:**
- Modify: `styles.css` (append new keyframe and two classes)
- Modify: `js/render.js` — add `computeTutorialHint` helper (insert before `renderGrid`, around line 150) and extend `renderGrid` to apply the `.tutorial-target` class and append the `.tutorial-hint` element

**Interfaces:**
- Consumes: `state.tutorialDone`, `state.tutorialCycle`, `state.plots[]`, `Garden.state.getStage(plot, now)` (existing helper)
- Produces (consumed by Task 3 only indirectly via shared state):
  - `computeTutorialHint(state, now) → { targetIdx: number, text: string } | null` — pure function, no side effects
  - CSS class `tutorial-target` applied to a `.plot` element produces a soft green pulse
  - DOM element `<div class="tutorial-hint">{text}</div>` appended inside `.garden` after `.grid`

- [ ] **Step 1: Add CSS in `styles.css`**

Open `styles.css`. Append at the end of the file:

```css
/* Tutorial onboarding — pulse on the target plot + hint label below the garden. */
@keyframes tutorial-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(126, 231, 135, 0.55); }
  50%      { box-shadow: 0 0 0 10px rgba(126, 231, 135, 0); }
}
.plot.tutorial-target {
  animation: tutorial-pulse 1.4s ease-in-out infinite;
  border-radius: 8px; /* harmless if the plot already has a radius; needed for clean shadow on plots that don't */
}
.tutorial-hint {
  margin-top: 12px;
  text-align: center;
  font-size: 14px;
  color: #2f7a3d;
  font-weight: 500;
  opacity: 0.9;
}
```

The color `#2f7a3d` is the existing accent green used in floating-number "+XP" pops (`js/render.js:1246` uses `#3b8e3b`, close cousin) — picking the same hue family keeps the visual language consistent. Verify it reads as green-on-light-background in the actual UI; if the page background is dark, switch to `#7ee787`.

- [ ] **Step 2: Add the `computeTutorialHint` helper in `js/render.js`**

Open `js/render.js`. Locate `renderGrid` (currently at line 151). Insert this helper function immediately above it (around line 150, after the closing `}` of `renderCatalog`'s `renderGrid` or wherever the previous function ends):

```js
  // Tutorial: pure function returning the current pulse target + label text,
  // or null when no hint applies. First-match-wins by lowest plot index for
  // stable behavior when the player has multiple plots in the same state.
  function computeTutorialHint(state, now) {
    if (state.tutorialDone) return null;
    const cycle = state.tutorialCycle;
    if (!cycle) return null;

    if (!cycle.planted) {
      const bloomed = state.plots.findIndex(
        p => p && Garden.state.getStage(p, now) === "bloomed"
      );
      if (bloomed !== -1) return { targetIdx: bloomed, text: "Click to harvest!" };
      const empty = state.plots.findIndex(p => p === null);
      if (empty !== -1) return { targetIdx: empty, text: "Click to plant" };
      return null;
    }
    if (!cycle.watered) {
      const seed = state.plots.findIndex(
        p => p && Garden.state.getStage(p, now) === "seed"
      );
      if (seed !== -1) return { targetIdx: seed, text: "Click to water" };
      return null;
    }
    if (!cycle.sunned) {
      const watered = state.plots.findIndex(
        p => p && Garden.state.getStage(p, now) === "watered"
      );
      if (watered !== -1) return { targetIdx: watered, text: "Click for sun" };
      return null;
    }
    return null;
  }
```

- [ ] **Step 3: Hook the helper into `renderGrid`**

Still in `js/render.js`. Locate `renderGrid` (now starts at line 152 after the helper insert). The function currently builds `wrap` (the `.garden` div containing `.grid`), iterates over `state.plots` appending `plotEl`s to `grid`, then returns `wrap`.

Find the end of the `state.plots.forEach((plot, idx) => { ... })` loop and the `return wrap;` statement near the bottom of `renderGrid`. Just before `return wrap;`, insert:

```js
    // Tutorial pulse + hint label. Renders only while tutorialDone === false.
    const hint = computeTutorialHint(state, now);
    if (hint) {
      const plotEls = grid.querySelectorAll(".plot");
      const targetEl = plotEls[hint.targetIdx];
      if (targetEl) targetEl.classList.add("tutorial-target");
      const label = document.createElement("div");
      label.className = "tutorial-hint";
      label.textContent = hint.text;
      wrap.appendChild(label);
    }
```

The `now` variable is already in scope (declared at the top of `renderGrid` as `const now = Date.now();`). Reuse it; do not call `Date.now()` again.

- [ ] **Step 4: Verify the pulse and label render on a fresh load**

1. In DevTools, clear localStorage again (`localStorage.clear()`) and reload.
2. Visually confirm:
   - The center plot (plot index 4) has a soft green pulsing glow around it.
   - Directly below the garden grid, a green label reads `Click to harvest!`.
   - The pulse pulses at roughly 1.4 second intervals.

If the pulse is clipped by the garden container's `overflow-x: auto` on the rightmost column: this is the documented mobile edge case. For now, the pulse on plot 4 (center) won't be affected — verify mobile later in step 6.

- [ ] **Step 5: Verify the label disappears for a returning player**

1. In DevTools console:
   ```js
   const raw = localStorage.getItem("dream-garden-v1");
   const s = JSON.parse(raw);
   s.tutorialDone = true;
   delete s.tutorialCycle;
   localStorage.setItem("dream-garden-v1", JSON.stringify(s));
   ```
2. Reload.
3. The pulse should be gone. The `.tutorial-hint` element should NOT appear in the DOM (inspect the `.garden` div in the Elements panel — only `.grid` should be inside). The bloomed daisy is still on plot 4 (because the save persisted it from the fresh-state task) but no pulse, no label.

- [ ] **Step 6: Verify on mobile viewport**

1. In DevTools, switch to the device toolbar, set viewport to 375 × 667 (iPhone SE).
2. Clear localStorage and reload.
3. The mobile layout puts the garden in the "garden" bottom-tab. Tap the garden tab if needed.
4. Confirm the pulse renders on the center plot and the label appears below the garden grid — both visible without horizontal scrolling.
5. If the pulse is clipped on the right edge, this only matters for plots on the rightmost column — center plot should be fine.

- [ ] **Step 7: Commit**

```bash
git add styles.css js/render.js
git commit -m "feat: tutorial pulse + hint label rendering

Add computeTutorialHint helper (pure function), apply .tutorial-target
class to the target plot, and append a .tutorial-hint label below the
grid. CSS keyframe drives a soft green ripple. No-op when tutorialDone."
```

---

### Task 3: Completion trigger + full verification

**Files:**
- Modify: `js/render.js:1169-1234` (the `handlePlotClick` function — specifically the plant branch around lines 1198-1205, the water branch around line 1209, and the sun branch around line 1213)

**Interfaces:**
- Consumes: `state.tutorialDone`, `state.tutorialCycle` (from Task 1), `computeTutorialHint` (from Task 2 — indirectly, via the renderer it drives)
- Mutates: `state.tutorialCycle.planted`, `state.tutorialCycle.watered`, `state.tutorialCycle.sunned`, `state.tutorialDone` (flips to `true` when all three cycle flags are true)
- Side effect: deletes `state.tutorialCycle` when the tutorial completes (keeps the persisted state object clean)

- [ ] **Step 1: Add a tutorial-helper call inside `handlePlotClick`**

Open `js/render.js`. Locate `handlePlotClick` (starts at line 1169). The function currently:

1. Checks `selectedPotionId` first (lines 1175-1193).
2. If `!plot`, plants a seed (lines 1198-1205).
3. Else cycles through stages (seed → water; watered → sun; bloomed → harvest; wilted → clear; growing → no-op).
4. Saves and re-renders.

We need to write to `state.tutorialCycle` AFTER each successful plant/water/sun action, then check for completion. Add a single helper function just above `handlePlotClick` to keep the call sites tidy:

```js
  // Tutorial: mark a step in the cycle; flip tutorialDone + drop the
  // transient cycle object once all three are true.
  function markTutorialStep(state, step) {
    if (state.tutorialDone) return;
    if (!state.tutorialCycle) return;
    state.tutorialCycle[step] = true;
    if (state.tutorialCycle.planted &&
        state.tutorialCycle.watered &&
        state.tutorialCycle.sunned) {
      state.tutorialDone = true;
      delete state.tutorialCycle;
    }
  }
```

- [ ] **Step 2: Call `markTutorialStep` from the plant branch**

In `handlePlotClick`, locate the plant branch:

```js
    if (!plot) {
      if (!selectedSeedId) return;
      if (selectedSeedId === "mysterySeed") {
        Garden.state.plantMystery(state, idx);
      } else {
        Garden.state.plant(state, idx, selectedSeedId);
      }
      if (Garden.audio) Garden.audio.playSfx("plant");
    } else {
```

Add the tutorial call immediately after the `playSfx("plant")` line and before the closing `}` of this branch:

```js
    if (!plot) {
      if (!selectedSeedId) return;
      if (selectedSeedId === "mysterySeed") {
        Garden.state.plantMystery(state, idx);
      } else {
        Garden.state.plant(state, idx, selectedSeedId);
      }
      if (Garden.audio) Garden.audio.playSfx("plant");
      markTutorialStep(state, "planted");
    } else {
```

- [ ] **Step 3: Call `markTutorialStep` from the water and sun branches**

Still in `handlePlotClick`, the watered/sun branch currently looks like:

```js
    } else {
      const stage = Garden.state.getStage(plot, now);
      if (stage === "seed") {
        Garden.state.water(state, idx);
        if (Garden.audio) Garden.audio.playSfx("water");
      }
      else if (stage === "watered") {
        Garden.state.sun(state, idx);
        if (Garden.audio) Garden.audio.playSfx("sun");
      }
      else if (stage === "bloomed") {
```

Add `markTutorialStep` calls after the matching SFX:

```js
    } else {
      const stage = Garden.state.getStage(plot, now);
      if (stage === "seed") {
        Garden.state.water(state, idx);
        if (Garden.audio) Garden.audio.playSfx("water");
        markTutorialStep(state, "watered");
      }
      else if (stage === "watered") {
        Garden.state.sun(state, idx);
        if (Garden.audio) Garden.audio.playSfx("sun");
        markTutorialStep(state, "sunned");
      }
      else if (stage === "bloomed") {
```

Do NOT add a call to the harvest branch — the spec deliberately leaves harvest out of the completion gate.

- [ ] **Step 4: Verify the happy-path completion flow**

1. Clear localStorage (`localStorage.clear()`) and reload.
2. The pulse should be on plot 4 with "Click to harvest!" — click it.
3. After harvest, the pulse moves to plot 0 (the lowest-index empty plot) with "Click to plant". Click it.
4. After plant, the pulse stays on plot 0 (now seed) with "Click to water". Click it.
5. After water, the pulse stays with "Click for sun". Click it.
6. After sun, the pulse and the label both vanish.
7. In DevTools console, inspect state:
   ```js
   const s = JSON.parse(localStorage.getItem("dream-garden-v1"));
   console.log("tutorialDone:", s.tutorialDone);   // expect: true
   console.log("tutorialCycle:", s.tutorialCycle); // expect: undefined
   ```

- [ ] **Step 5: Verify the wilting edge case**

1. Clear localStorage and reload.
2. Without clicking the pre-spawned bloom, wait 10+ seconds (daisy `growMs: 10000`).
3. After the wilt timer hits 0, the center plot should switch to the wilted ✕ visual.
4. The pulse should jump to plot 0 (an empty plot) and the label should now read "Click to plant".

- [ ] **Step 6: Verify the out-of-order edge case**

1. Clear localStorage and reload.
2. WITHOUT harvesting the pre-spawn first, click plot 0 (an empty plot) to plant a daisy.
3. The pulse should immediately move from plot 4 to plot 0 (now seed), and the label should read "Click to water".
4. The bloomed daisy on plot 4 is now ignored — it will wilt eventually.

- [ ] **Step 7: Verify the modal-interruption case**

1. Clear localStorage and reload.
2. Before doing anything, click the Shop icon in the top bar. The modal opens; the pulse and label may still be visible underneath (or hidden behind the modal — both acceptable).
3. Close the modal.
4. The pulse and label must be back, unchanged.
5. Repeat for Catalog, Settings, and Daily (if Daily has any claimables — otherwise just open via the icon).

- [ ] **Step 8: Verify the migration-conservative behavior**

1. With the tutorial complete from step 4, in DevTools:
   ```js
   const s = JSON.parse(localStorage.getItem("dream-garden-v1"));
   s.tutorialDone = false;
   localStorage.setItem("dream-garden-v1", JSON.stringify(s));
   ```
2. Reload. Because `tutorialCycle` is undefined (we deleted it on completion), `computeTutorialHint` returns `null` at the `if (!cycle) return null;` guard. No pulse, no label.
3. In DevTools, also delete `tutorialDone`:
   ```js
   const s = JSON.parse(localStorage.getItem("dream-garden-v1"));
   delete s.tutorialDone;
   localStorage.setItem("dream-garden-v1", JSON.stringify(s));
   ```
4. Reload. Migration sets `tutorialDone` to `true`. Still no pulse, no label.

- [ ] **Step 9: Verify desktop viewport**

1. Resize the browser window to ≥ 1280 × 800 (or use DevTools device toolbar).
2. Clear localStorage and reload.
3. The desktop three-column layout puts the garden in the center column. Pulse on plot 4 should be visible, label below the grid in the same column.

- [ ] **Step 10: Commit**

```bash
git add js/render.js
git commit -m "feat: tutorial completion trigger in handlePlotClick

markTutorialStep updates the tutorialCycle flags on plant/water/sun
clicks. When all three are true, tutorialDone flips and the transient
tutorialCycle object is dropped. Harvest is not part of the gate."
```

- [ ] **Step 11: Optional cleanup — verify the public site still works**

The live demo is at <https://pcismyname.github.io/dream-garden/>. Once these three commits are pushed to `origin/master`, GitHub Pages will redeploy automatically.

After the deploy completes (~30s):
1. Open the live site in a private window (clean cookies + storage).
2. Confirm the pulse and label render.
3. Walk through the four-step tutorial. Confirm it completes.
4. Reload. Confirm hints are gone.

No commit; this is end-to-end smoke verification.

---

## Self-review notes

- Spec coverage: every requirement from `docs/superpowers/specs/2026-06-22-tutorial-onboarding-design.md` maps to a task. State model + pre-spawn → Task 1. Migration → Task 1. Inference function → Task 2. Visual treatment → Task 2. Completion trigger → Task 3. Verification checklist → Task 3 (and partial coverage in Tasks 1-2).
- Type consistency check: `tutorialCycle` keys (`planted`, `watered`, `sunned`) are spelled the same in Task 1 (state init), Task 2 (helper reads), and Task 3 (helper writes). `tutorialDone` is consistent. `computeTutorialHint` signature `(state, now) → {targetIdx, text} | null` is consistent across Task 2 (defines it) and Task 3 (does not call it — only the renderer does).
- Placeholder scan: every code block is complete. Verification steps are explicit clicks/inspects, not "test it works".
- One spec edge case handled implicitly: the spec mentions box-shadow clipping on mobile as a "verify visually" item. Task 2 step 6 covers it for the center plot (most relevant case); if a later content change pushes the tutorial to a corner plot, the `inset` fallback can be added then.
