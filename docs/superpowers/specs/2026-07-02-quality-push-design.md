# Dream Garden — Quality Push for CrazyGames Re-submission

**Date:** 2026-07-02
**Status:** approved (user delegated design decisions for this session)
**Context:** The CrazyGames Basic Launch submission was rejected. No written
rejection reason was provided to Claude; this design targets the three most
probable quality gaps an experienced reviewer would flag within the first
minute of play.

## Diagnosis

1. **Placeholder-grade flower art.** Every species renders the identical
   5-circle rosette (`bloomedSvg` in `js/svg.js`) with only the fill color
   changed. Growth stages are also identical across species. This is the
   single loudest "programmer art" signal in the game.
2. **A completely static scene.** Nothing in the garden moves outside of
   click feedback. No idle motion, no ambient life, no bloom moment.
3. **Shallow content.** 6 species + 6 rares ≈ 15 minutes to catalog
   exhaustion; progression tops out at level 14. The project backlog already
   flags content depth as the #1 retention lever.
4. **No meta-goals.** Quests reset daily; there is no permanent
   accomplishment track (achievements were p2 in the backlog).

## Goals

Raise perceived quality to the CrazyGames bar without changing the core loop,
the tech approach (zero-build vanilla JS, `window.Garden` namespace, works on
`file://`), or the save-compat guarantees.

## Non-goals

- No multiplayer/backend/NPC gardens (explicitly out of scope per project memory).
- No art-asset pipeline (no PNG sprite packs); stay with inline SVG so the
  zero-build contract holds. `tmp_kenney/` packs stay unused (they are
  casino/RPG/UI themed — wrong fit).
- No storage VERSION bump. All new state fields get defensive migration in
  `main.js start()` per existing convention.

## Phase A — Distinct per-species flower art (`js/svg.js`)

Replace the shared `bloomedSvg(petalColor, centerColor)` rosette with a
**per-species silhouette table**. Each species gets a hand-authored 80×80 SVG
bloom with two-tone petal shading (base + highlight/shade), a stem, and
leaves; visually distinct at 72px plot size:

- **Daisy** — 10 thin ray petals around a dome center.
- **Tulip** — closed cup on a tall stem, two blade leaves.
- **Rose** — concentric layered petals (spiral read), thorned stem.
- **Jasmine** — cluster of 3 small 5-petal pinwheel blossoms.
- **Sunflower** — large brown seed-texture disk, short wide ray petals.
- **Calceolaria** — 3 pouch ("slipper") blobs with speckles.

Rare variants reuse the parent silhouette recolored via existing `COLORS`
table (consistent with "same species, rare color" fiction). The `growingSvg`
bud keeps its shape but takes the species petal color (as today).
`flowerIcon` (shelf/catalog chip) is upgraded to render a miniature of the
species silhouette rather than the shared rosette.

Contract preserved: `flowerSvg(flowerId, stage)` signature, 80×80 viewBox for
bloomed/wilted, 40×40 for early stages, no render.js changes needed.

## Phase B — Content depth (`js/flowers.js`, `js/svg.js`)

Six new species interleaved into the level curve and extending it past 14,
each with a rare variant on the standard every-16th-planting interval:

| id | name | levelReq | seedCost | sellPrice | growMs |
|----|------|----------|----------|-----------|--------|
| marigold | Marigold | 3 | 25 | 60 | 28000 |
| lavender | Lavender | 5 | 60 | 140 | 45000 |
| orchid | Orchid | 8 | 130 | 300 | 75000 |
| lotus | Lotus | 12 | 300 | 700 | 105000 |
| dahlia | Dahlia | 16 | 650 | 1500 | 150000 |
| moonflower | Moonflower | 20 | 1000 | 2400 | 180000 |

Rares: White Marigold, Pink Lavender, Blue Orchid, Golden Lotus, Black
Dahlia, Crimson Moonflower (sellPrice ≈ 2.4× parent, matching the existing
rare multiple). Each new species gets its own Phase-A-quality silhouette.
Economy stays on the existing price/time curve (~coins-per-second rises
gently with level, so late flowers stay worth planting).

No other systems change: shelf, catalog, quest generation, and mystery seeds
all derive from `Garden.FLOWERS` / `Garden.RARE_FLOWERS` at runtime.

## Phase C — Game feel & ambience

- **Bloom sway:** bloomed plots get a slow (4s) rest-pose-anchored rocking
  animation, `transform-origin: bottom center`. Safe because full re-render
  only happens on stage transitions.
- **Bloom pop:** `tick()` already computes a per-plot stage signature. Diff
  old vs new per plot; on `growing → bloomed`, after `renderAll`, add a
  one-shot `.just-bloomed` class (scale-pop keyframe) to that plot only, plus
  a small sparkle float via `Garden.fx`.
- **Ambient life layer:** a fixed, pointer-events-none layer (installed once,
  outside the re-rendered `#app` tree) with 2–3 CSS-animated butterflies
  drifting across the garden area and occasional floating petals. Subtle:
  long durations, low opacity, no JS per-frame work.
- **Sky & scene polish:** layered body background (sky gradient + 2 drifting
  cloud shapes via a dedicated background layer), soft rounded fence/hedge
  framing on the garden container.
- **First-impression basics:** SVG favicon (data URI), `<meta name="description">`,
  `<meta name="theme-color">`.

Reduced-motion: all new loops respect `@media (prefers-reduced-motion: reduce)`.

## Phase D — Achievements (`js/achievements.js` + UI)

~15 permanent achievements computed from lifetime counters. New state fields
(migrated defensively in `main.js`, defaulting from existing data where
possible): `lifetime: { harvests, coinsEarned, raresHarvested, potionsUsed,
questsCompleted }` and `achievements: { [id]: true }`.

Examples: First Bloom (1 harvest), Green Thumb (50 harvests), Flower Tycoon
(10,000 lifetime coins), Rare Collector (3 rares discovered), Full Catalog
(all rares discovered), Night Gardener (harvest a Moonflower), Landlord
(5×5 grid), Potion Master (10 potions used).

Unlock check runs after harvest/plant/potion/quest events inside the existing
`render.js` action handlers; unlock fires a `toast` (new "achievement"
variant) + save. UI: the Catalog modal gains a two-tab header — **Flowers |
Achievements** — reusing existing card grid styles; locked achievements show
name + hint, unlocked show gold border.

## Verification

- `node --check` every touched JS file.
- Manual smoke via local browser: fresh save boots, old save (pre-fields)
  migrates, all 12 species render distinct art at all stages, catalog shows
  24 entries, achievements unlock and persist.
- Commit per phase; push at the end.
