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

  Garden.fx = { floatText, toast };
})(window.Garden);
