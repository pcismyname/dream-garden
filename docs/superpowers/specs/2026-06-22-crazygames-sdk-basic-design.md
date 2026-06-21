# CrazyGames SDK — Basic Launch Integration Design

**Date:** 2026-06-22
**Status:** Draft
**Context:** The portal-submission audit (2026-06-21) identified CrazyGames as the target portal. The landscape-layout pass (commits `e84b3d1..ece0d4b`) cleared the layout gate. This spec covers the next gate: the minimum SDK integration required for a CrazyGames **Basic Launch** submission.

## Goal

Add the minimum CrazyGames SDK wiring to make the game eligible for a CrazyGames Basic Launch submission: load the SDK from CrazyGames's CDN, expose a tiny wrapper module (`Garden.cg`), and call `window.CrazyGames.SDK.game.gameplayStart()` once per session. The wrapper degrades to silent no-ops when the SDK is unavailable, so the existing public GitHub Pages site at `pcismyname.github.io/dream-garden/` continues to work identically for non-CrazyGames visitors.

## Motivation

The CrazyGames submission pipeline is two-stage. Basic Launch is a 2-week traffic test with a limited audience: ads are disabled, only the `gameplayStart` event is required. If engagement metrics pass, the game graduates to Full Launch — ads on, global visibility, and the SDK needs `gameplayStop`, `commercialBreak`, and the Data module wired up.

We're committing engineering time to the *Basic* tier first, deliberately, so we can validate the game gets traffic and retention on CrazyGames before investing more SDK work. This matches the user's explicit choice in brainstorming on 2026-06-22 and matches the commercialization plan's "validate before invest" stance.

## Non-goals

- **No `gameplayStop()`.** Required for Full Launch. CrazyGames recommends it for engagement tracking even at Basic tier, but it is not enforced at Basic and adds 4+ call sites (every modal open/close). YAGNI says wait until Full Launch.
- **No `commercialBreak()` or ad SDK code.** Basic Launch explicitly disables ads.
- **No rewarded video (`rewardedBreak()`).** Same reason.
- **No Data module.** Only collects beyond-events data — its presence triggers the privacy-policy / terms requirement. Skipping it keeps us out of that policy bucket.
- **No sitelock.** Sitelock locks the game to CrazyGames domains. Misconfiguring it would break the public GitHub Pages site, which is the live demo. Re-evaluate at Full Launch.
- **No build flag, runtime detection, or two-build pipeline.** The SDK script is added to the single existing `index.html`. CrazyGames's SDK is documented to be a safe no-op when loaded outside the CG iframe; the public site keeps working unchanged.
- **No audio muting hooks for ads.** No ads at Basic tier means no need to mute. The `Garden.audio.stopMusic()` API exists for the future Full Launch wiring.
- **No SDK init call.** v2 SDK self-initializes; the docs explicitly say `init()` is no longer needed.

## Architecture

A new ~50-line module `js/cg.js` wraps the SDK behind a stable internal API:

- `Garden.cg.ready()` — returns a Promise that resolves when `window.CrazyGames.SDK` is available, or rejects after a 3-second timeout (treated as "SDK unavailable; fall back to silent no-op").
- `Garden.cg.gameplayStart()` — calls `window.CrazyGames.SDK.game.gameplayStart()` if available. Idempotent: after the first successful call, subsequent calls are no-ops.
- `Garden.cg.isAvailable()` — boolean check; useful later for Full-Launch ad-break code that only fires when the SDK is live.

The CrazyGames SDK script is added to `index.html` via:

```html
<script async src="https://sdk.crazygames.com/crazygames-sdk-v2.js"></script>
```

The `async` attribute is important: it loads in parallel with the existing script chain, so the game's first paint isn't blocked by the SDK download. The wrapper handles the race where `gameplayStart()` might be called before the SDK script finishes loading.

The SDK script tag is added BEFORE the existing `js/flowers.js` … `js/main.js` chain. This is for predictability of script ordering, even though `async` removes the strict ordering requirement.

`js/cg.js` is added to the script chain immediately before `js/main.js` (after `js/render.js`). This matches the existing position of `js/audio.js` and lets `main.js` rely on `Garden.cg` being attached.

`js/main.js` gets one new call at the end of `start()`, after `setupHandlers()` and the first `renderAll()`:

```js
if (Garden.cg) Garden.cg.gameplayStart();
```

The defensive `if (Garden.cg)` guard mirrors the existing `if (Garden.audio)` pattern. In practice the script is always loaded by the time `start()` runs, but the guard keeps the boot path resilient to future load-order changes.

## Module contract — `js/cg.js`

The module attaches to the `window.Garden` namespace via the same IIFE wrapper pattern used by every other JS file:

```js
window.Garden = window.Garden || {};
(function (Garden) {
  // module body
  Garden.cg = { ready, gameplayStart, isAvailable };
})(window.Garden);
```

### `ready()` semantics

- Returns a Promise.
- Resolves with `true` when `window.CrazyGames` and `window.CrazyGames.SDK` both exist.
- Polls every 100 ms (using `setTimeout`, not `setInterval`, to allow clean cleanup if the SDK arrives during a poll tick).
- Rejects with `Error("CrazyGames SDK timeout")` after 3000 ms.
- Caches the Promise — repeat `ready()` calls return the same Promise (the SDK either loads once or never; no point re-polling).

### `gameplayStart()` semantics

- First call: awaits `ready()`. If it resolves, calls `window.CrazyGames.SDK.game.gameplayStart()` and sets a `started` flag. If it rejects, sets the `started` flag anyway and swallows the error (defensive — we want a second call to never re-poll).
- Subsequent calls: no-op (the `started` flag short-circuits everything).
- Errors from the SDK call itself are caught and swallowed (matches the existing audio module's defensive try/catch pattern). Any SDK-side malfunction must not crash the game.
- The function returns a Promise that resolves whether or not the SDK actually fired. Callers don't need to `await` it.

### `isAvailable()` semantics

- Returns `true` if `window.CrazyGames && window.CrazyGames.SDK` both currently exist, `false` otherwise.
- Synchronous, non-caching — reflects the live state of the SDK at the moment of the call.
- Used for the future Full-Launch ad-break code that needs to gate work on SDK presence.

## File-level changes

| File | Change |
|---|---|
| `index.html` | Add one `<script async src="https://sdk.crazygames.com/crazygames-sdk-v2.js"></script>` line in `<body>`, before the existing module script chain. Add one `<script src="js/cg.js"></script>` line in the chain, between `js/render.js` and `js/main.js`. |
| `js/cg.js` | New file. ~50 lines. IIFE wrapper attaching `Garden.cg = { ready, gameplayStart, isAvailable }`. |
| `js/main.js` | One new line at the end of `start()`, after the existing `setInterval(tick, 500);` is set up: `if (Garden.cg) Garden.cg.gameplayStart();`. |

No other files touched. No state migration. No new dependencies in `package.json` (none exists — zero-build project).

## Error handling

- **SDK script 404 / blocked by ad blocker / network error.** The `<script async>` tag fails silently. `window.CrazyGames` never appears. `ready()` rejects after 3 s. `gameplayStart()` swallows the rejection. Game continues normally.
- **SDK script loads but `window.CrazyGames.SDK.game.gameplayStart` throws.** The try/catch inside `gameplayStart()` swallows the error. Game continues normally.
- **`Garden.cg` undefined entirely (script tag for `js/cg.js` fails to load).** The defensive `if (Garden.cg)` in `main.js` skips the call.
- **`gameplayStart()` called twice (e.g., from a future caller).** The `started` flag short-circuits. SDK only sees one call per session.

In every failure mode the game continues to work. There is no path that crashes the game because of CG-side issues.

## Testing strategy

No test runner exists in this project (zero-build by design). Verification is browser-driven:

1. **Local `file://`.** Open `index.html` directly. Network tab shows the SDK script attempting to load but possibly blocked by CORS or by the file protocol. `Garden.cg.isAvailable()` returns `false`. `Garden.cg.gameplayStart()` resolves silently. Game boots and plays normally.
2. **GitHub Pages.** Push to `master`, then load `pcismyname.github.io/dream-garden/`. Network tab shows the SDK loading from `sdk.crazygames.com`. `Garden.cg.isAvailable()` returns `true`. `Garden.cg.gameplayStart()` fires the SDK call (visible in DevTools if you `console.log` it in cg.js as a temporary debugging line, removed before commit).
3. **Iframe simulation.** Reuse the same iframe-test pattern from the layout work: a one-off `_portal-test.html` that embeds `index.html` in a 1280×720 iframe. Verify SDK loads and `gameplayStart` fires inside the iframe.
4. **SDK blocked.** Open in a browser with an ad blocker rule that blocks `sdk.crazygames.com`. Confirm: `ready()` rejects, `gameplayStart()` no-ops, game runs identically.
5. **Boot timing.** Confirm `gameplayStart()` is called only AFTER the first `renderAll()` completes. Add a temporary `console.log("game ready")` before the `gameplayStart` call and a `console.log("cg.gameplayStart called")` inside cg.js to verify ordering. Remove debug logs before commit.
6. **Idempotency.** In DevTools console, call `Garden.cg.gameplayStart()` twice in a row. The second call should be a silent no-op (the underlying SDK is called exactly once per session).

## Open questions

None. All design decisions resolved in brainstorming on 2026-06-22.

## Risks

- **SDK version compatibility.** We're targeting v2 (the current stable per the CrazyGames docs at the time of this spec). If CrazyGames ships a v3 during our 2-week Basic Launch window, no action is needed for our submission — v2 will continue to work. We'll re-evaluate at Full Launch.
- **CrazyGames domain blocking.** Some corporate networks block `sdk.crazygames.com`. Our defensive timeout handles this for the public GitHub Pages site. Inside the CG iframe, the SDK comes from a same-origin context that won't be blocked.
- **Boot-time race.** The async SDK script may not have loaded by the time `main.js`'s `start()` runs. The `ready()` Promise polls until the SDK appears or times out, so the race is handled. There's no synchronous path that assumes SDK presence at boot.

## Files added / removed

- Added: `js/cg.js` (1 file)
- Modified: `index.html`, `js/main.js` (2 files)
- Deleted: none

No state schema change. No `storage.js` VERSION bump. No new dependencies.

## Effort estimate

Roughly **half a day to a day** of focused work. The implementation is mostly transcription from this spec, plus the manual verification matrix above.
