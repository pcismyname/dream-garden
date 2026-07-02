window.Garden = window.Garden || {};
(function (Garden) {
  let state = null;
  let lastStageSig = "";

  function stageSignature(state, now) {
    return state.plots
      .map(p => (p ? Garden.state.getStage(p, now) : "n"))
      .join("|");
  }

  function tick() {
    if (!state) return;
    const now = Date.now();

    // Reveal mystery plots when they bloom (or wilt unbloomed-seen):
    // record rare discovery once, then drop the mystery flag.
    let revealed = false;
    state.plots.forEach(plot => {
      if (!plot || !plot.mystery) return;
      const stage = Garden.state.getStage(plot, now);
      if (stage !== "bloomed" && stage !== "wilted") return;
      delete plot.mystery;
      revealed = true;
      const flower = Garden.flowerById(plot.flowerId);
      if (flower && flower.rare) {
        if (Garden.audio) Garden.audio.playSfx("rare-sparkle");
        if (!state.discovered) state.discovered = {};
        if (!state.discovered[flower.id] && Garden.fx) {
          Garden.fx.toast("Mystery seed revealed: " + flower.name + "! (RARE)", { variant: "rare" });
        }
        state.discovered[flower.id] = true;
      } else if (flower && Garden.fx) {
        Garden.fx.toast("Mystery seed revealed: " + flower.name + "!", { variant: "level" });
      }
    });
    if (revealed) Garden.storage.save(state);

    // Achievement sweep: one integration point catches every unlock path
    // (harvest, purchase, expansion, level, discovery) within 500ms.
    if (Garden.achievements) {
      const newly = Garden.achievements.sweep(state);
      if (newly.length > 0) {
        newly.forEach(a => {
          if (Garden.fx) Garden.fx.toast("🏆 " + a.name + " — " + a.desc, { variant: "achieve" });
        });
        if (Garden.audio) Garden.audio.playSfx("quest-complete");
        Garden.storage.save(state);
      }
    }

    const sig = stageSignature(state, now);

    if (sig !== lastStageSig) {
      // A plot transitioned (e.g., growing → bloomed, bloomed → wilted). Full rebuild.
      const oldStages = lastStageSig.split("|");
      lastStageSig = sig;
      Garden.render.renderAll(state);
      // Bloom pop: one-shot scale-in on exactly the plots that just bloomed.
      const newStages = sig.split("|");
      const plotEls = document.querySelectorAll(".plot");
      newStages.forEach((st, i) => {
        if (st !== "bloomed" || oldStages[i] !== "growing" || !plotEls[i]) return;
        const content = plotEls[i].querySelector(".plot-content");
        if (content) content.classList.add("just-bloomed");
      });
      return;
    }

    // No stage transitions — just update the live countdown text in place.
    // Growing plots count down to bloomAt; bloomed plots count down to bloomAt + growMs (wilt).
    const plotEls = document.querySelectorAll(".plot");
    state.plots.forEach((plot, idx) => {
      if (!plot || !plot.bloomAt) return;
      const plotEl = plotEls[idx];
      if (!plotEl) return;
      const timerEl = plotEl.querySelector(".timer");
      if (!timerEl) return;

      const stage = Garden.state.getStage(plot, now);
      let target;
      if (stage === "growing") {
        target = plot.bloomAt;
      } else if (stage === "bloomed") {
        const flower = Garden.flowerById(plot.flowerId);
        target = plot.bloomAt + (flower ? flower.growMs : 0) + (plot.wiltBonusMs || 0);
      } else {
        return; // wilted or other — no live timer
      }
      const remaining = Math.max(0, Math.ceil((target - now) / 1000));
      timerEl.textContent = `${remaining}s`;
    });
  }

  async function start() {
    await Garden.cg.init(3000);
    state = (await Garden.storage.load()) || Garden.state.createInitialState();
    // Backward-compat for saves from earlier versions.
    if (!state.plantCounts) state.plantCounts = {};
    if (!state.discovered) state.discovered = {};
    if (!Array.isArray(state.quests) || state.quests.length === 0) {
      state.quests = [];
      for (let i = 0; i < 3; i++) {
        state.quests.push(Garden.state.generateQuest(state));
      }
      Garden.storage.save(state);
    }
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
    // Tutorial migration: any save predating the tutorial system is treated
    // as a returning player and skips onboarding.
    if (typeof state.tutorialDone !== "boolean") state.tutorialDone = true;
    // Audio: preload elements, attach state ref so playSfx reads live settings.
    // Music can't start until a user gesture (browser autoplay policy), so we
    // arm a one-time click listener that fires startMusic() on the first click.
    if (Garden.audio) {
      Garden.audio.preload();
      Garden.audio._setState(state);
      const armMusic = () => {
        Garden.audio.startMusic();
        document.removeEventListener("click", armMusic);
      };
      document.addEventListener("click", armMusic);
    }
    if (!Array.isArray(state.decorations) || state.decorations.length !== Garden.DECORATION_SLOTS) {
      state.decorations = new Array(Garden.DECORATION_SLOTS).fill(null);
    }
    if (!Array.isArray(state.ownedPots) || state.ownedPots.length === 0) {
      state.ownedPots = [Garden.DEFAULT_POT];
    }
    // v1.9 → v1.10: grandfather dirt into ownedPots so players who had
    // terracotta as their old default also have the new default available.
    if (!state.ownedPots.includes(Garden.DEFAULT_POT)) {
      state.ownedPots.unshift(Garden.DEFAULT_POT);
    }
    if (!state.activePotId || !Garden.potById(state.activePotId) ||
        !state.ownedPots.includes(state.activePotId)) {
      state.activePotId = Garden.DEFAULT_POT;
    }
    if (!state.inventory || typeof state.inventory !== "object") {
      state.inventory = {};
    }
    // Achievements migration: older saves get empty counters. Threshold
    // achievements the player already satisfies (level, grid, discoveries)
    // unlock on the first tick sweep — a small welcome-back moment.
    if (!state.lifetime || typeof state.lifetime !== "object") {
      state.lifetime = Garden.achievements.defaultLifetime();
    }
    if (!state.lifetime.species || typeof state.lifetime.species !== "object") {
      state.lifetime.species = {};
    }
    if (!state.achievements || typeof state.achievements !== "object") {
      state.achievements = {};
    }
    // Daily systems: recap must be computed BEFORE the first save of this
    // session overwrites daily.lastSeenAt.
    Garden.daily.ensureDaily(state);
    const recap = Garden.daily.computeRecap(state);
    Garden.daily.rolloverQuests(state);
    Garden.storage.save(state);
    // Suppress the daily modal during the tutorial so a brand-new player's
    // first sight is the garden (and the pre-spawned harvestable daisy),
    // not a wall of claim buttons.
    if (state.tutorialDone && Garden.daily.claimablesCount(state) > 0) {
      Garden.render.openDailyReport(recap);
    }
    Garden.render.setupHandlers();
    Garden.render.renderAll(state);
    if (Garden.fx && Garden.fx.startAmbient) Garden.fx.startAmbient();
    lastStageSig = stageSignature(state, Date.now());
    setInterval(tick, 500);
    if (Garden.cg) Garden.cg.gameplayStart();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})(window.Garden);
