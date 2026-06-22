window.Garden = window.Garden || {};

(function (Garden) {
  const STORAGE_KEY = "dreamgarden.v1";
  const VERSION = 1;

  function parseSave(raw) {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed && parsed.version === VERSION ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  function save(state) {
    try {
      if (state.daily) state.daily.lastSeenAt = Date.now();
      const json = JSON.stringify(state);
      if (Garden.cg && Garden.cg.dataAvailable()) {
        Garden.cg.setItem(STORAGE_KEY, json);
      } else {
        localStorage.setItem(STORAGE_KEY, json);
      }
    } catch (e) {
      // Quota exceeded, private mode, etc. — game continues in-memory.
    }
  }

  async function load() {
    if (Garden.cg && Garden.cg.dataAvailable()) {
      let raw = Garden.cg.getItem(STORAGE_KEY);
      if (raw === null) {
        // Lift-on-empty migration: when the cloud bucket is empty, copy any
        // valid localStorage save up to the Data Module. Fires every boot
        // until the cloud has data — idempotent because save() only writes
        // to localStorage off-CG, so the lifted payload never drifts. We
        // validate via parseSave first so corrupt or wrong-version local
        // saves never get pinned to the cloud, and we drop the localStorage
        // shadow after a successful uplift to avoid stale-resurface across
        // signed-in → guest transitions on CG.
        const fallback = localStorage.getItem(STORAGE_KEY);
        if (fallback && parseSave(fallback)) {
          Garden.cg.setItem(STORAGE_KEY, fallback);
          localStorage.removeItem(STORAGE_KEY);
          raw = fallback;
        }
      }
      return parseSave(raw);
    }
    return parseSave(localStorage.getItem(STORAGE_KEY));
  }

  function clear() {
    try {
      if (Garden.cg && Garden.cg.dataAvailable()) {
        Garden.cg.removeItem(STORAGE_KEY);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {}
  }

  Garden.storage = { save, load, clear, STORAGE_KEY, VERSION };
})(window.Garden);
