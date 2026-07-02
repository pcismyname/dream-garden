window.Garden = window.Garden || {};

(function (Garden) {
  // Permanent accomplishments. Predicates only read state; unlocks are
  // recorded in state.achievements and never revoked. Lifetime counters
  // live in state.lifetime and are bumped by js/state.js mutators.

  function life(s) {
    return s.lifetime || {};
  }
  function discoveredCount(s) {
    return Object.keys(s.discovered || {}).length;
  }
  function speciesHarvested(s) {
    return Object.keys(life(s).species || {}).length;
  }

  const ACHIEVEMENTS = [
    { id: "first_bloom",    name: "First Bloom",      desc: "Harvest your first flower",            test: s => life(s).harvests >= 1 },
    { id: "green_thumb",    name: "Green Thumb",      desc: "Harvest 50 flowers",                   test: s => life(s).harvests >= 50 },
    { id: "master_gardener",name: "Master Gardener",  desc: "Harvest 250 flowers",                  test: s => life(s).harvests >= 250 },
    { id: "first_rare",     name: "Lucky Find",       desc: "Discover a rare variant",              test: s => discoveredCount(s) >= 1 },
    { id: "rare_collector", name: "Rare Collector",   desc: "Discover 4 rare variants",             test: s => discoveredCount(s) >= 4 },
    { id: "full_catalog",   name: "Full Catalog",     desc: "Discover every rare variant",          test: s => discoveredCount(s) >= Garden.RARE_FLOWERS.length },
    { id: "variety",        name: "Variety Gardener", desc: "Harvest 6 different species",          test: s => speciesHarvested(s) >= 6 },
    { id: "botanist",       name: "Botanist",         desc: "Harvest all 12 species",               test: s => speciesHarvested(s) >= Garden.FLOWERS.length },
    { id: "moon_harvest",   name: "Night Gardener",   desc: "Harvest a Moonflower",                 test: s => !!(life(s).species || {}).moonflower },
    { id: "coins_1k",       name: "Pocket Money",     desc: "Earn 1,000 lifetime coins",            test: s => life(s).coinsEarned >= 1000 },
    { id: "coins_10k",      name: "Flower Tycoon",    desc: "Earn 10,000 lifetime coins",           test: s => life(s).coinsEarned >= 10000 },
    { id: "coins_100k",     name: "Garden Empire",    desc: "Earn 100,000 lifetime coins",          test: s => life(s).coinsEarned >= 100000 },
    { id: "level_5",        name: "Sprouting Up",     desc: "Reach level 5",                        test: s => s.level >= 5 },
    { id: "level_10",       name: "Seasoned Grower",  desc: "Reach level 10",                       test: s => s.level >= 10 },
    { id: "level_20",       name: "Living Legend",    desc: "Reach level 20",                       test: s => s.level >= 20 },
    { id: "landlord",       name: "Landlord",         desc: "Expand the garden to 5×5",             test: s => s.gridSize >= 5 },
    { id: "potion_user",    name: "First Sip",        desc: "Use a potion",                         test: s => life(s).potionsUsed >= 1 },
    { id: "potion_master",  name: "Potion Master",    desc: "Use 10 potions",                       test: s => life(s).potionsUsed >= 10 },
    { id: "quest_10",       name: "Reliable Florist", desc: "Complete 10 daily orders",             test: s => life(s).questsCompleted >= 10 },
  ];

  function defaultLifetime() {
    return { harvests: 0, coinsEarned: 0, raresHarvested: 0, potionsUsed: 0, questsCompleted: 0, species: {} };
  }

  // Evaluate all locked achievements; record and return newly unlocked defs.
  // Cheap (a handful of predicates), safe to run every tick.
  function sweep(state) {
    if (!state.achievements) state.achievements = {};
    const unlocked = [];
    ACHIEVEMENTS.forEach(a => {
      if (state.achievements[a.id]) return;
      let ok = false;
      try { ok = !!a.test(state); } catch (e) { /* defensive: bad save shape */ }
      if (ok) {
        state.achievements[a.id] = true;
        unlocked.push(a);
      }
    });
    return unlocked;
  }

  function unlockedCount(state) {
    const map = state.achievements || {};
    return ACHIEVEMENTS.filter(a => map[a.id]).length;
  }

  Garden.achievements = { ACHIEVEMENTS, defaultLifetime, sweep, unlockedCount };
})(window.Garden);
