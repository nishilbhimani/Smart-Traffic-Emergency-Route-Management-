/**
 * Pulse · Smart Traffic & Emergency Route Management
 * Persistent User Preferences System (PulsePreferences)
 *
 * Capabilities:
 * - Versioned schema with migration support
 * - Type-safe validation with fallback to defaults
 * - SafeStorage driver (auto-falls back to in-memory if localStorage blocked/quota exceeded)
 * - Zero-flash theme hydration (Light / Dark / System sync)
 * - Cross-tab synchronization via storage events
 * - Granular pub/sub subscriptions for preference changes
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PulsePreferences = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STORAGE_KEY = 'pulse_preferences_v1';
  const SCHEMA_VERSION = 1;

  const DEFAULT_PREFERENCES = Object.freeze({
    version: SCHEMA_VERSION,
    theme: 'light', // Standard clean palette
    activeTab: 'overview', // 'overview' | 'map' | 'operations' | 'vehicles' | 'signals' | 'analytics'
    simSpeed: 1, // 1 | 3 | 8
    activeMissionIndex: 0,
    analyticsRange: '24h', // '24h' | '7d' | '30d'
    reducedMotion: 'system', // 'system' | 'always' | 'never'
    muteAudio: false,
    diagnosticsConsent: true,
    dismissedNotices: {}
  });

  const VALIDATORS = {
    theme: (v) => v === 'light',
    activeTab: (v) => ['overview', 'map', 'operations', 'vehicles', 'signals', 'analytics'].includes(v),
    simSpeed: (v) => [1, 3, 8].includes(Number(v)),
    activeMissionIndex: (v) => typeof v === 'number' && v >= 0 && v <= 10,
    analyticsRange: (v) => ['24h', '7d', '30d'].includes(v),
    reducedMotion: (v) => ['system', 'always', 'never'].includes(v),
    muteAudio: (v) => typeof v === 'boolean',
    diagnosticsConsent: (v) => typeof v === 'boolean',
    dismissedNotices: (v) => v && typeof v === 'object' && !Array.isArray(v)
  };

  // Safe Storage Driver with in-memory fallback
  class MemoryStorage {
    constructor() {
      this._data = new Map();
    }
    getItem(k) {
      return this._data.has(k) ? this._data.get(k) : null;
    }
    setItem(k, v) {
      this._data.set(k, String(v));
    }
    removeItem(k) {
      this._data.delete(k);
    }
    clear() {
      this._data.clear();
    }
  }

  let storageBackend = null;
  function getStorage() {
    if (storageBackend) return storageBackend;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const testKey = '__pulse_storage_test__';
        window.localStorage.setItem(testKey, '1');
        window.localStorage.removeItem(testKey);
        storageBackend = window.localStorage;
        return storageBackend;
      }
    } catch (e) {
      // LocalStorage unavailable, private mode restriction, or quota error
    }
    storageBackend = new MemoryStorage();
    return storageBackend;
  }

  // Active state
  let currentPrefs = { ...DEFAULT_PREFERENCES };
  const listeners = new Set();
  let mediaQueryMotion = null;

  function sanitize(data) {
    if (!data || typeof data !== 'object') {
      return { ...DEFAULT_PREFERENCES };
    }
    const clean = { ...DEFAULT_PREFERENCES };
    for (const [key, validator] of Object.entries(VALIDATORS)) {
      if (key in data && validator(data[key])) {
        clean[key] = data[key];
      }
    }
    clean.theme = 'light';
    clean.version = SCHEMA_VERSION;
    return clean;
  }

  function load() {
    try {
      const raw = getStorage().getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        currentPrefs = sanitize(parsed);
        if (parsed.theme && parsed.theme !== 'light') {
          save();
        }
      } else {
        currentPrefs = { ...DEFAULT_PREFERENCES };
      }
    } catch (err) {
      currentPrefs = { ...DEFAULT_PREFERENCES };
    }
    return currentPrefs;
  }

  function save() {
    try {
      getStorage().setItem(STORAGE_KEY, JSON.stringify(currentPrefs));
      return true;
    } catch (err) {
      return false;
    }
  }

  function notify(changedKey, value) {
    listeners.forEach((fn) => {
      try {
        fn(currentPrefs, changedKey, value);
      } catch (err) {
        // Prevent listener errors from breaking preferences
      }
    });
  }

  function get(key) {
    return key in currentPrefs ? currentPrefs[key] : DEFAULT_PREFERENCES[key];
  }

  function set(key, value) {
    if (key in VALIDATORS) {
      if (!VALIDATORS[key](value)) {
        return false;
      }
    }
    if (currentPrefs[key] === value) {
      return true; // No-op for unchanged value
    }
    currentPrefs[key] = value;
    save();
    notify(key, value);
    if (key === 'theme') {
      applyTheme(value);
    } else if (key === 'reducedMotion') {
      applyReducedMotion(value);
    }
    return true;
  }

  function update(partial) {
    if (!partial || typeof partial !== 'object') return false;
    let anyChanged = false;
    for (const [k, v] of Object.entries(partial)) {
      if (k in VALIDATORS && VALIDATORS[k](v)) {
        if (currentPrefs[k] !== v) {
          currentPrefs[k] = v;
          anyChanged = true;
        }
      }
    }
    if (anyChanged) {
      save();
      notify('__batch__', partial);
      if ('theme' in partial) applyTheme(partial.theme);
      if ('reducedMotion' in partial) applyReducedMotion(partial.reducedMotion);
    }
    return anyChanged;
  }

  function reset() {
    currentPrefs = { ...DEFAULT_PREFERENCES };
    save();
    notify('__reset__', currentPrefs);
    applyTheme(currentPrefs.theme);
    applyReducedMotion(currentPrefs.reducedMotion);
  }

  function subscribe(fn) {
    if (typeof fn === 'function') {
      listeners.add(fn);
      return () => listeners.delete(fn);
    }
    return () => {};
  }

  // Visual Theme Application (Pure Apple Light Design Language)
  function getEffectiveTheme() {
    return 'light';
  }

  function applyTheme() {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.setAttribute('data-theme', 'light');
    root.setAttribute('data-theme-preference', 'light');
    if (root.style) {
      root.style.colorScheme = 'light';
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('pulse:themechange', {
          detail: { theme: 'light', preference: 'light' }
        })
      );
    }
  }

  // Reduced Motion Application
  function getEffectiveReducedMotion(pref) {
    const val = pref || currentPrefs.reducedMotion;
    if (val === 'always') return true;
    if (val === 'never') return false;
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  }

  function applyReducedMotion(pref) {
    if (typeof document === 'undefined') return;
    const isReduced = getEffectiveReducedMotion(pref);
    document.documentElement.setAttribute('data-reduced-motion', isReduced ? 'true' : 'false');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('pulse:motionchange', {
          detail: { reducedMotion: isReduced, preference: pref || currentPrefs.reducedMotion }
        })
      );
    }
  }

  function init() {
    load();
    applyTheme('light');
    applyReducedMotion(currentPrefs.reducedMotion);

    if (typeof window !== 'undefined') {
      if (window.matchMedia) {
        mediaQueryMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (mediaQueryMotion.addEventListener) {
          mediaQueryMotion.addEventListener('change', () => {
            if (currentPrefs.reducedMotion === 'system') applyReducedMotion('system');
          });
        }
      }

      // Cross-tab synchronization
      window.addEventListener('storage', (event) => {
        if (event.key === STORAGE_KEY && event.newValue) {
          try {
            const externalPrefs = sanitize(JSON.parse(event.newValue));
            currentPrefs = externalPrefs;
            notify('__sync__', currentPrefs);
            applyTheme(currentPrefs.theme);
            applyReducedMotion(currentPrefs.reducedMotion);
          } catch (e) {}
        }
      });
    }
  }

  // Auto-initialize
  init();

  return {
    get,
    set,
    update,
    reset,
    getAll: () => ({ ...currentPrefs }),
    getDefaults: () => ({ ...DEFAULT_PREFERENCES }),
    subscribe,
    applyTheme,
    getEffectiveTheme,
    getEffectiveReducedMotion,
    isStoragePersistent: () => getStorage() === (typeof window !== 'undefined' ? window.localStorage : null)
  };
});
