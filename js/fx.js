window.Garden = window.Garden || {};

(function (Garden) {
  // Effects layer for short-lived floating numbers ("+12c", "+2 XP").
  function ensureFxLayer() {
    let layer = document.getElementById("fx-layer");
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "fx-layer";
      document.body.appendChild(layer);
    }
    return layer;
  }

  // Toast layer for status messages (quest complete, level up).
  function ensureToastLayer() {
    let layer = document.getElementById("toast-layer");
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "toast-layer";
      document.body.appendChild(layer);
    }
    return layer;
  }

  // Show a floating "+N" string near viewport coords (x, y).
  // Auto-removes after the rise animation finishes.
  function floatText(text, x, y, opts) {
    opts = opts || {};
    const layer = ensureFxLayer();
    const el = document.createElement("div");
    el.className = "fx-float";
    if (opts.color) el.style.color = opts.color;
    if (opts.dx) el.style.setProperty("--fx-dx", opts.dx + "px");
    if (opts.delay) {
      el.style.animationDelay = opts.delay + "ms";
      el.style.opacity = "0"; // stay invisible during the pre-animation delay
    }
    el.textContent = text;
    el.style.left = x + "px";
    el.style.top = y + "px";
    layer.appendChild(el);
    el.addEventListener("animationend", () => el.remove(), { once: true });
  }

  // Show a corner toast. Variants: "quest", "level", "rare" — for color.
  function toast(text, opts) {
    opts = opts || {};
    const layer = ensureToastLayer();
    const el = document.createElement("div");
    el.className = "toast" + (opts.variant ? " toast-" + opts.variant : "");
    el.textContent = text;
    layer.appendChild(el);
    // CSS chains two animations; only remove on the "out" one.
    el.addEventListener("animationend", (ev) => {
      if (ev.animationName === "toast-out") el.remove();
    });
  }

  // Ambient scene layers, installed once at boot (they live outside the
  // re-rendered #app tree so CSS loops never restart on renderAll):
  //  - #sky-layer (z-index -1): two soft clouds drifting behind the UI.
  //  - #ambient-layer (z-index 30): butterflies + falling petals, all
  //    pointer-events: none. Purely decorative; CSS does all the motion.
  function startAmbient() {
    if (document.getElementById("ambient-layer")) return;

    const sky = document.createElement("div");
    sky.id = "sky-layer";
    sky.innerHTML = `
      <div class="cloud cloud-a"></div>
      <div class="cloud cloud-b"></div>`;
    document.body.appendChild(sky);

    const butterflySvg = (wing, body) => `
      <svg viewBox="0 0 24 20" width="100%" height="100%">
        <g class="bf-wings">
          <ellipse cx="7" cy="7" rx="6" ry="5.5" fill="${wing}" opacity="0.9"/>
          <ellipse cx="17" cy="7" rx="6" ry="5.5" fill="${wing}" opacity="0.9"/>
          <ellipse cx="8" cy="14" rx="4.5" ry="4" fill="${wing}" opacity="0.75"/>
          <ellipse cx="16" cy="14" rx="4.5" ry="4" fill="${wing}" opacity="0.75"/>
        </g>
        <ellipse cx="12" cy="10" rx="1.6" ry="6" fill="${body}"/>
      </svg>`;

    const layer = document.createElement("div");
    layer.id = "ambient-layer";
    layer.innerHTML = `
      <div class="butterfly butterfly-a">${butterflySvg("#ffb347", "#5a3815")}</div>
      <div class="butterfly butterfly-b">${butterflySvg("#8fc7ff", "#2a3a5a")}</div>
      <div class="petal petal-a"></div>
      <div class="petal petal-b"></div>
      <div class="petal petal-c"></div>`;
    document.body.appendChild(layer);
  }

  Garden.fx = { floatText, toast, startAmbient };
})(window.Garden);
