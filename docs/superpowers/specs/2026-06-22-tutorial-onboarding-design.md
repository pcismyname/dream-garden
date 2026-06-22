# Tutorial Onboarding — Ambient Hints Design

**Date:** 2026-06-22
**Status:** Draft
**Context:** The CrazyGames Basic Launch submission (commits `35628cc..882293a`) closed the portal-readiness gate on the SDK side. The next portal-readiness gate is new-player retention: CrazyGames traffic drops in cold, and the current game opens to nine empty plots with no first-action cue. This spec covers the first item on the deferred-features list from `memory/project_dream_garden.md`: tutorial / onboarding.

## Goal

A brand-new player should perform their first satisfying action within five seconds of the game finishing its initial render, and learn the full core loop (plant → water → sun → harvest) within their first 60 seconds — without ever seeing a modal dialog, a forced step-by-step overlay, or a "Welcome to Dream Garden" splash.

## Approach (chosen during brainstorming on 2026-06-22)

**Better defaults + ambient hints only.** No tutorial overlay. The game pre-spawns one bloomed daisy on the center plot and shows a soft pulse + one-line label that tells the player what to do next. The pulse follows the player's progress through the core loop. Once the player has completed one full self-driven cycle (plant → water → sun), hints turn off forever.

- **Scope:** core loop only. Shop, decorations, potions, quests, daily, catalog are all discovered organically — no hints for them.
- **Dismissal:** implicit only. No "Skip intro" button. Hints fade automatically when the player either performs the corresponding action OR the inference function can no longer find a matching target (e.g., they ignore the pulse and the pre-spawn wilts — the hint moves to whatever's actionable).

## Non-goals

- **No "Skip tutorial" UI.** The dismissal model is implicit; adding a skip button contradicts that choice.
- **No tutorial replay from settings.** Single-use, never returns.
- **No hints for non-core systems** (shop, catalog, decorations, potions, quests, daily). Discovery is organic.
- **No NPC, mascot, or character-driven guidance.** Pulse + one-line label is the entire UI surface.
- **No tooltips with `getBoundingClientRect` positioning.** A static label below the garden carries the text; the pulse on the plot carries the location.
- **No localization.** Hint labels ship in English only, matching the rest of the game.
- **No analytics events.** Basic Launch doesn't justify the Data-module overhead (see the CrazyGames SDK spec for non-goals on Data).

## Architecture

Three pieces, all additive to existing files:

1. **State extension** in `js/state.js`: one persistent boolean (`tutorialDone`) and one transient object (`tutorialCycle`) added to `createInitialState()`.
2. **Inference function** in `js/render.js`: `computeTutorialHint(state, now)` — a pure function returning the current pulse target and label text, or `null` when no hint applies.
3. **Visual treatment** in `styles.css`: one keyframe animation (`tutorial-pulse`) plus styling for the `.tutorial-hint` label below the garden.

### State model

`createInitialState()` (in `js/state.js`) sets:

```js
tutorialDone: false,
tutorialCycle: { planted: false, watered: false, sunned: false },
```

Migration in `start()` (in `js/main.js`), alongside the existing `musicVolume` migration:

```js
if (typeof state.tutorialDone !== "boolean") state.tutorialDone = true;
```

Existing saves default `tutorialDone` to `true` — returning players never see the tutorial. Only freshly created states (no prior `localStorage` key) start with `tutorialDone: false`.

### Pre-spawn

Inside `createInitialState()`, after the empty `plots` array is built and before the function returns:

```js
const daisy = Garden.flowerById("daisy");
if (daisy) {
  s.plots[4] = {
    flowerId: "daisy",
    bloomAt: Date.now(),
  };
}
```

- Plot index 4 is the center of the 3×3 grid.
- `bloomAt: Date.now()` means the flower is already in the bloomed stage with a fresh wilt window — `Garden.state.getStage(plot, now)` returns `"bloomed"` immediately.
- Defensive guard: if `flowerById("daisy")` is undefined (e.g., the catalog changes in the future), skip the pre-spawn. The tutorial degrades to "Click to plant" on the first empty plot — still works.
- This runs exactly once, because `createInitialState()` only runs when there's no save in localStorage.

### Inference function

In `js/render.js`:

```js
function computeTutorialHint(state, now) {
  if (state.tutorialDone) return null;
  const cycle = state.tutorialCycle;
  if (!cycle) return null; // defensive

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

Properties:

- **Pure** — depends only on its arguments. No DOM access, no side effects.
- **Stable** — first-match-wins by lowest plot index. Multiple plots in the same state never cause the pulse to flicker between them.
- **Defensive** — returns `null` when no plot matches the expected stage (e.g., player wilted the only seed). The renderer falls through to no-hint behavior.

### Completion trigger

In `handlePlotClick` (in `js/render.js`), immediately after each state action and before `renderAll(state)`, update the cycle counter only when `!state.tutorialDone`. The update is inlined at the same site as the existing `Garden.audio.playSfx(...)` calls, so any plant action (both `Garden.state.plant` and `Garden.state.plantMystery`) increments the same counter:

```js
if (!state.tutorialDone) {
  // ... after the plant branch (plant OR plantMystery):
  state.tutorialCycle.planted = true;
  // ... after the water branch:
  state.tutorialCycle.watered = true;
  // ... after the sun branch:
  state.tutorialCycle.sunned = true;

  if (state.tutorialCycle.planted &&
      state.tutorialCycle.watered &&
      state.tutorialCycle.sunned) {
    state.tutorialDone = true;
    delete state.tutorialCycle;
  }
}
```

The transient `tutorialCycle` object is deleted when the tutorial completes — keeps the persisted state clean. The `tutorialDone` boolean stays.

The harvest action is not part of the completion gate. The pre-spawned bloom anchors the first harvest, but once the player has shown they can plant, water, and sun, they've demonstrated the loop. Gating on a second harvest would force them to wait through the grow timer to finish the tutorial, which contradicts the "off in 60 seconds" goal.

### Visual treatment

**Pulse on the target plot.** When `computeTutorialHint(...)` returns a non-null result, the renderer adds the class `tutorial-target` to the plot element at `targetIdx`. CSS in `styles.css`:

```css
@keyframes tutorial-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(126, 231, 135, 0.55); }
  50%      { box-shadow: 0 0 0 10px rgba(126, 231, 135, 0); }
}
.plot.tutorial-target {
  animation: tutorial-pulse 1.4s ease-in-out infinite;
}
```

Soft green ripple matching the existing accent color. The animation restarts each render (because `renderAll` rebuilds the DOM), but renders only happen on stage transitions or player clicks — the visual restart is imperceptible.

**Hint label below the garden.** When `computeTutorialHint(...)` returns non-null, the renderer appends a `<div class="tutorial-hint">{text}</div>` element to the garden container. CSS:

```css
.tutorial-hint {
  margin-top: 12px;
  text-align: center;
  font-size: 14px;
  color: var(--accent);
  opacity: 0.9;
  font-weight: 500;
}
```

When the tutorial completes (or the inference returns `null`), the element is omitted from the render output entirely — not just hidden. No permanent UI surface remains in the DOM after the tutorial ends.

The label sits in the same column as the garden grid on both desktop and mobile shapes — no absolute positioning, no shape-conditional CSS needed.

## Edge cases

### Handled implicitly by the inference function

- **Player lets the pre-spawn wilt** (waits past the daisy wilt window without clicking). The bloomed plot becomes wilted; `findIndex(stage === "bloomed")` returns -1; inference falls through to the empty-plot branch. Pulse moves to an empty plot, label = "Click to plant". The wilted plot sits there; the player learns about wilting via the catalog later.
- **Player plants before harvesting the pre-spawn.** The plant click flips `cycle.planted`; inference jumps to the water-check branch and pulses the new seed. The pre-spawn bloom is left to wilt on its own — acceptable, the player drove the order.
- **Player plants multiple seeds before watering any.** First-match-wins by lowest index → pulse is stable on plot[lowest], not flickering.
- **Player closes the browser between tutorial steps.** `tutorialDone` and `tutorialCycle` are persisted via the existing `Garden.storage.save(state)` after each click. Returning resumes from the same step.
- **Player clears localStorage.** Fresh state → tutorial runs again. Correct.
- **Player opens shop / catalog / settings / daily during tutorial.** Modal opens over the garden; pulse and label still render in the garden DOM underneath. When the modal closes, they're immediately visible again.

### Handled by explicit code

- **`flowerById("daisy")` returns undefined.** Pre-spawn skipped silently. Tutorial degrades to "Click to plant" on first empty plot. Implemented via the `if (daisy)` guard in `createInitialState()`.
- **Saves from before the tutorial system existed** (any commit before this feature ships). Migration in `start()` defaults `tutorialDone` to `true` for any state missing the field. Returning players never see the tutorial.
- **`tutorialCycle` lingering after completion.** Deleted explicitly when `tutorialDone` flips to `true`. Keeps the persisted state clean.

### Visual edge cases to verify

- **Box-shadow clipping on mobile.** The garden container has `overflow-x: auto` from the landscape-layout work. The pulse's 10px spread could be clipped on the rightmost column on mobile. Verify visually during implementation; if clipped, fall back to `box-shadow: inset` instead of an outer glow.
- **Pulse vs. existing bloomed-flower idle animation.** The bloomed flower may already have a subtle bob or glow. The tutorial pulse adds a distinct green ripple via box-shadow rather than transform, so the two should not conflict. Verify visually.

## Verification (manual)

Zero-build vanilla JS — no test framework. The author of the implementation runs this checklist in a browser with DevTools open:

1. Wipe `localStorage` → reload → center plot shows a bloomed daisy with green pulse and "Click to harvest!" label below the garden.
2. Harvest it → pulse moves to first empty plot, label = "Click to plant".
3. Plant → pulse stays on that plot (now seed), label = "Click to water".
4. Water → pulse stays, label = "Click for sun".
5. Sun → pulse and label disappear; in DevTools, `state.tutorialDone === true` and `state.tutorialCycle === undefined`.
6. Reload → no pulse, no label, no hint copy.
7. **Migration check A:** in DevTools, delete `state.tutorialDone` from the saved state object, then reload → `start()` migration sets `tutorialDone = true`, no pulse, no label.
8. **Migration check B:** in DevTools, set `state.tutorialDone = false` and reload → migration leaves the boolean intact, no pulse (because there's no `tutorialCycle` either). Confirms the migration is conservative.
9. **Wilting path:** wipe localStorage → reload → wait past the daisy wilt window without clicking → pulse jumps to an empty plot, label = "Click to plant".
10. **Out-of-order path:** wipe localStorage → reload → without harvesting the pre-spawn, plant a seed on a different empty plot → pulse jumps to the new seed, label = "Click to water". Pre-spawn left to wilt.
11. **Modal interruption:** mid-tutorial, open Shop / Catalog / Settings / Daily — each modal opens cleanly. Close it — pulse and label are still present on the correct plot.
12. **Mobile shape:** in DevTools, set viewport to 375×667 (iPhone SE), wipe localStorage, reload → pulse visible on center plot (not clipped), label visible below garden in the garden tab.
13. **Desktop shape:** viewport 1280×800, same flow → pulse and label visible in the center column.

## Out of scope, deferred

These are explicitly *not* in this spec but might be follow-ups later if data shows the lightweight approach isn't enough:

- Hints for any non-core system (shop, decorations, potions, catalog, daily, pot skins, quests).
- Skip button or settings toggle to replay.
- NPC or character-driven guidance.
- Analytics events for "tutorial reached step X" — would require the CrazyGames Data module, which is explicitly out of scope for Basic Launch.
- Translating hint labels.
