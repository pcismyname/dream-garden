window.Garden = window.Garden || {};

(function (Garden) {
  const TIMEOUT_MS = 3000;
  const POLL_MS = 100;

  let started = false;
  let readyPromise = null;

  function isAvailable() {
    return !!(window.CrazyGames && window.CrazyGames.SDK);
  }

  // Returns a cached Promise that resolves once the CrazyGames SDK script
  // has loaded and attached itself to window. Rejects after TIMEOUT_MS so
  // callers can fall back to a silent no-op when the SDK never arrives
  // (network blocked, file:// protocol, ad blocker, etc.).
  function ready() {
    if (readyPromise) return readyPromise;
    readyPromise = new Promise((resolve, reject) => {
      const deadline = Date.now() + TIMEOUT_MS;
      function poll() {
        if (isAvailable()) {
          resolve(true);
          return;
        }
        if (Date.now() >= deadline) {
          reject(new Error("CrazyGames SDK timeout"));
          return;
        }
        setTimeout(poll, POLL_MS);
      }
      poll();
    });
    return readyPromise;
  }

  // Fires the SDK's gameplayStart call at most once per page session.
  // Awaits ready() so the call works even when main.js boots before the
  // async SDK script finishes loading. All errors are swallowed — the
  // game must keep working whether or not the SDK is reachable.
  function gameplayStart() {
    if (started) return Promise.resolve();
    started = true;
    return ready().then(() => {
      try {
        const sdk = window.CrazyGames.SDK;
        // SDK reports environment "disabled" off the CrazyGames platform
        // (e.g., the public GitHub Pages site). Calling gameplayStart()
        // in that state triggers a synchronous console.error from inside
        // the SDK that no outside catch can suppress — so we skip the call.
        if (sdk.environment === "disabled") return;
        const result = sdk.game.gameplayStart();
        // Inside the CG iframe the call returns a Promise; swallow rejections
        // defensively (same pattern as musicEl.play() in js/audio.js).
        if (result && typeof result.catch === "function") result.catch(() => {});
      } catch (_) { /* synchronous throw — swallow */ }
    }, () => { /* SDK never appeared — silent fall-through */ });
  }

  Garden.cg = { ready, gameplayStart, isAvailable };
})(window.Garden);
