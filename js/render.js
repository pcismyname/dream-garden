window.Garden = window.Garden || {};

(function (Garden) {
  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }

  let selectedSeedId = "daisy";
  let catalogOpen = false;
  let settingsOpen = false;
  let shopOpen = false;

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
          <button class="icon-btn" data-action="open-shop" title="Decoration Shop" aria-label="Open shop">
            ${Garden.svg.SHOP_ICON}
            <span>Shop</span>
          </button>
          <button class="icon-btn" data-action="open-catalog" title="Flower Catalog" aria-label="Open flower catalog">
            ${Garden.svg.BOOK_ICON}
            <span>Catalog</span>
          </button>
          <button class="icon-btn icon-btn-square" data-action="open-settings" title="Settings" aria-label="Open settings">
            ${Garden.svg.GEAR_ICON}
          </button>
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

    const potId = state.activePotId || Garden.DEFAULT_POT;
    state.plots.forEach((plot, idx) => {
      const plotEl = document.createElement("div");
      plotEl.className = "plot";
      plotEl.dataset.idx = idx;

      // Layer the active pot SVG as the plot background.
      const potEl = document.createElement("div");
      potEl.className = "plot-pot";
      potEl.innerHTML = Garden.svg.potSvg(potId);
      plotEl.appendChild(potEl);

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

  function pluralize(name, count) {
    if (count === 1) return name;
    // consonant + y → ies (Daisy → Daisies). Otherwise just append s.
    if (/[^aeiou]y$/i.test(name)) return name.slice(0, -1) + "ies";
    return name + "s";
  }

  function renderDecorationZone(state) {
    const slots = state.decorations || [];
    if (slots.length === 0) return null;

    const wrap = el(`<div class="deco-zone"></div>`);
    for (let i = 0; i < slots.length; i++) {
      const decId = slots[i];
      const slotEl = document.createElement("div");
      slotEl.className = "deco-slot" + (decId ? " filled" : " empty");
      slotEl.dataset.slotIdx = i;
      if (decId) {
        slotEl.innerHTML = Garden.svg.decorationSvg(decId);
      } else {
        slotEl.innerHTML = `<div class="deco-empty-mark">+</div>`;
      }
      wrap.appendChild(slotEl);
    }
    return wrap;
  }

  function renderShop(state) {
    const overlay = el(`
      <div class="modal-overlay" data-action="shop-backdrop">
        <div class="modal-content shop-modal">
          <header class="modal-header">
            <h2>Decoration Shop</h2>
            <button class="modal-close" data-action="close-shop" aria-label="Close">✕</button>
          </header>
          <section class="shop-section">
            <h3 class="catalog-section-title">For Sale</h3>
            <div class="shop-grid" data-section="for-sale"></div>
          </section>
          <section class="shop-section">
            <h3 class="catalog-section-title">Pot Skins</h3>
            <div class="shop-grid" data-section="pots"></div>
          </section>
          <section class="shop-section">
            <h3 class="catalog-section-title">Your Decorations</h3>
            <div class="shop-grid" data-section="placed"></div>
          </section>
        </div>
      </div>
    `);

    // For Sale section
    const saleGrid = overlay.querySelector("[data-section='for-sale']");
    const placedCount = (state.decorations || []).filter(d => d != null).length;
    const slotsFull = placedCount >= Garden.DECORATION_SLOTS;

    Garden.DECORATIONS.forEach(dec => {
      const locked = state.level < dec.levelReq;
      const unaffordable = !locked && state.coins < dec.cost;
      const canBuy = !locked && !unaffordable && !slotsFull;

      let action;
      if (locked) {
        action = `<span class="shop-status locked">🔒 Lv ${dec.levelReq}</span>`;
      } else if (slotsFull) {
        action = `<span class="shop-status">No empty slot</span>`;
      } else {
        action = `<button class="shop-buy-btn" data-action="buy-decoration" data-decoration-id="${dec.id}" ${canBuy ? "" : "disabled"}>
          Buy <span class="mini-coin"></span>${dec.cost}
        </button>`;
      }

      const card = el(`
        <div class="shop-card ${locked ? "locked-card" : ""} ${unaffordable && !locked ? "unaffordable" : ""}">
          <div class="shop-art">${Garden.svg.decorationSvg(dec.id)}</div>
          <div class="shop-info">
            <div class="shop-name">${dec.name}</div>
            ${action}
          </div>
        </div>
      `);
      saleGrid.appendChild(card);
    });

    // Pot Skins section
    const potsGrid = overlay.querySelector("[data-section='pots']");
    const ownedPots = Array.isArray(state.ownedPots) ? state.ownedPots : [Garden.DEFAULT_POT];
    const activePotId = state.activePotId || Garden.DEFAULT_POT;
    Garden.POTS.forEach(pot => {
      const owned = ownedPots.includes(pot.id);
      const active = owned && pot.id === activePotId;
      const locked = !owned && state.level < pot.levelReq;
      const unaffordable = !owned && !locked && state.coins < pot.cost;
      const canBuy = !owned && !locked && !unaffordable;

      let action;
      if (active) {
        action = `<span class="shop-status active">Active</span>`;
      } else if (owned) {
        action = `<button class="shop-buy-btn" data-action="use-pot" data-pot-id="${pot.id}">Use</button>`;
      } else if (locked) {
        action = `<span class="shop-status locked">🔒 Lv ${pot.levelReq}</span>`;
      } else {
        action = `<button class="shop-buy-btn" data-action="buy-pot" data-pot-id="${pot.id}" ${canBuy ? "" : "disabled"}>
          Buy <span class="mini-coin"></span>${pot.cost}
        </button>`;
      }

      const card = el(`
        <div class="shop-card ${locked ? "locked-card" : ""} ${unaffordable && !locked ? "unaffordable" : ""} ${active ? "active-pot-card" : ""}">
          <div class="shop-art">${Garden.svg.potSvg(pot.id)}</div>
          <div class="shop-info">
            <div class="shop-name">${pot.name}</div>
            ${action}
          </div>
        </div>
      `);
      potsGrid.appendChild(card);
    });

    // Placed section
    const placedGrid = overlay.querySelector("[data-section='placed']");
    const placed = state.decorations || [];
    if (placed.every(d => d == null)) {
      placedGrid.appendChild(el(`<div class="shop-empty">No decorations placed yet. Buy some above!</div>`));
    } else {
      placed.forEach((decId, idx) => {
        if (decId == null) return;
        const dec = Garden.decorationById(decId);
        if (!dec) return;
        const refund = Math.floor(dec.cost * Garden.DECORATION_REFUND_PCT);
        const card = el(`
          <div class="shop-card placed-card">
            <div class="shop-art">${Garden.svg.decorationSvg(decId)}</div>
            <div class="shop-info">
              <div class="shop-name">${dec.name}</div>
              <button class="shop-remove-btn" data-action="remove-decoration" data-slot-idx="${idx}">
                Remove (+<span class="mini-coin"></span>${refund})
              </button>
            </div>
          </div>
        `);
        placedGrid.appendChild(card);
      });
    }

    return overlay;
  }

  function renderSettings(state) {
    const settings = state.settings || {};
    const overlay = el(`
      <div class="modal-overlay" data-action="settings-backdrop">
        <div class="modal-content settings-modal">
          <header class="modal-header">
            <h2>Settings</h2>
            <button class="modal-close" data-action="close-settings" aria-label="Close">✕</button>
          </header>
          <section class="settings-section">
            <label class="setting-row">
              <span>
                <span class="setting-name">Floating numbers on harvest</span>
                <span class="setting-desc">Show "+12c" and "+2 XP" rising from harvested plots</span>
              </span>
              <input type="checkbox" data-setting="floatingNumbers" ${settings.floatingNumbers ? "checked" : ""}>
            </label>
          </section>
        </div>
      </div>
    `);
    return overlay;
  }

  function renderQuests(state) {
    const quests = (state.quests || []);
    if (quests.length === 0) return null;

    const wrap = el(`
      <div class="quests-bar">
        <div class="quests-label">Orders</div>
        <div class="quests-list"></div>
      </div>
    `);
    const list = wrap.querySelector(".quests-list");

    quests.forEach(q => {
      const flower = Garden.flowerById(q.flowerId);
      if (!flower) return; // defensive
      const pct = Math.min(100, Math.floor((q.progress / q.target) * 100));
      const card = el(`
        <div class="quest-card">
          <div class="quest-icon">${Garden.svg.flowerIcon(q.flowerId)}</div>
          <div class="quest-info">
            <div class="quest-text">Deliver ${q.target} ${pluralize(flower.name, q.target)}</div>
            <div class="quest-progress-bar"><div class="quest-progress-fill" style="width:${pct}%"></div></div>
            <div class="quest-count">${q.progress}/${q.target}</div>
          </div>
        </div>
      `);
      list.appendChild(card);
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
    const questsEl = renderQuests(state);
    if (questsEl) app.appendChild(questsEl);

    const gardenEl = renderGrid(state);
    const decoZone = renderDecorationZone(state);
    if (decoZone) gardenEl.appendChild(decoZone);
    app.appendChild(gardenEl);

    app.appendChild(renderShelf(state));
    if (catalogOpen) app.appendChild(renderCatalog(state));
    if (settingsOpen) app.appendChild(renderSettings(state));
    if (shopOpen) app.appendChild(renderShop(state));
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
      const catalogBackdrop = ev.target.closest("[data-action='catalog-backdrop']");
      if (catalogBackdrop && !ev.target.closest(".modal-content")) {
        catalogOpen = false;
        renderAll(currentState);
        return;
      }

      // Settings: open / close / backdrop
      if (ev.target.closest("[data-action='open-settings']")) {
        settingsOpen = true;
        renderAll(currentState);
        return;
      }
      if (ev.target.closest("[data-action='close-settings']")) {
        settingsOpen = false;
        renderAll(currentState);
        return;
      }
      const settingsBackdrop = ev.target.closest("[data-action='settings-backdrop']");
      if (settingsBackdrop && !ev.target.closest(".modal-content")) {
        settingsOpen = false;
        renderAll(currentState);
        return;
      }

      // Shop: open / close / backdrop / buy / remove
      if (ev.target.closest("[data-action='open-shop']")) {
        shopOpen = true;
        renderAll(currentState);
        return;
      }
      if (ev.target.closest("[data-action='close-shop']")) {
        shopOpen = false;
        renderAll(currentState);
        return;
      }
      const shopBackdrop = ev.target.closest("[data-action='shop-backdrop']");
      if (shopBackdrop && !ev.target.closest(".modal-content")) {
        shopOpen = false;
        renderAll(currentState);
        return;
      }
      const buyBtn = ev.target.closest("[data-action='buy-decoration']");
      if (buyBtn && !buyBtn.disabled) {
        const decId = buyBtn.dataset.decorationId;
        const result = Garden.state.buyDecoration(currentState, decId);
        if (result.ok && Garden.fx) {
          const dec = Garden.decorationById(decId);
          Garden.fx.toast("Placed " + dec.name + ".", { variant: "level" });
        }
        Garden.storage.save(currentState);
        renderAll(currentState);
        return;
      }
      const removeBtn = ev.target.closest("[data-action='remove-decoration']");
      if (removeBtn) {
        const slot = Number(removeBtn.dataset.slotIdx);
        const result = Garden.state.removeDecoration(currentState, slot);
        if (result.ok && Garden.fx) {
          Garden.fx.toast("Removed. Refunded " + result.refund + " coins.", { variant: "quest" });
        }
        Garden.storage.save(currentState);
        renderAll(currentState);
        return;
      }
      const buyPotBtn = ev.target.closest("[data-action='buy-pot']");
      if (buyPotBtn && !buyPotBtn.disabled) {
        const potId = buyPotBtn.dataset.potId;
        const result = Garden.state.buyPot(currentState, potId);
        if (result.ok) {
          // Auto-equip just-bought pot for instant feedback
          Garden.state.setActivePot(currentState, potId);
          if (Garden.fx) {
            const pot = Garden.potById(potId);
            Garden.fx.toast("Pot equipped: " + pot.name, { variant: "level" });
          }
        }
        Garden.storage.save(currentState);
        renderAll(currentState);
        return;
      }
      const usePotBtn = ev.target.closest("[data-action='use-pot']");
      if (usePotBtn) {
        const potId = usePotBtn.dataset.potId;
        const result = Garden.state.setActivePot(currentState, potId);
        if (result.ok && Garden.fx) {
          const pot = Garden.potById(potId);
          Garden.fx.toast("Pot changed to " + pot.name, { variant: "level" });
        }
        Garden.storage.save(currentState);
        renderAll(currentState);
        return;
      }

      // When any modal is open, swallow other clicks.
      if (catalogOpen || settingsOpen || shopOpen) return;

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

    // Esc closes whichever modal is open
    document.addEventListener("keydown", (ev) => {
      if (ev.key !== "Escape") return;
      if (settingsOpen) {
        settingsOpen = false;
        if (currentState) renderAll(currentState);
      } else if (shopOpen) {
        shopOpen = false;
        if (currentState) renderAll(currentState);
      } else if (catalogOpen) {
        catalogOpen = false;
        if (currentState) renderAll(currentState);
      }
    });

    // Settings toggles (checkbox change events)
    app.addEventListener("change", (ev) => {
      if (!currentState) return;
      const cb = ev.target.closest("input[data-setting]");
      if (!cb) return;
      const key = cb.dataset.setting;
      if (!currentState.settings) currentState.settings = {};
      currentState.settings[key] = cb.checked;
      Garden.storage.save(currentState);
    });
  }

  function handlePlotClick(idx) {
    const state = currentState;
    const plot = state.plots[idx];
    const now = Date.now();

    let harvestResult = null;
    let plotRect = null;

    if (!plot) {
      if (!selectedSeedId) return;
      Garden.state.plant(state, idx, selectedSeedId);
    } else {
      const stage = Garden.state.getStage(plot, now);
      if (stage === "seed") Garden.state.water(state, idx);
      else if (stage === "watered") Garden.state.sun(state, idx);
      else if (stage === "bloomed") {
        // Capture position BEFORE the DOM is torn down by renderAll,
        // so the floating numbers can spawn at the right spot.
        const plotEls = document.querySelectorAll(".plot");
        if (plotEls[idx]) plotRect = plotEls[idx].getBoundingClientRect();
        harvestResult = Garden.state.harvest(state, idx);
      }
      else if (stage === "wilted") Garden.state.clear(state, idx);
      // growing → no-op
    }
    Garden.storage.save(state);
    renderAll(state);

    // FX feedback on harvest (runs AFTER renderAll so it lays over the new DOM).
    if (harvestResult && harvestResult.ok) {
      emitHarvestFx(state, harvestResult, plotRect);
    }
  }

  function emitHarvestFx(state, result, plotRect) {
    const floatingOn = !!(state.settings && state.settings.floatingNumbers);
    if (floatingOn && plotRect && Garden.fx) {
      const cx = plotRect.left + plotRect.width / 2;
      const cy = plotRect.top + plotRect.height * 0.35;
      // Coin first, XP staggered ~220ms later — sequential pops avoid overlap.
      Garden.fx.floatText("+" + result.coinsGained + "c", cx, cy, {
        color: "#b8860b",
      });
      Garden.fx.floatText("+" + result.xpGained + " XP", cx, cy, {
        color: "#3b8e3b", delay: 220,
      });
    }
    if (result.questCompleted && Garden.fx) {
      const qc = result.questCompleted;
      const flower = Garden.flowerById(qc.flowerId);
      const name = flower ? flower.name : qc.flowerId;
      Garden.fx.toast(
        "Order complete: " + qc.target + " × " + name + "  +" + qc.coinBonus + "c  +" + qc.xpBonus + " XP",
        { variant: "quest" }
      );
    }
    if (result.leveledUp && Garden.fx) {
      const newUnlock = Garden.FLOWERS.find(f => f.levelReq === result.newLevel);
      const text = newUnlock
        ? "Level " + result.newLevel + "! " + newUnlock.name + " unlocked."
        : "Level " + result.newLevel + " reached!";
      Garden.fx.toast(text, { variant: "level" });
    }
  }

  Garden.render = {
    renderAll, renderTopBar, renderGrid, renderShelf, renderQuests,
    renderDecorationZone, renderShop, renderSettings, renderCatalog, setupHandlers,
    setSelectedSeedId: (id) => { selectedSeedId = id; },
    getSelectedSeedId: () => selectedSeedId,
  };
})(window.Garden);
