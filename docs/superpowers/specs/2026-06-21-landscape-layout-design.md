# Landscape Layout & Mobile Tab Bar Design

**Date:** 2026-06-21
**Status:** Draft
**Context:** Portal-submission audit (2026-06-21) flagged the current 720-px-max-width portrait-ish layout as a hard fail for Poki and a soft fail for CrazyGames. This spec defines the desktop landscape redesign and mobile portrait tab bar needed to clear the "layout pass" gate for a CrazyGames submission.

## Goal

Replace the single 720-px-wide column layout with two responsive shapes that meet portal acceptance:

1. **Desktop / tablet (≥ 768 px wide):** a three-column landscape layout — seeds shelf on the left, garden in the center, orders / daily on the right — that fluidly fills the iframe width.
2. **Mobile portrait (< 768 px wide):** a bottom-tab-bar layout with four tabs (Garden, Orders, Shop, Daily). Catalog and Settings remain top-bar icon overlays.

Both shapes share state, share game logic, and share the same module structure. The choice is a CSS + render-time branch driven by viewport width.

## Motivation

CrazyGames technical requirements call for landscape playability on desktop and a mobile experience that works inside their fullscreen app shell. The current layout is centered, ~720 px wide, with vertical-stack flexbox and zero `@media` queries. On a 1920 × 1080 iframe the playable area is a narrow column with two dead bands of gradient on either side. On a 360 × 780 phone the same column is technically playable but cramped — modals overflow, the decoration row wraps, the toast stack overlaps the inventory bar.

Both portals will accept "polished on one orientation, playable on the other." We're targeting CrazyGames first, where desktop landscape is the priority and mobile portrait must be "playable and not embarrassing." Mobile landscape is treated as a stretch case (renders in desktop mode, may look cramped on short screens; we'll guard with a min-height check).

## Non-goals

- **No engine rewrite.** Vanilla JS + `window.Garden` namespace + zero-build stays. No React, no framework, no canvas migration. This is a layout pass, not an architecture pass.
- **No new gameplay.** Quests, daily systems, plots, potions, flowers — all unchanged. State shape is unchanged.
- **No content additions.** Catalog stays 6 + 6 flowers, Shop stays 6 pots / 6 decorations / 2 potions. Content depth is a separate "30-min retention" bet — out of scope here.
- **No drawer / gesture work on mobile.** M3 (slide-up drawer) was the polished mobile option but explicitly rejected — tab bar (M2) is what we're shipping. No `pointerdown`/`pointermove` swipe handling.
- **No portal SDK yet.** CrazyGames SDK integration is a separate task that follows this one. This spec only addresses the layout gate.
- **No splash / loading screen.** First-render is fast enough; portal cap is generous.

## Layout map — desktop (≥ 768 px)

Three columns, full viewport width, fluid:

```
┌─ Top bar ─────────────────────────────────────────────────────────────┐
│ 🪙 coins · Lv X ▰▰▰▱ · [Expand]               📅 🛒 📖 ⚙             │
├──────────┬───────────────────────────────────────────────┬────────────┤
│          │                                               │            │
│  Seeds   │              Garden grid                      │  Orders    │
│  (col)   │              (3×3 → 4×4 → 5×5)                │  Quest 1   │
│  · daisy │                                               │  Quest 2   │
│  · tulip │                                               │  Quest 3   │
│  · rose  │                                               │            │
│  …       │                                               │  Daily     │
│          ├───────────────────────────────────────────────┤  Day N     │
│  Potions │  Decorations  [🦔] [🌳] [📬] [⛲] [🪑] [🌞]    │  Spin: yes │
│  · speed │                                               │            │
│  · revive│                                               │            │
└──────────┴───────────────────────────────────────────────┴────────────┘
```

### Top bar (full width)

Unchanged content: coins, level + XP bar, expand-grid button on the left; 📅 Daily / 🛒 Shop / 📖 Catalog / ⚙ Settings icon buttons on the right. Layout becomes `display: flex; justify-content: space-between` at full viewport width. Already does this — just gets a max-width override.

### Left column — Seeds + Potions

Vertical strip, ~120 px wide. Replaces today's horizontal seed shelf row. Each seed card shows: flower icon, name, seed cost, lifetime plant count (so the "16-planting rare interval" hint stays visible). Same data, vertical instead of horizontal.

Potions section sits below seeds, separated by a label divider. Same active-inventory data the current bottom inventory bar shows. Use-mode crosshair behavior is unchanged.

Scrolls internally if 6 seeds + 2 potions overflow the column height.

### Center column — Garden + Decorations

Garden grid centered in the column. The grid scales with the column's available width — same logic the current code uses, just with a fluid container instead of a 720-px ceiling.

Decoration strip sits below the garden (today it's below the inventory bar; this moves it up). Same 6 slots, same buy/remove behavior. Visible alongside the garden — it's part of the "what your garden looks like" experience.

### Right column — Orders + Daily

Top: three quest cards stacked vertically. Existing quest card design adapts well to a narrower column.

Bottom of the column: a compact "Daily" preview block — current streak day, "Lucky draw available" pip if true, "Claim 3/3 chest" if true. Tapping any of these opens the existing Daily modal (which is the same content as the mobile Daily tab — see modal section below).

### Width strategy

The grid is `grid-template-columns: 160px 1fr 220px` with sensible mins. At 1280 px viewport, center column gets ~900 px. At 1920 px, ~1540 px (garden visually grows in spacing/padding, not in cells — 5×5 grid stays 5×5). At 768 px (the breakpoint floor), center column is ~388 px — still comfortable for a 5×5 grid.

No max-width on `body` or `#app`. Background gradient extends to the viewport edges.

## Layout map — mobile portrait (< 768 px)

```
┌─ Top bar (compact) ────────────────┐
│ 🪙 1,250 · Lv 7 ▰▰▱      📖 ⚙   │
├────────────────────────────────────┤
│                                    │
│         Active tab content         │
│         (Garden / Orders /         │
│          Shop / Daily)             │
│                                    │
├────────────────────────────────────┤
│  🌱      📋      🛒      📅       │
│ Garden  Orders  Shop   Daily      │
└────────────────────────────────────┘
```

### Top bar (compact)

Two top-bar icons survive on mobile: **📖 Catalog** (overlay modal — read-only reference, doesn't belong in a tab) and **⚙ Settings** (overlay modal). The other two — **📅 Daily** and **🛒 Shop** — become tabs at the bottom, so their icons leave the top bar.

The **Expand-grid button** moves into the Shop tab (it was already a Shop-section concept) and disappears from the top bar on mobile. On desktop it stays in the top bar.

### Tabs

Four tabs, each filling the screen below the top bar and above the tab bar:

1. **🌱 Garden** — garden grid, seed shelf (compact horizontal row above the tab bar's natural spot, similar to today's shelf), decoration strip below the seeds. Default tab on boot.
2. **📋 Orders** — the three active quest cards. If a quest just advanced, a small badge on the tab indicates "new progress."
3. **🛒 Shop** — same sections as today's Shop modal (Pots, Decorations, Potions, Grid Expansion), reflowed as a single vertical scroll.
4. **📅 Daily** — same content as today's Morning Report modal: streak claim, lucky draw, recap, all-3 chest progress. NEW-badge appears when something is claimable.

### Tab bar behavior

- Sticky at the bottom (`position: sticky` or `position: fixed` with safe-area inset for iOS).
- Active tab gets visual emphasis (background fill + accent text color).
- Tab switch is local-only (no URL change, no router) — it's a single `currentTab` variable in render-layer state, defaulting to "garden" on boot.
- Tapping the icon-button equivalent (e.g., 🛒 in the top bar on desktop) doesn't exist on mobile — those buttons are the tabs.

### Catalog and Settings

Catalog stays an overlay modal on both shapes. Same content as today, no change.

Settings stays an overlay modal on both shapes. Same content as today, no change.

The auto-open behavior of Daily on boot (Morning Report when there's something to claim) becomes "switch to Daily tab" on mobile, "open Daily modal" on desktop. Existing logic checks `Garden.daily.claimablesCount(state) > 0` — the same check drives both paths.

## Modal vs tab behavior across the breakpoint

| Surface | Desktop behavior | Mobile behavior |
|---|---|---|
| Catalog | Overlay modal (existing) | Overlay modal (unchanged) |
| Settings | Overlay modal (existing) | Overlay modal (unchanged) |
| Shop | Overlay modal (existing) | Tab content |
| Daily / Morning Report | Overlay modal (existing) | Tab content |
| Quest panel | Right column | Tab content |
| Seed shelf | Left column | In Garden tab |
| Decoration strip | Below garden | In Garden tab below seeds |
| Inventory (potions) | Left column under seeds | In Garden tab |

Implementation: the same `renderShop` / `renderDaily` / etc. functions return the same DOM trees. The container changes — wrapped in a `.modal-overlay` on desktop, inlined into a `.tab-panel` on mobile. The conditional is one `if (isMobile)` per surface inside `renderAll`.

## Render architecture — minimal refactor

Current `js/render.js` (1,088 lines) has a single `renderAll(state)` that builds the whole tree. The current functions to reuse:

- `renderTopBar(state)`
- `renderGrid(state)`
- `renderShelf(state)`
- `renderQuests(state)`
- `renderInventory(state)`
- `renderDecorationZone(state)`
- `renderShop(state)`
- `renderSettings(state)`
- `renderCatalog(state)`
- (Daily modal is rendered inside `renderAll` directly today — extract as `renderDaily(state)` for parity)

### New module-local state

```js
let currentTab = "garden";   // "garden" | "orders" | "shop" | "daily"
let viewport = "desktop";    // "desktop" | "mobile" — set by ResizeObserver on <html>
```

`currentTab` resets to `"garden"` on every load (not persisted). `viewport` is recomputed on resize.

### `renderAll` becomes a router

```js
function renderAll(state) {
  syncViewport();   // updates `viewport` from window.innerWidth
  const app = document.getElementById("app");
  app.innerHTML = "";
  app.className = viewport === "mobile" ? "shape-mobile" : "shape-desktop";
  app.appendChild(renderTopBar(state));
  if (viewport === "mobile") {
    app.appendChild(renderMobileBody(state));   // tab panel + tab bar
  } else {
    app.appendChild(renderDesktopBody(state));  // three-column grid
  }
  app.appendChild(renderOverlays(state));        // Catalog / Settings always-overlays
  if (viewport === "desktop") {
    app.appendChild(renderDesktopOverlays(state)); // Shop + Daily are modals on desktop
  }
}
```

The new functions `renderMobileBody`, `renderDesktopBody`, `renderOverlays`, `renderDesktopOverlays` are thin wrappers that compose the existing per-section renderers. The existing functions don't need to change — they just get called from different containers.

### Resize handling

A single `window.addEventListener("resize", debounce(renderAll, 150))` triggers a re-render when crossing the breakpoint. Debounced to 150 ms so dragging the window edge doesn't thrash. The tick loop already triggers re-renders too — both paths converge on the same `renderAll`.

For the mobile-landscape edge case (a phone rotated to landscape, viewport e.g. 812 × 375): we treat anything below 500 px height as mobile too, so the shape gate is:

```js
viewport = (window.innerWidth >= 768 && window.innerHeight >= 500) ? "desktop" : "mobile";
```

## CSS strategy

New stylesheet structure in `styles.css`:

```
/* Base styles — shared between shapes */
... existing top bar, plot, button, modal styles ...

/* Desktop shape — three column */
.shape-desktop #app { ... grid-template-columns: 160px 1fr 220px ... }
.shape-desktop .seed-shelf { ... vertical column ... }
.shape-desktop .quests-panel { ... right column ... }
.shape-desktop .decoration-zone { ... grid row 2 column 2 ... }

/* Mobile shape — tab bar */
.shape-mobile #app { display: flex; flex-direction: column; min-height: 100vh; }
.shape-mobile .tab-panel { flex: 1; overflow-y: auto; padding-bottom: 60px; /* tab bar height */ }
.shape-mobile .tab-bar { position: fixed; bottom: 0; ... }
.shape-mobile .seed-shelf { ... horizontal row inside Garden tab ... }
```

The `@media (max-width: 767px)` query is NOT used as the toggle — JS-driven `.shape-mobile` / `.shape-desktop` class names are. This is because we also need to gate on viewport height (the mobile-landscape case) which a single media query can't express cleanly. CSS variables for breakpoint numbers stay defined for any base media queries that survive.

Touch target hardening:

```css
.icon-btn, .tab-bar > *, .seed-card, .plot, .modal-close {
  min-width: 44px;
  min-height: 44px;
  touch-action: manipulation;  /* removes 300ms tap delay */
}
```

iOS safe area inset on the tab bar:

```css
.shape-mobile .tab-bar {
  padding-bottom: env(safe-area-inset-bottom);
}
```

## State shape — unchanged

No new state fields. `currentTab` and `viewport` are render-layer module-local — not persisted, not part of `state.settings`.

Existing migrations and defaults are untouched.

## Files changed (preview)

- `js/render.js` — heavy edits to `renderAll`, new `renderMobileBody` / `renderDesktopBody` / `renderOverlays` / `renderDesktopOverlays` / `renderTabBar` / `renderDaily` functions; existing per-section renderers untouched. Tab-click handler added to `setupHandlers`. Resize listener added. Roughly +200 / -50 lines.
- `styles.css` — major additions: `.shape-desktop` grid layout, `.shape-mobile` tab layout, touch target rules, safe-area handling. Existing styles mostly preserved. Roughly +250 lines.
- `index.html` — unchanged (script order, viewport meta).
- `js/main.js` — no changes (boot flow is the same).
- No changes to state.js, daily.js, audio.js, flowers.js, decorations.js, pots.js, potions.js, storage.js, svg.js, fx.js.

## Testing strategy

No test runner exists. Verification is browser-driven across viewport sizes.

1. **Desktop 1920 × 1080.** Three columns visible. Garden centered. Seeds vertical strip on left. Quests + daily on right. Decoration strip below garden. All modals (Shop, Daily, Catalog, Settings) open as overlays.
2. **Desktop 1280 × 720.** Same layout, slightly tighter. No overflow.
3. **Tablet 1024 × 768.** Same desktop layout.
4. **Phone portrait 360 × 780.** Tab bar at bottom with 4 tabs. Garden tab is default. Top bar has only 📖 ⚙ on the right. Tapping Orders/Shop/Daily switches tabs. Tapping Catalog or Settings opens a full-screen overlay.
5. **Phone landscape 812 × 375.** Mobile shape (because height < 500). Same tab bar.
6. **Resize across breakpoint.** Drag the window from 1280 → 700 → 1280. Layout switches at 768 with a debounce. No console errors. Game state preserved.
7. **Functional smoke.** On each shape, complete: plant → water → sun → harvest → quest completion → potion use → daily streak claim → lucky draw → settings toggle → audio toggle. All work without regression.
8. **CrazyGames iframe simulation.** Embed `index.html` inside an iframe sized to common CG dimensions (`<iframe src="index.html" style="width: 1280px; height: 720px">`). Verify nothing breaks at iframe boundary.
9. **Touch target audit.** On mobile DevTools, every interactive element ≥ 44 × 44 px.
10. **iOS safe area.** On a simulated iPhone with notch (DevTools), tab bar respects bottom safe area.

## Open questions

None blocking. Two minor notes that can be settled at implementation time:

- **Tab badges:** "NEW progress" on the Orders tab and "claimable" on the Daily tab — exact visual treatment (dot vs count) is implementer's call. Existing top-bar badge pattern (from the Daily icon) is the reference.
- **Initial scroll position on mobile tab switch:** when switching tabs, the new tab starts at scroll-top. Acceptable default.

## Risks

- **render.js bloat.** Adding ~200 lines to a 1,088-line file pushes it close to "this file is doing too much." A render.js split (one file per surface) is a tempting follow-up but is explicitly out of scope here. We'll note it as tech debt.
- **Resize debounce timing.** 150 ms is a guess; if the resize-rerender feels janky in practice it bumps to 250 ms. Browser-test only.
- **Mobile-portrait Shop tab content height.** All four Shop sections in one vertical scroll might be long. If user-test feedback is "I lose track of where I am," collapsing sections (accordion) is a follow-up — out of scope here.

## Effort

Roughly **5–10 days of focused work** for a careful implementer. Spec ⇒ plan ⇒ implementation breakdown will probably yield 6–8 commit-sized tasks: shared CSS, desktop shape, mobile tab bar, modal-vs-tab routing, resize handling, touch-target hardening, iframe/safe-area testing, polish pass.
