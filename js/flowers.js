window.Garden = window.Garden || {};

window.Garden.FLOWERS = [
  { id: "daisy",       name: "Daisy",       levelReq: 1,  seedCost: 5,   sellPrice: 12,   growMs: 10000  },
  { id: "tulip",       name: "Tulip",       levelReq: 2,  seedCost: 15,  sellPrice: 35,   growMs: 20000  },
  { id: "rose",        name: "Rose",        levelReq: 4,  seedCost: 40,  sellPrice: 90,   growMs: 35000  },
  { id: "jasmine",     name: "Jasmine",     levelReq: 7,  seedCost: 90,  sellPrice: 200,  growMs: 60000  },
  { id: "sunflower",   name: "Sunflower",   levelReq: 10, seedCost: 200, sellPrice: 450,  growMs: 90000  },
  { id: "calceolaria", name: "Calceolaria", levelReq: 14, seedCost: 450, sellPrice: 1000, growMs: 120000 },
];

window.Garden.flowerById = function (id) {
  return window.Garden.FLOWERS.find(f => f.id === id) || null;
};
