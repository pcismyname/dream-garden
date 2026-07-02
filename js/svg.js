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

  // ========================================================================
  // Full bloom art — one hand-authored silhouette per species so every
  // flower is recognizable at plot size. Shape functions take (petal,
  // center) colors and return inner SVG content for an 80x80 canvas with
  // the flower head around (40, 28) and the stem reaching y=68. Shading
  // uses black/white overlays with opacity so rare recolors stay correct.
  // ========================================================================

  function svgWrap(content, viewBox) {
    return `<svg viewBox="${viewBox}" width="100%" height="100%">${content}</svg>`;
  }

  const OUTLINE = `stroke="rgba(0,0,0,0.14)" stroke-width="0.7"`;

  // Shared stem + two leaves, used by most single-head species.
  const STEM_LEAVES = `
    <path d="M40 42 Q39 55 40 68" stroke="#3b8e3b" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M40 56 Q31 49 26 53 Q30 60 40 59 Z" fill="#56b256" ${OUTLINE}/>
    <path d="M40 61 Q49 55 54 59 Q50 66 40 64 Z" fill="#4aa54a" ${OUTLINE}/>`;

  // Pointed petal anchored at pivot (px, py), tip length len, half-width w.
  function pointedPetal(px, py, len, w, angle, fill, opacity) {
    return `<path d="M${px} ${py} Q${px - w} ${py - len * 0.55} ${px} ${py - len} Q${px + w} ${py - len * 0.55} ${px} ${py} Z"
      fill="${fill}" ${OUTLINE} ${opacity ? `opacity="${opacity}"` : ""}
      transform="rotate(${angle} ${px} ${py})"/>`;
  }

  function daisyBloom(p, c) {
    let petals = "";
    for (let i = 0; i < 10; i++) {
      petals += `<ellipse cx="40" cy="19.5" rx="4.2" ry="11" fill="${p}" ${OUTLINE} transform="rotate(${i * 36} 40 30)"/>`;
    }
    return `${STEM_LEAVES}${petals}
      <circle cx="40" cy="30" r="7.5" fill="${c}"/>
      <circle cx="37.5" cy="27.5" r="2.6" fill="#fff" opacity="0.4"/>`;
  }

  function tulipBloom(p, c) {
    return `
      <path d="M40 40 L40 68" stroke="#3b8e3b" stroke-width="3" stroke-linecap="round"/>
      <path d="M40 60 Q29 53 26 41 Q36 47 40 55 Z" fill="#56b256" ${OUTLINE}/>
      <path d="M40 63 Q51 56 54 44 Q44 50 40 58 Z" fill="#4aa54a" ${OUTLINE}/>
      <path d="M29 23 Q28 40 40 41 Q52 40 51 23 L47 14 Q44 20 40 20 Q36 20 33 14 Z" fill="${p}" ${OUTLINE}/>
      <path d="M36 15 Q40 24 44 15 Q42 11 40 11 Q38 11 36 15 Z" fill="${p}"/>
      <path d="M36 15 Q40 24 44 15" stroke="${c}" stroke-width="1" fill="none" opacity="0.6"/>
      <path d="M32 22 Q31 34 38 39" stroke="#fff" stroke-width="1.6" fill="none" opacity="0.35" stroke-linecap="round"/>
      <path d="M47 16 Q50 28 44 38" stroke="rgba(0,0,0,0.12)" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
  }

  function roseBloom(p, c) {
    let outer = "";
    for (let i = 0; i < 6; i++) {
      const a = i * 60 + 30;
      outer += `<circle cx="40" cy="20" r="8" fill="${p}" ${OUTLINE} transform="rotate(${a} 40 30)"/>`;
    }
    return `${STEM_LEAVES}
      <path d="M36 50 l-3 -2 M43 57 l3 -2" stroke="#2d6b2d" stroke-width="1.4" stroke-linecap="round"/>
      ${outer}
      <circle cx="40" cy="30" r="9.5" fill="${p}"/>
      <circle cx="40" cy="30" r="9.5" fill="rgba(0,0,0,0.07)"/>
      <path d="M40 30 q5 -5 1 -8.5 M40 30 q-5.5 1.5 -2.5 6.5 M40 30 q3 3.5 6.5 0.5"
        stroke="${c}" stroke-width="1.3" fill="none" opacity="0.55" stroke-linecap="round"/>
      <circle cx="36" cy="25" r="2.4" fill="#fff" opacity="0.3"/>`;
  }

  function jasmineBloom(p, c) {
    function blossom(x, y, r) {
      let petals = "";
      for (let i = 0; i < 5; i++) {
        petals += `<ellipse cx="${x}" cy="${y - r}" rx="${r * 0.62}" ry="${r}" fill="${p}" ${OUTLINE} transform="rotate(${i * 72 + 15} ${x} ${y})"/>`;
      }
      return `${petals}<circle cx="${x}" cy="${y}" r="${r * 0.5}" fill="${c}"/>`;
    }
    return `
      <path d="M40 68 Q39 50 33 32 M40 68 Q42 48 48 28 M40 68 Q41 52 43 42"
        stroke="#3b8e3b" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <path d="M40 58 Q32 53 28 56 Q32 62 40 60 Z" fill="#56b256" ${OUTLINE}/>
      <path d="M42 50 Q50 46 53 49 Q49 55 42 52 Z" fill="#4aa54a" ${OUTLINE}/>
      ${blossom(32, 27, 6)}
      ${blossom(49, 22, 7)}
      ${blossom(43, 38, 5.5)}`;
  }

  function sunflowerBloom(p, c) {
    let petals = "";
    for (let i = 0; i < 12; i++) {
      petals += `<ellipse cx="40" cy="16" rx="4.6" ry="9.5" fill="${p}" ${OUTLINE} transform="rotate(${i * 30} 40 28)"/>`;
    }
    return `
      <path d="M40 42 Q39 55 40 68" stroke="#3b8e3b" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M40 55 Q29 47 24 52 Q29 61 40 58 Z" fill="#56b256" ${OUTLINE}/>
      <path d="M40 60 Q51 53 56 58 Q51 66 40 63 Z" fill="#4aa54a" ${OUTLINE}/>
      ${petals}
      <circle cx="40" cy="28" r="12" fill="${c}"/>
      <circle cx="40" cy="28" r="12" fill="none" stroke="rgba(0,0,0,0.2)" stroke-width="1"/>
      <circle cx="36" cy="25" r="1.3" fill="rgba(0,0,0,0.3)"/>
      <circle cx="43" cy="24" r="1.3" fill="rgba(0,0,0,0.3)"/>
      <circle cx="40" cy="30" r="1.3" fill="rgba(0,0,0,0.3)"/>
      <circle cx="35" cy="31" r="1.3" fill="rgba(0,0,0,0.3)"/>
      <circle cx="44" cy="31" r="1.3" fill="rgba(0,0,0,0.3)"/>
      <circle cx="40" cy="24" r="1.3" fill="rgba(0,0,0,0.3)"/>`;
  }

  function calceolariaBloom(p, c) {
    function pouch(x, y, r) {
      return `
        <ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 1.15}" fill="${p}" ${OUTLINE}/>
        <ellipse cx="${x}" cy="${y - r * 0.85}" rx="${r * 0.65}" ry="${r * 0.35}" fill="${p}"/>
        <ellipse cx="${x}" cy="${y - r * 0.85}" rx="${r * 0.65}" ry="${r * 0.35}" fill="rgba(0,0,0,0.15)"/>
        <circle cx="${x - r * 0.3}" cy="${y + r * 0.2}" r="1.1" fill="${c}"/>
        <circle cx="${x + r * 0.35}" cy="${y}" r="1.1" fill="${c}"/>
        <circle cx="${x}" cy="${y + r * 0.55}" r="1.1" fill="${c}"/>
        <ellipse cx="${x - r * 0.4}" cy="${y - r * 0.35}" rx="2" ry="2.8" fill="#fff" opacity="0.3"/>`;
    }
    return `
      <path d="M40 68 Q38 52 31 34 M40 68 Q43 50 49 30 M40 68 Q40 54 40 44"
        stroke="#3b8e3b" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <path d="M40 59 Q31 53 27 56 Q31 63 40 61 Z" fill="#56b256" ${OUTLINE}/>
      ${pouch(30, 27, 7)}
      ${pouch(49, 23, 8)}
      ${pouch(40, 38, 6.5)}`;
  }

  function marigoldBloom(p, c) {
    let ruffle = "";
    for (let i = 0; i < 8; i++) {
      ruffle += `<circle cx="40" cy="20.5" r="5.5" fill="${p}" ${OUTLINE} transform="rotate(${i * 45} 40 29)"/>`;
    }
    let inner = "";
    for (let i = 0; i < 6; i++) {
      inner += `<circle cx="40" cy="24" r="4" fill="#fff" opacity="0.22" transform="rotate(${i * 60 + 30} 40 29)"/>`;
    }
    return `${STEM_LEAVES}
      <circle cx="40" cy="29" r="12.5" fill="${p}" ${OUTLINE}/>
      ${ruffle}
      <circle cx="40" cy="29" r="8" fill="${p}"/>
      <circle cx="40" cy="29" r="8" fill="rgba(0,0,0,0.08)"/>
      ${inner}
      <circle cx="40" cy="29" r="3" fill="${c}"/>`;
  }

  function lavenderBloom(p, c) {
    function spike(x, top, n) {
      let buds = "";
      for (let i = 0; i < n; i++) {
        const y = top + i * 4.4;
        const dx = (i % 2 === 0 ? -2.2 : 2.2) * (1 - i / (n + 2));
        buds += `<ellipse cx="${x + dx}" cy="${y}" rx="3.1" ry="2.4" fill="${p}" ${OUTLINE}/>`;
      }
      return `${buds}<ellipse cx="${x}" cy="${top - 2.5}" rx="2.3" ry="3" fill="${c}"/>`;
    }
    return `
      <path d="M31 40 Q31 56 40 68 M40 34 L40 68 M49 42 Q49 57 40 68"
        stroke="#5a8e5a" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <path d="M40 60 Q31 54 27 57 Q31 64 40 62 Z" fill="#56b256" ${OUTLINE}/>
      <path d="M42 54 Q50 49 53 52 Q49 59 42 56 Z" fill="#4aa54a" ${OUTLINE}/>
      ${spike(31, 20, 5)}
      ${spike(40, 13, 6)}
      ${spike(49, 23, 5)}`;
  }

  function orchidBloom(p, c) {
    return `
      <path d="M40 68 Q36 52 39 40 Q40 34 42 32" stroke="#5a8e5a" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <path d="M40 62 Q30 56 26 59 Q31 66 40 64 Z" fill="#56b256" ${OUTLINE}/>
      <ellipse cx="34" cy="20" rx="6" ry="11" fill="${p}" ${OUTLINE} transform="rotate(-28 34 24)"/>
      <ellipse cx="50" cy="20" rx="6" ry="11" fill="${p}" ${OUTLINE} transform="rotate(28 50 24)"/>
      <ellipse cx="28" cy="30" rx="9" ry="5.5" fill="${p}" ${OUTLINE} transform="rotate(-12 28 30)"/>
      <ellipse cx="56" cy="30" rx="9" ry="5.5" fill="${p}" ${OUTLINE} transform="rotate(12 56 30)"/>
      <ellipse cx="42" cy="14" rx="5" ry="8" fill="${p}" ${OUTLINE}/>
      <path d="M34 30 Q42 24 50 30 Q48 42 42 43 Q36 42 34 30 Z" fill="${c}" ${OUTLINE}/>
      <circle cx="39" cy="33" r="1.2" fill="rgba(255,255,255,0.55)"/>
      <circle cx="45" cy="33" r="1.2" fill="rgba(255,255,255,0.55)"/>
      <circle cx="42" cy="37" r="1.2" fill="rgba(255,255,255,0.55)"/>
      <ellipse cx="42" cy="27" rx="3" ry="2" fill="#fff" opacity="0.5"/>`;
  }

  function lotusBloom(p, c) {
    let back = "";
    [-38, -13, 13, 38].forEach(a => {
      back += pointedPetal(40, 42, 26, 8, a, p, null);
    });
    let front = "";
    [-26, 0, 26].forEach(a => {
      front += pointedPetal(40, 44, 22, 9, a, p, null);
    });
    return `
      <ellipse cx="40" cy="48" rx="19" ry="5" fill="#3d9142" ${OUTLINE}/>
      <path d="M40 48 L52 45" stroke="#2d6b2d" stroke-width="1" opacity="0.5"/>
      ${back}
      <g opacity="0.14"><circle cx="40" cy="30" r="16" fill="#000"/></g>
      ${front}
      <circle cx="40" cy="38" r="3.5" fill="${c}"/>
      <circle cx="39" cy="37" r="1.3" fill="#fff" opacity="0.5"/>`;
  }

  function dahliaBloom(p, c) {
    let outer = "";
    for (let i = 0; i < 12; i++) {
      outer += pointedPetal(40, 30, 17, 4.5, i * 30, p, null);
    }
    let mid = "";
    for (let i = 0; i < 8; i++) {
      mid += pointedPetal(40, 30, 11, 3.6, i * 45 + 15, p, null);
    }
    return `${STEM_LEAVES}${outer}
      <circle cx="40" cy="30" r="9" fill="rgba(0,0,0,0.1)"/>
      ${mid}
      <g opacity="0.25">${pointedPetal(40, 30, 11, 3.6, 60, "#fff")}${pointedPetal(40, 30, 11, 3.6, 285, "#fff")}</g>
      <circle cx="40" cy="30" r="3.2" fill="${c}"/>`;
  }

  function moonflowerBloom(p, c) {
    let lobes = "";
    for (let i = 0; i < 5; i++) {
      lobes += `<circle cx="40" cy="17.5" r="6" fill="${p}" ${OUTLINE} transform="rotate(${i * 72 + 36} 40 28)"/>`;
    }
    return `
      <path d="M40 68 Q34 58 38 46 Q41 40 40 38" stroke="#4a8e5a" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <path d="M39 52 Q30 48 27 51 Q31 58 39 55 Z" fill="#56b256" ${OUTLINE}/>
      <circle cx="40" cy="28" r="17" fill="${p}" opacity="0.28"/>
      ${lobes}
      <circle cx="40" cy="28" r="11" fill="${p}"/>
      <path d="M33 25 L47 31 M33 31 L47 25 M40 20 L40 36" stroke="${c}" stroke-width="1.1" opacity="0.5"/>
      <circle cx="40" cy="28" r="3" fill="${c}"/>
      <circle cx="36" cy="24" r="2" fill="#fff" opacity="0.55"/>`;
  }

  // Species id → bloom shape function. Rares map to their parent's shape
  // (same species, rare color) via shapeKeyFor.
  const SHAPES = {
    daisy: daisyBloom,
    tulip: tulipBloom,
    rose: roseBloom,
    jasmine: jasmineBloom,
    sunflower: sunflowerBloom,
    calceolaria: calceolariaBloom,
    marigold: marigoldBloom,
    lavender: lavenderBloom,
    orchid: orchidBloom,
    lotus: lotusBloom,
    dahlia: dahliaBloom,
    moonflower: moonflowerBloom,
  };

  function shapeKeyFor(flowerId) {
    if (SHAPES[flowerId]) return flowerId;
    const rare = (Garden.RARE_FLOWERS || []).find(r => r.id === flowerId);
    if (rare && SHAPES[rare.parentId]) return rare.parentId;
    return "daisy";
  }

  function bloomContent(flowerId) {
    const c = COLORS[flowerId] || COLORS.daisy;
    return SHAPES[shapeKeyFor(flowerId)](c.petal, c.center);
  }

  // Wilted: a small dried plant clearly drooping inside the pot.
  // Uses pale tan + dark olive (high contrast against terracotta pot orange)
  // and is positioned off-center so the pot interior remains visible.
  const WILTED_SVG = `
    <svg viewBox="0 0 80 80" width="100%" height="100%">
      <!-- Stem rising from pot base, bending sharply to the side -->
      <path d="M 40 75 L 40 56 Q 38 52 30 54" stroke="#4a4022" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <!-- Drooping bud at the end of the bent stem -->
      <ellipse cx="28" cy="56" rx="6" ry="4" fill="#c9b08a" stroke="#7a6442" stroke-width="0.7"/>
      <ellipse cx="24" cy="54" rx="3" ry="2.5" fill="#b89878" opacity="0.9"/>
      <ellipse cx="32" cy="58" rx="3" ry="2.5" fill="#b89878" opacity="0.85"/>
      <circle cx="28" cy="56" r="2" fill="#4a3a26"/>
      <!-- Single drooping leaf on the other side -->
      <ellipse cx="48" cy="62" rx="6" ry="2.5" fill="#7a7a4a" stroke="#4a4022" stroke-width="0.6" transform="rotate(28 48 62)"/>
    </svg>`;

  // Flower color table (petal, center) — both normals and rares.
  const COLORS = {
    // Normals
    daisy:       { petal: "#ffffff", center: "#ffd84a" },
    tulip:       { petal: "#e84a5f", center: "#b22e3f" },
    rose:        { petal: "#d4456b", center: "#fce8b2" },
    jasmine:     { petal: "#fff7e0", center: "#f4d27a" },
    sunflower:   { petal: "#ffd84a", center: "#7a4a1a" },
    calceolaria: { petal: "#ff9933", center: "#cc5500" },
    marigold:    { petal: "#f5a623", center: "#b35c00" },
    lavender:    { petal: "#9a7fd4", center: "#6a4fb0" },
    orchid:      { petal: "#e87ab8", center: "#8a2f6a" },
    lotus:       { petal: "#ffb3c6", center: "#ffd84a" },
    dahlia:      { petal: "#e0526e", center: "#8a1f3a" },
    moonflower:  { petal: "#f2f0ff", center: "#8f84d8" },
    // Rares
    daisy_pink:       { petal: "#ffa3c2", center: "#ff5588" },
    tulip_purple:     { petal: "#9b4ad4", center: "#6a2fa0" },
    rose_white:       { petal: "#fffaef", center: "#e8d8a0" },
    jasmine_purple:   { petal: "#c79bff", center: "#7a4ad0" },
    sunflower_orange: { petal: "#ff8833", center: "#aa3300" },
    calceolaria_red:  { petal: "#e84a4a", center: "#aa1111" },
    marigold_white:     { petal: "#fdf6e3", center: "#d4a017" },
    lavender_pink:      { petal: "#e8a0c8", center: "#b0509a" },
    orchid_blue:        { petal: "#6a8fe8", center: "#24357a" },
    lotus_gold:         { petal: "#ffd84a", center: "#c98a10" },
    dahlia_black:       { petal: "#5a3a52", center: "#2a1028" },
    moonflower_crimson: { petal: "#d43a4a", center: "#5a0a14" },
  };

  function flowerSvg(flowerId, stage) {
    if (stage === "seed") return SEED_SVG;
    if (stage === "watered") return WATERED_SVG;
    if (stage === "sunned") return SUNNED_SVG;
    if (stage === "wilted") return WILTED_SVG;
    const c = COLORS[flowerId] || COLORS.daisy;
    if (stage === "growing") return growingSvg(c.petal);
    if (stage === "bloomed") return svgWrap(bloomContent(flowerId), "0 0 80 80");
    return "";
  }

  // Tiny icon for the seed shelf and catalog cards: the species bloom art
  // cropped to the flower head so each species chip is distinct.
  function flowerIcon(flowerId) {
    return svgWrap(bloomContent(flowerId), "12 2 56 56");
  }

  // Question-mark silhouette for undiscovered rare flowers in the catalog.
  const MYSTERY_ICON = `
    <svg viewBox="0 0 40 40" width="100%" height="100%">
      <circle cx="20" cy="20" r="14" fill="#d6c98a" opacity="0.5"/>
      <text x="20" y="27" text-anchor="middle" font-size="20" font-weight="bold" fill="#7a5e2a">?</text>
    </svg>`;

  // Open-book icon for the Catalog button — leather cover, two cream pages with text lines.
  const BOOK_ICON = `
    <svg viewBox="0 0 28 24" width="22" height="20" aria-hidden="true">
      <!-- Cover shadow / back -->
      <path d="M2 4 Q2 3 4 3 L13.5 4.5 L13.5 22 L4 21 Q2 21 2 20 Z" fill="#8b5a2b"/>
      <path d="M26 4 Q26 3 24 3 L14.5 4.5 L14.5 22 L24 21 Q26 21 26 20 Z" fill="#7a4a1f"/>
      <!-- Pages -->
      <path d="M3 5 Q3 4 13 5 L13 21 Q3 20 3 19 Z" fill="#fff8e0"/>
      <path d="M25 5 Q25 4 15 5 L15 21 Q25 20 25 19 Z" fill="#fff8e0"/>
      <!-- Spine -->
      <rect x="13.5" y="4.5" width="1" height="17.5" fill="#5a3815"/>
      <!-- Text lines (left page) -->
      <line x1="5" y1="8"  x2="11" y2="8.3"  stroke="#c9a87a" stroke-width="0.7"/>
      <line x1="5" y1="11" x2="11" y2="11.3" stroke="#c9a87a" stroke-width="0.7"/>
      <line x1="5" y1="14" x2="11" y2="14.3" stroke="#c9a87a" stroke-width="0.7"/>
      <line x1="5" y1="17" x2="11" y2="17.3" stroke="#c9a87a" stroke-width="0.7"/>
      <!-- Text lines (right page) -->
      <line x1="17" y1="8.3"  x2="23" y2="8"  stroke="#c9a87a" stroke-width="0.7"/>
      <line x1="17" y1="11.3" x2="23" y2="11" stroke="#c9a87a" stroke-width="0.7"/>
      <line x1="17" y1="14.3" x2="23" y2="14" stroke="#c9a87a" stroke-width="0.7"/>
      <line x1="17" y1="17.3" x2="23" y2="17" stroke="#c9a87a" stroke-width="0.7"/>
    </svg>`;

  // ========================================================================
  // Decoration SVGs — cartoon style, 64x64 viewBox.
  // ========================================================================

  const DECO_SVGS = {
    gnome: `
      <svg viewBox="0 0 64 64" width="100%" height="100%">
        <!-- Hat (red cone) -->
        <path d="M32 8 L48 30 L16 30 Z" fill="#c94a4a" stroke="#7a2828" stroke-width="1"/>
        <!-- Hat band -->
        <rect x="16" y="28" width="32" height="3" fill="#a83838"/>
        <!-- Face -->
        <ellipse cx="32" cy="36" rx="9" ry="8" fill="#f4cfa3" stroke="#7a5e2a" stroke-width="0.8"/>
        <!-- Beard -->
        <path d="M22 38 Q22 50 32 52 Q42 50 42 38 Q38 42 32 42 Q26 42 22 38 Z" fill="#fff" stroke="#9a9a9a" stroke-width="0.6"/>
        <!-- Eyes -->
        <circle cx="29" cy="35" r="1.2" fill="#3a2810"/>
        <circle cx="35" cy="35" r="1.2" fill="#3a2810"/>
        <!-- Nose -->
        <ellipse cx="32" cy="38" rx="2" ry="1.5" fill="#e89a8a"/>
        <!-- Body (blue overalls) -->
        <path d="M22 50 L20 60 L44 60 L42 50 Z" fill="#4a78c4" stroke="#2a4a8a" stroke-width="0.8"/>
        <!-- Buttons -->
        <circle cx="29" cy="55" r="1" fill="#ffd84a"/>
        <circle cx="35" cy="55" r="1" fill="#ffd84a"/>
      </svg>`,

    bush: `
      <svg viewBox="0 0 64 64" width="100%" height="100%">
        <!-- Pot -->
        <path d="M22 50 L42 50 L40 60 L24 60 Z" fill="#a85f30" stroke="#6b3d1a" stroke-width="0.8"/>
        <rect x="21" y="48" width="22" height="4" fill="#c97a4a" stroke="#6b3d1a" stroke-width="0.6" rx="1"/>
        <!-- Foliage clusters -->
        <circle cx="32" cy="28" r="14" fill="#56b256" stroke="#2d6b2d" stroke-width="0.8"/>
        <circle cx="22" cy="34" r="10" fill="#5fc05f" stroke="#2d6b2d" stroke-width="0.8"/>
        <circle cx="42" cy="34" r="10" fill="#5fc05f" stroke="#2d6b2d" stroke-width="0.8"/>
        <circle cx="28" cy="22" r="7" fill="#7cc47c"/>
        <circle cx="38" cy="24" r="6" fill="#7cc47c"/>
        <!-- Tiny flower accent -->
        <circle cx="26" cy="30" r="2" fill="#ffd84a"/>
        <circle cx="40" cy="30" r="2" fill="#ffa3c2"/>
      </svg>`,

    mailbox: `
      <svg viewBox="0 0 64 64" width="100%" height="100%">
        <!-- Post -->
        <rect x="29" y="36" width="6" height="24" fill="#8b5a2b" stroke="#5a3815" stroke-width="0.8"/>
        <!-- Box body -->
        <path d="M16 22 Q16 16 24 16 L40 16 Q48 16 48 22 L48 36 L16 36 Z" fill="#c94a4a" stroke="#7a2828" stroke-width="1"/>
        <!-- Door line -->
        <line x1="40" y1="22" x2="40" y2="34" stroke="#7a2828" stroke-width="1"/>
        <!-- Door handle -->
        <circle cx="42" cy="28" r="1.5" fill="#ffd84a" stroke="#7a5e2a" stroke-width="0.5"/>
        <!-- Flag (up) -->
        <rect x="48" y="20" width="6" height="5" fill="#ffd84a" stroke="#7a5e2a" stroke-width="0.6"/>
        <line x1="48" y1="18" x2="48" y2="30" stroke="#7a5e2a" stroke-width="1"/>
      </svg>`,

    fountain: `
      <svg viewBox="0 0 64 64" width="100%" height="100%">
        <!-- Base -->
        <ellipse cx="32" cy="54" rx="22" ry="6" fill="#9aa3a8" stroke="#5a6266" stroke-width="0.8"/>
        <ellipse cx="32" cy="50" rx="20" ry="5" fill="#b8c2c7"/>
        <!-- Water in basin -->
        <ellipse cx="32" cy="50" rx="16" ry="3.5" fill="#5cb6ff" opacity="0.85"/>
        <!-- Center column -->
        <rect x="29" y="32" width="6" height="20" fill="#9aa3a8" stroke="#5a6266" stroke-width="0.6"/>
        <ellipse cx="32" cy="32" rx="6" ry="2" fill="#b8c2c7"/>
        <!-- Water spray -->
        <path d="M32 32 Q26 22 28 12 M32 32 Q38 22 36 12 M32 32 Q32 20 32 10" stroke="#5cb6ff" stroke-width="1.5" fill="none" opacity="0.7"/>
        <circle cx="32" cy="10" r="2" fill="#5cb6ff" opacity="0.9"/>
        <circle cx="28" cy="14" r="1.5" fill="#5cb6ff" opacity="0.8"/>
        <circle cx="36" cy="14" r="1.5" fill="#5cb6ff" opacity="0.8"/>
      </svg>`,

    bench: `
      <svg viewBox="0 0 64 64" width="100%" height="100%">
        <!-- Back legs (slats) -->
        <rect x="14" y="20" width="3" height="32" fill="#8b5a2b" stroke="#5a3815" stroke-width="0.6"/>
        <rect x="47" y="20" width="3" height="32" fill="#8b5a2b" stroke="#5a3815" stroke-width="0.6"/>
        <!-- Backrest slats -->
        <rect x="12" y="22" width="40" height="3" fill="#a06834" stroke="#5a3815" stroke-width="0.5"/>
        <rect x="12" y="28" width="40" height="3" fill="#a06834" stroke="#5a3815" stroke-width="0.5"/>
        <rect x="12" y="34" width="40" height="3" fill="#a06834" stroke="#5a3815" stroke-width="0.5"/>
        <!-- Seat -->
        <rect x="10" y="40" width="44" height="6" fill="#c97a4a" stroke="#5a3815" stroke-width="0.7" rx="1"/>
        <!-- Front legs -->
        <rect x="14" y="46" width="3" height="14" fill="#8b5a2b" stroke="#5a3815" stroke-width="0.6"/>
        <rect x="47" y="46" width="3" height="14" fill="#8b5a2b" stroke="#5a3815" stroke-width="0.6"/>
      </svg>`,

    sundial: `
      <svg viewBox="0 0 64 64" width="100%" height="100%">
        <!-- Pedestal base -->
        <ellipse cx="32" cy="58" rx="14" ry="3" fill="#7a6a5a"/>
        <rect x="22" y="40" width="20" height="18" fill="#a89a8a" stroke="#5a4a3a" stroke-width="0.8"/>
        <rect x="20" y="38" width="24" height="4" fill="#c9bba8" stroke="#5a4a3a" stroke-width="0.6"/>
        <!-- Dial plate -->
        <ellipse cx="32" cy="36" rx="18" ry="5" fill="#d4c8a8" stroke="#7a6a4a" stroke-width="0.8"/>
        <ellipse cx="32" cy="35" rx="18" ry="5" fill="#e8dcc0"/>
        <!-- Hour marks -->
        <line x1="32" y1="32" x2="32" y2="33" stroke="#5a4a3a" stroke-width="0.8"/>
        <line x1="20" y1="35" x2="22" y2="35" stroke="#5a4a3a" stroke-width="0.8"/>
        <line x1="42" y1="35" x2="44" y2="35" stroke="#5a4a3a" stroke-width="0.8"/>
        <line x1="24" y1="32" x2="25" y2="33" stroke="#5a4a3a" stroke-width="0.6"/>
        <line x1="40" y1="32" x2="39" y2="33" stroke="#5a4a3a" stroke-width="0.6"/>
        <!-- Gnomon (triangle) -->
        <path d="M32 35 L32 20 L42 35 Z" fill="#7a6a4a" stroke="#3a2a1a" stroke-width="0.8"/>
      </svg>`,
  };

  function decorationSvg(id) {
    return DECO_SVGS[id] || "";
  }

  // ========================================================================
  // Pot skins — 72x72 SVGs that replace the plot background.
  // Each pot is a trapezoid/vase shape narrower at the bottom, with a dirt
  // strip at the top where the flower emerges.
  // ========================================================================

  const POT_SVGS = {
    dirt: `
      <svg viewBox="0 0 72 72" width="100%" height="100%">
        <rect x="2" y="2" width="68" height="68" rx="10" fill="#9c5a2a" stroke="#5a3815" stroke-width="1"/>
        <rect x="2" y="2" width="68" height="6" rx="10" fill="#a85f30" opacity="0.7"/>
        <!-- subtle soil texture -->
        <circle cx="18" cy="26" r="1.5" fill="#7a4a1f" opacity="0.5"/>
        <circle cx="48" cy="32" r="1.2" fill="#7a4a1f" opacity="0.45"/>
        <circle cx="30" cy="48" r="1.5" fill="#7a4a1f" opacity="0.5"/>
        <circle cx="55" cy="55" r="1" fill="#7a4a1f" opacity="0.4"/>
        <circle cx="20" cy="58" r="1.2" fill="#7a4a1f" opacity="0.45"/>
        <circle cx="40" cy="20" r="1" fill="#7a4a1f" opacity="0.4"/>
      </svg>`,

    terracotta: `
      <svg viewBox="0 0 72 72" width="100%" height="100%">
        <path d="M 10 22 L 62 22 L 56 66 L 16 66 Z" fill="#9c5a2a" stroke="#5a3815" stroke-width="0.9"/>
        <rect x="6" y="16" width="60" height="7" rx="2" fill="#a85f30" stroke="#5a3815" stroke-width="0.9"/>
        <rect x="8" y="17" width="56" height="1.5" fill="#c97a4a" opacity="0.7"/>
        <ellipse cx="36" cy="22" rx="25" ry="2.5" fill="#3a2810"/>
      </svg>`,

    barrel: `
      <svg viewBox="0 0 72 72" width="100%" height="100%">
        <path d="M 12 22 Q 8 26 8 32 L 10 60 Q 10 66 16 66 L 56 66 Q 62 66 62 60 L 64 32 Q 64 26 60 22 Z" fill="#a06834" stroke="#5a3815" stroke-width="0.9"/>
        <line x1="20" y1="24" x2="20" y2="64" stroke="#5a3815" stroke-width="0.5"/>
        <line x1="30" y1="24" x2="30" y2="64" stroke="#5a3815" stroke-width="0.5"/>
        <line x1="42" y1="24" x2="42" y2="64" stroke="#5a3815" stroke-width="0.5"/>
        <line x1="52" y1="24" x2="52" y2="64" stroke="#5a3815" stroke-width="0.5"/>
        <path d="M 9 30 Q 36 32 63 30" stroke="#6a6a6a" stroke-width="2.5" fill="none"/>
        <path d="M 9 58 Q 36 60 63 58" stroke="#6a6a6a" stroke-width="2.5" fill="none"/>
        <ellipse cx="36" cy="22" rx="26" ry="2.5" fill="#3a2810"/>
      </svg>`,

    ceramic: `
      <svg viewBox="0 0 72 72" width="100%" height="100%">
        <path d="M 14 24 Q 8 30 10 42 L 14 60 Q 16 66 22 66 L 50 66 Q 56 66 58 60 L 62 42 Q 64 30 58 24 Z" fill="#4a78c4" stroke="#1a3a7a" stroke-width="0.9"/>
        <path d="M 18 30 Q 16 36 20 48" stroke="#a8c8ee" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.85"/>
        <ellipse cx="36" cy="22" rx="24" ry="3.5" fill="#3a5a9a" stroke="#1a3a7a" stroke-width="0.7"/>
        <ellipse cx="36" cy="22" rx="22" ry="2" fill="#3a2810"/>
      </svg>`,

    stone: `
      <svg viewBox="0 0 72 72" width="100%" height="100%">
        <path d="M 10 22 L 62 22 L 58 66 L 14 66 Z" fill="#8a8a85" stroke="#4a4a45" stroke-width="0.9"/>
        <rect x="6" y="16" width="60" height="7" rx="1" fill="#9a9a95" stroke="#4a4a45" stroke-width="0.9"/>
        <circle cx="20" cy="38" r="1.5" fill="#6a6a65"/>
        <circle cx="28" cy="52" r="1.2" fill="#7a7a75"/>
        <circle cx="45" cy="42" r="1.5" fill="#6a6a65"/>
        <circle cx="52" cy="56" r="1.2" fill="#7a7a75"/>
        <circle cx="35" cy="32" r="1" fill="#6a6a65"/>
        <circle cx="48" cy="32" r="1.2" fill="#6a6a65"/>
        <ellipse cx="36" cy="22" rx="26" ry="2.5" fill="#3a2810"/>
      </svg>`,

    vase: `
      <svg viewBox="0 0 72 72" width="100%" height="100%">
        <path d="M 20 24 Q 8 32 14 50 Q 16 64 22 66 L 50 66 Q 56 64 58 50 Q 64 32 52 24 Z" fill="#f5e4c5" stroke="#7a5e2a" stroke-width="0.9"/>
        <rect x="16" y="16" width="40" height="7" rx="2" fill="#e0b540" stroke="#7a5e2a" stroke-width="0.7"/>
        <rect x="16" y="17" width="40" height="1.5" fill="#ffd84a" opacity="0.8"/>
        <path d="M 10 44 Q 36 46 62 44" stroke="#d4a017" stroke-width="2.5" fill="none"/>
        <circle cx="26" cy="52" r="1.6" fill="#d4a017"/>
        <circle cx="36" cy="54" r="1.6" fill="#d4a017"/>
        <circle cx="46" cy="52" r="1.6" fill="#d4a017"/>
        <ellipse cx="36" cy="22" rx="20" ry="2.5" fill="#3a2810"/>
      </svg>`,
  };

  function potSvg(potId) {
    return POT_SVGS[potId] || POT_SVGS.terracotta;
  }

  // ========================================================================
  // Potion SVGs — small flask icons (~32x32).
  // ========================================================================

  const POTION_SVGS = {
    speedPotion: `
      <svg viewBox="0 0 40 40" width="100%" height="100%">
        <!-- Cork -->
        <rect x="15" y="3" width="10" height="3.5" rx="1" fill="#8b5a2b" stroke="#5a3815" stroke-width="0.5"/>
        <!-- Neck -->
        <rect x="16" y="6" width="8" height="6" fill="#c8dec8" stroke="#5a8e5a" stroke-width="0.5"/>
        <!-- Flask body -->
        <path d="M 14 12 L 26 12 L 30 28 Q 30 36 22 36 L 18 36 Q 10 36 10 28 Z" fill="#5fb35f" stroke="#2a7a2a" stroke-width="0.8"/>
        <!-- Liquid surface highlight -->
        <path d="M 14 14 Q 20 16 26 14" stroke="#3b8e3b" stroke-width="0.5" fill="none"/>
        <!-- Up-arrow marker (speed) -->
        <path d="M 20 19 L 15 26 L 25 26 Z" fill="#fff" opacity="0.92"/>
        <!-- Highlight on flask -->
        <path d="M 13 22 Q 12 28 14 33" stroke="#a8dba8" stroke-width="1.2" fill="none" stroke-linecap="round" opacity="0.8"/>
      </svg>`,

    revivalPotion: `
      <svg viewBox="0 0 40 40" width="100%" height="100%">
        <rect x="15" y="3" width="10" height="3.5" rx="1" fill="#8b5a2b" stroke="#5a3815" stroke-width="0.5"/>
        <rect x="16" y="6" width="8" height="6" fill="#cad9ea" stroke="#5a78a8" stroke-width="0.5"/>
        <path d="M 14 12 L 26 12 L 30 28 Q 30 36 22 36 L 18 36 Q 10 36 10 28 Z" fill="#5cb6ff" stroke="#1a4a8a" stroke-width="0.8"/>
        <path d="M 14 14 Q 20 16 26 14" stroke="#2a78c4" stroke-width="0.5" fill="none"/>
        <!-- Heart marker (revival) -->
        <path d="M 20 24 C 17 21, 14 22, 14.5 25 C 15 27.5, 20 30, 20 30 C 20 30, 25 27.5, 25.5 25 C 26 22, 23 21, 20 24 Z" fill="#fff" opacity="0.92"/>
        <path d="M 13 22 Q 12 28 14 33" stroke="#a8d4f0" stroke-width="1.2" fill="none" stroke-linecap="round" opacity="0.8"/>
      </svg>`,
  };

  function potionSvg(id) {
    return POTION_SVGS[id] || "";
  }

  // ========================================================================

  // Gear icon for the Settings button.
  const GEAR_ICON = `
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M19.14 12.94a7.42 7.42 0 0 0 .05-.94 7.42 7.42 0 0 0-.05-.94l2.03-1.58a.48.48 0 0 0 .12-.61l-1.92-3.32a.48.48 0 0 0-.59-.21l-2.39.96a7.4 7.4 0 0 0-1.63-.94l-.36-2.54A.47.47 0 0 0 13.94 2h-3.84a.47.47 0 0 0-.47.4l-.36 2.54a7.4 7.4 0 0 0-1.63.94l-2.39-.96a.48.48 0 0 0-.59.21L2.74 8.45a.48.48 0 0 0 .12.61l2.03 1.58a7.42 7.42 0 0 0-.05.94 7.42 7.42 0 0 0 .05.94l-2.03 1.58a.48.48 0 0 0-.12.61l1.92 3.32a.48.48 0 0 0 .59.21l2.39-.96a7.4 7.4 0 0 0 1.63.94l.36 2.54a.47.47 0 0 0 .47.4h3.84a.47.47 0 0 0 .47-.4l.36-2.54a7.4 7.4 0 0 0 1.63-.94l2.39.96a.48.48 0 0 0 .59-.21l1.92-3.32a.48.48 0 0 0-.12-.61zM12 15.5A3.5 3.5 0 1 1 15.5 12 3.5 3.5 0 0 1 12 15.5z" fill="#7a5e2a"/>
    </svg>`;

  // Storefront icon for the Shop button — red striped awning over a building.
  const SHOP_ICON = `
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <!-- Awning -->
      <path d="M2 8 L22 8 L20 12 L4 12 Z" fill="#c94a4a"/>
      <line x1="6" y1="8" x2="5" y2="12" stroke="#fff" stroke-width="0.7"/>
      <line x1="10" y1="8" x2="9" y2="12" stroke="#fff" stroke-width="0.7"/>
      <line x1="14" y1="8" x2="13" y2="12" stroke="#fff" stroke-width="0.7"/>
      <line x1="18" y1="8" x2="17" y2="12" stroke="#fff" stroke-width="0.7"/>
      <!-- Building -->
      <rect x="3" y="12" width="18" height="10" fill="#fff4d6" stroke="#7a5e2a" stroke-width="0.6"/>
      <!-- Door -->
      <rect x="10" y="15" width="4" height="7" fill="#8b5a2b"/>
      <circle cx="13" cy="18.5" r="0.5" fill="#ffd84a"/>
      <!-- Windows -->
      <rect x="5" y="14" width="3" height="3" fill="#5cb6ff" stroke="#7a5e2a" stroke-width="0.4"/>
      <rect x="16" y="14" width="3" height="3" fill="#5cb6ff" stroke="#7a5e2a" stroke-width="0.4"/>
    </svg>`;

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

  Garden.svg = {
    flowerSvg, flowerIcon, MYSTERY_ICON, BOOK_ICON, GEAR_ICON, SHOP_ICON,
    decorationSvg, potSvg, potionSvg,
    CALENDAR_ICON, CHEST_ICON, mysterySproutSvg, drawPrizeSvg,
  };
})(window.Garden);
