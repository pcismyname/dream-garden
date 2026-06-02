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

  // Wilted: petals droop, brown/gray, bent stem. Same silhouette for all flowers —
  // wilt is wilt, color doesn't matter.
  const WILTED_SVG = `
    <svg viewBox="0 0 80 80" width="100%" height="100%">
      <!-- Drooping petals, faded -->
      <ellipse cx="40" cy="54" rx="8" ry="6" fill="#8b7355"/>
      <ellipse cx="30" cy="50" rx="7" ry="5" fill="#8b7355" opacity="0.85"/>
      <ellipse cx="50" cy="50" rx="7" ry="5" fill="#8b7355" opacity="0.85"/>
      <ellipse cx="33" cy="60" rx="6" ry="4" fill="#736049" opacity="0.7"/>
      <ellipse cx="47" cy="60" rx="6" ry="4" fill="#736049" opacity="0.7"/>
      <circle cx="40" cy="55" r="3.5" fill="#4a3a26"/>
      <!-- Bent stem -->
      <path d="M 40 60 Q 28 66 32 75" stroke="#6b4f2a" stroke-width="3" fill="none" stroke-linecap="round"/>
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
    // Rares
    daisy_pink:       { petal: "#ffa3c2", center: "#ff5588" },
    tulip_purple:     { petal: "#9b4ad4", center: "#6a2fa0" },
    rose_white:       { petal: "#fffaef", center: "#e8d8a0" },
    jasmine_purple:   { petal: "#c79bff", center: "#7a4ad0" },
    sunflower_orange: { petal: "#ff8833", center: "#aa3300" },
    calceolaria_red:  { petal: "#e84a4a", center: "#aa1111" },
  };

  function flowerSvg(flowerId, stage) {
    if (stage === "seed") return SEED_SVG;
    if (stage === "watered") return WATERED_SVG;
    if (stage === "sunned") return SUNNED_SVG;
    if (stage === "wilted") return WILTED_SVG;
    const c = COLORS[flowerId] || COLORS.daisy;
    if (stage === "growing") return growingSvg(c.petal);
    if (stage === "bloomed") return bloomedSvg(c.petal, c.center);
    return "";
  }

  // Tiny icon for the seed shelf and catalog cards.
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

  Garden.svg = { flowerSvg, flowerIcon, MYSTERY_ICON, BOOK_ICON };
})(window.Garden);
