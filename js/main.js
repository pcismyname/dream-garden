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
    const sig = stageSignature(state, now);

    if (sig !== lastStageSig) {
      // A plot transitioned (e.g., growing → bloomed, bloomed → wilted). Full rebuild.
      lastStageSig = sig;
      Garden.render.renderAll(state);
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
        target = plot.bloomAt + (flower ? flower.growMs : 0);
      } else {
        return; // wilted or other — no live timer
      }
      const remaining = Math.max(0, Math.ceil((target - now) / 1000));
      timerEl.textContent = `${remaining}s`;
    });
  }

  function start() {
    state = Garden.storage.load() || Garden.state.createInitialState();
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
    if (!state.settings) state.settings = { floatingNumbers: true };
    if (typeof state.settings.floatingNumbers !== "boolean") {
      state.settings.floatingNumbers = true;
    }
    if (!Array.isArray(state.decorations) || state.decorations.length !== Garden.DECORATION_SLOTS) {
      state.decorations = new Array(Garden.DECORATION_SLOTS).fill(null);
    }
    Garden.render.setupHandlers();
    Garden.render.renderAll(state);
    lastStageSig = stageSignature(state, Date.now());
    setInterval(tick, 500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})(window.Garden);
