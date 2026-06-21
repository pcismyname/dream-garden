# Volume Sliders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two on/off audio checkboxes in Settings with two 0–100 range sliders, scaling the existing hardcoded `MAX_MUSIC_VOLUME = 0.4` and `MAX_SFX_VOLUME = 0.6` ceilings.

**Architecture:** State gets two new integer keys (`musicVolume`, `sfxVolume`) that replace the boolean `musicOn` / `sfxOn`. The audio module computes effective playback volume on every call from those keys. The Settings panel renders `<input type="range">` rows; the existing `change` event handler stays for the Floating Numbers checkbox and a new `input` event handler fires on every drag tick, writing to state + audio + localStorage live.

**Tech Stack:** Zero-build vanilla JS (`window.Garden` namespace via IIFE wrappers, plain `<script>` tags, works on `file://`). `HTMLAudioElement` for playback (already in place). localStorage for persistence (already in place). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-06-21-volume-sliders-design.md`

**Testing:** No test runner exists in this project (zero-build is intentional). Tasks 1–2 are statically verifiable (syntax check + grep + Node smoke); Task 3 is the manual browser smoke test pass.

## Global Constraints

- **Master-direct commits only.** This project has no feature-branch convention. All work lands on `master`.
- **Precise `git add` — never `-A` or `.`.** The working tree contains untracked local-only files (`Sales_Platform_Deck _Draft.pptx`, `commercialization-plan.html`, `features-and-mechanics.html`, `tmp_kenney/`, and Thai HTML decks). These must not be committed.
- **Never bump `js/storage.js` VERSION.** Version mismatch wipes saves by design. New settings fields are defaulted in `main.js` start.
- **State shape rules:**
  - Added keys: `state.settings.musicVolume` (int 0–100, default `100`), `state.settings.sfxVolume` (int 0–100, default `100`).
  - Removed keys: `state.settings.musicOn`, `state.settings.sfxOn`.
- **Volume ceilings (exact constants):** `MAX_MUSIC_VOLUME = 0.4`, `MAX_SFX_VOLUME = 0.6`. Slider at 100 maps to these — the maximum hardware playback level is unchanged from launch.
- **Migration is idempotent.** It runs on every boot and is a no-op once the old keys are gone. An already-migrated save with `musicVolume: 0` is never overwritten with `100`.
- **No new files. No deleted files.** Five existing files are touched: `js/state.js`, `js/main.js`, `js/audio.js`, `js/render.js`, `styles.css`.
- **Public Garden.audio API after this work:** `preload`, `playSfx`, `startMusic`, `stopMusic`, `setMusicVolume`, `setSfxVolume`, `_setState`. The old `setMusicEnabled` and `setSfxEnabled` are gone.

---

### Task 1: State migration + audio module rewrite + dead-handler cleanup

**Files:**
- Modify: `js/state.js` (`createInitialState` settings defaults — ~line 17)
- Modify: `js/main.js` (settings migration block in `start` — ~lines 85–90)
- Modify: `js/audio.js` (full module rewrite)
- Modify: `js/render.js` (Settings change handler — remove the two `Garden.audio.setMusicEnabled/setSfxEnabled` lines around line 1148)

**Interfaces:**
- Consumes: existing `Garden.audio.preload()`, `Garden.audio._setState(state)` continue to work the same way after this task.
- Produces:
  - `Garden.audio.setMusicVolume(n)` — `n` is an integer 0–100. Internally clamps, writes to `stateRef.settings.musicVolume`, applies live to `musicEl.volume` (and pauses or resumes music as the volume crosses 0).
  - `Garden.audio.setSfxVolume(n)` — same shape; no-op on the SFX template (volume read live per shot).
  - State invariants: after `start()` runs, `state.settings.musicVolume` and `state.settings.sfxVolume` are integers in `[0, 100]`. `state.settings.musicOn` and `state.settings.sfxOn` are absent.

**Outcome after this task:** The state shape has migrated; the audio module reads the new keys and plays at the correct effective volume. The Settings panel still shows the old checkbox rows (renderSettings hasn't been updated yet) — those checkboxes now read `undefined` from state and render unchecked. They're inert because the handler branches that called the removed `setMusicEnabled/setSfxEnabled` were cleaned up in this task. Floating-numbers checkbox still works. No JS errors. Audio plays at full volume by default (slider effectively at 100).

- [ ] **Step 1: Update `createInitialState` defaults in `js/state.js`**

Open `js/state.js`. Find the line:

```js
      settings: { floatingNumbers: true, musicOn: true, sfxOn: true },
```

Replace with:

```js
      settings: { floatingNumbers: true, musicVolume: 100, sfxVolume: 100 },
```

- [ ] **Step 2: Replace the migration block in `js/main.js`**

Open `js/main.js`. Find the existing settings block (it looks like this):

```js
    if (!state.settings) state.settings = { floatingNumbers: true, musicOn: true, sfxOn: true };
    if (typeof state.settings.floatingNumbers !== "boolean") {
      state.settings.floatingNumbers = true;
    }
    if (typeof state.settings.musicOn !== "boolean") state.settings.musicOn = true;
    if (typeof state.settings.sfxOn !== "boolean") state.settings.sfxOn = true;
```

Replace the entire block with:

```js
    if (!state.settings) state.settings = { floatingNumbers: true, musicVolume: 100, sfxVolume: 100 };
    if (typeof state.settings.floatingNumbers !== "boolean") {
      state.settings.floatingNumbers = true;
    }
    // Migrate old boolean toggles (musicOn / sfxOn) to integer volumes 0-100.
    // Idempotent: once the old keys are deleted, steps 1-3 are no-ops on
    // subsequent boots.
    if (Object.prototype.hasOwnProperty.call(state.settings, "musicOn")) {
      state.settings.musicVolume = state.settings.musicOn === false ? 0 : 100;
      delete state.settings.musicOn;
    }
    if (Object.prototype.hasOwnProperty.call(state.settings, "sfxOn")) {
      state.settings.sfxVolume = state.settings.sfxOn === false ? 0 : 100;
      delete state.settings.sfxOn;
    }
    if (typeof state.settings.musicVolume !== "number") state.settings.musicVolume = 100;
    if (typeof state.settings.sfxVolume !== "number") state.settings.sfxVolume = 100;
    state.settings.musicVolume = Math.max(0, Math.min(100, Math.round(state.settings.musicVolume)));
    state.settings.sfxVolume = Math.max(0, Math.min(100, Math.round(state.settings.sfxVolume)));
```

- [ ] **Step 3: Rewrite `js/audio.js` in full**

Open `js/audio.js`. Replace the entire file with:

```js
window.Garden = window.Garden || {};

(function (Garden) {
  const SFX_NAMES = [
    "plant", "water", "sun", "harvest",
    "level-up", "quest-complete", "chest", "rare-sparkle", "ui-click",
  ];
  const MUSIC_PATH = "audio/music/garden-theme.mp3";
  const MAX_SFX_VOLUME = 0.6;
  const MAX_MUSIC_VOLUME = 0.4;

  // Template elements — never played directly; cloned per shot so SFX can overlap.
  const sfxTemplates = {};
  let musicEl = null;
  let stateRef = null;
  let preloaded = false;

  function clampPct(n) {
    return Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
  }

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

  function preload() {
    if (preloaded) return;
    SFX_NAMES.forEach(name => {
      const a = new Audio("audio/sfx/" + name + ".mp3");
      a.preload = "auto";
      // Template volume is overwritten per shot in playSfx — value here is irrelevant.
      a.volume = MAX_SFX_VOLUME;
      sfxTemplates[name] = a;
    });
    musicEl = new Audio(MUSIC_PATH);
    musicEl.loop = true;
    // startMusic resets musicEl.volume on every call.
    musicEl.volume = MAX_MUSIC_VOLUME;
    musicEl.preload = "auto";
    preloaded = true;
  }

  function _setState(state) { stateRef = state; }

  function playSfx(name) {
    if (!stateRef || !stateRef.settings) return;
    const vol = effectiveSfxVolume();
    if (vol <= 0) return;
    const tmpl = sfxTemplates[name];
    if (!tmpl) return;
    try {
      const clone = tmpl.cloneNode();
      clone.volume = vol;
      const p = clone.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch (_) { /* no-op */ }
  }

  function startMusic() {
    if (!stateRef || !stateRef.settings) return;
    if (!musicEl) return;
    const vol = effectiveMusicVolume();
    if (vol <= 0) return;
    musicEl.volume = vol;
    try {
      const p = musicEl.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch (_) { /* no-op */ }
  }

  function stopMusic() {
    if (!musicEl) return;
    musicEl.pause();
  }

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

  Garden.audio = {
    preload, playSfx, startMusic, stopMusic,
    setMusicVolume, setSfxVolume, _setState,
  };
})(window.Garden);
```

- [ ] **Step 4: Remove dead handler branches in `js/render.js`**

Open `js/render.js`. Find the Settings change handler (the `app.addEventListener("change", ...)` block — currently around line 1141). It looks like:

```js
    app.addEventListener("change", (ev) => {
      if (!currentState) return;
      const cb = ev.target.closest("input[data-setting]");
      if (!cb) return;
      const key = cb.dataset.setting;
      if (!currentState.settings) currentState.settings = {};
      currentState.settings[key] = cb.checked;
      if (key === "musicOn" && Garden.audio) Garden.audio.setMusicEnabled(cb.checked);
      if (key === "sfxOn" && Garden.audio) Garden.audio.setSfxEnabled(cb.checked);
      Garden.storage.save(currentState);
    });
```

Delete the two `Garden.audio.setMusicEnabled` / `Garden.audio.setSfxEnabled` lines. The block becomes:

```js
    app.addEventListener("change", (ev) => {
      if (!currentState) return;
      const cb = ev.target.closest("input[data-setting]");
      if (!cb) return;
      const key = cb.dataset.setting;
      if (!currentState.settings) currentState.settings = {};
      currentState.settings[key] = cb.checked;
      Garden.storage.save(currentState);
    });
```

(This handler stays for the Floating Numbers checkbox. The Music / SFX checkbox rows in `renderSettings` are still rendered until Task 2; they just become inert.)

- [ ] **Step 5: Static checks**

```powershell
node -c js/state.js
node -c js/main.js
node -c js/audio.js
node -c js/render.js
```

Expected: all four clean (no output).

```powershell
Select-String -Path js/audio.js -Pattern 'setMusicVolume|setSfxVolume|MAX_MUSIC_VOLUME|MAX_SFX_VOLUME|effectiveMusicVolume|effectiveSfxVolume|clampPct' | Measure-Object | Select-Object -ExpandProperty Count
```

Expected: ≥ 12 (at least the function declarations plus their call sites).

```powershell
Select-String -Path js/audio.js -Pattern 'setMusicEnabled|setSfxEnabled'
```

Expected: NO matches (old API gone).

```powershell
Select-String -Path js/render.js -Pattern 'setMusicEnabled|setSfxEnabled'
```

Expected: NO matches (dead handler calls gone).

```powershell
Select-String -Path js/main.js -Pattern 'musicVolume|sfxVolume|Object\.prototype\.hasOwnProperty\.call\(state\.settings'
```

Expected: at least 6 matching lines (the migration block).

- [ ] **Step 6: Node smoke for the migration logic**

This is a small isolated check that doesn't need a browser. From the working directory:

```powershell
node -e @'
const settings = { floatingNumbers: true, musicOn: false, sfxOn: true };
// Simulate the migration block from main.js
if (Object.prototype.hasOwnProperty.call(settings, "musicOn")) {
  settings.musicVolume = settings.musicOn === false ? 0 : 100;
  delete settings.musicOn;
}
if (Object.prototype.hasOwnProperty.call(settings, "sfxOn")) {
  settings.sfxVolume = settings.sfxOn === false ? 0 : 100;
  delete settings.sfxOn;
}
if (typeof settings.musicVolume !== "number") settings.musicVolume = 100;
if (typeof settings.sfxVolume !== "number") settings.sfxVolume = 100;
settings.musicVolume = Math.max(0, Math.min(100, Math.round(settings.musicVolume)));
settings.sfxVolume = Math.max(0, Math.min(100, Math.round(settings.sfxVolume)));
console.log(JSON.stringify(settings));
'@
```

Expected output (exact):

```
{"floatingNumbers":true,"musicVolume":0,"sfxVolume":100}
```

Verify there is no `musicOn` or `sfxOn` key in the output.

- [ ] **Step 7: Commit**

```powershell
git add js/state.js js/main.js js/audio.js js/render.js
git commit -m "feat: volume sliders - state migration, audio module rewrite, dead handler cleanup"
```

---

### Task 2: Settings UI sliders

**Files:**
- Modify: `js/render.js` (`renderSettings` template — replace Music + SFX checkbox rows; add new `input` event handler in `setupHandlers` near the existing `change` handler)
- Modify: `styles.css` (append `.setting-slider` + `.setting-value` rules)

**Interfaces:**
- Consumes: `Garden.audio.setMusicVolume(n)` and `Garden.audio.setSfxVolume(n)` from Task 1.
- Produces: no public API changes. The Settings panel renders the new slider rows; user interaction wires through to audio and state via the new handler.

**Outcome after this task:** Open Settings — Floating Numbers checkbox unchanged. Music row shows a slider 0–100 with live `Music — XX%` label. SFX row likewise. Drag → live audio adjustment, label updates, localStorage updates, no settings-modal re-render (slider keeps focus mid-drag). Drag to 0 → music pauses / SFX silent. Drag back up → music resumes / SFX returns. Reload preserves the dragged positions.

- [ ] **Step 1: Replace the Music + SFX checkbox rows in `renderSettings`**

Open `js/render.js`. Find the `renderSettings` function. The section block currently looks like:

```js
          <section class="settings-section">
            <label class="setting-row">
              <span>
                <span class="setting-name">Floating numbers on harvest</span>
                <span class="setting-desc">Show "+12c" and "+2 XP" rising from harvested plots</span>
              </span>
              <input type="checkbox" data-setting="floatingNumbers" ${settings.floatingNumbers ? "checked" : ""}>
            </label>
            <label class="setting-row">
              <span>
                <span class="setting-name">Music</span>
                <span class="setting-desc">Cozy background music loop</span>
              </span>
              <input type="checkbox" data-setting="musicOn" ${settings.musicOn ? "checked" : ""}>
            </label>
            <label class="setting-row">
              <span>
                <span class="setting-name">Sound effects</span>
                <span class="setting-desc">Plant, water, harvest, rewards</span>
              </span>
              <input type="checkbox" data-setting="sfxOn" ${settings.sfxOn ? "checked" : ""}>
            </label>
          </section>
```

Replace the two `data-setting="musicOn"` and `data-setting="sfxOn"` rows (keeping the Floating Numbers row intact) so the block becomes:

```js
          <section class="settings-section">
            <label class="setting-row">
              <span>
                <span class="setting-name">Floating numbers on harvest</span>
                <span class="setting-desc">Show "+12c" and "+2 XP" rising from harvested plots</span>
              </span>
              <input type="checkbox" data-setting="floatingNumbers" ${settings.floatingNumbers ? "checked" : ""}>
            </label>
            <label class="setting-row">
              <span>
                <span class="setting-name">Music <span class="setting-value" data-volume-label="musicVolume">${settings.musicVolume}%</span></span>
                <span class="setting-desc">Cozy background music loop</span>
              </span>
              <input type="range" min="0" max="100" step="1" data-setting="musicVolume" value="${settings.musicVolume}" class="setting-slider">
            </label>
            <label class="setting-row">
              <span>
                <span class="setting-name">Sound effects <span class="setting-value" data-volume-label="sfxVolume">${settings.sfxVolume}%</span></span>
                <span class="setting-desc">Plant, water, harvest, rewards</span>
              </span>
              <input type="range" min="0" max="100" step="1" data-setting="sfxVolume" value="${settings.sfxVolume}" class="setting-slider">
            </label>
          </section>
```

- [ ] **Step 2: Add the `input` event handler in `setupHandlers`**

Open `js/render.js`. Find the existing settings `change` handler (around line 1141, after Task 1 cleanup). It looks like:

```js
    app.addEventListener("change", (ev) => {
      if (!currentState) return;
      const cb = ev.target.closest("input[data-setting]");
      if (!cb) return;
      const key = cb.dataset.setting;
      if (!currentState.settings) currentState.settings = {};
      currentState.settings[key] = cb.checked;
      Garden.storage.save(currentState);
    });
```

Insert this new `input` handler immediately AFTER the `change` handler block (still inside `setupHandlers`, before the closing `}` of the function):

```js
    // Range-slider drag events (separate from checkbox change events above).
    // Fires on every drag tick so audio + label + localStorage stay live.
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
      const label = document.querySelector("[data-volume-label='" + key + "']");
      if (label) label.textContent = n + "%";
      Garden.storage.save(currentState);
    });
```

- [ ] **Step 3: Append slider CSS at the end of `styles.css`**

Open `styles.css`. Append at the very end of the file:

```css
/* ===== Volume sliders in Settings ===== */

.setting-slider {
  width: 160px;
  cursor: pointer;
  accent-color: #56b256;
}

.setting-value {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  font-size: 12px;
  color: #56b256;
  font-weight: 600;
  margin-left: 6px;
}
```

- [ ] **Step 4: Static checks**

```powershell
node -c js/render.js
```

Expected: clean.

```powershell
Select-String -Path js/render.js -Pattern 'data-setting="musicVolume"|data-setting="sfxVolume"|data-volume-label|setting-slider|setting-value' | Measure-Object | Select-Object -ExpandProperty Count
```

Expected: ≥ 8 (template renders both sliders with class + label + setting attr, plus the value-label spans).

```powershell
Select-String -Path js/render.js -Pattern 'data-setting="musicOn"|data-setting="sfxOn"'
```

Expected: NO matches (old checkbox rows gone).

```powershell
Select-String -Path js/render.js -Pattern 'app\.addEventListener\("input"'
```

Expected: 1 match (the new handler).

```powershell
Select-String -Path styles.css -Pattern '\.setting-slider|\.setting-value' | Measure-Object | Select-Object -ExpandProperty Count
```

Expected: ≥ 2.

- [ ] **Step 5: Commit**

```powershell
git add js/render.js styles.css
git commit -m "feat: Settings UI - Music + SFX volume sliders with live label"
```

---

### Task 3: Manual verification pass

**Files:**
- Modify: only if bugs are found.

**Outcome:** Sliders work end-to-end across fresh saves, mid-drag adjustment, zero-threshold transitions, reload persistence, and old-save migration. No regression in floating numbers, plot interactions, or other audio call sites.

- [ ] **Step 1: Fresh save smoke**

In a browser DevTools console at `index.html`:

```js
localStorage.removeItem("dreamgarden.v1");
location.reload();
```

After reload:
1. Click anywhere → music starts at full volume (effective 0.4).
2. Open Settings. Both sliders at 100%. Floating Numbers checkbox checked.
3. Click an empty plot → plant SFX at full volume (effective 0.6).

- [ ] **Step 2: Drag Music slider mid-music**

While music is playing:
1. Open Settings, drag the Music slider left from 100 → 50. Music volume drops audibly during the drag.
2. Label updates live (`Music — 50%` etc.).
3. Drag right back to 100. Volume returns.

- [ ] **Step 3: Music zero-cross**

1. Drag Music slider to 0. Music pauses immediately.
2. Drag right to 30. Music resumes at the new volume.

- [ ] **Step 4: SFX volume**

1. Drag SFX slider to 50%. Close Settings. Click a plot → SFX plays softer.
2. Open Settings, drag SFX to 0. Click a plot → silence.
3. Drag SFX back to 80. Next plot click plays at 80%.

- [ ] **Step 5: Reload persistence**

1. Set sliders to Music 30%, SFX 70%. Close Settings.
2. Reload the page.
3. Open Settings. Sliders show Music 30%, SFX 70%.
4. First click → music starts at the saved 30% level.

- [ ] **Step 6: Music-off reload**

1. Set Music slider to 0. Reload.
2. Click anywhere — music does NOT start.
3. Open Settings, drag Music to 50. Music starts immediately.

- [ ] **Step 7: Migration from an old save**

In DevTools console:

```js
const raw = localStorage.getItem("dreamgarden.v1");
const save = JSON.parse(raw);
save.settings.musicOn = false;
save.settings.sfxOn = true;
delete save.settings.musicVolume;
delete save.settings.sfxVolume;
localStorage.setItem("dreamgarden.v1", JSON.stringify(save));
location.reload();
```

After reload:

```js
JSON.parse(localStorage.getItem("dreamgarden.v1")).settings
```

Expected: `{ floatingNumbers: <bool>, musicVolume: 0, sfxVolume: 100 }`. No `musicOn` or `sfxOn` keys present.

Open Settings: Music slider at 0%, SFX at 100%.

- [ ] **Step 8: Regression sweep**

Across both desktop and mobile shapes:

1. Floating Numbers toggle still works (uncheck → harvest doesn't show floating numbers; recheck → returns).
2. Full game loop: plant → water → sun → harvest. All four SFX play at the current SFX volume.
3. Quest completion → quest-complete SFX. All-3 chest → chest SFX. Level-up → level-up SFX.
4. Daily / Catalog / Shop / Settings ui-click SFX on the topbar buttons (desktop) or tab switches (mobile).
5. Rare mystery reveal → rare-sparkle SFX.
6. Music continues looping through all the above.

- [ ] **Step 9: Fix anything found, commit fixes individually**

For each bug:

```powershell
git add <files>
git commit -m "fix: <specific issue from smoke test>"
```

- [ ] **Step 10: Final state check**

```powershell
git status
```

Expected: clean working tree apart from the existing untracked local files.

---

## Execution notes

- Task 1 leaves Settings showing inert checkbox rows briefly until Task 2 lands. Don't pause between Tasks 1 and 2 for browser interaction — the static checks and node smoke in Task 1 Step 6 verify migration correctness without a browser.
- The two volume ceilings (`MAX_MUSIC_VOLUME = 0.4`, `MAX_SFX_VOLUME = 0.6`) are kept verbatim from the launched audio system. Sliders only scale DOWN from these values — never above.
- The `input` event handler in Task 2 saves to localStorage on every drag tick. That's intentional per the spec — drag-rate writes are cheap (sub-ms) and avoid a "save on release" code path that could desync state and audio.
- No `storage.js` VERSION bump. Migration lives in `main.js` start and is idempotent — safe to run on every boot.
