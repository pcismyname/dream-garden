window.Garden = window.Garden || {};

(function (Garden) {
  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }

  function renderTopBar(state) {
    const xpNeeded = Garden.state.xpForNextLevel(state.level);
    const xpPct = Math.min(100, Math.floor((state.xp / xpNeeded) * 100));
    const exp = Garden.state.nextExpansion(state);
    const totalPlots = state.gridSize * state.gridSize;

    let expandBtnHtml = "";
    if (exp) {
      const canExpand = state.level >= exp.minLevel && state.coins >= exp.cost;
      expandBtnHtml = `<button class="expand-btn" data-action="expand" ${canExpand ? "" : "disabled"}>
        Expand to ${exp.to}×${exp.to} (${exp.cost})
      </button>`;
    }

    return el(`
      <div class="topbar">
        <div class="coins">
          <span class="coin-icon"></span>
          <span>${state.coins}</span>
        </div>
        <div class="level-block">
          <span>Lv ${state.level}</span>
          <div class="xp-bar"><div class="xp-fill" style="width:${xpPct}%"></div></div>
          <span>${state.xp}/${xpNeeded} XP</span>
        </div>
        <div>${totalPlots} plots ${expandBtnHtml}</div>
      </div>
    `);
  }

  function renderGrid(state) {
    const now = Date.now();
    const wrap = el(`<div class="garden"><div class="grid" style="grid-template-columns:repeat(${state.gridSize}, 72px); grid-template-rows:repeat(${state.gridSize}, 72px);"></div></div>`);
    const grid = wrap.querySelector(".grid");

    state.plots.forEach((plot, idx) => {
      const plotEl = document.createElement("div");
      plotEl.className = "plot";
      plotEl.dataset.idx = idx;

      if (plot) {
        const stage = Garden.state.getStage(plot, now);
        const content = document.createElement("div");
        content.className = "plot-content";
        content.innerHTML = Garden.svg.flowerSvg(plot.flowerId, stage);
        plotEl.appendChild(content);

        if (stage === "bloomed") {
          const badge = document.createElement("div");
          badge.className = "ready-badge";
          badge.textContent = "✓";
          plotEl.appendChild(badge);
        } else if (stage === "growing") {
          const remaining = Math.max(0, Math.ceil((plot.bloomAt - now) / 1000));
          const timer = document.createElement("div");
          timer.className = "timer";
          timer.textContent = `${remaining}s`;
          plotEl.appendChild(timer);
        }
      }

      grid.appendChild(plotEl);
    });

    return wrap;
  }

  function renderAll(state) {
    const app = document.getElementById("app");
    app.innerHTML = "";
    app.appendChild(renderTopBar(state));
    app.appendChild(renderGrid(state));
    // Shelf added in next task.
  }

  Garden.render = { renderAll, renderTopBar, renderGrid };
})(window.Garden);
