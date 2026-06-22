# CrazyGames Data Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the CrazyGames v2 SDK Data Module behind `Garden.storage` so cloud save works on the CG iframe (per-user when signed in, per-browser when guest), with no behavior change off-platform. Spec: `docs/superpowers/specs/2026-06-22-crazygames-data-module-design.md`.

**Architecture:** Three additive touches. `js/cg.js` gets `init`/`dataAvailable`/`getItem`/`setItem`/`removeItem` wrappers. `js/storage.js` becomes async on `load` and routes through `Garden.cg` when available. `js/main.js start()` becomes async, awaits init then load. Each task ships as one commit; after each commit the game still boots and plays correctly off-platform.

**Tech Stack:** Vanilla JS using the `window.Garden` namespace via plain `<script>` tags, no build, no test framework. SDK v2 docs: <https://docs.crazygames.com/sdk/data/>. Manual browser verification.

## Global Constraints

- Zero-build vanilla JS — no ES modules, no bundler. New code attaches to `window.Garden` inside the existing IIFE pattern. No new files. No new global symbols.
- Script order in `index.html` is fixed: flowers → decorations → pots → potions → storage → state → daily → svg → fx → audio → render → cg → main. Storage runs BEFORE cg, which means `storage.js` cannot reference `Garden.cg` at module-load time — only inside function bodies that run after boot.
- Single source of truth per session: when `Garden.cg.dataAvailable()` is true, ALL save/load/clear go through `Garden.cg`. When false, ALL go through `localStorage`. No mirroring.
- `Garden.cg.init(timeoutMs)` returns `Promise<boolean>` and **never throws**. Callers `await` without try/catch.
- Default timeout for `init`: 3000 ms.
- `dataModuleDisabled` and `dataLimitExceeded` errors must be caught and logged via `console.warn`. On `dataLimitExceeded`, write the same payload to `localStorage` as a parachute so the player's save isn't lost.
- The probe key used by `init()` to detect `dataModuleDisabled` is the literal string `"__probe"`.
- `STORAGE_KEY = "dreamgarden.v1"` and `VERSION = 1` unchanged.
- Existing `Garden.storage.save(state)` callers (in `js/render.js`, `js/main.js`) are NOT updated. The signature stays `save(state)` sync. Only `load` becomes async.
- Manual verification only — no automated tests in the project.

## File Structure

- **Modify `js/cg.js`** — add `init`, `dataAvailable`, `getItem`, `setItem`, `removeItem` to the `Garden.cg` object. Add module-local `dataReady` flag.
- **Modify `js/main.js`** — `start()` becomes async; awaits `Garden.cg.init(3000)` then awaits `Garden.storage.load()`. The rest of `start()` is unchanged.
- **Modify `js/storage.js`** — `load()` becomes async with Data Module routing + one-shot localStorage→cloud migration. `save()` and `clear()` stay sync but route through `Garden.cg` when available.

No new files. No changes to `index.html`. No changes to any other JS file or to `styles.css`.

---

### Task 1: `js/cg.js` — Data Module wrappers

**Files:**
- Modify: `js/cg.js` (the entire existing IIFE — adds new methods to the exported object and one module-local flag)

**Interfaces:**
- Consumes: existing `window.CrazyGames.SDK` (added by the `<script async src="https://sdk.crazygames.com/crazygames-sdk-v2.js">` tag in `index.html`). The SDK's existing surfaces: `SDK.environment` (string, `"disabled"` off-platform), `SDK.init()` (returns Promise), `SDK.data.getItem(key)`, `SDK.data.setItem(key, value)`, `SDK.data.removeItem(key)`. Errors thrown by `SDK.data.*` use the shape `{ code: "dataModuleDisabled" | "dataLimitExceeded" | "other", message: string }`.
- Produces (consumed by Tasks 2 and 3):
  - `Garden.cg.init(timeoutMs?: number = 3000) → Promise<boolean>` — never throws; resolves `true` iff SDK + Data Module are usable
  - `Garden.cg.dataAvailable() → boolean` — synchronous accessor, true iff `init()` resolved `true`
  - `Garden.cg.getItem(key: string) → string | null` — sync; returns `null` if `dataAvailable()` is false or if the SDK throws
  - `Garden.cg.setItem(key: string, value: string) → void` — sync; logs and falls through to `localStorage.setItem` parachute if SDK throws
  - `Garden.cg.removeItem(key: string) → void` — sync; no-op if `dataAvailable()` is false; swallows SDK errors

- [ ] **Step 1: Read the current `js/cg.js` to understand the IIFE shape**

Open `js/cg.js`. The file is short (~50 lines). Note: it already attaches `ready`, `gameplayStart`, `isAvailable` to `Garden.cg`. Note the module-local helpers for detecting `window.CrazyGames` availability and the `SDK.environment === "disabled"` guard from commit `882293a`. The new code follows the same pattern.

- [ ] **Step 2: Add `init`, `dataAvailable`, `getItem`, `setItem`, `removeItem` to `js/cg.js`**

Inside the existing IIFE in `js/cg.js`, add a module-local flag and the five new functions. Locate the line where `Garden.cg = { ready, gameplayStart, isAvailable };` is assigned (near the end of the IIFE). Replace the existing assignment with the expanded one shown below, and add the helper functions immediately above it.

Find the existing export line, which looks roughly like:

```js
  Garden.cg = { ready, gameplayStart, isAvailable };
```

Above it, insert the new helpers:

```js
  let dataReady = false;

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Resolves true if the SDK initialized AND the Data Module is usable.
  // Never throws. On timeout (default 3s) or any failure, resolves false.
  async function init(timeoutMs) {
    if (typeof timeoutMs !== "number") timeoutMs = 3000;
    try {
      if (typeof window.CrazyGames === "undefined") return false;
      const SDK = window.CrazyGames.SDK;
      if (!SDK || SDK.environment === "disabled") return false;
      // Race SDK.init() against a wall-clock timeout. If init() hangs or
      // rejects, treat as unavailable and let the caller fall back to
      // localStorage.
      const ready = await Promise.race([
        SDK.init().then(() => true).catch(() => false),
        sleep(timeoutMs).then(() => false),
      ]);
      if (!ready) {
        console.warn("CG SDK init timed out or rejected; falling back to localStorage");
        return false;
      }
      // Probe the Data Module to detect dataModuleDisabled before any real read.
      try {
        SDK.data.getItem("__probe");
      } catch (e) {
        console.warn("CG Data Module disabled — check portal Progress Save setting", e);
        return false;
      }
      dataReady = true;
      return true;
    } catch (e) {
      console.warn("CG init unexpected failure; falling back to localStorage", e);
      return false;
    }
  }

  function dataAvailable() {
    return dataReady;
  }

  function getItem(key) {
    if (!dataReady) return null;
    try {
      return window.CrazyGames.SDK.data.getItem(key);
    } catch (e) {
      console.warn("CG data.getItem failed", e);
      return null;
    }
  }

  function setItem(key, value) {
    if (!dataReady) return;
    try {
      window.CrazyGames.SDK.data.setItem(key, value);
    } catch (e) {
      console.warn("CG data.setItem failed; writing to localStorage as parachute", e);
      try { localStorage.setItem(key, value); } catch (_) {}
    }
  }

  function removeItem(key) {
    if (!dataReady) return;
    try {
      window.CrazyGames.SDK.data.removeItem(key);
    } catch (e) {
      console.warn("CG data.removeItem failed", e);
    }
  }
```

Then update the export line to include the new methods:

```js
  Garden.cg = { ready, gameplayStart, isAvailable, init, dataAvailable, getItem, setItem, removeItem };
```

- [ ] **Step 3: Verify the new API exists in a browser (off-platform smoke check)**

Open `index.html` in a browser (file:// or local server). DevTools console:

```js
typeof Garden.cg.init;          // expect: "function"
typeof Garden.cg.dataAvailable; // expect: "function"
Garden.cg.dataAvailable();      // expect: false (init hasn't run yet)
await Garden.cg.init(3000);     // expect: false (off-platform — no SDK)
Garden.cg.dataAvailable();      // expect: false
Garden.cg.getItem("test");      // expect: null
Garden.cg.setItem("test", "x"); // expect: undefined; no error; no console.warn
```

The game itself should still boot and play normally — the new `Garden.cg` methods are not yet called by any code path.

- [ ] **Step 4: Commit**

```bash
git add js/cg.js
git commit -m "feat: CG Data Module wrappers in cg.js

Adds init(timeoutMs), dataAvailable(), getItem, setItem, removeItem
to Garden.cg. Init resolves boolean (never throws); on timeout or
SDK absence returns false. setItem falls back to localStorage on
quota errors. No callers yet — Tasks 2 and 3 wire these in."
```

---

### Task 2: `js/main.js` — async boot

**Files:**
- Modify: `js/main.js` (the `start()` function declaration and its first few lines, plus the DOMContentLoaded hookup at the bottom)

**Interfaces:**
- Consumes: `Garden.cg.init(timeoutMs)` from Task 1 (returns `Promise<boolean>`, never throws)
- Produces (read by Task 3): nothing new. `start()` now awaits `Garden.cg.init` then awaits `Garden.storage.load()`. Task 3 will change `storage.load` to actually return a Promise; this task awaits a sync return value, which is valid (await on a non-Promise resolves to the value).

- [ ] **Step 1: Read `js/main.js` `start()` to locate the await sites**

Open `js/main.js`. `start()` begins around line 73. The line `state = Garden.storage.load() || Garden.state.createInitialState();` is around line 74. The `setInterval(tick, 500);` is near the end. The `if (Garden.cg) Garden.cg.gameplayStart();` line is at the very end of `start()`.

- [ ] **Step 2: Make `start()` async and await both calls**

Find the function declaration:

```js
  function start() {
    state = Garden.storage.load() || Garden.state.createInitialState();
```

Replace with:

```js
  async function start() {
    await Garden.cg.init(3000);
    state = (await Garden.storage.load()) || Garden.state.createInitialState();
```

The rest of `start()` is unchanged. `await Garden.storage.load()` works whether `load()` is sync (current state, before Task 3) or async (after Task 3). `await` on a sync return value resolves to the value.

- [ ] **Step 3: Confirm the DOMContentLoaded hookup still works with an async function**

`addEventListener("DOMContentLoaded", start)` and calling `start()` directly both work when `start` is async — the returned Promise is unused and that's fine (no uncaught-rejection risk because `init` doesn't throw). The bottom of `main.js` should already look like:

```js
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
```

No change needed.

- [ ] **Step 4: Verify the game still boots normally off-platform**

Open `index.html` in a browser. The game should boot exactly as before — same speed (under 100ms), same first-paint state, same gameplay. In DevTools console:

```js
Garden.cg.dataAvailable(); // expect: false (off-platform)
```

The tutorial pulse, daily report behavior, audio, and rendering should all be unchanged.

- [ ] **Step 5: Commit**

```bash
git add js/main.js
git commit -m "feat: async start() in main.js — awaits CG init then storage load

start() now awaits Garden.cg.init(3000) before loading state, so the
Data Module's init can complete before storage.load consults it.
storage.load is still sync at this commit; awaiting a sync return
value is a no-op. Task 3 will make storage.load actually async."
```

---

### Task 3: `js/storage.js` — Data Module routing + migration

**Files:**
- Modify: `js/storage.js` (the `save` and `load` functions)

**Interfaces:**
- Consumes: `Garden.cg.dataAvailable()`, `Garden.cg.getItem(key)`, `Garden.cg.setItem(key, value)`, `Garden.cg.removeItem(key)` from Task 1
- Produces (read by `js/main.js`): `Garden.storage.load()` now returns `Promise<state | null>` — already awaited at the call site after Task 2. `Garden.storage.save(state)` and `Garden.storage.clear()` remain synchronous.

- [ ] **Step 1: Read `js/storage.js` to confirm the current shape**

`js/storage.js` is ~34 lines. Current exports: `save(state)`, `load() → state | null`, `clear()`, plus the constants `STORAGE_KEY` and `VERSION`. All three functions wrap `localStorage` calls in try/catch.

- [ ] **Step 2: Refactor `js/storage.js` to route through `Garden.cg` when available**

Replace the bodies of `save`, `load`, and `clear`. Keep `STORAGE_KEY`, `VERSION`, and the IIFE structure unchanged. The full replacement for the IIFE body:

```js
  const STORAGE_KEY = "dreamgarden.v1";
  const VERSION = 1;

  function parseSave(raw) {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed && parsed.version === VERSION ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  function save(state) {
    try {
      if (state.daily) state.daily.lastSeenAt = Date.now();
      const json = JSON.stringify(state);
      if (Garden.cg && Garden.cg.dataAvailable()) {
        Garden.cg.setItem(STORAGE_KEY, json);
      } else {
        localStorage.setItem(STORAGE_KEY, json);
      }
    } catch (e) {
      // Quota exceeded, private mode, etc. — game continues in-memory.
    }
  }

  async function load() {
    if (Garden.cg && Garden.cg.dataAvailable()) {
      let raw = Garden.cg.getItem(STORAGE_KEY);
      if (raw === null) {
        // One-shot migration: lift any existing localStorage save into the
        // Data Module on first init. Only fires when the cloud is empty,
        // so it never overwrites a real cloud save.
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

  function clear() {
    try {
      if (Garden.cg && Garden.cg.dataAvailable()) {
        Garden.cg.removeItem(STORAGE_KEY);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {}
  }

  Garden.storage = { save, load, clear, STORAGE_KEY, VERSION };
```

The `Garden.cg && ...` guard handles the edge case where `js/cg.js` failed to load (rare — but defensive). It also handles the fact that `cg.js` loads BEFORE `storage.js`-using code runs (per the script order); at module-load time `storage.js` doesn't reference `Garden.cg`, only inside the function bodies, which run later.

- [ ] **Step 3: Verify off-platform behavior is unchanged**

Open `index.html` in a browser. DevTools console:

```js
localStorage.clear();
location.reload();
```

After reload:
- Game boots normally with the tutorial pre-spawn.
- DevTools: `Garden.cg.dataAvailable()` returns `false`.
- Plant a daisy, harvest. Reload. State persists.
- DevTools: `localStorage.getItem("dreamgarden.v1")` returns the JSON. `Garden.cg.getItem("dreamgarden.v1")` returns `null` (no cloud on off-platform).

- [ ] **Step 4: Verify the migration code path in isolation**

In DevTools, simulate the migration manually (off-platform — the migration code path won't actually run, but we can verify the parseSave helper handles the data shape):

```js
// Verify parseSave is robust to garbage:
Garden.storage.load().then(s => console.log("loaded:", s));
// Expected: a non-null state object with version 1.

// Verify a malformed save returns null:
localStorage.setItem("dreamgarden.v1", "not json");
Garden.storage.load().then(s => console.log("loaded:", s));
// Expected: null
location.reload();
// Game boots with a fresh state (tutorial pre-spawn visible).
```

Full cloud-path verification happens on the live CG iframe after submission (see plan's "After shipping" section).

- [ ] **Step 5: Commit**

```bash
git add js/storage.js
git commit -m "feat: storage.js routes through Garden.cg when Data Module is available

load() is now async; routes to Garden.cg.getItem when CG is up, with
a one-shot migration that lifts any existing localStorage save into
the cloud on first boot. save() and clear() stay sync but route the
same way. Off-platform behavior identical to before."
```

---

## After shipping

These steps are NOT new tasks — they're a checklist of human-driven actions to take after the three commits land on `origin/master`.

- [ ] **Update the submission folder.** Rebuild the ZIP and re-extract:
  ```bash
  rm -rf dream-garden-submission dream-garden-submission.zip
  git archive --format=zip --output=dream-garden-submission.zip HEAD \
    -- . ':(exclude)docs' ':(exclude)README.md' ':(exclude).gitignore'
  mkdir dream-garden-submission && cd dream-garden-submission && unzip -q ../dream-garden-submission.zip && cd ..
  ```
- [ ] **Re-upload the new files to the CrazyGames portal.** Drag the contents of `dream-garden-submission/` (NOT the folder itself) into the portal's upload zone, replacing the prior upload.
- [ ] **Change the "Does your game save progress?" answer** from "Yes, using LocalStorage" to **"Yes, using the Data Module from the CrazyGames SDK"**. Submitting with the wrong answer keeps the Data Module server-side disabled and our `dataModuleDisabled` parachute fires for every player.
- [ ] **Update `crazygames-submission.html`** to reflect the corrected save-progress answer. (Already covered by spec; verify the doc matches.)
- [ ] **Live verification (after CrazyGames re-publishes):**
  - Open the CG-hosted game. Console: `Garden.cg.dataAvailable()` returns `true`.
  - Plant + harvest + reload — state persists across reloads.
  - `window.CrazyGames.SDK.data.getItem("dreamgarden.v1")` returns the JSON payload.
  - Sign out and back in to CG to verify per-user persistence.

## Self-review notes

- Spec coverage: every requirement from `docs/superpowers/specs/2026-06-22-crazygames-data-module-design.md` maps to a task. `init`/`dataAvailable`/wrappers → Task 1. async `start()` → Task 2. `storage.load`/`save`/`clear` routing + migration → Task 3. Portal-form change → "After shipping" checklist (human step). Error handling table maps to the try/catch + console.warn calls in Task 1's wrappers (`dataModuleDisabled` → probe try/catch; `dataLimitExceeded` → setItem try/catch with localStorage parachute; init timeout → `Promise.race` with `sleep`).
- Type consistency: `Garden.cg.init(timeoutMs?: number = 3000) → Promise<boolean>` consistent in Task 1 (defines) and Task 2 (consumes). `dataAvailable() → boolean` consistent in Task 1 (defines), Task 3 (consumes). `getItem/setItem/removeItem` signatures consistent. `STORAGE_KEY` string `"dreamgarden.v1"` consistent across all tasks and pre-existing code.
- Placeholder scan: every code block is complete. Verification steps are explicit console commands with expected output.
- Script ordering: `storage.js` loads before `cg.js` per `index.html`. Task 3's `storage.js` body uses `Garden.cg.dataAvailable()` only inside function bodies that run after `start()` boots — never at module-load time. The defensive `Garden.cg && ...` guard handles the very unlikely case where `cg.js` failed to load.
