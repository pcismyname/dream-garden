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
  // Thin warm-brown stroke so light-petaled flowers (Daisy, Jasmine) are visible
  // against light card backgrounds.
  function flowerIcon(flowerId) {
    const c = COLORS[flowerId] || COLORS.daisy;
    return `
      <svg viewBox="0 0 40 40" width="100%" height="100%">
        <g stroke="#6b5a3a" stroke-width="0.8">
          <ellipse cx="20" cy="18" rx="5" ry="5" fill="${c.petal}"/>
          <ellipse cx="14" cy="16" rx="4" ry="4" fill="${c.petal}"/>
          <ellipse cx="26" cy="16" rx="4" ry="4" fill="${c.petal}"/>
          <ellipse cx="16" cy="24" rx="4" ry="4" fill="${c.petal}"/>
          <ellipse cx="24" cy="24" rx="4" ry="4" fill="${c.petal}"/>
          <circle cx="20" cy="20" r="3" fill="${c.center}"/>
        </g>
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

  Garden.svg = {
    flowerSvg, flowerIcon, MYSTERY_ICON, BOOK_ICON, GEAR_ICON, SHOP_ICON,
    decorationSvg,
  };
})(window.Garden);
