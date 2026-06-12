# Daily Engagement System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a daily-retention layer — 7-day login streak, daily quests with an all-3 chest, a free daily lucky draw, a mystery seed item, a while-you-were-away recap, and a Morning Report modal that ties them together.

**Architecture:** A new `js/daily.js` module owns all "what day is it" logic (local calendar date keys) plus streak/draw/quest-rollover/recap pure functions. `js/state.js` gains the mystery-seed plant path and chest-on-quest-completion. `js/render.js` gains the Morning Report modal, a Daily top-bar button with badge, the "?" seed card, and quest ✓/chest UI. `js/main.js` wires day rollover + auto-open at boot and reveals mystery blooms in its tick.

**Tech Stack:** Zero-build vanilla JS (`window.Garden` namespace, plain script tags, works on `file://`), localStorage persistence, hand-written SVG art, single `styles.css`.

**Spec:** `docs/superpowers/specs/2026-06-12-daily-engagement-design.md`

**Testing:** No test runner exists in this project (intentional — zero-build). Every task has console/browser verification steps with exact commands and expected output. Open `index.html` directly in a browser and use DevTools console. `Garden.daily._setDayOffset(n)` simulates day rollover.

**Conventions you must follow:**
- Files attach to `window.Garden` via IIFE: `(function (Garden) { ... })(window.Garden);`
- State mutators return `{ ok: true, ... }` or `{ ok: false, reason: "..." }`
- Rendering rebuilds DOM from state (`renderAll`); handlers are event-delegated on `#app` via `data-action` attributes
- After any state change: `Garden.storage.save(currentState); renderAll(currentState);`
- Toasts: `Garden.fx.toast(text, { variant: "quest" | "level" | "rare" })`

---

### Task 1: `js/daily.js` — day keys, streak, draw, quest rollover, recap

**Files:**
- Create: `js/daily.js`
- Modify: `index.html` (add script tag after `js/state.js`)

- [ ] **Step 1: Create `js/daily.js` with the complete module**

```js
window.Garden = window.Garden || {};

(function (Garden) {
  // Dev-only: shifts "today" by N days so rollover is testable without waiting.
  let dayOffset = 0;

  // A "day" is a local calendar date key like "2026-06-13".
  function todayKey(now) {
    const d = new Date(now == null ? Date.now() : now);
    if (dayOffset) d.setDate(d.getDate() + dayOffset);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  // Whole-day difference between two "YYYY-MM-DD" keys (positive if to > from).
  function dayDiff(fromKey, toKey) {
    if (!fromKey || !toKey) return Infinity;
    const f = fromKey.split("-").map(Number);
    const t = toKey.split("-").map(Number);
    const a = Date.UTC(f[0], f[1] - 1, f[2]);
    const b = Date.UTC(t[0], t[1] - 1, t[2]);
    return Math.round((b - a) / 86400000);
  }

  function defaultDaily() {
    return {
      streakCount: 0,     // total claims made (cycle position = count % 7 + 1)
      lastClaimDay: null, // "YYYY-MM-DD" of last streak claim
      lastSpinDay: null,  // "YYYY-MM-DD" of last lucky-draw spin
      questsDay: null,    // day key the current quest set belongs to
      chestDay: null,     // day key the all-3 chest was awarded
      lastSeenAt: 0,      // ms timestamp, refreshed on every save — powers recap
    };
  }

  function ensureDaily(state) {
    if (!state.daily || typeof state.daily !== "object") {
      state.daily = defaultDaily();
    }
    return state.daily;
  }

  // ---- Login streak: 7-day repeating reward cycle ----
  const STREAK_REWARDS = [
    { day: 1, coins: 50 },
    { day: 2, coins: 100 },
    { day: 3, potionId: "speedPotion" },
    { day: 4, coins: 200 },
    { day: 5, potionId: "revivalPotion" },
    { day: 6, coins: 400 },
    { day: 7, coins: 500, mysterySeed: 1 },
  ];

  // Cycle position (1-7) the NEXT claim will award, after any rewind.
  function nextStreakPosition(daily, today) {
    let count = daily.streakCount;
    if (daily.lastClaimDay && dayDiff(daily.lastClaimDay, today) > 1) {
      count = Math.max(0, count - 1);
    }
    return (count % 7) + 1;
  }

  function canClaimStreak(state, now) {
    return ensureDaily(state).lastClaimDay !== todayKey(now);
  }

  function claimStreak(state, now) {
    const daily = ensureDaily(state);
    const today = todayKey(now);
    if (daily.lastClaimDay === today) return { ok: false, reason: "claimed" };

    // Rewind rule: a gap of more than 1 calendar day since the last CLAIM
    // slips the streak back one step (never a full reset).
    if (daily.lastClaimDay && dayDiff(daily.lastClaimDay, today) > 1) {
      daily.streakCount = Math.max(0, daily.streakCount - 1);
    }
    const position = (daily.streakCount % 7) + 1;
    const reward = STREAK_REWARDS[position - 1];

    if (!state.inventory) state.inventory = {};
    if (reward.coins) state.coins += reward.coins;
    if (reward.potionId) {
      state.inventory[reward.potionId] = (state.inventory[reward.potionId] || 0) + 1;
    }
    if (reward.mysterySeed) {
      state.inventory.mysterySeed = (state.inventory.mysterySeed || 0) + reward.mysterySeed;
    }
    daily.streakCount += 1;
    daily.lastClaimDay = today;
    return { ok: true, position, reward };
  }

  // ---- Lucky draw: one free spin per day ----
  const DRAW_PRIZES = [
    { id: "coinsSmall",    label: "Coins",          weight: 40, coins: s => 40 + s.level * 5 },
    { id: "coinsMedium",   label: "Coin Pouch",     weight: 25, coins: s => 100 + s.level * 10 },
    { id: "speedPotion",   label: "Speed Potion",   weight: 15, potionId: "speedPotion" },
    { id: "revivalPotion", label: "Revival Potion", weight: 10, potionId: "revivalPotion" },
    { id: "coinsLarge",    label: "Coin Chest",     weight: 5,  coins: s => 300 + s.level * 20 },
    { id: "mysterySeed",   label: "Mystery Seed",   weight: 5,  mysterySeed: 1 },
  ];

  function canSpin(state, now) {
    return ensureDaily(state).lastSpinDay !== todayKey(now);
  }

  // roll in [0, 1) maps onto the weighted table.
  function pickPrize(roll) {
    const total = DRAW_PRIZES.reduce((sum, p) => sum + p.weight, 0);
    let r = roll * total;
    for (const p of DRAW_PRIZES) {
      r -= p.weight;
      if (r < 0) return p;
    }
    return DRAW_PRIZES[0];
  }

  function spinDraw(state, now, roll) {
    const daily = ensureDaily(state);
    const today = todayKey(now);
    if (daily.lastSpinDay === today) return { ok: false, reason: "spun" };
    const prize = pickPrize(roll == null ? Math.random() : roll);

    if (!state.inventory) state.inventory = {};
    let coins = 0;
    if (prize.coins) {
      coins = prize.coins(state);
      state.coins += coins;
    }
    if (prize.potionId) {
      state.inventory[prize.potionId] = (state.inventory[prize.potionId] || 0) + 1;
    }
    if (prize.mysterySeed) {
      state.inventory.mysterySeed = (state.inventory.mysterySeed || 0) + 1;
    }
    daily.lastSpinDay = today;
    return { ok: true, prizeId: prize.id, label: prize.label, coins };
  }

  // ---- Daily quest rollover ----
  function rolloverQuests(state, now) {
    const daily = ensureDaily(state);
    const today = todayKey(now);
    if (daily.questsDay === today) return { rolled: false };
    if (daily.questsDay == null && Array.isArray(state.quests) && state.quests.length > 0) {
      // Migration: a pre-feature save adopts its existing rolling quests as
      // today's set; they're replaced on the first real new-day rollover.
      daily.questsDay = today;
      return { rolled: false };
    }
    state.quests = [];
    for (let i = 0; i < 3; i++) state.quests.push(Garden.state.generateQuest(state));
    daily.questsDay = today;
    return { rolled: true };
  }

  // ---- While-you-were-away recap ----
  function computeRecap(state, now) {
    const daily = ensureDaily(state);
    const since = daily.lastSeenAt || 0;
    const t = now == null ? Date.now() : now;
    let bloomed = 0, wilted = 0, readyNow = 0;
    state.plots.forEach(plot => {
      if (!plot || !plot.bloomAt) return;
      const flower = Garden.flowerById(plot.flowerId);
      if (!flower) return;
      const wiltAt = plot.bloomAt + flower.growMs;
      if (plot.bloomAt > since && plot.bloomAt <= t) bloomed += 1;
      if (wiltAt > since && wiltAt <= t) wilted += 1;
      if (plot.bloomAt <= t && wiltAt > t) readyNow += 1;
    });
    const awayMs = since ? t - since : 0;
    const show = awayMs >= 10 * 60 * 1000 && (bloomed > 0 || wilted > 0);
    return { bloomed, wilted, readyNow, awayMs, show };
  }

  // Unclaimed streak + unused spin (0-2) — drives the Daily button badge.
  function claimablesCount(state, now) {
    return (canClaimStreak(state, now) ? 1 : 0) + (canSpin(state, now) ? 1 : 0);
  }

  Garden.daily = {
    todayKey, dayDiff, defaultDaily, ensureDaily,
    STREAK_REWARDS, nextStreakPosition, canClaimStreak, claimStreak,
    DRAW_PRIZES, canSpin, spinDraw,
    rolloverQuests, computeRecap, claimablesCount,
    _setDayOffset: n => { dayOffset = n; },
  };
})(window.Garden);
```

- [ ] **Step 2: Add the script tag to `index.html`**

In `index.html`, after the `js/state.js` line, insert:

```html
  <script src="js/daily.js"></script>
```

Resulting order: `... storage.js → state.js → daily.js → svg.js ...` (daily.js calls `Garden.state.generateQuest` at runtime only, so this order is safe).

- [ ] **Step 3: Verify in browser console**

Open `index.html`, run in DevTools console:

```js
const s = Garden.state.createInitialState();
Garden.daily.ensureDaily(s);
Garden.daily.claimStreak(s);          // → {ok: true, position: 1, reward: {day: 1, coins: 50}}
s.coins;                              // → 150
Garden.daily.claimStreak(s);          // → {ok: false, reason: "claimed"}
s.daily.lastClaimDay = "2026-01-01";  // simulate a long gap
s.daily.streakCount = 5;
Garden.daily.claimStreak(s);          // → {ok: true, position: 5, ...} (rewound 5→4, position 4+1=5)
Garden.daily.spinDraw(s, null, 0.99); // → {ok: true, prizeId: "mysterySeed", ...}
s.inventory.mysterySeed;              // → 1
Garden.daily.spinDraw(s);             // → {ok: false, reason: "spun"}
Garden.daily.rolloverQuests(s);       // → {rolled: false}  (fresh state adopts its initial quests)
Garden.daily._setDayOffset(1);
Garden.daily.rolloverQuests(s);       // → {rolled: true}
Garden.daily._setDayOffset(0);
```

Expected: exactly the values in the comments. Also confirm the game still boots with no console errors.

- [ ] **Step 4: Commit**

```bash
git add js/daily.js index.html
git commit -m "feat: daily module - day keys, streak claim, lucky draw, quest rollover, recap"
```

---

### Task 2: `js/state.js` + `js/storage.js` — daily state, chest, mystery plant, lastSeenAt

**Files:**
- Modify: `js/state.js` (createInitialState ~line 7, harvest quest block ~lines 211-229, exports ~line 280)
- Modify: `js/storage.js` (save ~line 7)

- [ ] **Step 1: Add `daily` to `createInitialState` in `js/state.js`**

In the state object literal (after `inventory: {},`), add:

```js
      daily: Garden.daily ? Garden.daily.defaultDaily() : null,
```

(The guard exists because `daily.js` loads after `state.js`; at runtime `Garden.daily` is always present, but a console call before full load shouldn't crash.)

- [ ] **Step 2: Replace the quest block inside `harvest` and the `return`**

Replace from `// Quest progress: harvesting a rare counts...` down to (and including) the closing `}` of the `if (qIdx >= 0)` block with:

```js
    // Daily quest progress: harvesting a rare counts toward its parent's quest.
    // Quests do NOT regenerate on completion — they refresh once per day (js/daily.js).
    if (!state.quests) state.quests = [];
    const parentId = flower.parentId || flower.id;
    let questCompleted = null;
    let chestAwarded = null;
    const qIdx = state.quests.findIndex(q => q.flowerId === parentId && q.progress < q.target);
    if (qIdx >= 0) {
      state.quests[qIdx].progress += 1;
      if (state.quests[qIdx].progress >= state.quests[qIdx].target) {
        const q = state.quests[qIdx];
        const qFlower = Garden.flowerById(q.flowerId);
        // 1.5x the old rolling-quest bonuses — daily quests are scarcer (3/day).
        const coinBonus = Math.round(q.target * qFlower.sellPrice * 0.75);
        const xpBonus = Math.round((10 + q.target * Math.floor(qFlower.sellPrice / 10)) * 1.5);
        state.coins += coinBonus;
        state.xp += xpBonus;
        questCompleted = { flowerId: q.flowerId, target: q.target, coinBonus, xpBonus };

        // All-3 chest: once per day, when the third quest completes.
        const allDone = state.quests.every(qq => qq.progress >= qq.target);
        const today = Garden.daily ? Garden.daily.todayKey() : null;
        if (allDone && today && state.daily && state.daily.chestDay !== today) {
          state.daily.chestDay = today;
          const chestCoins = 100 + state.level * 25;
          const chestPotionId = Math.random() < 0.5 ? "speedPotion" : "revivalPotion";
          if (!state.inventory) state.inventory = {};
          state.inventory[chestPotionId] = (state.inventory[chestPotionId] || 0) + 1;
          state.coins += chestCoins;
          chestAwarded = { coins: chestCoins, potionId: chestPotionId };
        }
      }
    }
```

Then add `chestAwarded,` to the `return` object of `harvest` (after `questCompleted,`).

- [ ] **Step 3: Add `plantMystery` to `js/state.js`**

Insert after the `plant` function:

```js
  // Plant a mystery seed: the real flower is resolved NOW but hidden ("?")
  // until bloom. Bypasses plantCounts and the every-Nth rare interval by design.
  function plantMystery(state, plotIdx) {
    if (plotIdx < 0 || plotIdx >= state.plots.length) return { ok: false, reason: "bad-index" };
    if (state.plots[plotIdx] !== null) return { ok: false, reason: "occupied" };
    if (!state.inventory || !(state.inventory.mysterySeed > 0)) return { ok: false, reason: "no-seed" };

    const unlocked = Garden.FLOWERS.filter(f => state.level >= f.levelReq);
    const base = unlocked[Math.floor(Math.random() * unlocked.length)];
    let flowerId = base.id;
    const rare = Garden.rareForParent(base.id);
    if (rare && Math.random() < 0.25) flowerId = rare.id;

    state.inventory.mysterySeed -= 1;
    state.plots[plotIdx] = {
      flowerId,
      stage: "seed",
      plantedAt: Date.now(),
      bloomAt: null,
      mystery: true,
    };
    return { ok: true };
  }
```

Add `plantMystery,` to the `Garden.state` export object (next to `plant,`).

- [ ] **Step 4: Refresh `lastSeenAt` in `js/storage.js` save**

In `save`, before `localStorage.setItem(...)`:

```js
      if (state.daily) state.daily.lastSeenAt = Date.now();
```

- [ ] **Step 5: Verify in browser console**

Reload `index.html`, then:

```js
localStorage.removeItem("dreamgarden.v1");
const s = Garden.state.createInitialState();
s.daily;                               // → {streakCount: 0, lastClaimDay: null, ..., lastSeenAt: 0}
s.inventory.mysterySeed = 2;
Garden.state.plantMystery(s, 0);       // → {ok: true}
s.plots[0].mystery;                    // → true
s.inventory.mysterySeed;               // → 1
Garden.state.plantMystery(s, 0);       // → {ok: false, reason: "occupied"}
Garden.storage.save(s);
s.daily.lastSeenAt > 0;                // → true
// Chest: force-complete all 3 quests
s.quests.forEach(q => { q.progress = q.target; });
s.quests[0].progress = s.quests[0].target - 1;
s.plots[1] = { flowerId: s.quests[0].flowerId, stage: "sunned", plantedAt: Date.now(), bloomAt: Date.now() - 1000 };
const r = Garden.state.harvest(s, 1);
r.questCompleted !== null;             // → true
r.chestAwarded;                        // → {coins: 125, potionId: "speedPotion" or "revivalPotion"}
s.daily.chestDay;                      // → today's key, e.g. "2026-06-13"
```

Expected: values as commented. (`chestAwarded.coins` is 125 at level 1.)

- [ ] **Step 6: Commit**

```bash
git add js/state.js js/storage.js
git commit -m "feat: daily state defaults, all-3 quest chest, mystery seed planting, lastSeenAt"
```

---

### Task 3: `js/svg.js` — calendar icon, chest, mystery sprout, draw prize icons

**Files:**
- Modify: `js/svg.js` (add consts near `SHOP_ICON` ~line 380; extend exports ~line 398)

- [ ] **Step 1: Add the new SVG art**

Insert before the `Garden.svg = {` export block:

```js
  // Calendar icon for the Daily button — red header, checkmark body.
  const CALENDAR_ICON = `
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" fill="#fff4d6" stroke="#7a5e2a" stroke-width="1"/>
      <rect x="3" y="5" width="18" height="5" rx="2" fill="#c94a4a"/>
      <rect x="6" y="3" width="2" height="4" rx="1" fill="#7a5e2a"/>
      <rect x="16" y="3" width="2" height="4" rx="1" fill="#7a5e2a"/>
      <path d="M8 14 L11 17 L16 12" stroke="#3e7d2f" stroke-width="2" fill="none" stroke-linecap="round"/>
    </svg>`;

  // Treasure chest for the all-3 daily quest bonus.
  const CHEST_ICON = `
    <svg viewBox="0 0 40 40" width="100%" height="100%">
      <rect x="6" y="18" width="28" height="14" rx="2" fill="#8b5a2b" stroke="#5a3815" stroke-width="1"/>
      <path d="M6 18 Q6 10 20 10 Q34 10 34 18 Z" fill="#a06a35" stroke="#5a3815" stroke-width="1"/>
      <rect x="17" y="16" width="6" height="8" rx="1" fill="#ffd84a" stroke="#b8860b" stroke-width="1"/>
    </svg>`;

  // Mystery sprout: green sprout with a "?" bubble — hides the resolved flower
  // while a mystery seed grows. Same 40x40 viewBox as the other stage art.
  const MYSTERY_SPROUT_SVG = `
    <svg viewBox="0 0 40 40" width="100%" height="100%">
      <rect x="19" y="20" width="2" height="14" fill="#3b8e3b"/>
      <ellipse cx="14" cy="26" rx="6" ry="3" fill="#56b256" transform="rotate(-20 14 26)"/>
      <ellipse cx="26" cy="28" rx="6" ry="3" fill="#56b256" transform="rotate(20 26 28)"/>
      <circle cx="20" cy="13" r="7" fill="#d6c98a" opacity="0.6"/>
      <text x="20" y="17" text-anchor="middle" font-size="11" font-weight="bold" fill="#7a5e2a">?</text>
    </svg>`;

  // Stage art for a growing mystery plot. Seed/watered look like any seed;
  // only the growing stage needs masking (its bud color would leak the flower).
  function mysterySproutSvg(stage) {
    if (stage === "seed") return SEED_SVG;
    if (stage === "watered") return WATERED_SVG;
    if (stage === "sunned") return SUNNED_SVG;
    return MYSTERY_SPROUT_SVG; // "growing"
  }

  // Icons for the lucky-draw prize row. Coin prizes stack 1-3 coins.
  function drawPrizeSvg(id) {
    if (id === "speedPotion" || id === "revivalPotion") return potionSvg(id);
    if (id === "mysterySeed") return MYSTERY_ICON;
    const count = id === "coinsSmall" ? 1 : id === "coinsMedium" ? 2 : 3;
    let circles = "";
    for (let i = 0; i < count; i++) {
      const cx = 20 - (count - 1) * 5 + i * 10;
      const cy = 24 - i * 4;
      circles += `<circle cx="${cx}" cy="${cy}" r="8" fill="#ffd84a" stroke="#b8860b" stroke-width="1.5"/>`;
    }
    return `<svg viewBox="0 0 40 40" width="100%" height="100%">${circles}</svg>`;
  }
```

- [ ] **Step 2: Extend the exports**

Change the `Garden.svg = {` block to also export the new names:

```js
  Garden.svg = {
    flowerSvg, flowerIcon, MYSTERY_ICON, BOOK_ICON, GEAR_ICON, SHOP_ICON,
    CALENDAR_ICON, CHEST_ICON, mysterySproutSvg, drawPrizeSvg,
    decorationSvg, potSvg, potionSvg,
  };
```

- [ ] **Step 3: Verify in browser console**

```js
Garden.svg.CALENDAR_ICON.includes("<svg");        // → true
Garden.svg.CHEST_ICON.includes("<svg");           // → true
Garden.svg.mysterySproutSvg("growing").includes("?");  // → true
Garden.svg.mysterySproutSvg("seed") === Garden.svg.mysterySproutSvg("seed"); // → true (no error)
Garden.svg.drawPrizeSvg("coinsLarge").match(/<circle/g).length; // → 3
Garden.svg.drawPrizeSvg("speedPotion").includes("<svg");        // → true
```

- [ ] **Step 4: Commit**

```bash
git add js/svg.js
git commit -m "feat: SVG art for calendar icon, quest chest, mystery sprout, draw prizes"
```

---

### Task 4: `js/render.js` + `styles.css` — Daily button, Morning Report modal, claim/spin handlers

**Files:**
- Modify: `js/render.js` (module flags ~line 12, `renderTopBar` ~line 44, `renderAll` ~line 537, `setupHandlers` ~line 586, Esc handler ~line 707, exports ~line 822)
- Modify: `styles.css` (append)

- [ ] **Step 1: Add module state and the report renderer to `js/render.js`**

Next to the other flags (`let shopOpen = false;`), add:

```js
  let dailyOpen = false;
  let dailyRecap = null; // recap computed at boot, shown in the Morning Report
```

Add these functions after `renderSettings`:

```js
  function streakRewardLabel(r) {
    const parts = [];
    if (r.coins) parts.push(r.coins + "c");
    if (r.potionId) {
      const potion = Garden.potionById(r.potionId);
      parts.push(potion ? potion.name : r.potionId);
    }
    if (r.mysterySeed) parts.push("Mystery Seed");
    return parts.join(" + ");
  }

  function renderDailyReport(state) {
    const daily = Garden.daily.ensureDaily(state);
    const today = Garden.daily.todayKey();
    const canClaim = Garden.daily.canClaimStreak(state);
    const canSpinNow = Garden.daily.canSpin(state);
    const nextPos = Garden.daily.nextStreakPosition(daily, today);
    // Highlight the position up next; after claiming, the one just claimed.
    const highlightPos = canClaim ? nextPos : ((daily.streakCount - 1) % 7) + 1;

    const overlay = el(`
      <div class="modal-overlay" data-action="daily-backdrop">
        <div class="modal-content daily-modal">
          <header class="modal-header">
            <h2>☀ Daily Garden Report</h2>
            <button class="modal-close" data-action="close-daily" aria-label="Close">✕</button>
          </header>
          <div class="daily-sections"></div>
          <footer class="daily-footer">
            <button class="shop-buy-btn daily-start-btn" data-action="close-daily">Start gardening</button>
          </footer>
        </div>
      </div>
    `);
    const sections = overlay.querySelector(".daily-sections");

    // --- While you were away ---
    if (dailyRecap && dailyRecap.show) {
      sections.appendChild(el(`
        <section class="daily-section">
          <h3 class="catalog-section-title">While you were away</h3>
          <div class="recap-line">🌸 ${dailyRecap.bloomed} bloomed · 🥀 ${dailyRecap.wilted} wilted · ✓ ${dailyRecap.readyNow} ready now</div>
        </section>
      `));
    }

    // --- Login streak ---
    const streakSec = el(`
      <section class="daily-section">
        <h3 class="catalog-section-title">Login Streak</h3>
        <div class="streak-strip"></div>
        <div class="streak-action"></div>
      </section>
    `);
    const strip = streakSec.querySelector(".streak-strip");
    Garden.daily.STREAK_REWARDS.forEach(r => {
      const current = r.day === highlightPos;
      const done = canClaim ? r.day < highlightPos : r.day <= highlightPos && !current;
      strip.appendChild(el(`
        <div class="streak-cell ${done ? "done" : ""} ${current ? "current" : ""}">
          <div class="streak-day">Day ${r.day}</div>
          <div class="streak-reward">${streakRewardLabel(r)}</div>
          ${done ? '<div class="streak-check">✓</div>' : ""}
        </div>
      `));
    });
    const action = streakSec.querySelector(".streak-action");
    if (canClaim) {
      const r = Garden.daily.STREAK_REWARDS[nextPos - 1];
      action.appendChild(el(
        `<button class="shop-buy-btn" data-action="daily-claim">Claim Day ${nextPos}: ${streakRewardLabel(r)}</button>`
      ));
    } else {
      action.appendChild(el(`<span class="shop-status active">Claimed today ✓ — come back tomorrow</span>`));
    }
    sections.appendChild(streakSec);

    // --- Lucky draw ---
    const drawSec = el(`
      <section class="daily-section">
        <h3 class="catalog-section-title">Lucky Draw</h3>
        <div class="draw-row"></div>
        <div class="draw-action"></div>
      </section>
    `);
    const row = drawSec.querySelector(".draw-row");
    Garden.daily.DRAW_PRIZES.forEach(p => {
      row.appendChild(el(`
        <div class="draw-prize" data-prize-id="${p.id}" title="${p.label}">
          <div class="draw-prize-icon">${Garden.svg.drawPrizeSvg(p.id)}</div>
          <div class="draw-prize-label">${p.label}</div>
        </div>
      `));
    });
    const drawAction = drawSec.querySelector(".draw-action");
    if (canSpinNow) {
      drawAction.appendChild(el(`<button class="shop-buy-btn" data-action="daily-spin">🎰 Spin (free today)</button>`));
    } else {
      drawAction.appendChild(el(`<span class="shop-status">Spun today — come back tomorrow</span>`));
    }
    sections.appendChild(drawSec);

    return overlay;
  }
```

- [ ] **Step 2: Add the Daily button to `renderTopBar`**

In the `topbar-right` div, before the Shop button, insert:

```js
          <button class="icon-btn" data-action="open-daily" title="Daily Report" aria-label="Open daily report">
            ${Garden.svg.CALENDAR_ICON}
            <span>Daily</span>
            ${claimables > 0 ? `<span class="daily-badge">${claimables}</span>` : ""}
          </button>
```

And at the top of `renderTopBar` (next to the other consts), add:

```js
    const claimables = Garden.daily ? Garden.daily.claimablesCount(state) : 0;
```

- [ ] **Step 3: Mount the modal in `renderAll`**

After `if (shopOpen) app.appendChild(renderShop(state));` add:

```js
    if (dailyOpen) app.appendChild(renderDailyReport(state));
```

- [ ] **Step 4: Add handlers in `setupHandlers`**

After the shop backdrop block (and before the `buy-decoration` block), add:

```js
      // Daily report: open / close / backdrop / claim / spin
      if (ev.target.closest("[data-action='open-daily']")) {
        dailyOpen = true;
        renderAll(currentState);
        return;
      }
      if (ev.target.closest("[data-action='close-daily']")) {
        dailyOpen = false;
        renderAll(currentState);
        return;
      }
      const dailyBackdrop = ev.target.closest("[data-action='daily-backdrop']");
      if (dailyBackdrop && !ev.target.closest(".modal-content")) {
        dailyOpen = false;
        renderAll(currentState);
        return;
      }
      const claimBtn = ev.target.closest("[data-action='daily-claim']");
      if (claimBtn) {
        const result = Garden.daily.claimStreak(currentState);
        if (result.ok && Garden.fx) {
          Garden.fx.toast("Day " + result.position + " reward: " + streakRewardLabel(result.reward), { variant: "level" });
        }
        Garden.storage.save(currentState);
        renderAll(currentState);
        return;
      }
      const spinBtn = ev.target.closest("[data-action='daily-spin']");
      if (spinBtn && !spinBtn.disabled) {
        const result = Garden.daily.spinDraw(currentState);
        if (!result.ok) return;
        Garden.storage.save(currentState);
        spinBtn.disabled = true;
        // Cycling-highlight animation that lands on the won prize (~1.5-2s),
        // then rerender + toast. No rerender during the animation.
        const icons = Array.from(document.querySelectorAll(".draw-prize"));
        const target = icons.findIndex(n => n.dataset.prizeId === result.prizeId);
        let i = 0;
        const steps = 12 + (target >= 0 ? target : 0);
        const timer = setInterval(() => {
          icons.forEach(n => n.classList.remove("spin-active"));
          icons[i % icons.length].classList.add("spin-active");
          if (i >= steps) {
            clearInterval(timer);
            const msg = result.coins
              ? "+" + result.coins + " coins!"
              : "You won: " + result.label + "!";
            if (Garden.fx) Garden.fx.toast("Lucky draw: " + msg, { variant: "rare" });
            renderAll(currentState);
          }
          i++;
        }, 120);
        return;
      }
```

Update the modal click-swallow line (currently `if (catalogOpen || settingsOpen || shopOpen) return;`) to:

```js
      if (catalogOpen || settingsOpen || shopOpen || dailyOpen) return;
```

In the Esc keydown handler, add a `dailyOpen` branch after the `catalogOpen` branch:

```js
      } else if (dailyOpen) {
        dailyOpen = false;
        if (currentState) renderAll(currentState);
```

- [ ] **Step 5: Export `openDailyReport`**

Add to the `Garden.render = {` export object:

```js
    openDailyReport: (recap) => { dailyOpen = true; dailyRecap = recap || null; },
```

- [ ] **Step 6: Append daily-modal CSS to `styles.css`**

```css
/* ===== Daily report modal ===== */
.daily-modal { max-width: 460px; }
.daily-section { margin-bottom: 16px; }
.recap-line { font-size: 14px; color: #5a3e0a; padding: 6px 2px; }
.streak-strip { display: flex; gap: 4px; margin-bottom: 8px; }
.streak-cell {
  flex: 1;
  background: #fff8e0;
  border: 1px solid #e0d0a0;
  border-radius: 6px;
  padding: 4px 2px;
  text-align: center;
  position: relative;
}
.streak-cell.done { opacity: 0.55; }
.streak-cell.current {
  border-color: #b8860b;
  background: #ffefb8;
  box-shadow: 0 0 0 2px rgba(255, 216, 74, 0.4);
}
.streak-day { font-size: 10px; font-weight: bold; color: #7a5e2a; }
.streak-reward { font-size: 9px; color: #5a3e0a; min-height: 22px; }
.streak-check { position: absolute; top: 2px; right: 4px; color: #3e7d2f; font-size: 10px; font-weight: bold; }
.streak-action, .draw-action { display: flex; justify-content: center; margin-top: 4px; }
.draw-row { display: flex; gap: 6px; margin-bottom: 8px; }
.draw-prize {
  flex: 1;
  background: #fff8e0;
  border: 1px solid #e0d0a0;
  border-radius: 6px;
  padding: 4px;
  text-align: center;
  transition: transform 0.1s, box-shadow 0.1s;
}
.draw-prize-icon { width: 32px; height: 32px; margin: 0 auto; }
.draw-prize-label { font-size: 8px; color: #5a3e0a; }
.draw-prize.spin-active {
  transform: scale(1.12);
  box-shadow: 0 0 0 2px #ffd84a;
  background: #ffefb8;
}
.daily-footer { display: flex; justify-content: center; padding-top: 8px; border-top: 1px solid #e0d0a0; }
.icon-btn { position: relative; }
.daily-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  background: #c94a4a;
  color: #fff;
  font-size: 10px;
  font-weight: bold;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
}
```

- [ ] **Step 7: Verify in browser**

Reload `index.html`:
1. Topbar shows a **Daily** button with a red badge "2".
2. Click it → Morning Report opens: streak strip (Day 1 highlighted), Claim button, draw row with 6 prizes, Spin button. (No recap section yet — that's wired at boot in Task 6.)
3. Click **Claim Day 1: 50c** → toast "Day 1 reward: 50c", coins +50, claim button becomes "Claimed today ✓", badge drops to "1".
4. Click **Spin** → highlight cycles across prizes ~1.5s, lands on one, toast announces the prize, badge disappears.
5. Reopen the modal → both rows show "come back tomorrow"; reload page → still claimed/spun (persisted).
6. Esc and backdrop-click both close the modal; clicks on plots are swallowed while it's open.

- [ ] **Step 8: Commit**

```bash
git add js/render.js styles.css
git commit -m "feat: Daily button with badge, Morning Report modal, streak claim + lucky draw UI"
```

---

### Task 5: `js/render.js` + `styles.css` — mystery seed card, "?" sprout, daily quest panel UI

**Files:**
- Modify: `js/render.js` (`renderGrid` ~line 155, `renderQuests` ~line 439, `renderShelf` ~line 505, `renderAll` seed validation ~line 513, `handlePlotClick` plant branch ~line 765)
- Modify: `styles.css` (append)

- [ ] **Step 1: Hide growing mystery plots in `renderGrid`**

Replace the line `content.innerHTML = Garden.svg.flowerSvg(plot.flowerId, stage);` with:

```js
        const hideFlower = plot.mystery && stage !== "bloomed" && stage !== "wilted";
        content.innerHTML = hideFlower
          ? Garden.svg.mysterySproutSvg(stage)
          : Garden.svg.flowerSvg(plot.flowerId, stage);
```

(When `hideFlower` is true, `stage` is always "seed", "watered", or "growing" — `mysterySproutSvg` renders the first two like any seed and masks "growing" with the "?" sprout.)

- [ ] **Step 2: Add the mystery seed card at the end of `renderShelf`**

After the `Garden.FLOWERS.forEach(...)` loop, before `return wrap;`:

```js
    const mysteryCount = (state.inventory && state.inventory.mysterySeed) || 0;
    if (mysteryCount > 0) {
      const card = document.createElement("div");
      card.className = "seed-card mystery-seed" + (selectedSeedId === "mysterySeed" ? " selected" : "");
      card.dataset.flowerId = "mysterySeed";
      card.innerHTML = `
        <div class="seed-icon">${Garden.svg.MYSTERY_ICON}</div>
        <div class="seed-info">
          <div class="seed-name">Mystery</div>
          <span class="seed-cost">×${mysteryCount} · free</span>
        </div>
      `;
      seedsEl.appendChild(card);
    }
```

(The existing seed-shelf click handler already picks this up via `.seed-card` + `dataset.flowerId`; no handler change needed.)

- [ ] **Step 3: Guard the seed validation in `renderAll`**

Replace the validation block at the top of `renderAll`:

```js
    // Ensure selectedSeedId is still valid; otherwise pick the first unlocked.
    if (selectedSeedId === "mysterySeed") {
      const count = (state.inventory && state.inventory.mysterySeed) || 0;
      if (count <= 0) selectedSeedId = null;
    } else {
      const selectedFlower = Garden.flowerById(selectedSeedId);
      if (!selectedFlower || state.level < selectedFlower.levelReq) selectedSeedId = null;
    }
    if (!selectedSeedId) {
      const firstUnlocked = Garden.FLOWERS.find(f => state.level >= f.levelReq);
      selectedSeedId = firstUnlocked ? firstUnlocked.id : null;
    }
```

- [ ] **Step 4: Route mystery planting in `handlePlotClick`**

Replace the `if (!plot) { ... }` branch:

```js
    if (!plot) {
      if (!selectedSeedId) return;
      if (selectedSeedId === "mysterySeed") {
        Garden.state.plantMystery(state, idx);
      } else {
        Garden.state.plant(state, idx, selectedSeedId);
      }
    } else {
```

(When the last mystery seed is used, the Step 3 validation resets the selection on the next render.)

- [ ] **Step 5: Daily quest panel — NEW badge, ✓ on done quests, chest row**

Replace `renderQuests` with:

```js
  function renderQuests(state) {
    const quests = (state.quests || []);
    if (quests.length === 0) return null;
    const fresh = quests.every(q => q.progress === 0);
    const today = Garden.daily ? Garden.daily.todayKey() : null;
    const chestDone = !!(state.daily && state.daily.chestDay === today);

    const wrap = el(`
      <div class="quests-bar">
        <div class="quests-label">Daily Orders${fresh ? ' <span class="new-badge">NEW</span>' : ""}</div>
        <div class="quests-list"></div>
        <div class="quest-chest ${chestDone ? "chest-open" : ""}" title="Complete all 3 daily orders for a bonus chest">
          <div class="chest-icon">${Garden.svg.CHEST_ICON}</div>
          <div class="chest-text">${chestDone ? "Chest claimed! ✓" : "Complete all 3 for a bonus chest"}</div>
        </div>
      </div>
    `);
    const list = wrap.querySelector(".quests-list");

    quests.forEach(q => {
      const flower = Garden.flowerById(q.flowerId);
      if (!flower) return; // defensive
      const done = q.progress >= q.target;
      const pct = Math.min(100, Math.floor((q.progress / q.target) * 100));
      const card = el(`
        <div class="quest-card ${done ? "quest-done" : ""}">
          <div class="quest-icon">${Garden.svg.flowerIcon(q.flowerId)}</div>
          <div class="quest-info">
            <div class="quest-text">Deliver ${q.target} ${pluralize(flower.name, q.target)}</div>
            <div class="quest-progress-bar"><div class="quest-progress-fill" style="width:${pct}%"></div></div>
            <div class="quest-count">${q.progress}/${q.target}</div>
          </div>
          ${done ? '<div class="quest-done-check">✓</div>' : ""}
        </div>
      `);
      list.appendChild(card);
    });

    return wrap;
  }
```

- [ ] **Step 6: Chest toast in `emitHarvestFx`**

After the `questCompleted` toast block, add:

```js
    if (result.chestAwarded && Garden.fx) {
      const potion = Garden.potionById(result.chestAwarded.potionId);
      Garden.fx.toast(
        "Daily chest! +" + result.chestAwarded.coins + "c and a " + (potion ? potion.name : "potion"),
        { variant: "rare" }
      );
    }
```

- [ ] **Step 7: Append CSS to `styles.css`**

```css
/* ===== Mystery seed + daily quests ===== */
.seed-card.mystery-seed { border-color: #b89be0; background: #f3edff; }
.seed-card.mystery-seed.selected { border-color: #8a5fd0; box-shadow: 0 0 0 3px rgba(138, 95, 208, 0.18); }
.quest-card.quest-done { opacity: 0.6; }
.quest-done-check { color: #3e7d2f; font-weight: bold; font-size: 16px; }
.new-badge {
  background: #c94a4a;
  color: #fff;
  font-size: 9px;
  font-weight: bold;
  border-radius: 4px;
  padding: 1px 4px;
  vertical-align: middle;
}
.quest-chest { display: flex; align-items: center; gap: 6px; margin-top: 6px; opacity: 0.7; }
.quest-chest.chest-open { opacity: 1; }
.chest-icon { width: 24px; height: 24px; flex-shrink: 0; }
.chest-text { font-size: 11px; color: #5a3e0a; }
```

- [ ] **Step 8: Verify in browser**

Reload `index.html`, in console: `localStorage.removeItem("dreamgarden.v1")` then reload again.
1. Quest bar now says **Daily Orders** with a NEW badge and a greyed chest row.
2. Cheat in mystery seeds for UI testing (console):
   ```js
   const raw = JSON.parse(localStorage.getItem("dreamgarden.v1"));
   raw.inventory.mysterySeed = 2; localStorage.setItem("dreamgarden.v1", JSON.stringify(raw)); location.reload();
   ```
3. A purple **Mystery ×2 · free** card appears at the end of the seed shelf. Select it, click an empty plot → seed planted, count drops to ×1.
4. Water + sun it → during growth the plot shows the green sprout with "?" bubble (not a colored bud).
5. Complete a quest (plant/harvest its flower) → quest card greys out with ✓ and stays (no new quest replaces it).
6. Plant the last mystery seed → card disappears from shelf, selection falls back to Daisy.

- [ ] **Step 9: Commit**

```bash
git add js/render.js styles.css
git commit -m "feat: mystery seed shelf card + hidden sprout, daily quest panel with NEW badge and chest"
```

---

### Task 6: `js/main.js` — boot rollover, recap, auto-open, mystery reveal

**Files:**
- Modify: `js/main.js` (`start` ~line 80, `tick` ~line 12)

- [ ] **Step 1: Wire the daily systems into `start`**

After the `if (!state.inventory ...)` default block and BEFORE `Garden.render.setupHandlers();`, add:

```js
    // Daily systems: recap must be computed BEFORE the first save of this
    // session overwrites daily.lastSeenAt.
    Garden.daily.ensureDaily(state);
    const recap = Garden.daily.computeRecap(state);
    Garden.daily.rolloverQuests(state);
    Garden.storage.save(state);
    if (Garden.daily.claimablesCount(state) > 0) {
      Garden.render.openDailyReport(recap);
    }
```

- [ ] **Step 2: Reveal mystery blooms in `tick`**

At the top of `tick`, right after `const now = Date.now();`, add:

```js
    // Reveal mystery plots when they bloom (or wilt unbloomed-seen):
    // record rare discovery once, then drop the mystery flag.
    let revealed = false;
    state.plots.forEach(plot => {
      if (!plot || !plot.mystery) return;
      const stage = Garden.state.getStage(plot, now);
      if (stage !== "bloomed" && stage !== "wilted") return;
      delete plot.mystery;
      revealed = true;
      const flower = Garden.flowerById(plot.flowerId);
      if (flower && flower.rare) {
        if (!state.discovered) state.discovered = {};
        if (!state.discovered[flower.id] && Garden.fx) {
          Garden.fx.toast("Mystery seed revealed: " + flower.name + "! (RARE)", { variant: "rare" });
        }
        state.discovered[flower.id] = true;
      } else if (flower && Garden.fx) {
        Garden.fx.toast("Mystery seed revealed: " + flower.name + "!", { variant: "level" });
      }
    });
    if (revealed) Garden.storage.save(state);
```

(The stage transition also changes `stageSignature`, so the existing rerender path repaints the revealed flower in the same tick.)

- [ ] **Step 3: Verify in browser**

1. Fresh day boot: reload → Morning Report auto-opens (claim + spin available). Claim, spin, close. Reload → it does NOT auto-open (nothing claimable).
2. `_setDayOffset` is a module variable and does not survive a reload, so simulate a new day by editing the save instead:
   ```js
   const raw = JSON.parse(localStorage.getItem("dreamgarden.v1"));
   raw.daily.lastClaimDay = "2026-06-01"; raw.daily.lastSpinDay = "2026-06-01"; raw.daily.questsDay = "2026-06-01";
   raw.daily.lastSeenAt = Date.now() - 3 * 3600 * 1000; // "away" 3 hours
   localStorage.setItem("dreamgarden.v1", JSON.stringify(raw)); location.reload();
   ```
   → Morning Report auto-opens with fresh quests (NEW badge), claimable streak (rewound one step if the gap was >1 day), spin available. If plots bloomed/wilted during the simulated absence, the recap section appears with correct counts.
3. Mystery reveal: plant a mystery seed, water+sun, wait for bloom → toast "Mystery seed revealed: ...!" and the real flower appears. If it's a rare: RARE toast once, and the Catalog now shows it discovered.
4. Harvest a revealed mystery rare → quest progress ticks for its parent flower (existing parentId logic).

- [ ] **Step 4: Commit**

```bash
git add js/main.js
git commit -m "feat: boot-time daily rollover + recap + Morning Report auto-open, mystery bloom reveal"
```

---

### Task 7: Full manual test pass (spec checklist)

**Files:**
- Modify: only if bugs are found

- [ ] **Step 1: Run the spec's manual test plan end-to-end**

Use the save-editing snippet from Task 6 Step 3 to simulate day gaps (set `lastClaimDay`/`lastSpinDay`/`questsDay` to past dates). Check off each:

1. Fresh save (`localStorage.removeItem("dreamgarden.v1")`, reload) → Morning Report shows day-1 claim, spin available, 3 quests with NEW badge.
2. Same-day reload after claim + spin → no auto-open, Daily badge gone.
3. Simulated +1 day → auto-open, day-2 claim, fresh quests, NEW badge.
4. Simulated +2 day gap (e.g. `lastClaimDay` set to 3 days ago with `streakCount: 3`) → claim awards position 3 (rewound 3→2, next = 3).
5. Set `streakCount: 6`, `lastClaimDay` yesterday → claim awards Day 7 (mystery seed + 500c); next day's claim → Day 1 again.
6. Double-claim / double-spin in one day → buttons replaced by "come back tomorrow" labels; direct console calls return `{ok: false}`.
7. Mystery seed: plant → "?" sprout while growing → reveal toast at bloom → harvest works; rare path discovered in Catalog (force with `Garden.state.plantMystery` repeatedly at console if needed).
8. Recap: with a growing plot, set `daily.lastSeenAt` 3h back and `bloomAt` inside that window (console edit), reload → recap line shows 1 bloomed; absence under 10 min → no recap section.
9. Complete all 3 daily quests → chest toast once, chest row lights up; further harvests that day award no second chest.
10. Pre-feature save shape (delete `daily` key from the stored JSON, reload) → no errors; old quests adopted; everything above still works.

Also regression-check existing features: plant/water/sun/harvest, wilt+clear, potions buy/use, pot skins, decorations, catalog, settings, expand.

- [ ] **Step 2: Fix anything found, commit fixes individually**

```bash
git add <files>
git commit -m "fix: <specific issue found in daily-engagement test pass>"
```

- [ ] **Step 3: Final commit if any stragglers remain**

Working tree should be clean apart from the untracked local reference files (Thai blog HTML, pptx — never commit those).

---

## Execution notes

- Tasks 1-3 are console-verifiable logic/art; Tasks 4-6 are browser UI; Task 7 is the integration pass.
- Task order matters: 4 depends on 1+3 (daily module + icons), 5 depends on 2+3, 6 depends on 4 (`openDailyReport` export).
- Never bump `storage.js` VERSION — version mismatch wipes saves by design; all new fields are defensively defaulted instead.




