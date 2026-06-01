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

  Garden.state = { createInitialState, getStage };
})(window.Garden);
