// Minimal localStorage-backed persistence, matching the {key, value} shape
// the app was originally written against (Claude.ai's artifact storage API).
// Swap this file out if you'd rather persist to a real backend later —
// nothing else in the app needs to change as long as get/set/delete keep
// this same async signature.

const PREFIX = "draft-room:";

export const storage = {
  async get(key) {
    try {
      const raw = window.localStorage.getItem(PREFIX + key);
      if (raw === null) return null;
      return { key, value: raw };
    } catch {
      return null;
    }
  },

  async set(key, value) {
    window.localStorage.setItem(PREFIX + key, value);
    return { key, value };
  },

  async delete(key) {
    window.localStorage.removeItem(PREFIX + key);
    return { key, deleted: true };
  },
};
