window.Garden = window.Garden || {};

(function (Garden) {
  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }

  let selectedSeedId = "daisy";
  let catalogOpen = false;

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
        <div class="topbar-right">
          <span>${totalPlots} plots</span>
          ${expandBtnHtml}
          <button class="icon-btn" data-action="open-catalog">Catalog</button>
        </div>
      </div>
    `);
  }

  function renderCatalogCard(flower, locked, progress, intervalNeeded) {
    if (locked) {
      const parent = Garden.flowerById(flower.parentId);
      return el(`
        <div class="catalog-card locked-card">
          <div class="catalog-icon">${Garden.svg.MYSTERY_ICON}</div>
          <div class="catalog-info">
            <div class="catalog-name">???</div>
            <div class="catalog-hint">
              Plant ${intervalNeeded} ${parent ? parent.name : "?"}s
            </div>
            <div class="catalog-progress">${progress}/${intervalNeeded}</div>
          </div>
        </div>
      `);
    }
    // Discovered/normal card
    const stats = [];
    stats.push(`Lv ${flower.levelReq}`);
    if (!flower.rare) {
      stats.push(`<span class="mini-coin"></span>${flower.seedCost}→<span class="mini-coin"></span>${flower.sellPrice}`);
    } else {
      stats.push(`Sells <span class="mini-coin"></span>${flower.sellPrice}`);
    }
    stats.push(`${Math.round(flower.growMs / 1000)}s grow`);

    return el(`
      <div class="catalog-card ${flower.rare ? "rare-card" : ""}">
        <div class="catalog-icon">${Garden.svg.flowerIcon(flower.id)}</div>
        <div class="catalog-info">
          <div class="catalog-name">${flower.name}${flower.rare ? ' <span class="rare-tag">RARE</span>' : ""}</div>
          <div class="catalog-stats">${stats.join(" · ")}</div>
        </div>
      </div>
    `);
  }

  function renderCatalog(state) {
    const overlay = el(`
      <div class="modal-overlay" data-action="catalog-backdrop">
        <div class="modal-content catalog-modal">
          <header class="modal-header">
            <h2>Flower Catalog</h2>
            <button class="modal-close" data-action="close-catalog" aria-label="Close">✕</button>
          </header>
          <section class="catalog-section">
            <h3 class="catalog-section-title">Common Flowers</h3>
            <div class="catalog-grid" data-section="common"></div>
          </section>
          <section class="catalog-section">
            <h3 class="catalog-section-title">Rare Variants</h3>
            <div class="catalog-grid" data-section="rare"></div>
          </section>
        </div>
      </div>
    `);

    const commonGrid = overlay.querySelector("[data-section='common']");
    Garden.FLOWERS.forEach(f => commonGrid.appendChild(renderCatalogCard(f, false, 0, 0)));

    const rareGrid = overlay.querySelector("[data-section='rare']");
    const counts = state.plantCounts || {};
    const discovered = state.discovered || {};
    Garden.RARE_FLOWERS.forEach(rare => {
      const fullRare = Garden.flowerById(rare.id);
      const isDiscovered = !!discovered[rare.id];
      const progress = (counts[rare.parentId] || 0) % rare.interval;
      rareGrid.appendChild(renderCatalogCard(fullRare, !isDiscovered, progress, rare.interval));
    });

    return overlay;
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
          // Show ✓ badge + wilt countdown so the player knows the harvest window is finite.
          const badge = document.createElement("div");
          badge.className = "ready-badge";
          badge.textContent = "✓";
          plotEl.appendChild(badge);

          const flower = Garden.flowerById(plot.flowerId);
          if (flower) {
            const wiltAt = plot.bloomAt + flower.growMs;
            const remaining = Math.max(0, Math.ceil((wiltAt - now) / 1000));
            const timer = document.createElement("div");
            timer.className = "timer wilt-timer";
            timer.textContent = `${remaining}s`;
            plotEl.appendChild(timer);
          }
        } else if (stage === "wilted") {
          plotEl.classList.add("wilted");
          const badge = document.createElement("div");
          badge.className = "wilt-badge";
          badge.textContent = "✕";
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
        <div class="shelf-label">Seeds</div>
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
        ? `<span class="seed-lock">Lv ${flower.levelReq}</span>`
        : `<span class="seed-cost"><span class="mini-coin"></span>${flower.seedCost}</span>`;

      card.innerHTML = `
        <div class="seed-icon">${Garden.svg.flowerIcon(flower.id)}</div>
        <div class="seed-info">
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
    if (catalogOpen) app.appendChild(renderCatalog(state));
  }

  let currentState = null;

  function setupHandlers() {
    const app = document.getElementById("app");
    app.addEventListener("click", (ev) => {
      if (!currentState) return;

      // Catalog: open / close / backdrop
      if (ev.target.closest("[data-action='open-catalog']")) {
        catalogOpen = true;
        renderAll(currentState);
        return;
      }
      if (ev.target.closest("[data-action='close-catalog']")) {
        catalogOpen = false;
        renderAll(currentState);
        return;
      }
      const backdrop = ev.target.closest("[data-action='catalog-backdrop']");
      if (backdrop && !ev.target.closest(".modal-content")) {
        catalogOpen = false;
        renderAll(currentState);
        return;
      }

      // When the catalog is open, swallow other clicks (plot/seed/expand) so
      // the background game isn't manipulated by accident.
      if (catalogOpen) return;

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

    // Esc closes the catalog
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && catalogOpen) {
        catalogOpen = false;
        if (currentState) renderAll(currentState);
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
      else if (stage === "wilted") Garden.state.clear(state, idx);
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
