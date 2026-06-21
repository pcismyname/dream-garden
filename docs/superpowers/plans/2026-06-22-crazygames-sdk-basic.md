# CrazyGames SDK Basic Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the minimum CrazyGames v2 SDK wiring (script tag + 50-line wrapper + one `gameplayStart()` call site) so the game is eligible for a CrazyGames Basic Launch submission, while the public GitHub Pages site keeps working identically for non-CrazyGames visitors.

**Architecture:** A new `js/cg.js` IIFE module exposes `Garden.cg.{ready, gameplayStart, isAvailable}` and wraps the SDK behind a defensive timeout. The CrazyGames v2 SDK script is added to `index.html` as an `async` external script. `js/main.js` calls `Garden.cg.gameplayStart()` once at the end of `start()`. Every failure mode degrades to a silent no-op so the existing public site is unaffected.

**Tech Stack:** Zero-build vanilla JS (`window.Garden` namespace via plain `<script>` tags, works on `file://`). `HTMLAudioElement` and `localStorage` already in place — unused by this work. No new dependencies. CrazyGames HTML5 SDK v2 loaded from `https://sdk.crazygames.com/crazygames-sdk-v2.js`.

**Spec:** `docs/superpowers/specs/2026-06-22-crazygames-sdk-basic-design.md`

**Testing:** No test runner exists (zero-build, intentional). Task 1 is statically verifiable (syntax check + grep). Task 2 is the manual browser smoke test pass.

## Global Constraints

- **Master-direct commits only.** No feature-branch convention. All work lands on `master`.
- **Precise `git add` — never `-A` or `.`.** The working tree contains untracked local-only files (`Sales_Platform_Deck _Draft.pptx`, `commercialization-plan.html`, `features-and-mechanics.html`, `tmp_kenney/`, Thai HTML decks). These must not be committed.
- **Zero-build vanilla JS.** Module attaches to `window.Garden` via the IIFE wrapper `(function (Garden) { ... })(window.Garden);` — every other `js/*.js` file uses this exact shape.
- **SDK script URL is exactly:** `https://sdk.crazygames.com/crazygames-sdk-v2.js`. v2 is the current stable per CrazyGames docs. The script tag uses the `async` attribute.
- **Global object is exactly:** `window.CrazyGames.SDK`. The gameplayStart call is exactly `window.CrazyGames.SDK.game.gameplayStart()`.
- **`Garden.cg` public API after this work:** exactly `ready`, `gameplayStart`, `isAvailable`. No other exported keys.
- **Polling cadence:** `ready()` polls every `100 ms` with a `3000 ms` total timeout. These are exact numeric constants in the module.
- **Idempotency:** `gameplayStart()` fires the SDK call at most once per page session.
- **No state changes.** No new `state.settings` keys, no migrations, no `storage.js` VERSION bump.
- **No other SDK calls.** No `gameplayStop`, no `commercialBreak`, no `rewardedBreak`, no Data module, no sitelock. Those are explicitly out of scope per the spec's Non-goals section.

---

### Task 1: SDK wrapper module + script tags + call site

**Files:**
- Create: `js/cg.js`
- Modify: `index.html` (add SDK external script tag in `<body>` before existing chain; add `js/cg.js` script tag between `js/render.js` and `js/main.js`)
- Modify: `js/main.js` (one new line at end of `start()`, immediately after the existing `setInterval(tick, 500);` at line 146)

**Interfaces:**
- Consumes: nothing from prior tasks (this is the only implementation task).
- Produces:
  - `Garden.cg.ready()` — returns a `Promise<true>` that resolves when `window.CrazyGames.SDK` is reachable, or rejects with `Error("CrazyGames SDK timeout")` after 3000 ms. The Promise is cached on the module; repeated `ready()` calls return the same Promise.
  - `Garden.cg.gameplayStart()` — awaits `ready()`, calls `window.CrazyGames.SDK.game.gameplayStart()` inside a `try/catch`. Idempotent: the first call sets an internal `started` flag and subsequent calls return `Promise.resolve()` immediately. Always returns a Promise that resolves (never rejects) regardless of SDK availability.
  - `Garden.cg.isAvailable()` — synchronous boolean, returns `true` if `window.CrazyGames && window.CrazyGames.SDK` both currently exist.

**Outcome after this task:** The CrazyGames SDK loads from its CDN on every page request (or fails silently if blocked). `Garden.cg.gameplayStart()` fires once per session — visible in DevTools as a network request to a CrazyGames analytics endpoint when running on the public GitHub Pages site. Inside the CrazyGames iframe, the SDK behaves identically. Local `file://` boots run with `Garden.cg.isAvailable()` returning `false` and the call no-oping — no console errors, no broken UX.

- [ ] **Step 1: Create `js/cg.js`**

Open a new file at `js/cg.js`. Write the complete module body (no shortening — every line is required):

```js
window.Garden = window.Garden || {};

(function (Garden) {
  const TIMEOUT_MS = 3000;
  const POLL_MS = 100;

  let started = false;
  let readyPromise = null;

  function isAvailable() {
    return !!(window.CrazyGames && window.CrazyGames.SDK);
  }

  // Returns a cached Promise that resolves once the CrazyGames SDK script
  // has loaded and attached itself to window. Rejects after TIMEOUT_MS so
  // callers can fall back to a silent no-op when the SDK never arrives
  // (network blocked, file:// protocol, ad blocker, etc.).
  function ready() {
    if (readyPromise) return readyPromise;
    readyPromise = new Promise((resolve, reject) => {
      const deadline = Date.now() + TIMEOUT_MS;
      function poll() {
        if (isAvailable()) {
          resolve(true);
          return;
        }
        if (Date.now() >= deadline) {
          reject(new Error("CrazyGames SDK timeout"));
          return;
        }
        setTimeout(poll, POLL_MS);
      }
      poll();
    });
    return readyPromise;
  }

  // Fires the SDK's gameplayStart call at most once per page session.
  // Awaits ready() so the call works even when main.js boots before the
  // async SDK script finishes loading. All errors are swallowed — the
  // game must keep working whether or not the SDK is reachable.
  function gameplayStart() {
    if (started) return Promise.resolve();
    started = true;
    return ready().then(() => {
      try {
        window.CrazyGames.SDK.game.gameplayStart();
      } catch (_) { /* SDK present but call threw — swallow */ }
    }, () => { /* SDK never appeared — silent fall-through */ });
  }

  Garden.cg = { ready, gameplayStart, isAvailable };
})(window.Garden);
```

- [ ] **Step 2: Add the SDK external script tag and the `js/cg.js` tag to `index.html`**

Open `index.html`. The current contents are:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dream Garden</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="app"></div>

  <script src="js/flowers.js"></script>
  <script src="js/decorations.js"></script>
  <script src="js/pots.js"></script>
  <script src="js/potions.js"></script>
  <script src="js/storage.js"></script>
  <script src="js/state.js"></script>
  <script src="js/daily.js"></script>
  <script src="js/svg.js"></script>
  <script src="js/fx.js"></script>
  <script src="js/audio.js"></script>
  <script src="js/render.js"></script>
  <script src="js/main.js"></script>
</body>
</html>
```

Make two edits:

(a) Immediately after `<div id="app"></div>` (i.e. before the first `<script src="js/flowers.js">`), insert:

```html

  <!-- CrazyGames v2 SDK. Loaded async; treated as optional by js/cg.js. -->
  <script async src="https://sdk.crazygames.com/crazygames-sdk-v2.js"></script>
```

(b) Between the `<script src="js/render.js"></script>` line and the `<script src="js/main.js"></script>` line, insert:

```html
  <script src="js/cg.js"></script>
```

The resulting `<body>` should read in order:

```html
<body>
  <div id="app"></div>

  <!-- CrazyGames v2 SDK. Loaded async; treated as optional by js/cg.js. -->
  <script async src="https://sdk.crazygames.com/crazygames-sdk-v2.js"></script>

  <script src="js/flowers.js"></script>
  <script src="js/decorations.js"></script>
  <script src="js/pots.js"></script>
  <script src="js/potions.js"></script>
  <script src="js/storage.js"></script>
  <script src="js/state.js"></script>
  <script src="js/daily.js"></script>
  <script src="js/svg.js"></script>
  <script src="js/fx.js"></script>
  <script src="js/audio.js"></script>
  <script src="js/render.js"></script>
  <script src="js/cg.js"></script>
  <script src="js/main.js"></script>
</body>
```

- [ ] **Step 3: Add the `gameplayStart()` call site in `js/main.js`**

Open `js/main.js`. Find the end of the `start()` function — it currently ends with:

```js
    Garden.render.setupHandlers();
    Garden.render.renderAll(state);
    lastStageSig = stageSignature(state, Date.now());
    setInterval(tick, 500);
  }
```

Add one line so the block becomes:

```js
    Garden.render.setupHandlers();
    Garden.render.renderAll(state);
    lastStageSig = stageSignature(state, Date.now());
    setInterval(tick, 500);
    if (Garden.cg) Garden.cg.gameplayStart();
  }
```

The defensive `if (Garden.cg)` mirrors the existing `if (Garden.audio)` guards elsewhere in `main.js`.

- [ ] **Step 4: Static checks**

Run each of these commands. All four are expected to pass.

```powershell
node -c js/cg.js
```

Expected: no output (clean parse).

```powershell
node -c js/main.js
```

Expected: no output.

```powershell
Select-String -Path js/cg.js -Pattern 'window\.CrazyGames\.SDK\.game\.gameplayStart|function ready\b|function gameplayStart\b|function isAvailable\b|TIMEOUT_MS = 3000|POLL_MS = 100|Garden\.cg = \{' | Measure-Object | Select-Object -ExpandProperty Count
```

Expected: ≥ 7 matches (one per pattern alternative).

```powershell
Select-String -Path index.html -Pattern 'sdk\.crazygames\.com/crazygames-sdk-v2\.js|src="js/cg\.js"' | Measure-Object | Select-Object -ExpandProperty Count
```

Expected: 2 matches (SDK tag + cg.js tag).

```powershell
Select-String -Path js/main.js -Pattern 'Garden\.cg\.gameplayStart\(\)'
```

Expected: 1 match.

- [ ] **Step 5: Module smoke test in Node**

Verify the module loads cleanly in a Node-shaped environment (no DOM, no `window.CrazyGames`). The wrapper should attach to a fake `window.Garden` and `isAvailable()` should return `false`.

```powershell
node -e "global.window = { Garden: {} }; require('./js/cg.js'); console.log('available:', window.Garden.cg.isAvailable()); console.log('keys:', Object.keys(window.Garden.cg).sort().join(','));"
```

Expected output:

```
available: false
keys: gameplayStart,isAvailable,ready
```

If the keys list shows anything other than exactly those three, fail the task.

- [ ] **Step 6: Commit**

```powershell
git add js/cg.js index.html js/main.js
git commit -m "feat: CrazyGames v2 SDK Basic Launch - wrapper module + script tags + gameplayStart"
```

---

### Task 2: Manual verification pass

**Files:** Modify only if bugs are found.

**Outcome:** The 6 verification scenarios from the spec pass in a real browser. The public site, the iframe simulation, the SDK-blocked path, and boot-ordering all behave as documented.

- [ ] **Step 1: Local `file://` boot**

Open `C:\Users\chids\OneDrive\Documents\garden\index.html` directly in a browser (do not push first). In DevTools:

```js
Garden.cg.isAvailable()      // expected: false
await Garden.cg.gameplayStart()   // expected: resolves silently, no error
Garden.cg.isAvailable()      // expected: still false (SDK script can't load over file://)
```

Confirm:
- No errors in the console.
- The game boots normally (top bar, garden grid render, all interactions work).
- A plant/water/sun/harvest cycle works.

- [ ] **Step 2: GitHub Pages boot (post-deploy step, run AFTER Step 6)**

This step depends on the work being pushed to `origin/master`. Run it as a separate verification AFTER you push. Open `https://pcismyname.github.io/dream-garden/` in a browser. In DevTools Network tab, filter on `sdk.crazygames.com`:

- Expected: one request to `https://sdk.crazygames.com/crazygames-sdk-v2.js`, returning 200 (or 304 on a warm cache).

In the console:

```js
await Garden.cg.ready()      // expected: resolves to true
Garden.cg.isAvailable()      // expected: true
```

The `gameplayStart` call from `main.js` will have already fired by the time you type the above. Verify in the Network tab there's a request to `sdk.crazygames.com` for a path containing `gameplaystart` or similar telemetry endpoint — exact path is internal to the SDK but a network call should be visible.

- [ ] **Step 3: Iframe simulation**

Create a one-off test file `_portal-test.html` in the working directory (do NOT commit it):

```powershell
@"
<!DOCTYPE html><html><body style='margin:0;background:#222;display:flex;align-items:center;justify-content:center;height:100vh'>
<iframe src='index.html' width='1280' height='720' style='border:0'></iframe>
</body></html>
"@ | Out-File -Encoding utf8 _portal-test.html
```

Open `_portal-test.html` in a browser. Verify:
- The game loads inside the iframe.
- DevTools (right-click iframe → Inspect Frame) shows the SDK script loading.
- `Garden.cg.isAvailable()` returns `true` inside the iframe context.

After verification:

```powershell
Remove-Item _portal-test.html
```

- [ ] **Step 4: SDK blocked**

Open the public site (or any browser with an ad blocker / network rule blocking `sdk.crazygames.com`). Confirm:

- `Garden.cg.isAvailable()` returns `false` after 3+ seconds.
- `await Garden.cg.ready()` rejects with `Error("CrazyGames SDK timeout")` after ~3 seconds.
- `Garden.cg.gameplayStart()` resolves silently (does NOT throw or reject).
- The game otherwise plays normally.

- [ ] **Step 5: Boot ordering check (one-shot temporary debug)**

Temporarily add three `console.log` lines:
- In `js/main.js` immediately before `setInterval(tick, 500);`: `console.log("[boot] render done");`
- In `js/main.js` immediately before `if (Garden.cg)`: `console.log("[boot] calling cg.gameplayStart");`
- In `js/cg.js` inside the `try { ... }` block, right before the SDK call: `console.log("[boot] firing gameplayStart on SDK");`

Reload the page (on GitHub Pages or in the iframe sim — needs a real SDK environment). Expected console order:

```
[boot] render done
[boot] calling cg.gameplayStart
[boot] firing gameplayStart on SDK
```

Then REMOVE the three `console.log` lines and confirm the game still behaves correctly. Do NOT commit the debug logs.

- [ ] **Step 6: Idempotency**

In DevTools console at the public site:

```js
await Garden.cg.gameplayStart()
await Garden.cg.gameplayStart()
await Garden.cg.gameplayStart()
```

Expected: only the first call fires the SDK's `gameplayStart` (visible as a single network request in the Network tab — the others should produce no additional CrazyGames-domain requests).

- [ ] **Step 7: Regression sweep**

On both desktop (1280×720) and mobile (360×780 emulation), run a full play loop:

1. Plant → water → sun → harvest → coins + XP land. All SFX play.
2. Open Settings — Music + SFX sliders work, Floating Numbers toggle works.
3. Open Catalog / Shop / Daily — all modals/tabs work as on master before this work.
4. Buy a potion → inventory. Use a potion → applies.
5. Trigger a quest completion → toast + SFX.

Nothing should be different from pre-merge behavior.

- [ ] **Step 8: Fix anything found, commit fixes individually**

```powershell
git add <files>
git commit -m "fix: <specific issue from CG SDK smoke test>"
```

- [ ] **Step 9: Final clean state**

```powershell
git status
```

Expected: clean working tree apart from the existing untracked local files. No `_portal-test.html`, no temporary debug log changes.

---

## Execution notes

- Task 1 is a single commit covering the full minimal Basic Launch wiring. The work is tightly coupled — splitting it would create three one-line commits that can't be reviewed independently.
- Task 2 Step 2 depends on the push to `origin/master` to validate the GitHub Pages path. Run it AFTER the user pushes (i.e., after `finishing-a-development-branch` completes Option 1).
- The script tag placement (SDK external first, then existing module chain, then `js/cg.js` between `render.js` and `main.js`) is exact per the spec. Don't reorder.
- Every SDK code path swallows errors. There must be no path from a failed SDK load to a broken game UI.
- After this work ships, the next gate on the runway is Full Launch SDK integration (gameplayStop hooks + `commercialBreak()` + audio mute during ads + Data module). That's a separate spec/plan, written only if the Basic Launch 2-week test produces enough traffic to justify the work.
