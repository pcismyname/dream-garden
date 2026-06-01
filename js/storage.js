window.Garden = window.Garden || {};

(function (Garden) {
  const STORAGE_KEY = "dreamgarden.v1";
  const VERSION = 1;

  function save(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // Quota exceeded, private mode, etc. — game continues in-memory.
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== VERSION) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function clear() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }

  Garden.storage = { save, load, clear, STORAGE_KEY, VERSION };
})(window.Garden);
