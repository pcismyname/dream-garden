window.Garden = window.Garden || {};

window.Garden.FLOWERS = [
  { id: "daisy",       name: "Daisy",       levelReq: 1,  seedCost: 5,    sellPrice: 12,   growMs: 10000  },
  { id: "tulip",       name: "Tulip",       levelReq: 2,  seedCost: 15,   sellPrice: 35,   growMs: 20000  },
  { id: "marigold",    name: "Marigold",    levelReq: 3,  seedCost: 25,   sellPrice: 60,   growMs: 28000  },
  { id: "rose",        name: "Rose",        levelReq: 4,  seedCost: 40,   sellPrice: 90,   growMs: 35000  },
  { id: "lavender",    name: "Lavender",    levelReq: 5,  seedCost: 60,   sellPrice: 140,  growMs: 45000  },
  { id: "jasmine",     name: "Jasmine",     levelReq: 7,  seedCost: 90,   sellPrice: 200,  growMs: 60000  },
  { id: "orchid",      name: "Orchid",      levelReq: 8,  seedCost: 130,  sellPrice: 300,  growMs: 75000  },
  { id: "sunflower",   name: "Sunflower",   levelReq: 10, seedCost: 200,  sellPrice: 450,  growMs: 90000  },
  { id: "lotus",       name: "Lotus",       levelReq: 12, seedCost: 300,  sellPrice: 700,  growMs: 105000 },
  { id: "calceolaria", name: "Calceolaria", levelReq: 14, seedCost: 450,  sellPrice: 1000, growMs: 120000 },
  { id: "dahlia",      name: "Dahlia",      levelReq: 16, seedCost: 650,  sellPrice: 1500, growMs: 150000 },
  { id: "moonflower",  name: "Moonflower",  levelReq: 20, seedCost: 1000, sellPrice: 2400, growMs: 180000 },
];

// Rare variants: spawned automatically on every Nth planting of the parent flower.
// They cannot be bought — only grown by planting the parent species.
window.Garden.RARE_FLOWERS = [
  { id: "daisy_pink",       parentId: "daisy",       name: "Pink Daisy",       sellPrice: 30,   interval: 16 },
  { id: "tulip_purple",     parentId: "tulip",       name: "Purple Tulip",     sellPrice: 90,   interval: 16 },
  { id: "rose_white",       parentId: "rose",        name: "White Rose",       sellPrice: 225,  interval: 16 },
  { id: "jasmine_purple",   parentId: "jasmine",     name: "Purple Jasmine",   sellPrice: 500,  interval: 16 },
  { id: "sunflower_orange", parentId: "sunflower",   name: "Orange Sunflower", sellPrice: 1125, interval: 16 },
  { id: "calceolaria_red",  parentId: "calceolaria", name: "Red Calceolaria",  sellPrice: 2500, interval: 16 },
  { id: "marigold_white",   parentId: "marigold",    name: "White Marigold",     sellPrice: 150,  interval: 16 },
  { id: "lavender_pink",    parentId: "lavender",    name: "Pink Lavender",      sellPrice: 350,  interval: 16 },
  { id: "orchid_blue",      parentId: "orchid",      name: "Blue Orchid",        sellPrice: 750,  interval: 16 },
  { id: "lotus_gold",       parentId: "lotus",       name: "Golden Lotus",       sellPrice: 1750, interval: 16 },
  { id: "dahlia_black",     parentId: "dahlia",      name: "Black Dahlia",       sellPrice: 3750, interval: 16 },
  { id: "moonflower_crimson", parentId: "moonflower", name: "Crimson Moonflower", sellPrice: 6000, interval: 16 },
];

// Mythical variants: a pure jackpot roll on every planting of the parent
// (checked before the deterministic rare interval). Sell for 8x the parent.
window.Garden.MYTHIC_FLOWERS = [
  { id: "daisy_celestial",    parentId: "daisy",       name: "Celestial Daisy",     sellPrice: 96,    chance: 0.02 },
  { id: "tulip_phoenix",      parentId: "tulip",       name: "Phoenix Tulip",       sellPrice: 280,   chance: 0.02 },
  { id: "marigold_ember",     parentId: "marigold",    name: "Ember Marigold",      sellPrice: 480,   chance: 0.02 },
  { id: "rose_midnight",      parentId: "rose",        name: "Midnight Rose",       sellPrice: 720,   chance: 0.02 },
  { id: "lavender_aurora",    parentId: "lavender",    name: "Aurora Lavender",     sellPrice: 1120,  chance: 0.02 },
  { id: "jasmine_moonlit",    parentId: "jasmine",     name: "Moonlit Jasmine",     sellPrice: 1600,  chance: 0.02 },
  { id: "orchid_dragon",      parentId: "orchid",      name: "Dragon Orchid",       sellPrice: 2400,  chance: 0.02 },
  { id: "sunflower_eclipse",  parentId: "sunflower",   name: "Eclipse Sunflower",   sellPrice: 3600,  chance: 0.02 },
  { id: "lotus_twilight",     parentId: "lotus",       name: "Twilight Lotus",      sellPrice: 5600,  chance: 0.02 },
  { id: "calceolaria_royal",  parentId: "calceolaria", name: "Royal Calceolaria",   sellPrice: 8000,  chance: 0.02 },
  { id: "dahlia_galaxy",      parentId: "dahlia",      name: "Galaxy Dahlia",       sellPrice: 12000, chance: 0.02 },
  { id: "moonflower_prism",   parentId: "moonflower",  name: "Prism Moonflower",    sellPrice: 19200, chance: 0.02 },
];

window.Garden.flowerById = function (id) {
  const normal = window.Garden.FLOWERS.find(f => f.id === id);
  if (normal) return normal;
  const rare = window.Garden.RARE_FLOWERS.find(r => r.id === id);
  if (rare) {
    const parent = window.Garden.FLOWERS.find(f => f.id === rare.parentId);
    // Merge: rare inherits parent's growMs / levelReq, overrides name + sellPrice.
    // seedCost is preserved from parent but rares aren't directly plantable.
    return Object.assign({}, parent, rare, { rare: true });
  }
  const mythic = window.Garden.MYTHIC_FLOWERS.find(m => m.id === id);
  if (mythic) {
    const parent = window.Garden.FLOWERS.find(f => f.id === mythic.parentId);
    return Object.assign({}, parent, mythic, { mythic: true });
  }
  return null;
};

window.Garden.rareForParent = function (parentId) {
  return window.Garden.RARE_FLOWERS.find(r => r.parentId === parentId) || null;
};

window.Garden.mythicForParent = function (parentId) {
  return window.Garden.MYTHIC_FLOWERS.find(m => m.parentId === parentId) || null;
};
