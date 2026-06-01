window.Garden = window.Garden || {};

(function (Garden) {
  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }

  let selectedSeedId = "daisy";

  function renderTopBar(state) {
    const xpNeeded = Garden.state.xpForNextLevel(state.level);
    const xpPct = Math.min(100, Math.floor((state.xp / xpNeeded) * 100));
    const exp = Garden.state.nextExpansion(state);
    const totalPlots = state.gridSize * state.gridSize;

    let expandBtnHtml = "";
    if (exp && state.level >= exp.minLevel) {
      const canAfford = state.coins >= exp.cost;
      expandBtnHtml = `<button class="expand-btn" data-action="expand" ${canAfford ? "" : "disabled"}>
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

  function renderShelf(state) {
    const wrap = el(`
      <div class="shelf">
        <div class="shelf-label">Seeds — click to select, then click an empty plot</div>
        <div class="seeds"></div>
      </div>
    `);
    const seedsEl = wrap.querySelector(".seeds");

    Garden.FLOWERS.forEach(flower => {
      const locked = state.level < flower.levelReq;
      const unaffordable = !locked && state.coins < flower.seedCost;
      const isSelected = !locked && flower.id === selectedSeedId;

      const card = document.createElement("div");
      let cls = "seed-card";
      if (locked) cls += " locked";
      else if (unaffordable) cls += " unaffordable";
      if (isSelected) cls += " selected";
      card.className = cls;
      card.dataset.flowerId = flower.id;

      const right = locked
        ? `<span class="seed-lock">🔒 Lv ${flower.levelReq}</span>`
        : `<span class="seed-cost">${flower.seedCost}🪙</span>`;

      card.innerHTML = `
        <div class="seed-icon">${Garden.svg.flowerIcon(flower.id)}</div>
        <div>
          <div class="seed-name">${flower.name}</div>
          ${right}
        </div>
      `;
      seedsEl.appendChild(card);
    });

    return wrap;
  }

  function renderAll(state) {
    currentState = state;

    // Ensure selectedSeedId is still unlocked; otherwise pick the first unlocked.
    const selectedFlower = Garden.flowerById(selectedSeedId);
    if (!selectedFlower || state.level < selectedFlower.levelReq) {
      const firstUnlocked = Garden.FLOWERS.find(f => state.level >= f.levelReq);
      selectedSeedId = firstUnlocked ? firstUnlocked.id : null;
    }

    const app = document.getElementById("app");
    app.innerHTML = "";
    app.appendChild(renderTopBar(state));
    app.appendChild(renderGrid(state));
    app.appendChild(renderShelf(state));
  }

  let currentState = null;

  function setupHandlers() {
    const app = document.getElementById("app");
    app.addEventListener("click", (ev) => {
      if (!currentState) return;

      // Plot click
      const plotEl = ev.target.closest(".plot");
      if (plotEl) {
        const idx = Number(plotEl.dataset.idx);
        handlePlotClick(idx);
        return;
      }

      // Seed shelf click
      const seedEl = ev.target.closest(".seed-card");
      if (seedEl && !seedEl.classList.contains("locked")) {
        selectedSeedId = seedEl.dataset.flowerId;
        renderAll(currentState);
        return;
      }

      // Expand button
      const expandBtn = ev.target.closest("[data-action='expand']");
      if (expandBtn && !expandBtn.disabled) {
        Garden.state.expandGrid(currentState);
        Garden.storage.save(currentState);
        renderAll(currentState);
        return;
      }
    });
  }

  function handlePlotClick(idx) {
    const state = currentState;
    const plot = state.plots[idx];
    const now = Date.now();

    if (!plot) {
      if (!selectedSeedId) return;
      Garden.state.plant(state, idx, selectedSeedId);
    } else {
      const stage = Garden.state.getStage(plot, now);
      if (stage === "seed") Garden.state.water(state, idx);
      else if (stage === "watered") Garden.state.sun(state, idx);
      else if (stage === "bloomed") Garden.state.harvest(state, idx);
      // growing → no-op
    }
    Garden.storage.save(state);
    renderAll(state);
  }

  Garden.render = {
    renderAll, renderTopBar, renderGrid, renderShelf, setupHandlers,
    setSelectedSeedId: (id) => { selectedSeedId = id; },
    getSelectedSeedId: () => selectedSeedId,
  };
})(window.Garden);
