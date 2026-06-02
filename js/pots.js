window.Garden = window.Garden || {};

// Pot skins — purely cosmetic visual variants for the planting plots.
// Terracotta is owned by default at game start.
window.Garden.POTS = [
  { id: "terracotta", name: "Terracotta",    levelReq: 1, cost: 0    }, // default
  { id: "barrel",     name: "Wooden Barrel", levelReq: 2, cost: 200  },
  { id: "ceramic",    name: "Ceramic Blue",  levelReq: 4, cost: 500  },
  { id: "stone",      name: "Stone Planter", levelReq: 6, cost: 1000 },
  { id: "vase",       name: "Ornate Vase",   levelReq: 9, cost: 2500 },
];

window.Garden.DEFAULT_POT = "terracotta";

window.Garden.potById = function (id) {
  return window.Garden.POTS.find(p => p.id === id) || null;
};
