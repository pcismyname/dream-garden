# Landscape Layout & Mobile Tab Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single 720-px portrait-ish layout with two responsive shapes — desktop three-column landscape (≥ 768 × 500 px) and mobile portrait four-tab bottom bar (otherwise) — so the game clears CrazyGames' layout gate.

**Architecture:** A JS-driven viewport mode (`"desktop"` / `"mobile"`) toggles a class on the `<div id="app">` root. CSS rules under `.shape-desktop` and `.shape-mobile` define the two shapes. `renderAll(state)` becomes a thin router that calls either `renderDesktopBody(state)` or `renderMobileBody(state)`; the existing per-section renderers (`renderTopBar`, `renderGrid`, `renderShelf`, `renderQuests`, `renderInventory`, `renderDecorationZone`, `renderShop`, `renderDailyReport`) are reused unchanged — only their containers and call ordering change. Catalog + Settings stay overlay modals on both shapes. Shop + Daily are overlay modals on desktop, tab content on mobile. State shape is untouched.

**Tech Stack:** Zero-build vanilla JS (`window.Garden` namespace, plain script tags, works on `file://`), CSS Grid + Flexbox, `window.matchMedia` for viewport detection, `ResizeObserver` not required (resize event with debounce). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-06-21-landscape-layout-design.md`

**Testing:** No test runner (project is intentionally zero-build). Tasks 1–5 are statically verifiable (syntax check + grep for landmark code). Task 6 is the manual browser smoke test pass.

**Conventions you must follow:**
- Files attach to `window.Garden` via IIFE wrappers already in place — don't break them.
- Never bump `storage.js` VERSION — version mismatch wipes saves by design.
- After any state mutation: `Garden.storage.save(currentState); renderAll(currentState);`
- This change does NOT touch state. There is no migration step.
- All commits go to `master` directly — the project has no feature-branch convention. (Confirmed in memory: "branch: master, no feature branches".)

---

### Task 1: Viewport detection + body router scaffolding

**Files:**
- Modify: `js/render.js` (top-of-IIFE declarations, `renderAll`, `setupHandlers`)

**Outcome:** No visible change. After this task, `document.getElementById("app").className` flips between `"shape-desktop"` and `"shape-mobile"` as you resize the window across 768 px / 500 px height. The existing single-column layout still renders inside both classes (no CSS rules under `.shape-*` exist yet). This task wires the plumbing without changing the picture.

- [ ] **Step 1: Add viewport state at the top of the IIFE**

In `js/render.js`, find the existing module-local declarations near the top:

```js
  let selectedSeedId = "daisy";
  let selectedPotionId = null;  // when set, next plot click applies this potion
  let catalogOpen = false;
  let settingsOpen = false;
  let shopOpen = false;
  let dailyOpen = false;
  let dailyRecap = null; // recap computed at boot, shown in the Morning Report
```

Add two new lines immediately after the `dailyRecap` declaration:

```js
  let viewport = "desktop";    // "desktop" | "mobile" — recomputed on every renderAll
  let currentTab = "garden";   // "garden" | "orders" | "shop" | "daily" — mobile only
```

- [ ] **Step 2: Add the viewport sync helper**

In `js/render.js`, find the `el` helper at the top of the IIFE:

```js
  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }
```

Add this function immediately after `el`:

```js
  // Mobile shape applies when the viewport is narrow (phone) OR short
  // (phone in landscape on a short screen). Otherwise desktop shape.
  function syncViewport() {
    const narrow = window.innerWidth < 768;
    const short = window.innerHeight < 500;
    viewport = (narrow || short) ? "mobile" : "desktop";
  }
```

- [ ] **Step 3: Update `renderAll` to apply the shape class**

In `js/render.js`, find `renderAll`:

```js
  function renderAll(state) {
    currentState = state;
    // ... selectedSeedId validation ...
    const app = document.getElementById("app");
    app.innerHTML = "";
    app.appendChild(renderTopBar(state));
    // ...
  }
```

Update the body of `renderAll` so the very first action is `syncViewport()` and the `app.innerHTML = ""` line is followed by setting `className`. The minimal patch:

Replace the line:

```js
    const app = document.getElementById("app");
    app.innerHTML = "";
```

with:

```js
    syncViewport();
    const app = document.getElementById("app");
    app.innerHTML = "";
    app.className = viewport === "mobile" ? "shape-mobile" : "shape-desktop";
```

Leave the rest of `renderAll` exactly as it is. The existing single-column rendering still happens, just inside a now-classed container.

- [ ] **Step 4: Add a debounced resize listener inside `setupHandlers`**

In `js/render.js`, find `function setupHandlers() {`:

```js
  function setupHandlers() {
    const app = document.getElementById("app");
    app.addEventListener("click", (ev) => {
```

Immediately after the `const app = document.getElementById("app");` line, add the resize listener:

```js
    // Re-render on resize so the shape (desktop vs mobile) tracks the viewport.
    // Debounce so dragging the window edge does not thrash.
    let resizeTimer = null;
    window.addEventListener("resize", () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (currentState) renderAll(currentState);
      }, 150);
    });
```

- [ ] **Step 5: Static check**

Run:

```powershell
node -c js/render.js
```

Expected: no output (clean parse). Then:

```powershell
Select-String -Path js/render.js -Pattern 'syncViewport|let viewport|let currentTab|window\.addEventListener\("resize"' | Select-Object -ExpandProperty Line
```

Expected: at least 5 matching lines.

- [ ] **Step 6: Commit**

```powershell
git add js/render.js
git commit -m "feat: viewport detection + shape class scaffolding (no visible change)"
```

---

### Task 2: Desktop three-column shape

**Files:**
- Modify: `styles.css` (append new section)
- Modify: `js/render.js` (extract `renderAll` body into `renderDesktopBody`, add the new three-column DOM structure)

**Outcome:** On viewports ≥ 768 × 500 px, the game now renders as a true landscape layout: top bar across the top, a left column with the seed shelf (vertical) and inventory, the garden grid + decoration strip in a wide center column, and the quest panel + daily preview in the right column. The Settings / Shop / Catalog / Daily modals still open as overlays the same as before. Mobile (< 768 px) still renders the existing single-column layout because `renderMobileBody` is implemented in Task 3.

- [ ] **Step 1: Append the desktop shape CSS at the end of `styles.css`**

Open `styles.css`. Append at the end of the file:

```css
/* ===== Desktop landscape shape (>= 768 x 500) ===== */

#app.shape-desktop {
  max-width: none;
  width: 100%;
  display: grid;
  grid-template-rows: auto 1fr;
  grid-template-columns: 160px 1fr 240px;
  grid-template-areas:
    "top top top"
    "left center right";
  gap: 0;
  min-height: 100vh;
}

#app.shape-desktop > .topbar {
  grid-area: top;
}

#app.shape-desktop > .desktop-left {
  grid-area: left;
  background: rgba(255, 244, 214, 0.85);
  border-right: 2px solid #e6d9a8;
  padding: 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
}

#app.shape-desktop > .desktop-center {
  grid-area: center;
  padding: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

#app.shape-desktop > .desktop-right {
  grid-area: right;
  background: rgba(255, 244, 214, 0.85);
  border-left: 2px solid #e6d9a8;
  padding: 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
}

/* Seeds become a vertical strip in the left column. */
#app.shape-desktop .seed-shelf {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: transparent;
  border: none;
  padding: 0;
}

#app.shape-desktop .seed-shelf .seed-card {
  width: 100%;
}

/* Inventory bar becomes a vertical block in the left column. */
#app.shape-desktop .inventory-bar {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: transparent;
  border: none;
  padding: 0;
}

/* Quest panel becomes a vertical block in the right column. */
#app.shape-desktop .quests-panel {
  position: static;
  width: auto;
  max-width: none;
}

/* Desktop right column header chips. */
#app.shape-desktop .desktop-section-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #5a3e0a;
  padding: 4px 2px;
  border-bottom: 1px solid #d6c98a;
  margin-bottom: 2px;
}

/* Daily preview block in the right column. */
#app.shape-desktop .daily-preview {
  background: #fff4d6;
  border: 1px solid #d6c98a;
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 12px;
  color: #3a2e0a;
  cursor: pointer;
}

#app.shape-desktop .daily-preview:hover {
  background: #fff9e0;
}

#app.shape-desktop .daily-preview .dp-line {
  margin-bottom: 4px;
}

#app.shape-desktop .daily-preview .dp-line:last-child {
  margin-bottom: 0;
}
```

- [ ] **Step 2: Add the `renderDesktopBody` function in `js/render.js`**

Open `js/render.js`. Find the line right before `function renderAll(state) {` (the line should be a closing `}` of `renderShelf`). Insert this new function just BEFORE `function renderAll(state) {`:

```js
  function renderDailyPreview(state) {
    if (!Garden.daily) return null;
    const claimables = Garden.daily.claimablesCount(state);
    const wrap = document.createElement("div");
    wrap.className = "daily-preview";
    wrap.setAttribute("data-action", "open-daily");
    const day = (state.daily && state.daily.streakCount) ? (state.daily.streakCount % 7) + 1 : 1;
    let html = '<div class="dp-line"><b>Day ' + day + '</b> of 7-day streak</div>';
    if (claimables > 0) {
      html += '<div class="dp-line">⚡ ' + claimables + ' to claim — tap to open</div>';
    } else {
      html += '<div class="dp-line">All caught up today.</div>';
    }
    wrap.innerHTML = html;
    return wrap;
  }

  function renderDesktopBody(state) {
    const app = document.getElementById("app");

    // Top bar spans all three columns.
    app.appendChild(renderTopBar(state));

    // Left column: seeds + inventory (potions).
    const left = document.createElement("div");
    left.className = "desktop-left";
    const seedsLabel = document.createElement("div");
    seedsLabel.className = "desktop-section-label";
    seedsLabel.textContent = "Seeds";
    left.appendChild(seedsLabel);
    left.appendChild(renderShelf(state));
    const invEl = renderInventory(state);
    if (invEl) {
      const invLabel = document.createElement("div");
      invLabel.className = "desktop-section-label";
      invLabel.textContent = "Potions";
      left.appendChild(invLabel);
      left.appendChild(invEl);
    }
    app.appendChild(left);

    // Center column: garden grid + decoration strip below.
    const center = document.createElement("div");
    center.className = "desktop-center";
    const gardenEl = renderGrid(state);
    if (selectedPotionId) gardenEl.classList.add("potion-use-mode");
    center.appendChild(gardenEl);
    const decoZone = renderDecorationZone(state);
    if (decoZone) center.appendChild(decoZone);
    app.appendChild(center);

    // Right column: quests + daily preview.
    const right = document.createElement("div");
    right.className = "desktop-right";
    const questsLabel = document.createElement("div");
    questsLabel.className = "desktop-section-label";
    questsLabel.textContent = "Today's orders";
    right.appendChild(questsLabel);
    const questsEl = renderQuests(state);
    if (questsEl) right.appendChild(questsEl);
    const dailyLabel = document.createElement("div");
    dailyLabel.className = "desktop-section-label";
    dailyLabel.textContent = "Daily";
    right.appendChild(dailyLabel);
    const dpEl = renderDailyPreview(state);
    if (dpEl) right.appendChild(dpEl);
    app.appendChild(right);

    // Overlays (Catalog, Settings, Shop, Daily modal) on top.
    if (catalogOpen) app.appendChild(renderCatalog(state));
    if (settingsOpen) app.appendChild(renderSettings(state));
    if (shopOpen) app.appendChild(renderShop(state));
    if (dailyOpen) app.appendChild(renderDailyReport(state));
  }
```

- [ ] **Step 3: Update `renderAll` to call `renderDesktopBody` on desktop**

In `js/render.js`, find the current `renderAll` (the one we touched in Task 1). The body after the selectedSeedId block currently looks like:

```js
    syncViewport();
    const app = document.getElementById("app");
    app.innerHTML = "";
    app.className = viewport === "mobile" ? "shape-mobile" : "shape-desktop";
    app.appendChild(renderTopBar(state));
    const questsEl = renderQuests(state);
    if (questsEl) app.appendChild(questsEl);

    const gardenEl = renderGrid(state);
    const decoZone = renderDecorationZone(state);
    if (decoZone) gardenEl.appendChild(decoZone);
    if (selectedPotionId) gardenEl.classList.add("potion-use-mode");
    app.appendChild(gardenEl);

    const inventoryEl = renderInventory(state);
    if (inventoryEl) app.appendChild(inventoryEl);

    app.appendChild(renderShelf(state));
    if (catalogOpen) app.appendChild(renderCatalog(state));
    if (settingsOpen) app.appendChild(renderSettings(state));
    if (shopOpen) app.appendChild(renderShop(state));
    if (dailyOpen) app.appendChild(renderDailyReport(state));
  }
```

Replace everything from `app.appendChild(renderTopBar(state));` down to and including the line `if (dailyOpen) app.appendChild(renderDailyReport(state));` with this branching block (note: keep `app.innerHTML = ""` and the className line — they stay):

```js
    if (viewport === "desktop") {
      renderDesktopBody(state);
    } else {
      // Mobile body is added in Task 3. Until then, render the legacy single-column
      // layout so phone viewport still works during the transition.
      app.appendChild(renderTopBar(state));
      const questsEl = renderQuests(state);
      if (questsEl) app.appendChild(questsEl);
      const gardenEl = renderGrid(state);
      const decoZone = renderDecorationZone(state);
      if (decoZone) gardenEl.appendChild(decoZone);
      if (selectedPotionId) gardenEl.classList.add("potion-use-mode");
      app.appendChild(gardenEl);
      const inventoryEl = renderInventory(state);
      if (inventoryEl) app.appendChild(inventoryEl);
      app.appendChild(renderShelf(state));
      if (catalogOpen) app.appendChild(renderCatalog(state));
      if (settingsOpen) app.appendChild(renderSettings(state));
      if (shopOpen) app.appendChild(renderShop(state));
      if (dailyOpen) app.appendChild(renderDailyReport(state));
    }
  }
```

- [ ] **Step 4: Static check**

Run:

```powershell
node -c js/render.js
```

Expected: no output.

```powershell
Select-String -Path js/render.js -Pattern 'function renderDesktopBody|function renderDailyPreview|desktop-left|desktop-right|desktop-center' | Measure-Object | Select-Object -ExpandProperty Count
```

Expected: ≥ 5.

```powershell
Select-String -Path styles.css -Pattern '#app\.shape-desktop' | Measure-Object | Select-Object -ExpandProperty Count
```

Expected: ≥ 10.

- [ ] **Step 5: Commit**

```powershell
git add js/render.js styles.css
git commit -m "feat: desktop three-column landscape shape"
```

---

### Task 3: Mobile tab bar shape

**Files:**
- Modify: `styles.css` (append mobile shape rules)
- Modify: `js/render.js` (add `renderTabBar`, `renderMobileBody`; remove the legacy fallback inside `renderAll`)

**Outcome:** On viewports < 768 px (or < 500 px tall), the game renders as a compact top bar over a swappable tab panel, with a four-button bar (`🌱 Garden / 📋 Orders / 🛒 Shop / 📅 Daily`) fixed at the bottom. Tabs switch synchronously — no page reload, no URL change. Default tab is "garden". Catalog + Settings still open as overlay modals (they're separate from the tab system). Shop + Daily still open as overlay modals on desktop AND as tab content on mobile — the overlay version is what fires when the user taps the tab button in this task; Task 4 wires the actual tab-as-content rendering.

- [ ] **Step 1: Append the mobile shape CSS at the end of `styles.css`**

Open `styles.css`. Append at the end:

```css
/* ===== Mobile portrait shape (< 768px wide or < 500px tall) ===== */

#app.shape-mobile {
  max-width: none;
  width: 100%;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  position: relative;
}

#app.shape-mobile > .topbar {
  padding: 8px 12px;
  gap: 8px;
}

/* Hide the desktop column wrappers if they leak in (defensive). */
#app.shape-mobile > .desktop-left,
#app.shape-mobile > .desktop-center,
#app.shape-mobile > .desktop-right {
  display: none;
}

/* Tab panel: scrollable region between top bar and tab bar. */
#app.shape-mobile > .tab-panel {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 8px 8px calc(60px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Tab bar: pinned to the bottom with iOS safe area. */
#app.shape-mobile > .tab-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #fff4d6;
  border-top: 2px solid #e6d9a8;
  display: flex;
  z-index: 50;
  padding-bottom: env(safe-area-inset-bottom);
}

#app.shape-mobile > .tab-bar > .tab-button {
  flex: 1;
  background: transparent;
  border: none;
  border-right: 1px solid #e6d9a8;
  padding: 8px 4px;
  font-size: 11px;
  font-weight: 600;
  color: #5a3e0a;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-height: 56px;
  position: relative;
}

#app.shape-mobile > .tab-bar > .tab-button:last-child {
  border-right: none;
}

#app.shape-mobile > .tab-bar > .tab-button.active {
  background: #fff;
  color: #56b256;
}

#app.shape-mobile > .tab-bar > .tab-button .tb-icon {
  font-size: 18px;
  line-height: 1;
}

#app.shape-mobile > .tab-bar > .tab-button .tb-badge {
  position: absolute;
  top: 4px;
  right: 8px;
  background: #ff5252;
  color: white;
  font-size: 9px;
  font-weight: 700;
  border-radius: 10px;
  padding: 0 4px;
  min-width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Mobile top bar: hide the Daily / Shop icon-buttons since they're tabs now.
   Keep Catalog + Settings as overlays. */
#app.shape-mobile > .topbar [data-action='open-daily'],
#app.shape-mobile > .topbar [data-action='open-shop'] {
  display: none;
}

/* On mobile the legacy bottom inventory layout doesn't apply. */
#app.shape-mobile .inventory-bar {
  background: rgba(255, 244, 214, 0.92);
  border: 1px solid #d6c98a;
  border-radius: 6px;
  padding: 6px 8px;
}
```

- [ ] **Step 2: Add `renderTabBar` and `renderMobileBody` in `js/render.js`**

Open `js/render.js`. Locate the new `renderDesktopBody` function added in Task 2. Insert these two new functions immediately AFTER `renderDesktopBody`:

```js
  function renderTabBar(state) {
    const claimables = Garden.daily ? Garden.daily.claimablesCount(state) : 0;
    const questsAdvancing = Array.isArray(state.quests)
      ? state.quests.some(q => q && q.progress > 0 && q.progress < q.target)
      : false;

    const bar = document.createElement("div");
    bar.className = "tab-bar";

    const tabs = [
      { id: "garden", icon: "🌱", label: "Garden", badge: null },
      { id: "orders", icon: "📋", label: "Orders", badge: questsAdvancing ? "•" : null },
      { id: "shop",   icon: "🛒", label: "Shop",   badge: null },
      { id: "daily",  icon: "📅", label: "Daily",  badge: claimables > 0 ? String(claimables) : null },
    ];

    for (const t of tabs) {
      const btn = document.createElement("button");
      btn.className = "tab-button" + (currentTab === t.id ? " active" : "");
      btn.setAttribute("data-action", "switch-tab");
      btn.setAttribute("data-tab", t.id);
      let html = '<span class="tb-icon">' + t.icon + '</span><span>' + t.label + '</span>';
      if (t.badge) html += '<span class="tb-badge">' + t.badge + '</span>';
      btn.innerHTML = html;
      bar.appendChild(btn);
    }
    return bar;
  }

  function renderMobileBody(state) {
    const app = document.getElementById("app");
    app.appendChild(renderTopBar(state));

    const panel = document.createElement("div");
    panel.className = "tab-panel tab-panel-" + currentTab;

    if (currentTab === "garden") {
      panel.appendChild(renderShelf(state));
      const gardenEl = renderGrid(state);
      if (selectedPotionId) gardenEl.classList.add("potion-use-mode");
      panel.appendChild(gardenEl);
      const invEl = renderInventory(state);
      if (invEl) panel.appendChild(invEl);
      const decoZone = renderDecorationZone(state);
      if (decoZone) panel.appendChild(decoZone);
    } else if (currentTab === "orders") {
      const questsEl = renderQuests(state);
      if (questsEl) panel.appendChild(questsEl);
    } else if (currentTab === "shop") {
      // Shop tab content is wired in Task 4; for this task it just shows a placeholder
      // so the tab-switching plumbing is testable.
      const stub = document.createElement("div");
      stub.style.padding = "16px";
      stub.style.textAlign = "center";
      stub.style.color = "#5a3e0a";
      stub.textContent = "Shop tab content lands in Task 4.";
      panel.appendChild(stub);
    } else if (currentTab === "daily") {
      // Same — wired in Task 4.
      const stub = document.createElement("div");
      stub.style.padding = "16px";
      stub.style.textAlign = "center";
      stub.style.color = "#5a3e0a";
      stub.textContent = "Daily tab content lands in Task 4.";
      panel.appendChild(stub);
    }

    app.appendChild(panel);
    app.appendChild(renderTabBar(state));

    // Overlays (Catalog, Settings, Shop, Daily modal) still apply on mobile —
    // tapping the top-bar 📖 / ⚙ buttons opens these; the tabs are a separate path.
    if (catalogOpen) app.appendChild(renderCatalog(state));
    if (settingsOpen) app.appendChild(renderSettings(state));
    if (shopOpen) app.appendChild(renderShop(state));
    if (dailyOpen) app.appendChild(renderDailyReport(state));
  }
```

- [ ] **Step 3: Replace the legacy fallback in `renderAll`**

In `js/render.js`, find the branching block in `renderAll` from Task 2:

```js
    if (viewport === "desktop") {
      renderDesktopBody(state);
    } else {
      // Mobile body is added in Task 3. Until then, render the legacy single-column
      // layout so phone viewport still works during the transition.
      app.appendChild(renderTopBar(state));
      const questsEl = renderQuests(state);
      if (questsEl) app.appendChild(questsEl);
      const gardenEl = renderGrid(state);
      const decoZone = renderDecorationZone(state);
      if (decoZone) gardenEl.appendChild(decoZone);
      if (selectedPotionId) gardenEl.classList.add("potion-use-mode");
      app.appendChild(gardenEl);
      const inventoryEl = renderInventory(state);
      if (inventoryEl) app.appendChild(inventoryEl);
      app.appendChild(renderShelf(state));
      if (catalogOpen) app.appendChild(renderCatalog(state));
      if (settingsOpen) app.appendChild(renderSettings(state));
      if (shopOpen) app.appendChild(renderShop(state));
      if (dailyOpen) app.appendChild(renderDailyReport(state));
    }
  }
```

Replace the whole `if / else` block with:

```js
    if (viewport === "desktop") {
      renderDesktopBody(state);
    } else {
      renderMobileBody(state);
    }
  }
```

- [ ] **Step 4: Add the tab-switch handler in `setupHandlers`**

In `js/render.js`, find the `app.addEventListener("click", (ev) => {` block inside `setupHandlers`. Find the existing block for `open-catalog`:

```js
      if (ev.target.closest("[data-action='open-catalog']")) {
        if (Garden.audio) Garden.audio.playSfx("ui-click");
        catalogOpen = true;
        renderAll(currentState);
        return;
      }
```

Immediately BEFORE that `open-catalog` block, insert this tab-switch handler:

```js
      const tabBtn = ev.target.closest("[data-action='switch-tab']");
      if (tabBtn) {
        const next = tabBtn.dataset.tab;
        if (next && next !== currentTab) {
          if (Garden.audio) Garden.audio.playSfx("ui-click");
          currentTab = next;
          renderAll(currentState);
        }
        return;
      }
```

- [ ] **Step 5: Static check**

Run:

```powershell
node -c js/render.js
```

Expected: no output.

```powershell
Select-String -Path js/render.js -Pattern 'function renderTabBar|function renderMobileBody|switch-tab' | Measure-Object | Select-Object -ExpandProperty Count
```

Expected: ≥ 5.

```powershell
Select-String -Path styles.css -Pattern '#app\.shape-mobile' | Measure-Object | Select-Object -ExpandProperty Count
```

Expected: ≥ 8.

- [ ] **Step 6: Commit**

```powershell
git add js/render.js styles.css
git commit -m "feat: mobile tab bar shape with four-tab navigation"
```

---

### Task 4: Tab content for Shop and Daily on mobile

**Files:**
- Modify: `js/render.js` (`renderMobileBody` Shop + Daily branches; topbar handler routing)

**Outcome:** On mobile, tapping the Shop tab now renders the full Shop content (pots, decorations, potions, grid expansion) inline in the tab panel — no modal overlay. Same for Daily — the Morning Report content (streak, lucky draw, recap, quest progress) renders as the Daily tab content. On desktop, the Shop and Daily modals work exactly as before (no behavior change). The top-bar buttons for Shop and Daily no longer exist on mobile (they were hidden by CSS in Task 3) — the tabs replace them.

Also handles the auto-open behavior for Morning Report: on mobile, if `Garden.daily.claimablesCount(state) > 0` on boot, the Daily tab becomes the default instead of the Garden tab. On desktop, the existing modal auto-open behavior is unchanged.

- [ ] **Step 1: Wire the Shop and Daily tab contents**

In `js/render.js`, find `renderMobileBody`. Replace the stub branches for `"shop"` and `"daily"` with calls to the existing renderers, but unwrapped from the modal overlay container.

The current stub for shop reads:

```js
    } else if (currentTab === "shop") {
      // Shop tab content is wired in Task 4; for this task it just shows a placeholder
      // so the tab-switching plumbing is testable.
      const stub = document.createElement("div");
      stub.style.padding = "16px";
      stub.style.textAlign = "center";
      stub.style.color = "#5a3e0a";
      stub.textContent = "Shop tab content lands in Task 4.";
      panel.appendChild(stub);
    } else if (currentTab === "daily") {
```

Replace the entire `"shop"` stub block (the lines between `} else if (currentTab === "shop") {` and the `} else if (currentTab === "daily") {` opener) with:

```js
    } else if (currentTab === "shop") {
      // Reuse the modal renderer, then pluck out its inner content so it
      // displays inline in the tab panel instead of as an overlay.
      const shopOverlay = renderShop(state);
      const shopContent = shopOverlay.querySelector(".modal-content");
      if (shopContent) {
        shopContent.classList.add("tab-embedded");
        panel.appendChild(shopContent);
      } else {
        panel.appendChild(shopOverlay);  // defensive — fall back to overlay if structure changes
      }
```

Then find the `"daily"` stub:

```js
    } else if (currentTab === "daily") {
      // Same — wired in Task 4.
      const stub = document.createElement("div");
      stub.style.padding = "16px";
      stub.style.textAlign = "center";
      stub.style.color = "#5a3e0a";
      stub.textContent = "Daily tab content lands in Task 4.";
      panel.appendChild(stub);
    }
```

Replace the entire `"daily"` stub block with:

```js
    } else if (currentTab === "daily") {
      const dailyOverlay = renderDailyReport(state);
      const dailyContent = dailyOverlay.querySelector(".modal-content");
      if (dailyContent) {
        dailyContent.classList.add("tab-embedded");
        panel.appendChild(dailyContent);
      } else {
        panel.appendChild(dailyOverlay);
      }
    }
```

- [ ] **Step 2: Style the embedded modal content so it doesn't keep its overlay-card look**

Open `styles.css`. Append at the end:

```css
/* When Shop/Daily modal content is embedded inside a mobile tab, drop the
   centered-card chrome and let it flow with the tab panel. */
#app.shape-mobile .modal-content.tab-embedded {
  max-width: none;
  width: 100%;
  max-height: none;
  margin: 0;
  border-radius: 0;
  box-shadow: none;
  border: none;
  padding: 0;
  background: transparent;
}

/* Hide the close-button inside an embedded tab — there's nothing to close. */
#app.shape-mobile .modal-content.tab-embedded .modal-close,
#app.shape-mobile .modal-content.tab-embedded .modal-header .modal-close {
  display: none;
}
```

- [ ] **Step 3: Default to the Daily tab on mobile when something is claimable at boot**

This avoids the awkward "Garden tab on boot, then user has to tap Daily to claim rewards" flow. On mobile, `Garden.render.openDailyReport(recap)` (called by `main.js` at boot) should switch the default tab instead of opening a modal.

In `js/render.js`, find the `Garden.render` exports near the bottom of the file:

```js
  Garden.render = {
    renderAll, renderTopBar, renderGrid, renderShelf, renderQuests, renderInventory,
    renderDecorationZone, renderShop, renderSettings, renderCatalog, setupHandlers,
    setSelectedSeedId: (id) => { selectedSeedId = id; },
    getSelectedSeedId: () => selectedSeedId,
    openDailyReport: (recap) => { dailyOpen = true; dailyRecap = recap || null; },
  };
```

Replace the `openDailyReport` line with:

```js
    openDailyReport: (recap) => {
      dailyRecap = recap || null;
      // On mobile the Daily content lives in a tab — switch to it instead
      // of stacking a modal on top of the tab panel.
      syncViewport();
      if (viewport === "mobile") {
        currentTab = "daily";
      } else {
        dailyOpen = true;
      }
    },
```

- [ ] **Step 4: Static check**

Run:

```powershell
node -c js/render.js
```

Expected: no output.

```powershell
Select-String -Path js/render.js -Pattern 'tab-embedded|querySelector\(\".modal-content\"\)' | Measure-Object | Select-Object -ExpandProperty Count
```

Expected: ≥ 4.

```powershell
Select-String -Path styles.css -Pattern '\.tab-embedded' | Measure-Object | Select-Object -ExpandProperty Count
```

Expected: ≥ 2.

- [ ] **Step 5: Commit**

```powershell
git add js/render.js styles.css
git commit -m "feat: mobile Shop and Daily tabs render the modal content inline"
```

---

### Task 5: Touch-target hardening + tap-delay fix + iOS safe area

**Files:**
- Modify: `styles.css` (append touch hardening rules)

**Outcome:** All interactive elements are at least 44 × 44 px (Apple HIG minimum for reliable touch). The 300 ms iOS Safari tap delay is removed via `touch-action: manipulation`. The mobile tab bar respects the iPhone home-indicator safe area (the bottom inset). Visual changes are subtle on desktop (some buttons grow slightly), pronounced on mobile (the seed cards, plots, and modal close buttons all become finger-friendly).

- [ ] **Step 1: Append touch-hardening CSS at the end of `styles.css`**

Open `styles.css`. Append at the end:

```css
/* ===== Touch hardening (mobile-first, applies to all shapes) ===== */

/* Remove the 300ms tap delay on iOS Safari + Android Chrome. */
.icon-btn,
.expand-btn,
.tab-button,
.seed-card,
.plot,
.modal-close,
.buy-btn,
.use-pot-btn,
.daily-preview,
[data-action] {
  touch-action: manipulation;
}

/* Apple HIG minimum touch target: 44x44. Already-large elements (.plot,
   .modal-content) are unaffected; small icon buttons grow. */
.icon-btn,
.modal-close {
  min-width: 44px;
  min-height: 44px;
}

/* On mobile, seed cards in the Garden tab need to be tappable thumbs. */
#app.shape-mobile .seed-card,
#app.shape-mobile .pot-card,
#app.shape-mobile .potion-card,
#app.shape-mobile .decoration-card {
  min-height: 56px;
}

#app.shape-mobile .plot {
  /* Plot size already scales with the grid container, but lock a floor
     so 5x5 on a narrow phone stays tappable. */
  min-width: 40px;
  min-height: 40px;
}

/* Tap-highlight color tint — softer than the browser default blue. */
* {
  -webkit-tap-highlight-color: rgba(86, 178, 86, 0.15);
}

/* Modal close button on mobile: enlarge tap region without enlarging visible glyph. */
#app.shape-mobile .modal-close {
  padding: 12px;
  font-size: 18px;
}
```

- [ ] **Step 2: Static check**

```powershell
Select-String -Path styles.css -Pattern 'touch-action: manipulation|min-width: 44px|-webkit-tap-highlight-color|env\(safe-area-inset' | Measure-Object | Select-Object -ExpandProperty Count
```

Expected: ≥ 4. (The `env(safe-area-inset-bottom)` lines were added in Task 3 and Task 5 doesn't add more — Task 3's count already covers it.)

- [ ] **Step 3: Commit**

```powershell
git add styles.css
git commit -m "feat: touch targets, tap-delay fix, iOS safe area handling"
```

---

### Task 6: Manual verification pass

**Files:**
- Modify: only if bugs are found.

**Outcome:** Both layouts work across a representative range of viewport sizes. Functional regression sweep confirms no audio/quest/daily/potion breakage. CrazyGames iframe simulation passes.

- [ ] **Step 1: Desktop wide — 1920 × 1080**

Open `index.html` in a desktop browser, then resize the window so its content area is ~1920 × 1080 (or full-screen on a 1080p monitor with no DevTools panel).

Expected:
1. Top bar spans full viewport width.
2. Three columns visible: ~160px seeds on left, fluid garden + decorations center, ~240px quests + daily on right.
3. Garden grid centered in the center column.
4. Seeds shelf is vertical, showing all unlocked flowers.
5. Inventory bar (potions) is below seeds in the left column.
6. Quest cards stacked vertically on the right. Daily preview block below.
7. Tap a seed → it gets selected (highlight).
8. Tap an empty plot → flower plants, plant SFX plays.
9. Open Shop button (top-right) → modal overlay appears centered.
10. Open Settings button → modal overlay appears centered.
11. Open Catalog button → modal overlay appears centered.
12. Open Daily button → modal overlay appears centered.
13. Tap Daily preview block in right column → same Daily modal opens.

- [ ] **Step 2: Desktop typical — 1280 × 720**

Resize window content area to ~1280 × 720. Repeat checks 1–13 from Step 1.

Expected: same as wide, slightly tighter spacing. No content overflow. No horizontal scrollbar.

- [ ] **Step 3: Tablet — 1024 × 768**

Resize to ~1024 × 768.

Expected: still desktop layout (1024 ≥ 768 and 768 ≥ 500). Three columns. Slightly cramped right column but readable.

- [ ] **Step 4: Phone portrait — 360 × 780**

In DevTools, set device emulation to a small phone (iPhone SE 375 × 667 or similar Android, ~360 × 780).

Expected:
1. Top bar shows coins, level/XP, then 📖 Catalog and ⚙ Settings on the right only.
2. Garden tab is the default active tab.
3. Tab bar at the bottom with 4 buttons: 🌱 Garden / 📋 Orders / 🛒 Shop / 📅 Daily.
4. Garden tab shows: seed shelf horizontal row → garden grid → inventory bar → decoration strip.
5. Tap Orders tab → see three quest cards.
6. Tap Shop tab → see pots, decorations, potions, grid expansion sections — no modal overlay, content fills the tab panel.
7. Tap Daily tab → see streak, lucky draw, recap content — no modal overlay.
8. Tap 📖 Catalog in top bar → modal overlay opens.
9. Tap ⚙ Settings in top bar → modal overlay opens.
10. Tap the close button on Catalog modal → modal closes, tab state unchanged.
11. Plant/water/sun/harvest cycle works on phone-sized plots.
12. Tab buttons are ≥ 44 px tall (visually). Plots are ≥ 40 px (visually).

- [ ] **Step 5: Phone landscape — 812 × 375**

Switch DevTools to landscape orientation on the same phone (~812 × 375).

Expected: still mobile shape (height 375 < 500). Same tab bar layout, just wider. Garden grid uses the extra horizontal room.

- [ ] **Step 6: Resize across breakpoint**

In a non-emulated window, drag the browser window from ~1280 px wide down to ~700 px wide and back up.

Expected:
1. Layout switches at 768 px with a ~150 ms debounce — no thrashing as you drag.
2. No console errors.
3. Game state preserved (coins, plots, selected seed all intact).
4. If you were on the Orders tab on mobile, then resize to desktop, then back to mobile — Orders tab is still active.

- [ ] **Step 7: Functional smoke test on each shape**

On both desktop (1280 × 720) and mobile (360 × 780), exercise the full game loop:

1. Plant a seed on an empty plot → plant SFX.
2. Click to water → water SFX.
3. Click to sun → sun SFX.
4. Wait for bloom → harvest → harvest SFX. Coins + XP increase.
5. Buy a potion in Shop → coin balance drops, potion appears in inventory.
6. Click potion → use mode (crosshair cursor on desktop, tap-target on mobile). Apply to a valid plot.
7. Open Daily (modal on desktop, tab on mobile) → claim streak day if available → coins increase.
8. Spin lucky draw if available → prize awarded.
9. Open Settings → flip Music slider / SFX toggles → audio responds live.
10. Open Catalog → click an unlocked flower → see stats. Click a locked flower → see unlock hint.

- [ ] **Step 8: CrazyGames iframe simulation**

Create a one-off test file in the working dir (do NOT commit it):

```powershell
@"
<!DOCTYPE html><html><body style='margin:0;background:#222;display:flex;align-items:center;justify-content:center;height:100vh'>
<iframe src='index.html' width='1280' height='720' style='border:0'></iframe>
</body></html>
"@ | Out-File -Encoding utf8 _portal-test.html
```

Open `_portal-test.html` in a browser. Verify:
1. Game loads inside the iframe.
2. Click works (no iframe sandbox blocking).
3. Audio plays after first click.
4. localStorage persists across reloads of the iframe.
5. No console errors from `top.location` / cross-origin issues.

After verification:

```powershell
Remove-Item _portal-test.html
```

- [ ] **Step 9: Fix anything found, commit fixes individually**

For each bug:

```powershell
git add <files>
git commit -m "fix: <specific issue found in layout test pass>"
```

- [ ] **Step 10: Final clean state check**

```powershell
git status
```

Expected: clean working tree apart from the existing untracked local files (Thai HTML, pptx, decks).

---

## Execution notes

- The plan is structured so each task leaves the game in a working state. After Task 1 there's no visible change; after Task 2 desktop looks correct but mobile is the legacy single-column; after Task 3 both shapes render but mobile Shop/Daily tabs show stubs; after Task 4 everything looks right; Task 5 is polish; Task 6 is verification.
- Don't bump `storage.js` VERSION — same rule as audio/daily plans.
- All `Garden.audio &&` guards remain — they're defensive and match the existing style.
- If the resize debounce feels janky in Task 6 (e.g., feels like rendering happens too late while you drag), bump the timeout from 150 ms to 250 ms in Task 1's resize listener. Don't drop below 100 ms — it'll thrash.
- The audit also flagged Morning Report auto-open as a CrazyGames "land in gameplay immediately" concern; this plan addresses it on mobile (becomes a tab switch, not a blocking modal) but leaves the desktop modal behavior unchanged. A separate ticket can move desktop behind a first-interaction gate if needed for portal review.
