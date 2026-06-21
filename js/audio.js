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
