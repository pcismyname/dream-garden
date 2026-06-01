window.Garden = window.Garden || {};
(function (Garden) {
  let state = null;

  function tick() {
    if (state) Garden.render.renderAll(state);
  }

  function start() {
    state = Garden.storage.load() || Garden.state.createInitialState();
    Garden.render.setupHandlers();
    Garden.render.renderAll(state);
    setInterval(tick, 500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})(window.Garden);
