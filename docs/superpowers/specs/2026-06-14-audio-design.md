# Audio System — Design

**Date:** 2026-06-14
**Status:** Approved
**Goal:** Add a cozy-acoustic audio layer — looping background music plus targeted sound effects on every core gameplay action and reward — with separate music/SFX toggles in Settings. Audio was deferred feature #3 on the roadmap.

## Context

Dream Garden currently has zero audio: the FX module (`js/fx.js`) drives only visual juice (floating numbers, toasts). Settings has one toggle (`floatingNumbers`). The game is a static GitHub Pages site under `pcismyname/dream-garden`; everything must be self-contained (no CDNs).

Out of scope: voice-over, dynamic mixing/ducking, day-night music switching, per-flower SFX variants, Web Audio synthesis.

## File layout & sourcing

A new `audio/` directory at repo root, committed to git:

```
audio/
  music/
    garden-theme.mp3       ~1-2 MB, ~60-120s loop
  sfx/
    plant.mp3              ~10-40 KB each
    water.mp3
    sun.mp3
    harvest.mp3
    level-up.mp3
    quest-complete.mp3
    chest.mp3
    rare-sparkle.mp3
    ui-click.mp3
```

- **Format:** MP3 across the board. Universal browser support, small filesize, no codec drama.
- **Source:** Pixabay (pixabay.com). Pixabay Content License = royalty-free, no attribution required, commercial use OK — suitable for a public GitHub Pages site. Files downloaded via `Invoke-WebRequest` from Pixabay's direct CDN URLs.
- **Vibe target:** cozy acoustic — soft ukulele/acoustic-guitar music, organic SFX (coin clink, soft pop, gentle chime), avoid harsh synth/chiptune.
- **Estimated total repo addition:** ~2–3 MB.
- **Filename contract:** the names above are the public contract. Replacing a sound = overwrite the file at the same path; no code change needed.

## State shape

Two new fields in `state.settings`, defensively defaulted on load like the existing `floatingNumbers`:

```js
settings: {
  floatingNumbers: true,   // existing
  musicOn: true,           // new
  sfxOn: true,             // new
}
```

**No storage version bump.** `storage.js` rejects mismatched versions and wipes saves; new fields must default in-place instead.

## New module: `js/audio.js`

A small `Garden.audio` module wrapping `HTMLAudioElement` (no Web Audio API needed). Loaded after `js/state.js` so it can read settings, before `js/render.js` so renderers can call into it.

```js
Garden.audio = {
  preload(),                  // lazy-creates Audio elements; idempotent
  playSfx(name),              // fires SFX if state.settings.sfxOn
  startMusic(),               // begins loop if state.settings.musicOn
  stopMusic(),                // pauses, keeps position
  setMusicEnabled(bool),      // called by Settings toggle; starts/stops as needed
  setSfxEnabled(bool),        // called by Settings toggle
  _setState(state),           // called from main.js once at boot to attach state ref
};
```

**SFX implementation note:** to allow the same SFX to overlap (rapid harvests, double-clicks), `playSfx` clones the preloaded element (`audio.cloneNode().play()`) rather than reusing a single instance. Cheap; avoids "cut-off" feel.

**Volume:** all SFX play at `volume = 0.6`, music at `volume = 0.4`. Hardcoded — not user-tunable in v1 (toggle-only, per design decision).

## Autoplay handling

Browsers (Chrome, Safari, Firefox) block `audio.play()` until the page has received a user gesture. Strategy:

- At boot, `preload()` creates the elements but does NOT call `play()`.
- A one-time `click` listener is attached to `document` that calls `startMusic()` and then removes itself. The very first plot click / button click / settings open will trigger music if `musicOn` is true.
- If `musicOn` is false at first-click time, music stays silent; toggling it on later in Settings calls `startMusic()` directly (which will succeed because a gesture has already occurred).

## Call sites

All SFX firing happens in existing modules — `audio.js` itself never reaches into game state.

| Event | Trigger | SFX |
|-------|---------|-----|
| Plot click → plant | `handlePlotClick` plant branch in `render.js` | `plant` |
| Plot click → water | `handlePlotClick` water branch | `water` |
| Plot click → sun | `handlePlotClick` sun branch | `sun` |
| Plot click → harvest | `emitHarvestFx` in `render.js` (always-on path) | `harvest` |
| Level-up | `emitHarvestFx` leveledUp branch | `level-up` |
| Quest complete | `emitHarvestFx` questCompleted branch | `quest-complete` |
| Daily chest awarded | `emitHarvestFx` chestAwarded branch | `chest` |
| Mystery bloom reveals a rare | `tick` in `main.js` revealed-rare branch | `rare-sparkle` |
| Shop / Settings / Daily / Catalog topbar button | each `data-action='open-*'` handler in `render.js` | `ui-click` |

`ui-click` fires only on the four topbar Open buttons. Close buttons, backdrop clicks, and Esc-to-close are silent — keeps the soundscape clean and avoids double-firing when buying/closing in quick succession.

Pattern at every call site: `Garden.audio && Garden.audio.playSfx("name");` — defensive null-check matches the existing `Garden.fx &&` style.

## Settings UI

Two new checkbox rows in `renderSettings`, immediately after the existing floating-numbers row. Same DOM/CSS pattern as the existing toggle. Each row's change handler:

```js
state.settings.musicOn = ev.target.checked;
Garden.audio.setMusicEnabled(state.settings.musicOn);
Garden.storage.save(state);
```

## Defaults & migration

- New saves: both toggles default to `true` (full audio on).
- Existing saves missing the fields: default to `true` in `main.js` start, matching the `floatingNumbers` migration pattern.
- First-time players hear: silence until first click → music begins, every action has SFX.

## Failure modes

- **File 404 (download failed / file missing):** `Audio` element fires `error` event; the play call is wrapped in a try/catch that silently no-ops. Game continues without that sound.
- **Autoplay blocked even after gesture (rare browser config):** music stays silent, SFX still work. No error surfaced to player.
- **Page hidden (tab switch):** music keeps playing (browser default). Acceptable for this scope.

## Testing & verification

No automated test runner (zero-build project). Manual checklist after implementation:

1. Fresh load → silence. Click a plot → music starts, plant SFX fires.
2. Water / sun / harvest each trigger their own SFX, audible during the action.
3. Level up → level-up jingle plays once.
4. Complete a daily quest → quest-complete SFX. Complete all 3 → chest SFX too.
5. Plant a mystery seed, force it to a rare reveal → rare-sparkle plays.
6. Open Settings → toggle Music off → music stops mid-loop. Toggle back on → music resumes (from start of loop is acceptable). Toggle SFX off → plot clicks are silent.
7. Reload after toggling both off → both stay off.
8. Rapid-click a plot (e.g. mash harvest in expand mode) → SFX overlap rather than cut each other off.

## Out of scope / future

- Volume sliders (currently hardcoded). Easy add later if requested.
- Multiple music tracks / day cycle.
- Topbar mute button (settings-only for v1).
- Audio sprites / preloading optimisation (only matters at much higher SFX counts).
- Web Audio API features (filters, fades, pitch).
