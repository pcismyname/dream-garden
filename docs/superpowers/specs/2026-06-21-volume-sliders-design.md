# Volume Sliders Design

**Date:** 2026-06-21
**Status:** Draft
**Supersedes:** the on/off-only audio toggles shipped 2026-06-21 (commits `1b293e5..b373dcb`).

## Goal

Let the player adjust music and SFX volume independently from the Settings panel. Replace the existing two on/off checkboxes with two range sliders. A slider at 0 functions as "off"; no separate mute toggle is needed.

## Motivation

The audio system shipped earlier today exposes only on/off toggles. Background music at the hardcoded `0.4` volume is the right balance for some players and too loud (or too quiet) for others, and SFX have the same problem. A binary toggle forces players who find the music distracting at any volume to mute it entirely, even if they'd happily keep it at 30%. Two sliders give the natural control without changing any other UX.

## Non-goals

- **No master slider.** Two channels match the existing two toggles; a third (master) is overkill for a casual web game.
- **No exposing volume above today's default.** Pushing past `MUSIC_VOLUME = 0.4` or `SFX_VOLUME = 0.6` risks blasting the user's speakers — these constants are already mixed to be comfortable on typical hardware. The slider top end maps to those constants, not to `1.0`.
- **No per-SFX volume.** All 9 SFX share one volume.
- **No keyboard shortcut for mute.** Esc already cancels potion use-mode; we don't want to overload it. Players who want a quick mute drag the slider to 0.
- **No fade-in / fade-out.** When music transitions across the `0` threshold (off→on or on→off), it just hard-cuts. Cozy game, short tracks; fade engineering is not worth the complexity here.

## User-visible behavior

The Settings modal currently shows three rows:

1. Floating numbers on harvest — checkbox (unchanged)
2. Music — checkbox (replaced)
3. Sound effects — checkbox (replaced)

After this change, rows 2 and 3 become slider rows:

```
Music — 60%                 [============o====]
Sound effects — 100%        [===================o]
```

The percentage in the label updates live as the user drags. Music volume changes audibly while the player drags — they hear the level they're committing to. SFX volume previews on the next SFX (the next plot click, button click, etc.) — there's no "play a test tone" affordance.

When a slider reaches `0`:

- Music: the music element pauses immediately.
- SFX: `playSfx` returns early without cloning, before any audio object is created.

When a slider crosses from `0` to `>0`:

- Music: starts playing (or resumes from wherever the underlying element is — `HTMLAudioElement.play()` resumes from the paused position).
- SFX: the next call to `playSfx` plays normally.

Persistence: every `input` event writes the new value to localStorage. This is per-tick during a drag — typically dozens of writes for one slow drag — but each is a `JSON.stringify` of the same state blob (a few KB) plus a synchronous `localStorage.setItem`, well under 1 ms.

## State shape

### Added

- `state.settings.musicVolume`: integer 0–100, default `100`.
- `state.settings.sfxVolume`: integer 0–100, default `100`.

### Removed

- `state.settings.musicOn`
- `state.settings.sfxOn`

### Migration (`main.js` start)

The current boot code defaults these settings if missing. It will be replaced with logic that runs on every boot but is safe to run repeatedly:

For each channel (music, SFX):

1. **If the old key is present** in `state.settings` (i.e. an unmigrated save), convert it: `false` → `volume = 0`, `true` → `volume = 100`. Then `delete` the old key.
2. **If the new key is still missing** after step 1 (i.e. a fresh save or a save from a future-but-broken state), default `volume = 100`.
3. **Defensive clamp:** if the new key is not a number, or is outside `0`–`100`, set it to `100`.

This handles three cases correctly: unmigrated old save (step 1), fresh save (step 2), and corrupt save (step 3). On a subsequent boot after a successful migration, step 1 is a no-op (old key absent), step 2 is a no-op (new key present), step 3 is a no-op (value already in range). Crucially, an already-migrated save with `musicVolume: 0` is preserved — we don't accidentally overwrite it with `100` because step 2 only fires when the key is missing.

We do **not** bump `storage.js` VERSION. The audio plan called this out: version bumps wipe saves by design. Defensive defaults in `main.js` are the canonical pattern for new settings fields.

## Module changes — `js/audio.js`

### Constants

```js
const MAX_MUSIC_VOLUME = 0.4;
const MAX_SFX_VOLUME = 0.6;
```

These replace the old `MUSIC_VOLUME` / `SFX_VOLUME` constants. `0.4` and `0.6` are preserved as the ceiling — slider at 100 produces the exact same volume the player tested at launch.

### Effective-volume helpers

Internal-only:

```js
function effectiveMusicVolume() {
  if (!stateRef || !stateRef.settings) return MAX_MUSIC_VOLUME;
  const pct = stateRef.settings.musicVolume;
  if (typeof pct !== "number") return MAX_MUSIC_VOLUME;
  return MAX_MUSIC_VOLUME * Math.max(0, Math.min(100, pct)) / 100;
}
function effectiveSfxVolume() {
  if (!stateRef || !stateRef.settings) return MAX_SFX_VOLUME;
  const pct = stateRef.settings.sfxVolume;
  if (typeof pct !== "number") return MAX_SFX_VOLUME;
  return MAX_SFX_VOLUME * Math.max(0, Math.min(100, pct)) / 100;
}
```

Clamping handles defensive cases (corrupt save with a value outside 0–100).

### `playSfx`

```js
function playSfx(name) {
  if (!stateRef || !stateRef.settings) return;
  const vol = effectiveSfxVolume();
  if (vol <= 0) return;  // early exit — no clone created
  const tmpl = sfxTemplates[name];
  if (!tmpl) return;
  try {
    const clone = tmpl.cloneNode();
    clone.volume = vol;
    const p = clone.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch (_) { /* no-op */ }
}
```

The old `if (!stateRef.settings.sfxOn) return` check is replaced by the `vol <= 0` check. SFX volume is read live on each call, so `setSfxVolume` doesn't need to push to anything.

### `startMusic`

```js
function startMusic() {
  if (!stateRef || !stateRef.settings) return;
  if (!musicEl) return;
  const vol = effectiveMusicVolume();
  if (vol <= 0) return;  // do not start while muted
  musicEl.volume = vol;
  try {
    const p = musicEl.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch (_) { /* no-op */ }
}
```

Updates `musicEl.volume` on every call so it picks up the latest slider value even if music was already playing.

### `setMusicVolume(n)` / `setSfxVolume(n)` — new public API

```js
function setMusicVolume(n) {
  if (!stateRef || !stateRef.settings) return;
  stateRef.settings.musicVolume = clampPct(n);
  if (!musicEl) return;
  const vol = effectiveMusicVolume();
  if (vol <= 0) {
    musicEl.pause();
  } else {
    musicEl.volume = vol;
    if (musicEl.paused) {
      try {
        const p = musicEl.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      } catch (_) { /* no-op */ }
    }
  }
}

function setSfxVolume(n) {
  if (!stateRef || !stateRef.settings) return;
  stateRef.settings.sfxVolume = clampPct(n);
  // playSfx reads live — no further work needed.
}
```

`clampPct` is a small local helper: `Math.max(0, Math.min(100, Math.round(Number(n) || 0)))`.

Important: these helpers also write to `stateRef.settings` so the render-layer change handler can call `setMusicVolume(n)` then `Garden.storage.save(currentState)` without needing to also manually assign the setting.

### Removed API

- `setMusicEnabled(on)` — replaced by `setMusicVolume`.
- `setSfxEnabled(on)` — replaced by `setSfxVolume`.

No external callers exist outside `render.js` change handler, so this is a safe rename.

## UI changes — `js/render.js`

### `renderSettings`

Replace the two `<label class="setting-row">` blocks for `musicOn` and `sfxOn` with slider rows. Approximate template:

```html
<label class="setting-row">
  <span>
    <span class="setting-name">Music <span class="setting-value" data-volume-label="musicVolume">${settings.musicVolume}%</span></span>
    <span class="setting-desc">Cozy background music loop</span>
  </span>
  <input type="range" min="0" max="100" step="1" data-setting="musicVolume" value="${settings.musicVolume}" class="setting-slider">
</label>
```

Same shape for `sfxVolume`. The Floating numbers checkbox row is unchanged.

The live percentage updates inside the existing `<span class="setting-name">` via the new `<span class="setting-value">` child. The change handler will update `data-volume-label="musicVolume"` element's text content; no re-render of the entire Settings modal needed (re-rendering would steal focus from the slider mid-drag).

### Change handler

The current handler listens on `change` for checkboxes. It must now also listen on `input` for sliders. Both events bubble to the same `app.addEventListener`.

```js
app.addEventListener("input", (ev) => {
  if (!currentState) return;
  const sl = ev.target.closest("input[type='range'][data-setting]");
  if (!sl) return;
  const key = sl.dataset.setting;
  if (!currentState.settings) currentState.settings = {};
  const n = Math.max(0, Math.min(100, Math.round(Number(sl.value) || 0)));
  currentState.settings[key] = n;
  if (key === "musicVolume" && Garden.audio) Garden.audio.setMusicVolume(n);
  if (key === "sfxVolume" && Garden.audio) Garden.audio.setSfxVolume(n);
  const label = document.querySelector(`[data-volume-label="${key}"]`);
  if (label) label.textContent = n + "%";
  Garden.storage.save(currentState);
});
```

The existing `change` handler stays for the floating-numbers checkbox; it just stops needing the `musicOn` / `sfxOn` branches.

Note: `setMusicVolume` / `setSfxVolume` already write to `stateRef.settings`, and `stateRef` is the same object as `currentState`. The explicit `currentState.settings[key] = n` line is redundant but defensive — it guarantees the state is written even if a future refactor decouples the two refs. Save fires once per `input` event.

### CSS

The existing `.setting-row` rule should accommodate `<input type="range">` without modification (it's a flexbox row). A new `.setting-slider { width: 160px; }` selector goes in `styles.css` to keep the slider width consistent (browser default range width varies between Chrome and Firefox). The new `.setting-value` selector gets `color: var(--accent-2)` (or whatever the existing palette uses) and a monospace font so the percentage doesn't jitter as it changes width.

## Boot wiring — `js/main.js`

The existing audio-arm block (`Garden.audio.preload(); Garden.audio._setState(state); ...`) is unchanged. The one-time gesture listener calls `startMusic()` which now checks `effectiveMusicVolume()` internally — if the player had music slid to 0 last session, the first click silently skips the play.

## Error handling

- Missing `settings.musicVolume` / `sfxVolume` after migration: the effective-volume helpers default to `MAX_MUSIC_VOLUME` / `MAX_SFX_VOLUME`, i.e., full slider. Same fallback as a fresh save.
- Corrupt value (non-numeric, NaN, negative, > 100): clamped to 0–100 before use.
- `setMusicVolume` called before audio module is preloaded: guarded by `if (!musicEl) return` after writing to state — the value persists, next `startMusic` picks it up.

## Testing strategy

No test runner exists in this project (zero-build, intentional). Verification is browser-driven:

1. **Fresh save.** `localStorage.removeItem("dreamgarden.v1"); location.reload();`. Open Settings — both sliders at 100%. Click a plot — music starts, SFX plays at the level shipped at launch.
2. **Drag music slider mid-music.** Music volume changes audibly while dragging.
3. **Drag music slider to 0.** Music pauses. Drag back up — music resumes.
4. **Drag SFX slider to 50%.** Click a plot — SFX plays softer.
5. **Drag SFX slider to 0.** Click a plot — silence. Drag back up — next click plays normally.
6. **Reload after dragging.** Sliders restore to the dragged positions. Music starts at the saved level on first click. If music was at 0, first click does NOT start music.
7. **Migration from old save.** Manually inject an old save with `musicOn: false, sfxOn: true` into localStorage, reload. Music slider should be at 0, SFX at 100. The old keys should be absent from `JSON.parse(localStorage.getItem("dreamgarden.v1")).settings`.
8. **Regression sweep.** Floating numbers toggle still works, plant/water/sun/harvest still fire SFX, daily/catalog/shop/settings ui-click still fires.

## Open questions

None. All design decisions resolved in brainstorming on 2026-06-21.

## Files changed (preview)

- `js/state.js` — `createInitialState` defaults.
- `js/main.js` — migration block in `start`.
- `js/audio.js` — constants, helpers, `playSfx`, `startMusic`, new `setMusicVolume` / `setSfxVolume`, removed `setMusicEnabled` / `setSfxEnabled`.
- `js/render.js` — `renderSettings` template, new `input` event handler, removed `musicOn` / `sfxOn` branches in the existing `change` handler.
- `styles.css` — small `.setting-slider` + `.setting-value` rules.

No file additions or deletions.
