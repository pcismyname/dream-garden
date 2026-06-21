window.Garden = window.Garden || {};

(function (Garden) {
  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }

  let selectedSeedId = "daisy";
  let selectedPotionId = null;  // when set, next plot click applies this potion
  let catalogOpen = false;
  let settingsOpen = false;
  let shopOpen = false;
  let dailyOpen = false;
  let dailyRecap = null; // recap computed at boot, shown in the Morning Report
  let viewport = "desktop";    // "desktop" | "mobile" — recomputed on every renderAll
  let currentTab = "garden";   // "garden" | "orders" | "shop" | "daily" — mobile only

  // Mobile shape applies when the viewport is narrow (phone) OR short
  // (phone in landscape on a short screen). Otherwise desktop shape.
  function syncViewport() {
    const narrow = window.innerWidth < 768;
    const short = window.innerHeight < 500;
    viewport = (narrow || short) ? "mobile" : "desktop";
  }

  function renderTopBar(state) {
    const xpNeeded = Garden.state.xpForNextLevel(state.level);
    const xpPct = Math.min(100, Math.floor((state.xp / xpNeeded) * 100));
    const exp = Garden.state.nextExpansion(state);
    const totalPlots = state.gridSize * state.gridSize;
    const claimables = Garden.daily ? Garden.daily.claimablesCount(state) : 0;

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
          <button class="icon-btn" data-action="open-daily" title="Daily Report" aria-label="Open daily report">
            ${Garden.svg.CALENDAR_ICON}
            <span>Daily</span>
            ${claimables > 0 ? `<span class="daily-badge">${claimables}</span>` : ""}
          </button>
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
      plotEl.dataset.pot = potId;

      // Layer the active pot SVG as the plot background.
      const potEl = document.createElement("div");
      potEl.className = "plot-pot";
      potEl.innerHTML = Garden.svg.potSvg(potId);
      plotEl.appendChild(potEl);

      if (plot) {
        const stage = Garden.state.getStage(plot, now);
        const content = document.createElement("div");
        content.className = "plot-content";
        const hideFlower = plot.mystery && stage !== "bloomed" && stage !== "wilted";
        content.innerHTML = hideFlower
          ? Garden.svg.mysterySproutSvg(stage)
          : Garden.svg.flowerSvg(plot.flowerId, stage);
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

  function renderInventory(state) {
    const inv = state.inventory || {};
    // Only show owned potions (count > 0). If nothing owned, hide the bar entirely.
    const owned = Garden.POTIONS.filter(p => (inv[p.id] || 0) > 0);
    if (owned.length === 0) return null;

    const hint = selectedPotionId
      ? "Click a plot to apply the selected potion. (Esc to cancel)"
      : "Click a potion to use it on a plot";

    const wrap = el(`
      <div class="inventory-bar ${selectedPotionId ? 'use-mode' : ''}">
        <div class="inventory-label">Potions — ${hint}</div>
        <div class="inventory-list"></div>
      </div>
    `);
    const list = wrap.querySelector(".inventory-list");

    owned.forEach(potion => {
      const count = inv[potion.id] || 0;
      const isSelected = potion.id === selectedPotionId;
      const card = el(`
        <div class="potion-card ${isSelected ? 'selected' : ''}" data-potion-id="${potion.id}" title="${potion.description}">
          <div class="potion-icon">${Garden.svg.potionSvg(potion.id)}</div>
          <div class="potion-info">
            <div class="potion-name">${potion.name}</div>
            <div class="potion-count">×${count}</div>
          </div>
        </div>
      `);
      list.appendChild(card);
    });

    return wrap;
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
            <h3 class="catalog-section-title">Potions</h3>
            <div class="shop-grid" data-section="potions"></div>
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

    // Potions section
    const potionsGrid = overlay.querySelector("[data-section='potions']");
    const inv = state.inventory || {};
    Garden.POTIONS.forEach(potion => {
      const locked = state.level < potion.levelReq;
      const unaffordable = !locked && state.coins < potion.cost;
      const canBuy = !locked && !unaffordable;
      const owned = inv[potion.id] || 0;

      let action;
      if (locked) {
        action = `<span class="shop-status locked">🔒 Lv ${potion.levelReq}</span>`;
      } else {
        action = `<button class="shop-buy-btn" data-action="buy-potion" data-potion-id="${potion.id}" ${canBuy ? "" : "disabled"}>
          Buy <span class="mini-coin"></span>${potion.cost}
        </button>`;
      }

      const card = el(`
        <div class="shop-card ${locked ? "locked-card" : ""} ${unaffordable && !locked ? "unaffordable" : ""}">
          <div class="shop-art">${Garden.svg.potionSvg(potion.id)}</div>
          <div class="shop-info">
            <div class="shop-name">${potion.name} ${owned > 0 ? `<span class="owned-count">×${owned}</span>` : ""}</div>
            <div class="potion-desc">${potion.description}</div>
            ${action}
          </div>
        </div>
      `);
      potionsGrid.appendChild(card);
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
            <label class="setting-row">
              <span>
                <span class="setting-name">Music</span>
                <span class="setting-desc">Cozy background music loop</span>
              </span>
              <input type="checkbox" data-setting="musicOn" ${settings.musicOn ? "checked" : ""}>
            </label>
            <label class="setting-row">
              <span>
                <span class="setting-name">Sound effects</span>
                <span class="setting-desc">Plant, water, harvest, rewards</span>
              </span>
              <input type="checkbox" data-setting="sfxOn" ${settings.sfxOn ? "checked" : ""}>
            </label>
          </section>
        </div>
      </div>
    `);
    return overlay;
  }

  function streakRewardLabel(r) {
    const parts = [];
    if (r.coins) parts.push(r.coins + "c");
    if (r.potionId) {
      const potion = Garden.potionById(r.potionId);
      parts.push(potion ? potion.name : r.potionId);
    }
    if (r.mysterySeed) parts.push("Mystery Seed");
    return parts.join(" + ");
  }

  function renderDailyReport(state) {
    const daily = Garden.daily.ensureDaily(state);
    const today = Garden.daily.todayKey();
    const canClaim = Garden.daily.canClaimStreak(state);
    const canSpinNow = Garden.daily.canSpin(state);
    const nextPos = Garden.daily.nextStreakPosition(daily, today);
    // Highlight the position up next; after claiming, the one just claimed.
    const highlightPos = canClaim ? nextPos : ((daily.streakCount - 1) % Garden.daily.STREAK_REWARDS.length) + 1;

    const overlay = el(`
      <div class="modal-overlay" data-action="daily-backdrop">
        <div class="modal-content daily-modal">
          <header class="modal-header">
            <h2>☀ Daily Garden Report</h2>
            <button class="modal-close" data-action="close-daily" aria-label="Close">✕</button>
          </header>
          <div class="daily-sections"></div>
          <footer class="daily-footer">
            <button class="shop-buy-btn daily-start-btn" data-action="close-daily">Start gardening</button>
          </footer>
        </div>
      </div>
    `);
    const sections = overlay.querySelector(".daily-sections");

    // --- While you were away ---
    if (dailyRecap && dailyRecap.show) {
      sections.appendChild(el(`
        <section class="daily-section">
          <h3 class="catalog-section-title">While you were away</h3>
          <div class="recap-line">🌸 ${dailyRecap.bloomed} bloomed · 🥀 ${dailyRecap.wilted} wilted · ✓ ${dailyRecap.readyNow} ready now</div>
        </section>
      `));
    }

    // --- Login streak ---
    const streakSec = el(`
      <section class="daily-section">
        <h3 class="catalog-section-title">Login Streak</h3>
        <div class="streak-strip"></div>
        <div class="streak-action"></div>
      </section>
    `);
    const strip = streakSec.querySelector(".streak-strip");
    Garden.daily.STREAK_REWARDS.forEach(r => {
      const current = r.day === highlightPos;
      const done = canClaim ? r.day < highlightPos : r.day <= highlightPos && !current;
      strip.appendChild(el(`
        <div class="streak-cell ${done ? "done" : ""} ${current ? "current" : ""}">
          <div class="streak-day">Day ${r.day}</div>
          <div class="streak-reward">${streakRewardLabel(r)}</div>
          ${done ? '<div class="streak-check">✓</div>' : ""}
        </div>
      `));
    });
    const action = streakSec.querySelector(".streak-action");
    if (canClaim) {
      const r = Garden.daily.STREAK_REWARDS[nextPos - 1];
      action.appendChild(el(
        `<button class="shop-buy-btn" data-action="daily-claim">Claim Day ${nextPos}: ${streakRewardLabel(r)}</button>`
      ));
    } else {
      action.appendChild(el(`<span class="shop-status active">Claimed today ✓ — come back tomorrow</span>`));
    }
    sections.appendChild(streakSec);

    // --- Lucky draw ---
    const drawSec = el(`
      <section class="daily-section">
        <h3 class="catalog-section-title">Lucky Draw</h3>
        <div class="draw-row"></div>
        <div class="draw-action"></div>
      </section>
    `);
    const row = drawSec.querySelector(".draw-row");
    Garden.daily.DRAW_PRIZES.forEach(p => {
      row.appendChild(el(`
        <div class="draw-prize" data-prize-id="${p.id}" title="${p.label}">
          <div class="draw-prize-icon">${Garden.svg.drawPrizeSvg(p.id)}</div>
          <div class="draw-prize-label">${p.label}</div>
        </div>
      `));
    });
    const drawAction = drawSec.querySelector(".draw-action");
    if (canSpinNow) {
      drawAction.appendChild(el(`<button class="shop-buy-btn" data-action="daily-spin">🎰 Spin (free today)</button>`));
    } else {
      drawAction.appendChild(el(`<span class="shop-status">Spun today — come back tomorrow</span>`));
    }
    sections.appendChild(drawSec);

    return overlay;
  }

  function renderQuests(state) {
    const quests = (state.quests || []);
    if (quests.length === 0) return null;
    const fresh = quests.every(q => q.progress === 0);
    const today = Garden.daily ? Garden.daily.todayKey() : null;
    const chestDone = !!(state.daily && state.daily.chestDay === today);

    const wrap = el(`
      <div class="quests-bar">
        <div class="quests-label">Daily Orders${fresh ? ' <span class="new-badge">NEW</span>' : ""}</div>
        <div class="quests-list"></div>
        <div class="quest-chest ${chestDone ? "chest-open" : ""}" title="Complete all 3 daily orders for a bonus chest">
          <div class="chest-icon">${Garden.svg.CHEST_ICON}</div>
          <div class="chest-text">${chestDone ? "Chest claimed! ✓" : "Complete all 3 for a bonus chest"}</div>
        </div>
      </div>
    `);
    const list = wrap.querySelector(".quests-list");

    quests.forEach(q => {
      const flower = Garden.flowerById(q.flowerId);
      if (!flower) return; // defensive
      const done = q.progress >= q.target;
      const pct = Math.min(100, Math.floor((q.progress / q.target) * 100));
      const card = el(`
        <div class="quest-card ${done ? "quest-done" : ""}">
          <div class="quest-icon">${Garden.svg.flowerIcon(q.flowerId)}</div>
          <div class="quest-info">
            <div class="quest-text">Deliver ${q.target} ${pluralize(flower.name, q.target)}</div>
            <div class="quest-progress-bar"><div class="quest-progress-fill" style="width:${pct}%"></div></div>
            <div class="quest-count">${q.progress}/${q.target}</div>
          </div>
          ${done ? '<div class="quest-done-check">✓</div>' : ""}
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

    const mysteryCount = (state.inventory && state.inventory.mysterySeed) || 0;
    if (mysteryCount > 0) {
      const card = document.createElement("div");
      card.className = "seed-card mystery-seed" + (selectedSeedId === "mysterySeed" ? " selected" : "");
      card.dataset.flowerId = "mysterySeed";
      card.innerHTML = `
        <div class="seed-icon">${Garden.svg.MYSTERY_ICON}</div>
        <div class="seed-info">
          <div class="seed-name">Mystery</div>
          <span class="seed-cost">×${mysteryCount} · free</span>
        </div>
      `;
      seedsEl.appendChild(card);
    }

    return wrap;
  }

  function renderDailyPreview(state) {
    if (!Garden.daily) return null;
    const claimables = Garden.daily.claimablesCount(state);
    const wrap = document.createElement("div");
    wrap.className = "daily-preview";
    wrap.setAttribute("data-action", "open-daily");
    const day = (state.daily && state.daily.streakCount) ? (state.daily.streakCount % 7) + 1 : 1;
    let html = '<div class="dp-line"><b>Day ' + day + '</b> of 7-day streak</div>';
    if (claimables > 0) {
      html += '<div class="dp-line">⚡ ' + claimables + ' to claim — click to open</div>';
    } else {
      html += '<div class="dp-line">All caught up today.</div>';
    }
    wrap.innerHTML = html;
    return wrap;
  }

  function renderDesktopBody(state) {
    const app = document.getElementById("app");

    // Top bar spans all three columns.
    app.appendChild(renderTopBar(state));

    // Left column: seeds + inventory (potions).
    // renderShelf and renderInventory each carry their own internal label —
    // no extra section chip needed here.
    const left = document.createElement("div");
    left.className = "desktop-left";
    left.appendChild(renderShelf(state));
    const invEl = renderInventory(state);
    if (invEl) left.appendChild(invEl);
    app.appendChild(left);

    // Center column: garden grid + decoration strip below.
    const center = document.createElement("div");
    center.className = "desktop-center";
    const gardenEl = renderGrid(state);
    if (selectedPotionId) gardenEl.classList.add("potion-use-mode");
    center.appendChild(gardenEl);
    const decoZone = renderDecorationZone(state);
    if (decoZone) center.appendChild(decoZone);
    app.appendChild(center);

    // Right column: quests + daily preview.
    // renderQuests carries its own "Daily Orders" label; daily-preview block
    // does not, so we keep the chip above it for visual grouping.
    const right = document.createElement("div");
    right.className = "desktop-right";
    const questsEl = renderQuests(state);
    if (questsEl) right.appendChild(questsEl);
    const dailyLabel = document.createElement("div");
    dailyLabel.className = "desktop-section-label";
    dailyLabel.textContent = "Daily";
    right.appendChild(dailyLabel);
    const dpEl = renderDailyPreview(state);
    if (dpEl) right.appendChild(dpEl);
    app.appendChild(right);

    // Overlays (Catalog, Settings, Shop, Daily modal) on top.
    if (catalogOpen) app.appendChild(renderCatalog(state));
    if (settingsOpen) app.appendChild(renderSettings(state));
    if (shopOpen) app.appendChild(renderShop(state));
    if (dailyOpen) app.appendChild(renderDailyReport(state));
  }

  function renderTabBar(state) {
    const claimables = Garden.daily ? Garden.daily.claimablesCount(state) : 0;
    const questsAdvancing = Array.isArray(state.quests)
      ? state.quests.some(q => q && q.progress > 0 && q.progress < q.target)
      : false;

    const bar = document.createElement("div");
    bar.className = "tab-bar";

    const tabs = [
      { id: "garden", icon: "🌱", label: "Garden", badge: null },
      { id: "orders", icon: "📋", label: "Orders", badge: questsAdvancing ? "•" : null },
      { id: "shop",   icon: "🛒", label: "Shop",   badge: null },
      { id: "daily",  icon: "📅", label: "Daily",  badge: claimables > 0 ? String(claimables) : null },
    ];

    for (const t of tabs) {
      const btn = document.createElement("button");
      btn.className = "tab-button" + (currentTab === t.id ? " active" : "");
      btn.setAttribute("data-action", "switch-tab");
      btn.setAttribute("data-tab", t.id);
      let html = '<span class="tb-icon" aria-hidden="true">' + t.icon + '</span><span>' + t.label + '</span>';
      if (t.badge) html += '<span class="tb-badge">' + t.badge + '</span>';
      btn.innerHTML = html;
      bar.appendChild(btn);
    }
    return bar;
  }

  function renderMobileBody(state) {
    const app = document.getElementById("app");
    app.appendChild(renderTopBar(state));

    const panel = document.createElement("div");
    panel.className = "tab-panel tab-panel-" + currentTab;

    if (currentTab === "garden") {
      panel.appendChild(renderShelf(state));
      const gardenEl = renderGrid(state);
      if (selectedPotionId) gardenEl.classList.add("potion-use-mode");
      panel.appendChild(gardenEl);
      const invEl = renderInventory(state);
      if (invEl) panel.appendChild(invEl);
      const decoZone = renderDecorationZone(state);
      if (decoZone) panel.appendChild(decoZone);
    } else if (currentTab === "orders") {
      const questsEl = renderQuests(state);
      if (questsEl) panel.appendChild(questsEl);
    } else if (currentTab === "shop") {
      // Reuse the modal renderer, then pluck out its inner content so it
      // displays inline in the tab panel instead of as an overlay.
      const shopOverlay = renderShop(state);
      const shopContent = shopOverlay.querySelector(".modal-content");
      if (shopContent) {
        shopContent.classList.add("tab-embedded");
        panel.appendChild(shopContent);
      } else {
        panel.appendChild(shopOverlay);  // defensive — fall back to overlay if structure changes
      }
    } else if (currentTab === "daily") {
      const dailyOverlay = renderDailyReport(state);
      const dailyContent = dailyOverlay.querySelector(".modal-content");
      if (dailyContent) {
        dailyContent.classList.add("tab-embedded");
        panel.appendChild(dailyContent);
      } else {
        panel.appendChild(dailyOverlay);
      }
    }

    app.appendChild(panel);
    app.appendChild(renderTabBar(state));

    // Catalog and Settings are overlay modals on both shapes. Shop and Daily
    // live as tabs on mobile — their overlay versions are never rendered here
    // (handlers below switch tabs on mobile instead of setting shopOpen/dailyOpen).
    if (catalogOpen) app.appendChild(renderCatalog(state));
    if (settingsOpen) app.appendChild(renderSettings(state));
  }

  function renderAll(state) {
    currentState = state;

    // Ensure selectedSeedId is still valid; otherwise pick the first unlocked.
    if (selectedSeedId === "mysterySeed") {
      const count = (state.inventory && state.inventory.mysterySeed) || 0;
      if (count <= 0) selectedSeedId = null;
    } else {
      const selectedFlower = Garden.flowerById(selectedSeedId);
      if (!selectedFlower || state.level < selectedFlower.levelReq) selectedSeedId = null;
    }
    if (!selectedSeedId) {
      const firstUnlocked = Garden.FLOWERS.find(f => state.level >= f.levelReq);
      selectedSeedId = firstUnlocked ? firstUnlocked.id : null;
    }

    syncViewport();
    const app = document.getElementById("app");
    app.innerHTML = "";
    app.className = viewport === "mobile" ? "shape-mobile" : "shape-desktop";
    if (viewport === "desktop") {
      renderDesktopBody(state);
    } else {
      renderMobileBody(state);
    }
  }

  let currentState = null;

  function setupHandlers() {
    const app = document.getElementById("app");

    // Re-render on resize so the shape (desktop vs mobile) tracks the viewport.
    // Debounce so dragging the window edge does not thrash.
    let resizeTimer = null;
    window.addEventListener("resize", () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (currentState) renderAll(currentState);
      }, 150);
    });

    app.addEventListener("click", (ev) => {
      if (!currentState) return;

      const tabBtn = ev.target.closest("[data-action='switch-tab']");
      if (tabBtn) {
        const next = tabBtn.dataset.tab;
        if (next && next !== currentTab) {
          if (Garden.audio) Garden.audio.playSfx("ui-click");
          currentTab = next;
          renderAll(currentState);
        }
        return;
      }

      // Catalog: open / close / backdrop
      if (ev.target.closest("[data-action='open-catalog']")) {
        if (Garden.audio) Garden.audio.playSfx("ui-click");
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
        if (Garden.audio) Garden.audio.playSfx("ui-click");
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
        if (Garden.audio) Garden.audio.playSfx("ui-click");
        if (viewport === "mobile") {
          currentTab = "shop";
        } else {
          shopOpen = true;
        }
        renderAll(currentState);
        return;
      }
      if (ev.target.closest("[data-action='close-shop']")) {
        if (viewport === "mobile") {
          currentTab = "garden";
        } else {
          shopOpen = false;
        }
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
      const buyPotionBtn = ev.target.closest("[data-action='buy-potion']");
      if (buyPotionBtn && !buyPotionBtn.disabled) {
        const potionId = buyPotionBtn.dataset.potionId;
        const result = Garden.state.buyPotion(currentState, potionId);
        if (result.ok && Garden.fx) {
          const potion = Garden.potionById(potionId);
          Garden.fx.toast("Bought " + potion.name + ".", { variant: "level" });
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

      // Daily report: open / close / backdrop / claim / spin
      if (ev.target.closest("[data-action='open-daily']")) {
        if (Garden.audio) Garden.audio.playSfx("ui-click");
        dailyRecap = null;
        if (viewport === "mobile") {
          currentTab = "daily";
        } else {
          dailyOpen = true;
        }
        renderAll(currentState);
        return;
      }
      if (ev.target.closest("[data-action='close-daily']")) {
        if (viewport === "mobile") {
          currentTab = "garden";
        } else {
          dailyOpen = false;
        }
        renderAll(currentState);
        return;
      }
      const dailyBackdrop = ev.target.closest("[data-action='daily-backdrop']");
      if (dailyBackdrop && !ev.target.closest(".modal-content")) {
        dailyOpen = false;
        renderAll(currentState);
        return;
      }
      const claimBtn = ev.target.closest("[data-action='daily-claim']");
      if (claimBtn) {
        const result = Garden.daily.claimStreak(currentState);
        if (result.ok && Garden.fx) {
          Garden.fx.toast("Day " + result.position + " reward: " + streakRewardLabel(result.reward), { variant: "level" });
        }
        Garden.storage.save(currentState);
        renderAll(currentState);
        return;
      }
      const spinBtn = ev.target.closest("[data-action='daily-spin']");
      if (spinBtn && !spinBtn.disabled) {
        const result = Garden.daily.spinDraw(currentState);
        if (!result.ok) return;
        Garden.storage.save(currentState);
        spinBtn.disabled = true;
        // Cycling-highlight animation (~1.5-2s) that lands on the won prize.
        // Nodes are re-queried every step: tick() may rebuild the modal mid-spin.
        const target = Garden.daily.DRAW_PRIZES.findIndex(p => p.id === result.prizeId);
        const steps = 12 + (target >= 0 ? target : 0);
        let i = 0;
        const finish = () => {
          const msg = result.coins
            ? "+" + result.coins + " coins!"
            : "You won: " + result.label + "!";
          if (Garden.fx) Garden.fx.toast("Lucky draw: " + msg, { variant: "rare" });
        };
        const timer = setInterval(() => {
          const icons = Array.from(document.querySelectorAll(".draw-prize"));
          if (!dailyOpen || icons.length === 0) {
            // Modal closed mid-spin — skip the show, just announce the prize.
            clearInterval(timer);
            finish();
            renderAll(currentState);
            return;
          }
          icons.forEach(n => n.classList.remove("spin-active"));
          icons[i % icons.length].classList.add("spin-active");
          if (i >= steps) {
            clearInterval(timer);
            finish();
            // Leave the winner highlighted briefly before the rerender wipes it.
            setTimeout(() => renderAll(currentState), 900);
          }
          i++;
        }, 120);
        return;
      }

      // When any modal is open, swallow other clicks.
      if (catalogOpen || settingsOpen || shopOpen || dailyOpen) return;

      // Potion inventory click — toggle use-mode
      const potionEl = ev.target.closest(".potion-card");
      if (potionEl) {
        const potionId = potionEl.dataset.potionId;
        selectedPotionId = (selectedPotionId === potionId) ? null : potionId;
        renderAll(currentState);
        return;
      }

      // Plot click
      const plotEl = ev.target.closest(".plot");
      if (plotEl) {
        const idx = Number(plotEl.dataset.idx);
        handlePlotClick(idx);
        return;
      }

      // Seed shelf click — selecting a seed cancels potion use mode
      const seedEl = ev.target.closest(".seed-card");
      if (seedEl && !seedEl.classList.contains("locked")) {
        selectedSeedId = seedEl.dataset.flowerId;
        selectedPotionId = null;
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

    // Esc closes whichever modal is open, or cancels potion use mode
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
      } else if (dailyOpen) {
        dailyOpen = false;
        if (currentState) renderAll(currentState);
      } else if (selectedPotionId) {
        selectedPotionId = null;
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

    // Potion use mode takes precedence over the normal plant/water/sun/harvest flow.
    if (selectedPotionId) {
      const result = Garden.state.usePotion(state, idx, selectedPotionId);
      if (result.ok) {
        const potion = Garden.potionById(selectedPotionId);
        if (Garden.fx) Garden.fx.toast((potion ? potion.name : "Potion") + " applied!", { variant: "level" });
        selectedPotionId = null; // exit use mode on success
      } else if (Garden.fx) {
        // Stay in use mode — let the player click a valid target instead.
        const msg = result.reason === "not-growing"
          ? "Speed Potion only works on growing flowers."
          : result.reason === "not-wilted"
          ? "Revival Potion only works on wilted flowers."
          : "Can't use here.";
        Garden.fx.toast(msg, { variant: "quest" });
      }
      Garden.storage.save(state);
      renderAll(state);
      return;
    }

    let harvestResult = null;
    let plotRect = null;

    if (!plot) {
      if (!selectedSeedId) return;
      if (selectedSeedId === "mysterySeed") {
        Garden.state.plantMystery(state, idx);
      } else {
        Garden.state.plant(state, idx, selectedSeedId);
      }
      if (Garden.audio) Garden.audio.playSfx("plant");
    } else {
      const stage = Garden.state.getStage(plot, now);
      if (stage === "seed") {
        Garden.state.water(state, idx);
        if (Garden.audio) Garden.audio.playSfx("water");
      }
      else if (stage === "watered") {
        Garden.state.sun(state, idx);
        if (Garden.audio) Garden.audio.playSfx("sun");
      }
      else if (stage === "bloomed") {
        // Capture position BEFORE the DOM is torn down by renderAll,
        // so the floating numbers can spawn at the right spot.
        const plotEls = document.querySelectorAll(".plot");
        if (plotEls[idx]) plotRect = plotEls[idx].getBoundingClientRect();
        harvestResult = Garden.state.harvest(state, idx);
        if (Garden.audio) Garden.audio.playSfx("harvest");
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
      if (Garden.audio) Garden.audio.playSfx("quest-complete");
    }
    if (result.chestAwarded && Garden.fx) {
      const potion = Garden.potionById(result.chestAwarded.potionId);
      Garden.fx.toast(
        "Daily chest! +" + result.chestAwarded.coins + "c and a " + (potion ? potion.name : "potion"),
        { variant: "rare" }
      );
      if (Garden.audio) Garden.audio.playSfx("chest");
    }
    if (result.leveledUp && Garden.fx) {
      const newUnlock = Garden.FLOWERS.find(f => f.levelReq === result.newLevel);
      const text = newUnlock
        ? "Level " + result.newLevel + "! " + newUnlock.name + " unlocked."
        : "Level " + result.newLevel + " reached!";
      Garden.fx.toast(text, { variant: "level" });
      if (Garden.audio) Garden.audio.playSfx("level-up");
    }
  }

  Garden.render = {
    renderAll, renderTopBar, renderGrid, renderShelf, renderQuests, renderInventory,
    renderDecorationZone, renderShop, renderSettings, renderCatalog, setupHandlers,
    setSelectedSeedId: (id) => { selectedSeedId = id; },
    getSelectedSeedId: () => selectedSeedId,
    openDailyReport: (recap) => {
      dailyRecap = recap || null;
      // On mobile the Daily content lives in a tab — switch to it instead
      // of stacking a modal on top of the tab panel.
      syncViewport();
      if (viewport === "mobile") {
        currentTab = "daily";
      } else {
        dailyOpen = true;
      }
    },
  };
})(window.Garden);
