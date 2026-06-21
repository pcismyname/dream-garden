window.Garden = window.Garden || {};

(function (Garden) {
  const SFX_NAMES = [
    "plant", "water", "sun", "harvest",
    "level-up", "quest-complete", "chest", "rare-sparkle", "ui-click",
  ];
  const MUSIC_PATH = "audio/music/garden-theme.mp3";
  const SFX_VOLUME = 0.6;
  const MUSIC_VOLUME = 0.4;

  // Template elements — never played directly; cloned per shot so SFX can overlap.
  const sfxTemplates = {};
  let musicEl = null;
  let stateRef = null;
  let preloaded = false;

  function preload() {
    if (preloaded) return;
    SFX_NAMES.forEach(name => {
      const a = new Audio("audio/sfx/" + name + ".mp3");
      a.preload = "auto";
      a.volume = SFX_VOLUME;
      sfxTemplates[name] = a;
    });
    musicEl = new Audio(MUSIC_PATH);
    musicEl.loop = true;
    musicEl.volume = MUSIC_VOLUME;
    musicEl.preload = "auto";
    preloaded = true;
  }

  function _setState(state) { stateRef = state; }

  function playSfx(name) {
    if (!stateRef || !stateRef.settings || !stateRef.settings.sfxOn) return;
    const tmpl = sfxTemplates[name];
    if (!tmpl) return;
    try {
      const clone = tmpl.cloneNode();
      clone.volume = SFX_VOLUME;
      const p = clone.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch (_) { /* no-op */ }
  }

  function startMusic() {
    if (!stateRef || !stateRef.settings || !stateRef.settings.musicOn) return;
    if (!musicEl) return;
    try {
      const p = musicEl.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch (_) { /* no-op */ }
  }

  function stopMusic() {
    if (!musicEl) return;
    musicEl.pause();
  }

  function setMusicEnabled(on) {
    if (on) startMusic();
    else stopMusic();
  }

  // SFX has no persistent element — playSfx reads stateRef.settings.sfxOn live —
  // so this is a no-op kept for API symmetry with setMusicEnabled.
  function setSfxEnabled(_on) {}

  Garden.audio = {
    preload, playSfx, startMusic, stopMusic,
    setMusicEnabled, setSfxEnabled, _setState,
  };
})(window.Garden);
