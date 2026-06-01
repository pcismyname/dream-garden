window.Garden = window.Garden || {};

(function (Garden) {
  const VERSION = 1;

  function createInitialState() {
    return {
      version: VERSION,
      coins: 100,
      xp: 0,
      level: 1,
      gridSize: 3,
      plots: new Array(9).fill(null),
      plantCounts: {},   // { flowerId: int } — counts plantings of NORMAL flowers
      discovered: {},    // { rareFlowerId: true } — rares the player has grown
    };
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

    state.coins += flower.sellPrice;
    state.xp += Math.floor(flower.sellPrice / 5);
    state.plots[plotIdx] = null;

    let leveledUp = false;
    while (state.xp >= xpForNextLevel(state.level)) {
      state.xp -= xpForNextLevel(state.level);
      state.level += 1;
      leveledUp = true;
    }
    return { ok: true, leveledUp, rare: !!flower.rare };
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
    createInitialState, getStage, plant, water, sun, harvest, clear,
    xpForNextLevel, expandGrid, nextExpansion, GRID_EXPANSIONS,
  };
})(window.Garden);
