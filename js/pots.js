window.Garden = window.Garden || {};

// Tile + pot skins for the planting plots.
// "dirt" is the free default — a plain soil patch. Everything else is a
// decorative pot the player buys from the Shop.
window.Garden.POTS = [
  { id: "dirt",       name: "Dirt Patch",    levelReq: 1, cost: 0    }, // free default
  { id: "terracotta", name: "Terracotta",    levelReq: 1, cost: 150  },
  { id: "barrel",     name: "Wooden Barrel", levelReq: 2, cost: 350  },
  { id: "ceramic",    name: "Ceramic Blue",  levelReq: 4, cost: 700  },
  { id: "stone",      name: "Stone Planter", levelReq: 6, cost: 1300 },
  { id: "vase",       name: "Ornate Vase",   levelReq: 9, cost: 2500 },
];

window.Garden.DEFAULT_POT = "dirt";

window.Garden.potById = function (id) {
  return window.Garden.POTS.find(p => p.id === id) || null;
};
