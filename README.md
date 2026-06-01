# Dream Garden

A browser flower-farming demo recreating the core loop of the 2010 Thai Facebook game **ดรีมการ์เด้น (Dream Garden)** by SNS+.

**Play it: https://pcismyname.github.io/dream-garden/**

## How to play

1. Click an empty plot to plant the selected seed (Daisy at the start).
2. Click the seeded plot to water it.
3. Click again to add sunlight — the growth timer starts.
4. Wait for the flower to bloom (yellow ✓ badge appears).
5. Click the bloomed flower to harvest, sell it, and gain XP.
6. Level up to unlock new flower types and grid expansions.

## Run locally

Double-click `index.html`. That's it — no build step, no server, no install. Save state lives in your browser's `localStorage` (per-browser, per-origin).

To reset progress, open devtools and run:

```js
localStorage.clear(); location.reload();
```

## Tech

Vanilla HTML, CSS, and JavaScript. No framework, no bundler. Inline SVG for all flower artwork.

```
index.html            entry point
styles.css            all styling
js/
├── flowers.js        flower catalog (cost, price, growth time, level req)
├── storage.js        localStorage save/load with version check
├── state.js          pure state mutations (plant, water, sun, harvest, expandGrid)
├── svg.js            SVG markup per flower × stage
├── render.js         DOM rendering + click handlers
└── main.js           bootstrap + 500ms render tick
```

## Design & plan

- Design spec: [`docs/superpowers/specs/2026-06-01-dream-garden-design.md`](docs/superpowers/specs/2026-06-01-dream-garden-design.md)
- Implementation plan: [`docs/superpowers/plans/2026-06-01-dream-garden.md`](docs/superpowers/plans/2026-06-01-dream-garden.md)

## Credits

Original game **ดรีมการ์เด้น** by **SNS+** (2010, Facebook). This is a fan recreation of the core gameplay loop, not affiliated with the original developers.
