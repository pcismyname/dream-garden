window.Garden = window.Garden || {};
(function (Garden) {
  function start() {
    const state = Garden.storage.load() || Garden.state.createInitialState();
    Garden.render.renderAll(state);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})(window.Garden);
