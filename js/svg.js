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
