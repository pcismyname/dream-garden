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

  function renderAll(state) {
    const app = document.getElementById("app");
    app.innerHTML = "";
    app.appendChild(renderTopBar(state));
    // Grid and shelf added in later tasks.
  }

  Garden.render = { renderAll, renderTopBar };
})(window.Garden);
