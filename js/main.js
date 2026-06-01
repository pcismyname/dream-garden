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
      // A plot transitioned (e.g., growing → bloomed). Full rebuild.
      lastStageSig = sig;
      Garden.render.renderAll(state);
      return;
    }

    // No stage transitions — just update the live countdown text in place.
    const plotEls = document.querySelectorAll(".plot");
    state.plots.forEach((plot, idx) => {
      if (!plot || !plot.bloomAt) return;
      const plotEl = plotEls[idx];
      if (!plotEl) return;
      const timerEl = plotEl.querySelector(".timer");
      if (!timerEl) return;
      const remaining = Math.max(0, Math.ceil((plot.bloomAt - now) / 1000));
      timerEl.textContent = `${remaining}s`;
    });
  }

  function start() {
    state = Garden.storage.load() || Garden.state.createInitialState();
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
