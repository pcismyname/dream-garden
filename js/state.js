window.Garden = window.Garden || {};

(function (Garden) {
  const VERSION = 1;

  function createInitialState() {
    const s = {
      version: VERSION,
      coins: 100,
      xp: 0,
      level: 1,
      gridSize: 3,
      plots: new Array(9).fill(null),
      plantCounts: {},   // { flowerId: int } — counts plantings of NORMAL flowers
      discovered: {},    // { rareFlowerId: true } — rares the player has grown
      quests: [],
      settings: { floatingNumbers: true, musicOn: true, sfxOn: true },
      decorations: new Array(Garden.DECORATION_SLOTS).fill(null),
      ownedPots: [Garden.DEFAULT_POT],
      activePotId: Garden.DEFAULT_POT,
      inventory: {},
      daily: Garden.daily ? Garden.daily.defaultDaily() : null,
    };
    for (let i = 0; i < 3; i++) s.quests.push(generateQuest(s));
    return s;
  }

  function buyPotion(state, potionId) {
    const potion = Garden.potionById(potionId);
    if (!potion) return { ok: false, reason: "unknown" };
    if (state.level < potion.levelReq) return { ok: false, reason: "locked" };
    if (state.coins < potion.cost) return { ok: false, reason: "broke" };
    if (!state.inventory) state.inventory = {};
    state.coins -= potion.cost;
    state.inventory[potionId] = (state.inventory[potionId] || 0) + 1;
    return { ok: true };
  }

  function usePotion(state, plotIdx, potionId) {
    if (!state.inventory || !state.inventory[potionId]) {
      return { ok: false, reason: "no-potion" };
    }
    const plot = state.plots[plotIdx];
    if (!plot) return { ok: false, reason: "empty-plot" };

    const now = Date.now();
    const stage = getStage(plot, now);

    if (potionId === "speedPotion") {
      if (stage !== "growing") return { ok: false, reason: "not-growing" };
      // Subtract 15s from the bloom timer. Don't push below current time
      // (that would make it bloomed but with arbitrary bloomAt history).
      plot.bloomAt = Math.max(now, plot.bloomAt - Garden.SPEED_POTION_MS);
      state.inventory[potionId] = Math.max(0, state.inventory[potionId] - 1);
      return { ok: true };
    }

    if (potionId === "revivalPotion") {
      if (stage !== "wilted") return { ok: false, reason: "not-wilted" };
      // Restore to freshly bloomed: full wilt window remaining.
      plot.bloomAt = now;
      state.inventory[potionId] = Math.max(0, state.inventory[potionId] - 1);
      return { ok: true };
    }

    return { ok: false, reason: "unknown-potion" };
  }

  function buyPot(state, potId) {
    const pot = Garden.potById(potId);
    if (!pot) return { ok: false, reason: "unknown" };
    if (state.level < pot.levelReq) return { ok: false, reason: "locked" };
    if (!Array.isArray(state.ownedPots)) state.ownedPots = [Garden.DEFAULT_POT];
    if (state.ownedPots.includes(potId)) return { ok: false, reason: "already-owned" };
    if (state.coins < pot.cost) return { ok: false, reason: "broke" };
    state.coins -= pot.cost;
    state.ownedPots.push(potId);
    return { ok: true };
  }

  function setActivePot(state, potId) {
    if (!Array.isArray(state.ownedPots) || !state.ownedPots.includes(potId)) {
      return { ok: false, reason: "not-owned" };
    }
    state.activePotId = potId;
    return { ok: true };
  }

  function buyDecoration(state, decorationId) {
    const dec = Garden.decorationById(decorationId);
    if (!dec) return { ok: false, reason: "unknown" };
    if (state.level < dec.levelReq) return { ok: false, reason: "locked" };
    if (state.coins < dec.cost) return { ok: false, reason: "broke" };
    if (!Array.isArray(state.decorations)) {
      state.decorations = new Array(Garden.DECORATION_SLOTS).fill(null);
    }
    const slot = state.decorations.findIndex(s => s == null);
    if (slot === -1) return { ok: false, reason: "full" };
    state.coins -= dec.cost;
    state.decorations[slot] = dec.id;
    return { ok: true, slot };
  }

  function removeDecoration(state, slotIdx) {
    if (!Array.isArray(state.decorations)) return { ok: false, reason: "empty" };
    const id = state.decorations[slotIdx];
    if (id == null) return { ok: false, reason: "empty" };
    const dec = Garden.decorationById(id);
    state.decorations[slotIdx] = null;
    const refund = dec ? Math.floor(dec.cost * Garden.DECORATION_REFUND_PCT) : 0;
    state.coins += refund;
    return { ok: true, refund };
  }

  // Random quest: deliver N of an unlocked flower. Always picks from currently-unlocked
  // normal flowers (not rares — those can't be bought).
  function generateQuest(state) {
    const unlocked = Garden.FLOWERS.filter(f => state.level >= f.levelReq);
    const pool = unlocked.length > 0 ? unlocked : [Garden.FLOWERS[0]]; // defensive
    const flower = pool[Math.floor(Math.random() * pool.length)];
    const target = 2 + Math.floor(Math.random() * 4); // 2-5 inclusive
    return { flowerId: flower.id, target, progress: 0 };
  }

  // Returns "seed" | "watered" | "growing" | "bloomed" | "wilted" for a non-null plot.
  // Stage progression: seed → watered → sunned → (timer) → growing → bloomed → wilted.
  // Wilt window equals the flower's grow time (per source 1's rose example: 4h grow, 4h wilt).
  function getStage(plot, now) {
    if (!plot) return null;
    if (plot.stage === "seed") return "seed";
    if (plot.stage === "watered") return "watered";
    // plot.stage === "sunned"
    if (plot.bloomAt == null) return "growing"; // defensive
    if (now < plot.bloomAt) return "growing";
    const flower = Garden.flowerById(plot.flowerId);
    if (!flower) return "bloomed"; // defensive
    const wiltAt = plot.bloomAt + flower.growMs;
    if (now < wiltAt) return "bloomed";
    return "wilted";
  }

  function plant(state, plotIdx, flowerId) {
    if (plotIdx < 0 || plotIdx >= state.plots.length) return { ok: false, reason: "bad-index" };
    if (state.plots[plotIdx] !== null) return { ok: false, reason: "occupied" };
    const flower = Garden.flowerById(flowerId);
    if (!flower) return { ok: false, reason: "unknown-flower" };
    if (flower.rare) return { ok: false, reason: "rare-not-plantable" };
    if (state.level < flower.levelReq) return { ok: false, reason: "locked" };
    if (state.coins < flower.seedCost) return { ok: false, reason: "broke" };

    state.coins -= flower.seedCost;

    // Track plantings for rare-spawn logic.
    if (!state.plantCounts) state.plantCounts = {};
    state.plantCounts[flowerId] = (state.plantCounts[flowerId] || 0) + 1;

    // Every Nth planting of a flower with a rare cousin spawns the rare instead.
    let actualFlowerId = flowerId;
    let rareSpawned = false;
    const rare = Garden.rareForParent(flowerId);
    if (rare && state.plantCounts[flowerId] % rare.interval === 0) {
      actualFlowerId = rare.id;
      if (!state.discovered) state.discovered = {};
      state.discovered[rare.id] = true;
      rareSpawned = true;
    }

    state.plots[plotIdx] = {
      flowerId: actualFlowerId,
      stage: "seed",
      plantedAt: Date.now(),
      bloomAt: null,
    };
    return { ok: true, rareSpawned };
  }

  // Plant a mystery seed: the real flower is resolved NOW but hidden ("?")
  // until bloom. Bypasses plantCounts and the every-Nth rare interval by design.
  function plantMystery(state, plotIdx) {
    if (plotIdx < 0 || plotIdx >= state.plots.length) return { ok: false, reason: "bad-index" };
    if (state.plots[plotIdx] !== null) return { ok: false, reason: "occupied" };
    if (!state.inventory || !(state.inventory.mysterySeed > 0)) return { ok: false, reason: "no-seed" };

    const unlocked = Garden.FLOWERS.filter(f => state.level >= f.levelReq);
    const base = unlocked[Math.floor(Math.random() * unlocked.length)];
    let flowerId = base.id;
    const rare = Garden.rareForParent(base.id);
    if (rare && Math.random() < 0.25) flowerId = rare.id;

    state.inventory.mysterySeed -= 1;
    state.plots[plotIdx] = {
      flowerId,
      stage: "seed",
      plantedAt: Date.now(),
      bloomAt: null,
      mystery: true,
    };
    return { ok: true };
  }

  function water(state, plotIdx) {
    const plot = state.plots[plotIdx];
    if (!plot) return { ok: false, reason: "empty" };
    if (plot.stage !== "seed") return { ok: false, reason: "wrong-stage" };
    plot.stage = "watered";
    return { ok: true };
  }

  function sun(state, plotIdx) {
    const plot = state.plots[plotIdx];
    if (!plot) return { ok: false, reason: "empty" };
    if (plot.stage !== "watered") return { ok: false, reason: "wrong-stage" };
    const flower = Garden.flowerById(plot.flowerId);
    plot.stage = "sunned";
    plot.bloomAt = Date.now() + flower.growMs;
    return { ok: true };
  }

  function xpForNextLevel(level) {
    return level * level * 50;
  }

  function harvest(state, plotIdx) {
    const plot = state.plots[plotIdx];
    if (!plot) return { ok: false, reason: "empty" };
    const stage = getStage(plot, Date.now());
    if (stage !== "bloomed") return { ok: false, reason: "not-ready" };
    const flower = Garden.flowerById(plot.flowerId);

    const coinsGained = flower.sellPrice;
    const xpGained = Math.floor(flower.sellPrice / 5);
    state.coins += coinsGained;
    state.xp += xpGained;
    state.plots[plotIdx] = null;

    // Daily quest progress: harvesting a rare counts toward its parent's quest.
    // Quests do NOT regenerate on completion — they refresh once per day (js/daily.js).
    if (!state.quests) state.quests = [];
    const parentId = flower.parentId || flower.id;
    let questCompleted = null;
    let chestAwarded = null;
    const qIdx = state.quests.findIndex(q => q.flowerId === parentId && q.progress < q.target);
    if (qIdx >= 0) {
      state.quests[qIdx].progress += 1;
      if (state.quests[qIdx].progress >= state.quests[qIdx].target) {
        const q = state.quests[qIdx];
        const qFlower = Garden.flowerById(q.flowerId);
        // 1.5x the old rolling-quest bonuses — daily quests are scarcer (3/day).
        const coinBonus = Math.round(q.target * qFlower.sellPrice * 0.75);
        const xpBonus = Math.round((10 + q.target * Math.floor(qFlower.sellPrice / 10)) * 1.5);
        state.coins += coinBonus;
        state.xp += xpBonus;
        questCompleted = { flowerId: q.flowerId, target: q.target, coinBonus, xpBonus };

        // All-3 chest: once per day, when the third quest completes.
        const allDone = state.quests.every(qq => qq.progress >= qq.target);
        const today = Garden.daily ? Garden.daily.todayKey() : null;
        if (allDone && today && state.daily && state.daily.chestDay !== today) {
          state.daily.chestDay = today;
          const chestCoins = 100 + state.level * 25;
          const chestPotionId = Math.random() < 0.5 ? "speedPotion" : "revivalPotion";
          if (!state.inventory) state.inventory = {};
          state.inventory[chestPotionId] = (state.inventory[chestPotionId] || 0) + 1;
          state.coins += chestCoins;
          chestAwarded = { coins: chestCoins, potionId: chestPotionId };
        }
      }
    }

    let leveledUp = false;
    while (state.xp >= xpForNextLevel(state.level)) {
      state.xp -= xpForNextLevel(state.level);
      state.level += 1;
      leveledUp = true;
    }
    return {
      ok: true,
      coinsGained,
      xpGained,
      leveledUp,
      newLevel: state.level,
      rare: !!flower.rare,
      questCompleted,
      chestAwarded,
    };
  }

  // Click a wilted plot to compost it. No reward — seed cost is already lost.
  function clear(state, plotIdx) {
    const plot = state.plots[plotIdx];
    if (!plot) return { ok: false, reason: "empty" };
    const stage = getStage(plot, Date.now());
    if (stage !== "wilted") return { ok: false, reason: "not-wilted" };
    state.plots[plotIdx] = null;
    return { ok: true };
  }

  const GRID_EXPANSIONS = [
    { from: 3, to: 4, cost: 500,  minLevel: 5  },
    { from: 4, to: 5, cost: 2000, minLevel: 10 },
  ];

  function nextExpansion(state) {
    return GRID_EXPANSIONS.find(e => e.from === state.gridSize) || null;
  }

  function expandGrid(state) {
    const exp = nextExpansion(state);
    if (!exp) return { ok: false, reason: "max-size" };
    if (state.level < exp.minLevel) return { ok: false, reason: "locked" };
    if (state.coins < exp.cost) return { ok: false, reason: "broke" };

    state.coins -= exp.cost;
    state.gridSize = exp.to;
    const newLen = exp.to * exp.to;
    while (state.plots.length < newLen) state.plots.push(null);
    return { ok: true };
  }

  Garden.state = {
    createInitialState, getStage, plant, plantMystery, water, sun, harvest, clear,
    xpForNextLevel, expandGrid, nextExpansion, GRID_EXPANSIONS,
    generateQuest,
    buyDecoration, removeDecoration,
    buyPot, setActivePot,
    buyPotion, usePotion,
  };
})(window.Garden);
