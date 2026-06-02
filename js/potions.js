window.Garden = window.Garden || {};

// Consumable potions — bought from the Shop, applied to plots from the inventory bar.
window.Garden.POTIONS = [
  {
    id: "speedPotion",
    name: "Speed Potion",
    levelReq: 1,
    cost: 60,
    description: "Subtract 15s from a growing plot",
  },
  {
    id: "revivalPotion",
    name: "Revival Potion",
    levelReq: 3,
    cost: 100,
    description: "Restore a wilted plot to fresh bloom",
  },
];

// How many milliseconds the speed potion shaves off the bloom timer.
window.Garden.SPEED_POTION_MS = 15000;

window.Garden.potionById = function (id) {
  return window.Garden.POTIONS.find(p => p.id === id) || null;
};
