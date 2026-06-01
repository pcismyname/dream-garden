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
    };
  }

  // Returns "seed" | "watered" | "growing" | "bloomed" for a non-null plot.
  function getStage(plot, now) {
    if (!plot) return null;
    if (plot.stage === "seed") return "seed";
    if (plot.stage === "watered") return "watered";
    // plot.stage === "sunned"
    if (plot.bloomAt == null) return "growing"; // defensive; shouldn't happen
    return now >= plot.bloomAt ? "bloomed" : "growing";
  }

  function plant(state, plotIdx, flowerId) {
    if (plotIdx < 0 || plotIdx >= state.plots.length) return { ok: false, reason: "bad-index" };
    if (state.plots[plotIdx] !== null) return { ok: false, reason: "occupied" };
    const flower = Garden.flowerById(flowerId);
    if (!flower) return { ok: false, reason: "unknown-flower" };
    if (state.level < flower.levelReq) return { ok: false, reason: "locked" };
    if (state.coins < flower.seedCost) return { ok: false, reason: "broke" };

    state.coins -= flower.seedCost;
    state.plots[plotIdx] = {
      flowerId: flower.id,
      stage: "seed",
      plantedAt: Date.now(),
      bloomAt: null,
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

    state.coins += flower.sellPrice;
    state.xp += Math.floor(flower.sellPrice / 5);
    state.plots[plotIdx] = null;

    let leveledUp = false;
    while (state.xp >= xpForNextLevel(state.level)) {
      state.xp -= xpForNextLevel(state.level);
      state.level += 1;
      leveledUp = true;
    }
    return { ok: true, leveledUp };
  }

  Garden.state = { createInitialState, getStage, plant, water, sun, harvest, xpForNextLevel };
})(window.Garden);
