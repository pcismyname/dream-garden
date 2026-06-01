# Dream Garden Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-player browser flower-farming demo that recreates the core loop of the 2010 Dream Garden Facebook game.

**Architecture:** Zero-build static site. `index.html` loads `styles.css` and six JS files via plain `<script>` tags. Each JS file attaches its exports to a `window.Garden` namespace global — this avoids ES modules so the file works when double-clicked (`file://`). State persists in `localStorage`. A 500ms `setInterval` re-renders so growth timers and bloomed markers update without per-plot timers. Spec: `docs/superpowers/specs/2026-06-01-dream-garden-design.md`.

**Tech Stack:** Vanilla HTML / CSS / JavaScript. Inline SVG for flower artwork. `localStorage` for save data. No npm, no bundler, no test framework — manual verification per spec.

**Project root:** `C:/Users/chids/OneDrive/Documents/garden/` (already exists; contains the source HTML and screenshots).

---

## Notes for the implementer

- **No ES modules.** Each `js/*.js` file starts with `window.Garden = window.Garden || {};` and attaches its symbols to that object (e.g., `window.Garden.FLOWERS = [...]`). Script order in `index.html` matters: `flowers.js` → `storage.js` → `state.js` → `svg.js` → `render.js` → `main.js`. This is so the user can double-click `index.html` and play — ES module imports are blocked on `file://` in most browsers.
- **No test framework.** Verification is by pasting snippets into the browser devtools console, or by visual inspection. Each task spells out what to check.
- **Frequent commits.** This repo doesn't yet exist as a git repo — Task 1 initializes it. Every task ends with a commit. Commit messages use conventional-commit prefixes (`feat:`, `chore:`, `style:`).
- **No emojis in source files** unless explicitly called for (the seed-shelf "🔒" and bloom "✓" badges are the only intentional uses; the spec calls these out).

---

## Task 1: Initialize project and scaffold files

**Files:**
- Create: `index.html`, `styles.css`, `.gitignore`
- Create: `js/flowers.js`, `js/storage.js`, `js/state.js`, `js/svg.js`, `js/render.js`, `js/main.js`

- [ ] **Step 1: Create `.gitignore`** to keep brainstorm artifacts and OS junk out of the repo.

```gitignore
.superpowers/
.DS_Store
Thumbs.db
*.log
```

- [ ] **Step 2: Create the empty JS files** with just the namespace bootstrap line.

For each of `js/flowers.js`, `js/storage.js`, `js/state.js`, `js/svg.js`, `js/render.js`, `js/main.js`, write a single line:

```js
window.Garden = window.Garden || {};
```

- [ ] **Step 3: Create `styles.css`** with a minimal reset so the page isn't ugly while we're building.

```css
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: #cce8ff;
  color: #3a2e0a;
}
```

- [ ] **Step 4: Create `index.html`** wiring everything together. Note the script load order.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dream Garden</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="app"></div>

  <script src="js/flowers.js"></script>
  <script src="js/storage.js"></script>
  <script src="js/state.js"></script>
  <script src="js/svg.js"></script>
  <script src="js/render.js"></script>
  <script src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 5: Verify in browser.** Double-click `index.html`. Open devtools console. Expected:
  - Page renders as a blank pale-blue area
  - No console errors
  - Typing `Garden` returns an object `{}`

- [ ] **Step 6: Initialize git and commit.**

```bash
git init
git add .gitignore index.html styles.css js/
git commit -m "chore: scaffold dream garden project"
```

---

## Task 2: Flower catalog (`js/flowers.js`)

**Files:**
- Modify: `js/flowers.js`

- [ ] **Step 1: Write the catalog.** Replace contents of `js/flowers.js` with:

```js
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
```

- [ ] **Step 2: Verify in browser console.** Reload `index.html`. In devtools console run:

```js
Garden.FLOWERS.length;           // expected: 6
Garden.flowerById("rose").seedCost;  // expected: 40
Garden.flowerById("missing");    // expected: null
```

- [ ] **Step 3: Commit.**

```bash
git add js/flowers.js
git commit -m "feat: add flower catalog"
```

---

## Task 3: Storage module (`js/storage.js`)

**Files:**
- Modify: `js/storage.js`

- [ ] **Step 1: Write the storage helpers.** Replace contents of `js/storage.js` with:

```js
window.Garden = window.Garden || {};

(function (Garden) {
  const STORAGE_KEY = "dreamgarden.v1";
  const VERSION = 1;

  function save(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // Quota exceeded, private mode, etc. — game continues in-memory.
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== VERSION) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function clear() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }

  Garden.storage = { save, load, clear, STORAGE_KEY, VERSION };
})(window.Garden);
```

- [ ] **Step 2: Verify in browser console.** Reload `index.html`. Run:

```js
Garden.storage.save({ version: 1, hello: "world" });
Garden.storage.load();                  // expected: { version: 1, hello: "world" }
Garden.storage.save({ version: 99 });
Garden.storage.load();                  // expected: null (wrong version)
Garden.storage.clear();
Garden.storage.load();                  // expected: null
```

- [ ] **Step 3: Commit.**

```bash
git add js/storage.js
git commit -m "feat: add localStorage save/load with version check"
```

---

## Task 4: State — initial state and `getStage`

**Files:**
- Modify: `js/state.js`

- [ ] **Step 1: Write `createInitialState` and `getStage`.** Replace contents of `js/state.js` with:

```js
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
```

- [ ] **Step 2: Verify in browser console.** Reload `index.html`. Run:

```js
const s = Garden.state.createInitialState();
s.coins;                  // expected: 100
s.plots.length;           // expected: 9
s.plots.every(p => p === null);  // expected: true

const now = Date.now();
Garden.state.getStage(null, now);                                          // expected: null
Garden.state.getStage({stage:"seed"}, now);                                // expected: "seed"
Garden.state.getStage({stage:"sunned", bloomAt: now - 1000}, now);         // expected: "bloomed"
Garden.state.getStage({stage:"sunned", bloomAt: now + 1000}, now);         // expected: "growing"
```

- [ ] **Step 3: Commit.**

```bash
git add js/state.js
git commit -m "feat: add initial state and stage derivation"
```

---

## Task 5: State — `plant` action

**Files:**
- Modify: `js/state.js`

- [ ] **Step 1: Add `plant`** inside the existing IIFE in `js/state.js`, before the `Garden.state = …` line:

```js
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
```

- [ ] **Step 2: Export `plant`** by changing the `Garden.state = ...` line:

```js
  Garden.state = { createInitialState, getStage, plant };
```

- [ ] **Step 3: Verify in browser console.** Reload `index.html`. Run:

```js
const s = Garden.state.createInitialState();
Garden.state.plant(s, 0, "daisy");          // expected: { ok: true }
s.coins;                                    // expected: 95
s.plots[0].flowerId;                        // expected: "daisy"
s.plots[0].stage;                           // expected: "seed"

Garden.state.plant(s, 0, "daisy");          // expected: { ok: false, reason: "occupied" }
Garden.state.plant(s, 1, "rose");           // expected: { ok: false, reason: "locked" }
s.coins = 1;
Garden.state.plant(s, 1, "daisy");          // expected: { ok: false, reason: "broke" }
```

- [ ] **Step 4: Commit.**

```bash
git add js/state.js
git commit -m "feat: add plant action with cost and level checks"
```

---

## Task 6: State — `water` and `sun` actions

**Files:**
- Modify: `js/state.js`

- [ ] **Step 1: Add `water` and `sun`** inside the IIFE in `js/state.js`, before the `Garden.state = …` line:

```js
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
```

- [ ] **Step 2: Export the new functions** — update the `Garden.state = …` line:

```js
  Garden.state = { createInitialState, getStage, plant, water, sun };
```

- [ ] **Step 3: Verify in browser console.** Reload `index.html`. Run:

```js
const s = Garden.state.createInitialState();
Garden.state.plant(s, 0, "daisy");
Garden.state.water(s, 0);                   // expected: { ok: true }
s.plots[0].stage;                           // expected: "watered"
Garden.state.water(s, 0);                   // expected: { ok: false, reason: "wrong-stage" }
Garden.state.sun(s, 0);                     // expected: { ok: true }
s.plots[0].stage;                           // expected: "sunned"
s.plots[0].bloomAt > Date.now();            // expected: true
```

- [ ] **Step 4: Commit.**

```bash
git add js/state.js
git commit -m "feat: add water and sun actions"
```

---

## Task 7: State — `harvest` with XP and level-up

**Files:**
- Modify: `js/state.js`

- [ ] **Step 1: Add `xpForNextLevel` and `harvest`** inside the IIFE, before the `Garden.state = …` line:

```js
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
```

- [ ] **Step 2: Export the new functions** — update the `Garden.state = …` line:

```js
  Garden.state = { createInitialState, getStage, plant, water, sun, harvest, xpForNextLevel };
```

- [ ] **Step 3: Verify in browser console.** Reload `index.html`. Run:

```js
const s = Garden.state.createInitialState();
Garden.state.plant(s, 0, "daisy");
Garden.state.water(s, 0);
Garden.state.sun(s, 0);
s.plots[0].bloomAt = Date.now() - 1;          // fake instant bloom
Garden.state.harvest(s, 0);                   // expected: { ok: true, leveledUp: false }
s.coins;                                      // expected: 107  (95 + 12)
s.xp;                                         // expected: 2

// force level up
s.xp = 49;
Garden.state.plant(s, 1, "daisy");
Garden.state.water(s, 1); Garden.state.sun(s, 1);
s.plots[1].bloomAt = Date.now() - 1;
Garden.state.harvest(s, 1);                   // expected: { ok: true, leveledUp: true }
s.level;                                      // expected: 2
s.xp;                                         // expected: 1  (49 + 2 = 51 - 50 threshold)
```

- [ ] **Step 4: Commit.**

```bash
git add js/state.js
git commit -m "feat: add harvest with XP and level progression"
```

---

## Task 8: State — grid expansion

**Files:**
- Modify: `js/state.js`

- [ ] **Step 1: Add `GRID_EXPANSIONS`, `nextExpansion`, and `expandGrid`** inside the IIFE, before the `Garden.state = …` line:

```js
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
```

- [ ] **Step 2: Export the new functions** — update the `Garden.state = …` line:

```js
  Garden.state = {
    createInitialState, getStage, plant, water, sun, harvest,
    xpForNextLevel, expandGrid, nextExpansion, GRID_EXPANSIONS,
  };
```

- [ ] **Step 3: Verify in browser console.** Reload `index.html`. Run:

```js
const s = Garden.state.createInitialState();
Garden.state.nextExpansion(s);                // expected: { from:3, to:4, cost:500, minLevel:5 }
Garden.state.expandGrid(s);                   // expected: { ok:false, reason:"locked" }
s.level = 5;
Garden.state.expandGrid(s);                   // expected: { ok:false, reason:"broke" }
s.coins = 500;
Garden.state.expandGrid(s);                   // expected: { ok:true }
s.gridSize;                                   // expected: 4
s.plots.length;                               // expected: 16
s.plots.slice(9).every(p => p === null);      // expected: true (new plots are empty)
```

- [ ] **Step 4: Commit.**

```bash
git add js/state.js
git commit -m "feat: add grid expansion"
```

---

## Task 9: SVG library (`js/svg.js`)

**Files:**
- Modify: `js/svg.js`

This task is large because we need stage drawings for 6 flowers × 5 stages. To keep it bite-sized, we use ONE generic "seed/watered/sunned" sprite (a small brown dot, a dot with a water droplet, a sprout) that's the same for all flowers — only the `growing` and `bloomed` stages are flower-specific. This still feels distinct because the early stages look identical in the original game too (they're all just "dirt that's been watered").

- [ ] **Step 1: Write the SVG factory.** Replace contents of `js/svg.js` with:

```js
window.Garden = window.Garden || {};

(function (Garden) {
  // Generic early stages — same for all flowers
  const SEED_SVG = `
    <svg viewBox="0 0 40 40" width="100%" height="100%">
      <circle cx="20" cy="22" r="3.5" fill="#5a3e1a"/>
    </svg>`;

  const WATERED_SVG = `
    <svg viewBox="0 0 40 40" width="100%" height="100%">
      <circle cx="20" cy="22" r="3.5" fill="#3a2810"/>
      <path d="M28 12 Q31 18 28 20 Q25 18 28 12 Z" fill="#5cb6ff" opacity="0.85"/>
    </svg>`;

  const SUNNED_SVG = `
    <svg viewBox="0 0 40 40" width="100%" height="100%">
      <rect x="19" y="18" width="2" height="10" fill="#3b8e3b"/>
      <ellipse cx="16" cy="22" rx="4" ry="2" fill="#56b256" transform="rotate(-25 16 22)"/>
      <ellipse cx="24" cy="22" rx="4" ry="2" fill="#56b256" transform="rotate(25 24 22)"/>
    </svg>`;

  // Mid-growth: small bud, color per flower
  function growingSvg(color) {
    return `
      <svg viewBox="0 0 40 40" width="100%" height="100%">
        <rect x="19" y="20" width="2" height="14" fill="#3b8e3b"/>
        <ellipse cx="14" cy="26" rx="6" ry="3" fill="#56b256" transform="rotate(-20 14 26)"/>
        <ellipse cx="26" cy="28" rx="6" ry="3" fill="#56b256" transform="rotate(20 26 28)"/>
        <circle cx="20" cy="16" r="5" fill="${color}"/>
      </svg>`;
  }

  // Full bloom: 5-petal rosette, color per flower
  function bloomedSvg(petalColor, centerColor) {
    return `
      <svg viewBox="0 0 80 80" width="100%" height="100%">
        <ellipse cx="40" cy="35" rx="9" ry="9" fill="${petalColor}"/>
        <ellipse cx="30" cy="32" rx="8" ry="8" fill="${petalColor}"/>
        <ellipse cx="50" cy="32" rx="8" ry="8" fill="${petalColor}"/>
        <ellipse cx="34" cy="44" rx="8" ry="8" fill="${petalColor}"/>
        <ellipse cx="46" cy="44" rx="8" ry="8" fill="${petalColor}"/>
        <circle cx="40" cy="38" r="5" fill="${centerColor}"/>
        <rect x="37" y="46" width="6" height="22" fill="#3b8e3b"/>
      </svg>`;
  }

  // Flower color table (petal, center)
  const COLORS = {
    daisy:       { petal: "#ffffff", center: "#ffd84a" },
    tulip:       { petal: "#e84a5f", center: "#b22e3f" },
    rose:        { petal: "#d4456b", center: "#fce8b2" },
    jasmine:     { petal: "#fff7e0", center: "#f4d27a" },
    sunflower:   { petal: "#ffd84a", center: "#7a4a1a" },
    calceolaria: { petal: "#ff9933", center: "#cc5500" },
  };

  function flowerSvg(flowerId, stage) {
    if (stage === "seed") return SEED_SVG;
    if (stage === "watered") return WATERED_SVG;
    if (stage === "sunned") return SUNNED_SVG;
    const c = COLORS[flowerId] || COLORS.daisy;
    if (stage === "growing") return growingSvg(c.petal);
    if (stage === "bloomed") return bloomedSvg(c.petal, c.center);
    return "";
  }

  // Tiny icon for the seed shelf (a bloomed flower, no stem)
  function flowerIcon(flowerId) {
    const c = COLORS[flowerId] || COLORS.daisy;
    return `
      <svg viewBox="0 0 40 40" width="100%" height="100%">
        <ellipse cx="20" cy="18" rx="5" ry="5" fill="${c.petal}"/>
        <ellipse cx="14" cy="16" rx="4" ry="4" fill="${c.petal}"/>
        <ellipse cx="26" cy="16" rx="4" ry="4" fill="${c.petal}"/>
        <ellipse cx="16" cy="24" rx="4" ry="4" fill="${c.petal}"/>
        <ellipse cx="24" cy="24" rx="4" ry="4" fill="${c.petal}"/>
        <circle cx="20" cy="20" r="3" fill="${c.center}"/>
      </svg>`;
  }

  Garden.svg = { flowerSvg, flowerIcon };
})(window.Garden);
```

- [ ] **Step 2: Verify visually.** Reload `index.html`. In devtools console run a quick render of all stages for daisy and rose:

```js
const stages = ["seed","watered","sunned","growing","bloomed"];
const ids = ["daisy","rose","sunflower"];
document.getElementById("app").innerHTML = ids.map(id =>
  `<div style="display:flex; gap:8px; margin:8px;">
    ${stages.map(st =>
      `<div style="width:60px; height:60px; background:#9c5a2a; border-radius:6px; padding:4px;">
        ${Garden.svg.flowerSvg(id, st)}
      </div>`).join("")}
  </div>`
).join("");
```

Expected: three rows of five small brown squares each, showing seed → watered → sunned → growing → bloomed transition. Daisy bloom is white with yellow center; rose bloom is pink/magenta; sunflower is yellow.

- [ ] **Step 3: Reload the page** to clear the debug render.

- [ ] **Step 4: Commit.**

```bash
git add js/svg.js
git commit -m "feat: add SVG library for flower stages"
```

---

## Task 10: CSS layout shell

**Files:**
- Modify: `styles.css`

- [ ] **Step 1: Write the full stylesheet.** Replace contents of `styles.css` with:

```css
* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #3a2e0a;
  background: linear-gradient(180deg, #cce8ff 0%, #cce8ff 30%, #9bd49b 30%, #7cc47c 100%);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
}

#app {
  width: 100%;
  max-width: 720px;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

/* ===== Top bar ===== */
.topbar {
  background: #fff4d6;
  border-bottom: 2px solid #e6d9a8;
  padding: 12px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  flex-wrap: wrap;
}

.coins {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: bold;
  color: #5a3e0a;
}

.coin-icon {
  display: inline-block;
  width: 20px;
  height: 20px;
  background: radial-gradient(circle at 30% 30%, #ffe66b, #d4a017);
  border-radius: 50%;
  border: 1px solid #a87f0e;
}

.level-block {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #5a3e0a;
}

.xp-bar {
  width: 140px;
  height: 10px;
  background: #e6d9a8;
  border-radius: 5px;
  overflow: hidden;
}

.xp-fill {
  height: 100%;
  background: linear-gradient(90deg, #7cc47c, #56b256);
  transition: width 0.2s;
}

.expand-btn {
  background: #56b256;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: bold;
  cursor: pointer;
  box-shadow: 0 2px 0 #3b8e3b;
}
.expand-btn:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: 0 2px 0 #888; background: #999; }

/* ===== Garden ===== */
.garden {
  flex: 1;
  padding: 30px 20px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.grid {
  display: grid;
  gap: 10px;
}

.plot {
  width: 72px;
  height: 72px;
  background: #9c5a2a;
  border-radius: 8px;
  cursor: pointer;
  position: relative;
  box-shadow: 0 2px 0 #6b3d1a;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  user-select: none;
}
.plot:hover { background: #ad6a3a; }

.plot-content { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }

.ready-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #ffd84a;
  color: #5a3e0a;
  font-size: 10px;
  font-weight: bold;
  padding: 2px 5px;
  border-radius: 8px;
  border: 1px solid #a87f0e;
}

.timer {
  position: absolute;
  top: 4px;
  left: 4px;
  font-size: 9px;
  color: #fff;
  background: rgba(0,0,0,0.55);
  padding: 1px 4px;
  border-radius: 6px;
}

/* ===== Seed shelf ===== */
.shelf {
  background: #fff4d6;
  border-top: 2px solid #e6d9a8;
  padding: 12px 18px;
}

.shelf-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #7a5e2a;
  margin-bottom: 8px;
}

.seeds {
  display: flex;
  gap: 8px;
  overflow-x: auto;
}

.seed-card {
  background: #fff;
  border: 1px solid #d6c98a;
  border-radius: 8px;
  padding: 6px 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}
.seed-card.selected {
  border: 2px solid #ff9933;
  padding: 5px 9px;
}
.seed-card.locked {
  background: #eee;
  border-color: #ccc;
  opacity: 0.55;
  cursor: not-allowed;
}
.seed-card.unaffordable {
  opacity: 0.7;
}
.seed-icon { width: 24px; height: 24px; flex-shrink: 0; }
.seed-name { font-weight: bold; }
.seed-cost { color: #7a5e2a; font-size: 11px; }
.seed-lock { color: #999; font-size: 11px; }
```

- [ ] **Step 2: Verify visually.** Reload `index.html`. Expected: pale-blue-to-green gradient background, blank centered content area, no console errors. No content yet — that comes in Task 11.

- [ ] **Step 3: Commit.**

```bash
git add styles.css
git commit -m "style: add layout shell for top bar, garden, and shelf"
```

---

## Task 11: Render — top bar

**Files:**
- Modify: `js/render.js`

- [ ] **Step 1: Write `renderTopBar` and helpers.** Replace contents of `js/render.js` with:

```js
window.Garden = window.Garden || {};

(function (Garden) {
  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }

  function renderTopBar(state) {
    const xpNeeded = Garden.state.xpForNextLevel(state.level);
    const xpPct = Math.min(100, Math.floor((state.xp / xpNeeded) * 100));
    const exp = Garden.state.nextExpansion(state);
    const totalPlots = state.gridSize * state.gridSize;

    let expandBtnHtml = "";
    if (exp) {
      const canExpand = state.level >= exp.minLevel && state.coins >= exp.cost;
      expandBtnHtml = `<button class="expand-btn" data-action="expand" ${canExpand ? "" : "disabled"}>
        Expand to ${exp.to}×${exp.to} (${exp.cost})
      </button>`;
    }

    return el(`
      <div class="topbar">
        <div class="coins">
          <span class="coin-icon"></span>
          <span>${state.coins}</span>
        </div>
        <div class="level-block">
          <span>Lv ${state.level}</span>
          <div class="xp-bar"><div class="xp-fill" style="width:${xpPct}%"></div></div>
          <span>${state.xp}/${xpNeeded} XP</span>
        </div>
        <div>${totalPlots} plots ${expandBtnHtml}</div>
      </div>
    `);
  }

  function renderAll(state) {
    const app = document.getElementById("app");
    app.innerHTML = "";
    app.appendChild(renderTopBar(state));
    // Grid and shelf added in later tasks.
  }

  Garden.render = { renderAll, renderTopBar };
})(window.Garden);
```

- [ ] **Step 2: Hook up a temporary bootstrap** to see it on screen. In `js/main.js`, replace contents with:

```js
window.Garden = window.Garden || {};
(function (Garden) {
  function start() {
    const state = Garden.storage.load() || Garden.state.createInitialState();
    Garden.render.renderAll(state);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})(window.Garden);
```

- [ ] **Step 3: Verify visually.** Reload `index.html`. Expected:
  - Cream top bar at the top of the page
  - Shows `100` coins with gold circle icon
  - Shows `Lv 1`, empty XP bar, `0/50 XP`
  - Shows `9 plots` on the right, no expand button (locked at L5)
  - No console errors

- [ ] **Step 4: Commit.**

```bash
git add js/render.js js/main.js
git commit -m "feat: render top bar with coins, XP, level"
```

---

## Task 12: Render — garden grid (read-only)

**Files:**
- Modify: `js/render.js`

- [ ] **Step 1: Add `renderGrid`** inside the IIFE in `js/render.js`, before `renderAll`:

```js
  function renderGrid(state) {
    const now = Date.now();
    const wrap = el(`<div class="garden"><div class="grid" style="grid-template-columns:repeat(${state.gridSize}, 72px); grid-template-rows:repeat(${state.gridSize}, 72px);"></div></div>`);
    const grid = wrap.querySelector(".grid");

    state.plots.forEach((plot, idx) => {
      const plotEl = document.createElement("div");
      plotEl.className = "plot";
      plotEl.dataset.idx = idx;

      if (plot) {
        const stage = Garden.state.getStage(plot, now);
        const content = document.createElement("div");
        content.className = "plot-content";
        content.innerHTML = Garden.svg.flowerSvg(plot.flowerId, stage);
        plotEl.appendChild(content);

        if (stage === "bloomed") {
          const badge = document.createElement("div");
          badge.className = "ready-badge";
          badge.textContent = "✓";
          plotEl.appendChild(badge);
        } else if (stage === "growing") {
          const remaining = Math.max(0, Math.ceil((plot.bloomAt - now) / 1000));
          const timer = document.createElement("div");
          timer.className = "timer";
          timer.textContent = `${remaining}s`;
          plotEl.appendChild(timer);
        }
      }

      grid.appendChild(plotEl);
    });

    return wrap;
  }
```

- [ ] **Step 2: Append grid in `renderAll`.** Update `renderAll`:

```js
  function renderAll(state) {
    const app = document.getElementById("app");
    app.innerHTML = "";
    app.appendChild(renderTopBar(state));
    app.appendChild(renderGrid(state));
    // Shelf added in next task.
  }
```

- [ ] **Step 3: Export `renderGrid`** — update the `Garden.render = ...` line:

```js
  Garden.render = { renderAll, renderTopBar, renderGrid };
```

- [ ] **Step 4: Verify visually.** Reload `index.html`. Expected:
  - 3×3 grid of brown plots below the top bar
  - All plots empty (no SVG inside)
  - Plots are square, ~72px, with subtle drop shadow
  - Hovering a plot lightens its color

To verify planted states, paste into the console:

```js
const s = Garden.storage.load() || Garden.state.createInitialState();
Garden.state.plant(s, 0, "daisy");
Garden.state.water(s, 1); // will fail — only the plant call matters here
Garden.state.plant(s, 1, "daisy"); Garden.state.water(s, 1);
Garden.state.plant(s, 2, "daisy"); Garden.state.water(s, 2); Garden.state.sun(s, 2);
Garden.state.plant(s, 3, "daisy"); Garden.state.water(s, 3); Garden.state.sun(s, 3);
s.plots[3].bloomAt = Date.now() - 1; // force bloomed
Garden.render.renderAll(s);
```

Expected: plot 0 shows a tiny brown seed, plot 1 shows seed + water drop, plot 2 shows a small sprout with timer overlay, plot 3 shows a full daisy with yellow ✓ badge.

- [ ] **Step 5: Reload** to clear the temporary state.

- [ ] **Step 6: Commit.**

```bash
git add js/render.js
git commit -m "feat: render garden grid with stage SVGs"
```

---

## Task 13: Render — seed shelf with selection

**Files:**
- Modify: `js/render.js`

- [ ] **Step 1: Add module-scoped `selectedSeedId`** at the top of the IIFE in `js/render.js`, right after the `function el(...)` definition:

```js
  let selectedSeedId = "daisy";
```

- [ ] **Step 2: Add `renderShelf`** inside the IIFE, before `renderAll`:

```js
  function renderShelf(state) {
    const wrap = el(`
      <div class="shelf">
        <div class="shelf-label">Seeds — click to select, then click an empty plot</div>
        <div class="seeds"></div>
      </div>
    `);
    const seedsEl = wrap.querySelector(".seeds");

    Garden.FLOWERS.forEach(flower => {
      const locked = state.level < flower.levelReq;
      const unaffordable = !locked && state.coins < flower.seedCost;
      const isSelected = !locked && flower.id === selectedSeedId;

      const card = document.createElement("div");
      let cls = "seed-card";
      if (locked) cls += " locked";
      else if (unaffordable) cls += " unaffordable";
      if (isSelected) cls += " selected";
      card.className = cls;
      card.dataset.flowerId = flower.id;

      const right = locked
        ? `<span class="seed-lock">🔒 Lv ${flower.levelReq}</span>`
        : `<span class="seed-cost">${flower.seedCost}🪙</span>`;

      card.innerHTML = `
        <div class="seed-icon">${Garden.svg.flowerIcon(flower.id)}</div>
        <div>
          <div class="seed-name">${flower.name}</div>
          ${right}
        </div>
      `;
      seedsEl.appendChild(card);
    });

    return wrap;
  }
```

- [ ] **Step 3: Append shelf in `renderAll`** and ensure `selectedSeedId` stays valid (if the currently-selected seed becomes locked after a state reset, fall back). Update `renderAll`:

```js
  function renderAll(state) {
    // Ensure selectedSeedId is still unlocked; otherwise pick the first unlocked.
    const selectedFlower = Garden.flowerById(selectedSeedId);
    if (!selectedFlower || state.level < selectedFlower.levelReq) {
      const firstUnlocked = Garden.FLOWERS.find(f => state.level >= f.levelReq);
      selectedSeedId = firstUnlocked ? firstUnlocked.id : null;
    }

    const app = document.getElementById("app");
    app.innerHTML = "";
    app.appendChild(renderTopBar(state));
    app.appendChild(renderGrid(state));
    app.appendChild(renderShelf(state));
  }
```

- [ ] **Step 4: Export `renderShelf` and a setter for selectedSeedId** — update the `Garden.render = ...` line:

```js
  Garden.render = {
    renderAll, renderTopBar, renderGrid, renderShelf,
    setSelectedSeedId: (id) => { selectedSeedId = id; },
    getSelectedSeedId: () => selectedSeedId,
  };
```

- [ ] **Step 5: Verify visually.** Reload `index.html`. Expected (starting state, level 1):
  - Cream-colored shelf at the bottom
  - Daisy card has orange border (selected) and shows `5🪙`
  - Tulip, Rose, Jasmine, Sunflower, Calceolaria all grayed out, each showing `🔒 Lv N` next to the name

- [ ] **Step 6: Commit.**

```bash
git add js/render.js
git commit -m "feat: render seed shelf with selection state"
```

---

## Task 14: Wire click handlers (plot interactions + seed selection + expand)

**Files:**
- Modify: `js/render.js`

- [ ] **Step 1: Add event delegation** at the end of the IIFE in `js/render.js`, just before the `Garden.render = ...` line. Plus a `currentState` module variable so handlers can read it:

```js
  let currentState = null;

  function setupHandlers() {
    const app = document.getElementById("app");
    app.addEventListener("click", (ev) => {
      if (!currentState) return;

      // Plot click
      const plotEl = ev.target.closest(".plot");
      if (plotEl) {
        const idx = Number(plotEl.dataset.idx);
        handlePlotClick(idx);
        return;
      }

      // Seed shelf click
      const seedEl = ev.target.closest(".seed-card");
      if (seedEl && !seedEl.classList.contains("locked")) {
        selectedSeedId = seedEl.dataset.flowerId;
        renderAll(currentState);
        return;
      }

      // Expand button
      const expandBtn = ev.target.closest("[data-action='expand']");
      if (expandBtn && !expandBtn.disabled) {
        Garden.state.expandGrid(currentState);
        Garden.storage.save(currentState);
        renderAll(currentState);
        return;
      }
    });
  }

  function handlePlotClick(idx) {
    const state = currentState;
    const plot = state.plots[idx];
    const now = Date.now();

    if (!plot) {
      if (!selectedSeedId) return;
      Garden.state.plant(state, idx, selectedSeedId);
    } else {
      const stage = Garden.state.getStage(plot, now);
      if (stage === "seed") Garden.state.water(state, idx);
      else if (stage === "watered") Garden.state.sun(state, idx);
      else if (stage === "bloomed") Garden.state.harvest(state, idx);
      // growing → no-op
    }
    Garden.storage.save(state);
    renderAll(state);
  }
```

- [ ] **Step 2: Update `renderAll` to track `currentState`.** Add a single line at the top of `renderAll`:

```js
  function renderAll(state) {
    currentState = state;
    // ... rest of renderAll unchanged
```

- [ ] **Step 3: Export `setupHandlers`** — update the `Garden.render = ...` line:

```js
  Garden.render = {
    renderAll, renderTopBar, renderGrid, renderShelf, setupHandlers,
    setSelectedSeedId: (id) => { selectedSeedId = id; },
    getSelectedSeedId: () => selectedSeedId,
  };
```

- [ ] **Step 4: Call `setupHandlers` from `main.js`.** Replace contents of `js/main.js` with:

```js
window.Garden = window.Garden || {};
(function (Garden) {
  function start() {
    const state = Garden.storage.load() || Garden.state.createInitialState();
    Garden.render.setupHandlers();
    Garden.render.renderAll(state);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})(window.Garden);
```

- [ ] **Step 5: Verify by playing.** Reload `index.html`. Walk through:
  - Click an empty plot → daisy seed appears, coins drop from 100 to 95
  - Click that plot again → water drop appears
  - Click again → small sprout, no countdown yet (one render frame, timer would appear in next task)
  - Wait ~10 seconds (timer doesn't tick yet, that's Task 15) — but click the plot. If it's been >10s, harvest succeeds: coins jump to 107, XP shows 2.
  - Click a locked seed (e.g., Tulip) → nothing changes.

(The countdown won't tick down because we don't have the 500ms render loop yet. The next task fixes that.)

- [ ] **Step 6: Commit.**

```bash
git add js/render.js js/main.js
git commit -m "feat: wire plot, seed, and expand click handlers"
```

---

## Task 15: Render tick loop (`main.js`)

**Files:**
- Modify: `js/main.js`

- [ ] **Step 1: Add a 500ms render-tick interval** that calls `renderAll` with the current state. The state is the same object across the session, so we keep a closure reference. Replace contents of `js/main.js` with:

```js
window.Garden = window.Garden || {};
(function (Garden) {
  let state = null;

  function tick() {
    if (state) Garden.render.renderAll(state);
  }

  function start() {
    state = Garden.storage.load() || Garden.state.createInitialState();
    Garden.render.setupHandlers();
    Garden.render.renderAll(state);
    setInterval(tick, 500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})(window.Garden);
```

- [ ] **Step 2: Verify by playing the full loop.** Reload `index.html`. Walk through end-to-end:
  - Click empty plot → seed (coins 100 → 95)
  - Click again → water drop
  - Click again → sprout with countdown `10s`
  - Watch countdown tick down each second
  - At 0s, sprout becomes a full daisy with yellow ✓ badge
  - Click it → coins jump to 107, XP bar fills slightly (2/50)
  - Plant a few more daisies and harvest them. After ~25 daisies (50 XP), level becomes 2 and Tulip unlocks in the shelf.

- [ ] **Step 3: Verify save round-trip.** Mid-game (with several plots growing), reload the page. Expected: state restored, including in-progress timers (they continue counting down from where they left off in real time).

- [ ] **Step 4: Commit.**

```bash
git add js/main.js
git commit -m "feat: add 500ms render tick for live timers"
```

---

## Task 16: Final playtest pass

**Files:** none (verification only)

- [ ] **Step 1: Open devtools console**, run `localStorage.clear()`, reload `index.html`.

- [ ] **Step 2: Walk through every item in the spec's manual playtest checklist** (`docs/superpowers/specs/2026-06-01-dream-garden-design.md` "Testing" section, items 1–12). Specifically:

  1. Start fresh → see 100 coins, Lv 1, 3×3 grid, daisy selectable ✅
  2. Plant daisy → coins 95, plot shows seed ✅
  3. Click seeded plot → watered icon ✅
  4. Click watered plot → timer starts ✅
  5. Wait 10s → bloomed with ✓ badge ✅
  6. Click bloomed → coins 107, XP 2 ✅
  7. Harvest ~25 daisies → Lv 2, Tulip unlocks ✅
  8. Click locked seed → no change ✅
  9. Try to plant with coins < seedCost → blocked ✅
  10. Reload mid-growth → state restored ✅
  11. Reach Lv 5 with 500+ coins → expand button appears; click → grid → 4×4, coins drop by 500 ✅
  12. `localStorage.clear()` + reload → fresh state ✅

- [ ] **Step 3: Fix any failures you find.** If a checklist item fails, find the related task above, make the fix, and commit with `fix:` prefix.

  To speed-run leveling for items 7 and 11, paste this in console (cheat):

  ```js
  // (Cheat for testing only — fast-forward to L5 with 1000 coins)
  const Garden = window.Garden;
  const s = Garden.storage.load();
  s.level = 5; s.coins = 1000; s.xp = 0;
  Garden.storage.save(s);
  location.reload();
  ```

- [ ] **Step 4: Final commit** if any fixes were needed; otherwise skip.

```bash
git status   # verify clean working tree
git log --oneline
```

Expected: a clean linear history of 14 commits (Tasks 1–15), all working.

---

## Self-review notes (already addressed)

- **Spec coverage:** Every "in scope" bullet maps to tasks — core loop (5,6,7), coin economy (5,7), XP/levels (7), flower unlocks (2, 13), expanding grid (8, 11, 14), localStorage persistence (3, 14, 15), English UI (10, 11, 13), SVG style (9).
- **Naming consistency:** `plant`, `water`, `sun`, `harvest`, `expandGrid`, `getStage`, `xpForNextLevel`, `nextExpansion`, `flowerSvg`, `flowerIcon`, `flowerById`, `renderAll`, `renderTopBar`, `renderGrid`, `renderShelf`, `setupHandlers`, `setSelectedSeedId` — used identically across tasks.
- **`selectedSeedId` lifecycle:** initialized to `"daisy"` (Task 13), updated by shelf click (Task 14), validated against unlock status in `renderAll` (Task 13), never persisted — matches spec.
- **No placeholders:** every step includes either complete code, an exact command, or an explicit visual/console check.
