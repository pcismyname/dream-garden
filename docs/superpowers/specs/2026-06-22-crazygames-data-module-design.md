# CrazyGames Data Module — Cloud Save Integration Design

**Date:** 2026-06-22
**Status:** Draft
**Context:** During the CrazyGames Basic Launch portal submission (same day as the tutorial-onboarding ship), the portal flagged a warning: "For iframe games our Automatic Progress Save does not work, to benefit from cloud save please use the data module from the SDK." The original CrazyGames SDK Basic Launch spec (`docs/superpowers/specs/2026-06-22-crazygames-sdk-basic-design.md`) explicitly deferred the Data Module to Full Launch as a YAGNI choice. We're reversing that decision now because the practical impact is bigger than expected: without the Data Module, every CG iframe player loses their save on every tab close. That kills retention for a game whose loop spans 15+ minutes and rewards return visits.

## Goal

Wire the CrazyGames v2 SDK Data Module behind the existing `Garden.storage` API so that on CG, saves persist to the cloud (per-user when signed in, per-browser when guest), and off CG, behavior is identical to today. The change must be invisible to every existing save/load call site in the game — only `js/storage.js`, `js/cg.js`, and the boot sequence in `js/main.js` are touched.

## Motivation

CrazyGames hosts our game inside an iframe served from their CDN. The iframe origin differs from `pcismyname.github.io`, so `localStorage` written by our game on CG cannot be read by the same game on GitHub Pages and vice versa — they live in different storage buckets. Worse, the CG iframe environment treats localStorage as session-scoped: the player closes the tab, the save is gone. The Data Module is CrazyGames's documented solution — it gives us 1MB per user per game, with automatic cross-device sync for logged-in users and an internal localStorage fallback for guests.

We chose Basic Launch precisely to validate engagement before investing more SDK work. Per the data we don't have yet, retention without cloud save is a known dead end for sub-30-minute loops. Better to ship cloud save now than to submit, lose data on the test traffic, and have to resubmit later.

## Non-goals

- **No new save format or schema change.** The persisted JSON shape stays exactly what `storage.js VERSION = 1` defines today. We move where it's stored, not what's stored.
- **No write to both Data Module AND localStorage when on CG.** Single source of truth per session avoids conflict-resolution edge cases. The SDK's own guest mode already provides a localStorage backstop internally; double-writing duplicates that.
- **No retry-on-failure logic.** The SDK debounces writes 1s (up to 30s); transient network failures are the SDK's problem, not ours. We log and move on.
- **No cloud-save UI** (no "syncing…" indicator, no "load from cloud" button). The flow is fully automatic.
- **No conflict resolution between local and cloud saves.** The Data Module is authoritative on CG; localStorage is authoritative off CG. The migration step is one-shot and only fires when the Data Module is empty — never overwrites a cloud save.
- **No retroactive sync of past GitHub Pages saves.** The two origins are separate buckets; we can't read GitHub Pages localStorage from inside CG's iframe and vice versa.
- **No `gameplayStop` / `commercialBreak` / `rewardedBreak` SDK calls.** Those remain Full Launch concerns per the original CG SDK spec.

## Architecture

Three files touched:

1. **`js/cg.js`** — gains `init(timeoutMs)`, `dataAvailable()`, and storage-shaped `getItem` / `setItem` / `removeItem` wrappers around the SDK Data Module. The wrappers absorb all failure modes and stay synchronous after `init`.
2. **`js/storage.js`** — `load()` becomes async and routes through `Garden.cg` when `dataAvailable()` is true. `save()` and `clear()` stay synchronous and route the same way. `STORAGE_KEY` and `VERSION` unchanged. Migration step (lift any localStorage save into the Data Module on first init when the Data Module is empty) lives here.
3. **`js/main.js`** — `start()` becomes async. First line is `await Garden.cg.init(3000)`, then `state = (await Garden.storage.load()) || Garden.state.createInitialState()`. The rest of `start()` is unchanged. `gameplayStart()` continues to fire after `setInterval(tick, 500)`.

No new files. No new globals. Script order in `index.html` unchanged (the existing flowers → … → render → cg → main order already has cg before main, which is the only ordering constraint that matters).

### `js/cg.js` — new API surface

The existing `Garden.cg.{ready, gameplayStart, isAvailable}` is preserved. Added:

```js
// Resolves true if the SDK initialized AND the Data Module is usable.
// Never throws. On timeout (3s default) or any failure, resolves false.
async function init(timeoutMs = 3000)

// Synchronous accessor — true iff init() resolved true.
function dataAvailable()

// Storage-shaped wrappers. Safe to call regardless of dataAvailable().
// When unavailable, getItem returns null and setItem/removeItem are no-ops.
function getItem(key)
function setItem(key, value)
function removeItem(key)
```

`init` does, in order:

1. If `window.CrazyGames === undefined` (SDK script never loaded — off-platform), resolve `false` immediately.
2. If `window.CrazyGames.SDK.environment === "disabled"` (loaded but off-platform), resolve `false` immediately. Matches the existing `gameplayStart` guard from commit `882293a`.
3. `await window.CrazyGames.SDK.init()` wrapped in `Promise.race([init, sleep(timeoutMs)])`. On timeout, resolve `false`.
4. Probe the Data Module by calling `window.CrazyGames.SDK.data.getItem("__probe")` inside a try/catch. On `dataModuleDisabled` (or any throw), `console.warn` and resolve `false`. The probe value is discarded.
5. Set module-local `dataReady = true`. Resolve `true`.

The probe is the only way to detect `dataModuleDisabled` before our first real read — the SDK has no `data.isEnabled()` check.

### `js/storage.js` — new contract

`STORAGE_KEY = "dreamgarden.v1"` and `VERSION = 1` unchanged. The exported API becomes:

```js
async function load()        // routes Data Module → localStorage based on cg.dataAvailable()
function save(state)         // sync; updates daily.lastSeenAt; routes Data Module → localStorage
function clear()             // sync; routes Data Module → localStorage
```

`load()` is the only function that becomes async. Its body:

```js
async function load() {
  if (Garden.cg.dataAvailable()) {
    let raw = Garden.cg.getItem(STORAGE_KEY);
    if (raw === null) {
      // Migration: lift any existing localStorage save into the Data Module.
      // One-shot; only fires when the cloud is empty.
      const fallback = localStorage.getItem(STORAGE_KEY);
      if (fallback) {
        Garden.cg.setItem(STORAGE_KEY, fallback);
        raw = fallback;
      }
    }
    return parseSave(raw);
  }
  return parseSave(localStorage.getItem(STORAGE_KEY));
}

function parseSave(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && parsed.version === VERSION ? parsed : null;
  } catch { return null; }
}
```

`save()` and `clear()` route through the same `dataAvailable()` check:

```js
function save(state) {
  try {
    if (state.daily) state.daily.lastSeenAt = Date.now();
    const json = JSON.stringify(state);
    if (Garden.cg.dataAvailable()) {
      Garden.cg.setItem(STORAGE_KEY, json);
    } else {
      localStorage.setItem(STORAGE_KEY, json);
    }
  } catch (e) {
    // Quota exceeded, private mode, etc. — game continues in-memory.
  }
}
```

### `js/main.js` — async boot

```js
async function start() {
  const cgReady = await Garden.cg.init(3000);  // boolean, never throws

  state = (await Garden.storage.load()) || Garden.state.createInitialState();
  // ... all existing migrations and bootstrap (musicVolume, tutorialDone, decorations, daily, etc.)
  // ... existing audio arming, render, setInterval(tick, 500)
  Garden.cg.gameplayStart();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}
```

`start()` becoming async is the only structural change. Its inner body is unchanged except for the two awaits at the top. The `setInterval(tick, 500)` line at the bottom keeps the tick loop on the same cadence as before.

`cgReady` is captured but not currently consumed inside `start()` — the storage and gameplayStart paths already check `dataAvailable()` / `isAvailable()` internally. Kept as a local for future use (or remove during implementation if unused; YAGNI applies).

## Error handling

All failure modes are absorbed at the `Garden.cg` boundary. No caller in `storage.js` or `main.js` has to try/catch the SDK.

| Failure | Detection | Recovery |
|---|---|---|
| SDK script never loaded | `window.CrazyGames === undefined` at top of `init()` | `init()` resolves `false`. No console noise — this is the expected GitHub Pages case. |
| SDK reports `environment === "disabled"` | Check after step 1 | `init()` resolves `false`. No console noise. |
| `SDK.init()` rejects or hangs | `Promise.race` with 3s timeout, plus try/catch | `init()` resolves `false`. `console.warn` so we notice. |
| `dataModuleDisabled` thrown by the probe | Try/catch around `data.getItem("__probe")` inside `init()` | `init()` resolves `false`. `console.warn("CG Data Module disabled — check portal Progress Save setting")`. Falls back to localStorage cleanly. |
| `dataLimitExceeded` on setItem (~1MB cap) | Try/catch inside `cg.setItem` wrapper | `console.warn`, write the same payload to `localStorage` as a parachute so the save is not lost. Won't happen in practice — state is ~10KB. |
| Any other setItem error | Same try/catch | Same localStorage parachute. |

Init's signature is `async init(timeoutMs) → boolean`. **It never throws.** Callers `await` without try/catch.

## Portal-form change (human step, not code)

On the CrazyGames submission portal's "Does your game save progress?" question, change the selection from "Yes, using LocalStorage" to **"Yes, using the Data Module from the CrazyGames SDK"**. The LocalStorage option leaves the Data Module disabled server-side, which means our `dataModuleDisabled` parachute would fire for every CG player — i.e., zero cloud sync, every player on the localStorage fallback. The submission instructions HTML and the project memory are updated to reflect this in the same commit set.

## Verification (manual)

The project has no automated test framework. Verification is a checklist run by a human in a browser.

### Off-platform (GitHub Pages or local file)

1. Open `index.html` directly or visit `https://pcismyname.github.io/dream-garden/`. Game boots in <1s with no console errors.
2. In DevTools console: `Garden.cg.dataAvailable()` returns `false`.
3. Plant a daisy, harvest it. Reload. Coins and XP persist. State is in `localStorage["dreamgarden.v1"]`.
4. No regressions on tutorial, audio, daily, or rendering compared to pre-Data-Module behavior.

### On CG iframe (post-submission, real environment)

1. Open the CrazyGames-hosted version of the game. Boot completes within 3s (typical: 200–500ms once SDK has warmed).
2. DevTools: `Garden.cg.dataAvailable()` returns `true`.
3. Plant, harvest, level up. Reload the iframe. Coins, XP, plot state, decorations, tutorialDone all persist.
4. DevTools: `window.CrazyGames.SDK.data.getItem("dreamgarden.v1")` returns the JSON payload.
5. Sign in to a different CrazyGames account, reload. Garden state resets to a fresh tutorial pre-spawn. Sign back in to the first account; original state returns.

### Migration

6. On CG iframe, in DevTools before any play: `localStorage.setItem("dreamgarden.v1", '{"version":1,"coins":999,"xp":0,"level":1,"plots":[null,null,null,null,null,null,null,null,null],"plantCounts":{},"discovered":{},"quests":[],"settings":{"floatingNumbers":true,"musicVolume":100,"sfxVolume":100},"decorations":[null,null,null,null,null,null],"ownedPots":["dirt"],"activePotId":"dirt","inventory":{},"daily":null,"tutorialDone":true}')`. Reload.
7. Game boots with 999 coins, tutorial skipped. Cloud was empty; localStorage migrated up.
8. DevTools: `Garden.cg.getItem("dreamgarden.v1")` now returns the migrated state. localStorage still has it as a side effect — that's fine.

### Failure handling

9. In DevTools, monkey-patch `window.CrazyGames.SDK.data.setItem = () => { throw { code: "dataLimitExceeded" }; }`. Plant a daisy. Console-warn appears; the save lands in localStorage as a parachute.
10. In DevTools, delete `window.CrazyGames` entirely and reload. `init()` resolves false fast, game boots from localStorage.

## Out of scope, deferred

- Cloud-save UI (sync indicators, manual cloud-load, conflict resolution UI).
- Migration from localStorage to Data Module across the GitHub-Pages-to-CG boundary (different origins; impossible without a backend).
- `gameplayStop`, `commercialBreak`, ad audio muting — still Full Launch concerns.
- Telemetry on Data Module hit/miss rates. CG provides analytics on the developer dashboard if we ever need them.
- Encryption of cloud save. The state is harmless — coins and a flower garden — and CG handles transport security.
