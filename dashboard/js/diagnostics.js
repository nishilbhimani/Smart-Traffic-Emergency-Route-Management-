/**
 * Pulse · Smart Traffic & Emergency Route Management
 * Centralized Diagnostics, Observability & Analytics Module (PulseDiagnostics)
 *
 * Capabilities:
 * - Structured product analytics with privacy sanitation
 * - Centralized error capture with deduplication & correlation IDs
 * - Performance metrics (Web Vitals, FPS, Tab Latency, Long Tasks)
 * - Health indicator calculation (Normal / Warning / Degraded)
 * - Bounded ring-buffer storage with exportable diagnostic reports
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./preferences.js'));
  } else {
    root.PulseDiagnostics = factory(root.PulsePreferences);
  }
})(typeof self !== 'undefined' ? self : this, function (Preferences) {
  'use strict';

  const MAX_LOG_ENTRIES = 120;
  const DEDUPE_WINDOW_MS = 5000;
  const APP_VERSION = '2.4.0';

  const ringBuffer = [];
  const recentErrorSignatures = new Map();
  const metricAggregates = new Map();

  let healthState = 'normal'; // 'normal' | 'warning' | 'error'
  let totalErrorsCount = 0;
  let totalEventsCount = 0;
  let fpsHistory = [];
  let currentFps = 60;
  let lastFpsTime = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  let frameCount = 0;

  function generateCorrelationId(prefix = 'corr') {
    return prefix + '_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
  }

  function sanitizePayload(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const sensitiveKeys = ['password', 'token', 'auth', 'secret', 'key', 'credit', 'cookie'];
    const clean = {};
    for (const [k, v] of Object.entries(obj)) {
      if (sensitiveKeys.some((s) => k.toLowerCase().includes(s))) {
        clean[k] = '[REDACTED]';
      } else if (typeof v === 'string') {
        clean[k] = v.length > 250 ? v.substring(0, 250) + '…' : v;
      } else if (typeof v === 'object' && v !== null) {
        clean[k] = Array.isArray(v) ? v.slice(0, 10) : sanitizePayload(v);
      } else {
        clean[k] = v;
      }
    }
    return clean;
  }

  function appendLog(type, item) {
    ringBuffer.push({
      id: generateCorrelationId('log'),
      timestamp: new Date().toISOString(),
      type,
      ...item
    });
    if (ringBuffer.length > MAX_LOG_ENTRIES) {
      ringBuffer.shift();
    }
    notifyLogChange();
  }

  const logListeners = new Set();
  function notifyLogChange() {
    logListeners.forEach((fn) => {
      try {
        fn(ringBuffer);
      } catch (e) {}
    });
  }

  function updateHealth() {
    let nextHealth = 'normal';
    if (totalErrorsCount > 4) {
      nextHealth = 'error';
    } else if (totalErrorsCount > 0 || currentFps < 25) {
      nextHealth = 'warning';
    }

    if (nextHealth !== healthState) {
      healthState = nextHealth;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('pulse:healthchange', {
            detail: { health: healthState, totalErrors: totalErrorsCount }
          })
        );
      }
    }
  }

  // --- Product Analytics ---
  function track(eventName, payload = {}) {
    if (Preferences && !Preferences.get('diagnosticsConsent')) {
      return false;
    }
    if (typeof eventName !== 'string' || !eventName.trim()) {
      return false;
    }

    totalEventsCount++;
    const cleanPayload = sanitizePayload(payload);
    const eventRecord = {
      event: eventName,
      payload: cleanPayload,
      route: Preferences ? Preferences.get('activeTab') : 'unknown'
    };

    appendLog('event', eventRecord);
    return true;
  }

  // --- Centralized Error Reporting ---
  function captureError(err, context = {}) {
    totalErrorsCount++;
    const message = err instanceof Error ? err.message : String(err || 'Unknown error');
    const stack = err instanceof Error && err.stack ? err.stack.split('\n').slice(0, 4).join('\n') : '';
    const category = context.category || 'general';
    const route = context.route || (Preferences ? Preferences.get('activeTab') : 'unknown');

    // Deduplication
    const signature = `${category}:${message}:${route}`;
    const now = Date.now();
    if (recentErrorSignatures.has(signature)) {
      const lastSeen = recentErrorSignatures.get(signature);
      if (now - lastSeen < DEDUPE_WINDOW_MS) {
        return context.correlationId || signature;
      }
    }
    recentErrorSignatures.set(signature, now);

    const correlationId = context.correlationId || generateCorrelationId('err');
    const errorRecord = {
      correlationId,
      message,
      stack,
      category,
      route,
      context: sanitizePayload(context),
      appVersion: APP_VERSION
    };

    appendLog('error', errorRecord);
    updateHealth();

    // Development console notice
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(`[Pulse Diagnostics: ${correlationId}]`, message, context);
    }

    return correlationId;
  }

  // --- Performance Metrics ---
  function recordMetric(name, value, unit = 'ms', tags = {}) {
    const numVal = typeof value === 'number' ? value : parseFloat(value) || 0;
    if (!metricAggregates.has(name)) {
      metricAggregates.set(name, { count: 0, sum: 0, min: numVal, max: numVal, last: numVal, unit });
    }
    const stat = metricAggregates.get(name);
    stat.count++;
    stat.sum += numVal;
    stat.min = Math.min(stat.min, numVal);
    stat.max = Math.max(stat.max, numVal);
    stat.last = numVal;
    stat.avg = Math.round((stat.sum / stat.count) * 100) / 100;

    appendLog('metric', {
      name,
      value: numVal,
      unit,
      avg: stat.avg,
      tags: sanitizePayload(tags)
    });
  }

  // --- Frame Rate Sampling ---
  function sampleFrame(now) {
    frameCount++;
    const delta = now - lastFpsTime;
    if (delta >= 1000) {
      currentFps = Math.min(60, Math.round((frameCount * 1000) / delta));
      fpsHistory.push(currentFps);
      if (fpsHistory.length > 20) fpsHistory.shift();
      frameCount = 0;
      lastFpsTime = now;
      if (currentFps < 25) {
        updateHealth();
      }
    }
  }

  // --- Report & State Access ---
  function getSummary() {
    return {
      appVersion: APP_VERSION,
      health: healthState,
      totalEvents: totalEventsCount,
      totalErrors: totalErrorsCount,
      currentFps,
      avgFps: fpsHistory.length ? Math.round(fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length) : 60,
      bufferLength: ringBuffer.length,
      storageMode: Preferences && Preferences.isStoragePersistent() ? 'persistent' : 'in-memory-fallback',
      metrics: Object.fromEntries(metricAggregates)
    };
  }

  function getLogs(filterType = null) {
    if (!filterType) return [...ringBuffer];
    return ringBuffer.filter((i) => i.type === filterType);
  }

  function exportReport() {
    return {
      exportedAt: new Date().toISOString(),
      summary: getSummary(),
      preferences: Preferences ? Preferences.getAll() : null,
      logs: [...ringBuffer]
    };
  }

  function clear() {
    ringBuffer.length = 0;
    recentErrorSignatures.clear();
    totalErrorsCount = 0;
    totalEventsCount = 0;
    healthState = 'normal';
    updateHealth();
    notifyLogChange();
  }

  function subscribeLogs(fn) {
    if (typeof fn === 'function') {
      logListeners.add(fn);
      return () => logListeners.delete(fn);
    }
    return () => {};
  }

  return {
    track,
    captureError,
    recordMetric,
    sampleFrame,
    getSummary,
    getLogs,
    exportReport,
    clear,
    subscribeLogs,
    getHealth: () => healthState,
    getCurrentFps: () => currentFps,
    generateCorrelationId
  };
});
