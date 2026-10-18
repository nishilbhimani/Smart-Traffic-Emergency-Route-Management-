/**
 * Pulse · Smart Traffic & Emergency Route Management
 * Resilient REST API Client (PulseAPI)
 *
 * Capabilities:
 * - Offline-first design with automatic graceful local fallback
 * - Request deduplication (single in-flight promise per endpoint)
 * - Request timeouts (5000ms AbortController)
 * - Parameterized JSON payloads & error mapping
 * - Health probe & connectivity state tracking
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./diagnostics.js'));
  } else {
    root.PulseAPI = factory(root.PulseDiagnostics);
  }
})(typeof self !== 'undefined' ? self : this, function (Diagnostics) {
  'use strict';

  const API_BASE = '/api/v1';
  const DEFAULT_TIMEOUT_MS = 5000;

  let isBackendAvailable = null; // null = untracked, true = connected, false = offline/standalone
  const inFlightRequests = new Map();

  async function request(endpoint, options = {}) {
    const method = options.method || 'GET';
    const cacheKey = `${method}:${endpoint}:${options.body || ''}`;

    // Deduplicate concurrent in-flight GET requests
    if (method === 'GET' && inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || DEFAULT_TIMEOUT_MS);

    const promise = (async () => {
      try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
          ...options,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(options.headers || {})
          }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.message || `API error (${response.status} ${response.statusText})`);
        }

        isBackendAvailable = true;
        const json = await response.json();
        return json;
      } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          if (Diagnostics) Diagnostics.captureError(new Error(`API request timed out: ${endpoint}`), { category: 'network_timeout' });
        } else {
          isBackendAvailable = false;
        }
        throw err;
      } finally {
        inFlightRequests.delete(cacheKey);
      }
    })();

    if (method === 'GET') {
      inFlightRequests.set(cacheKey, promise);
    }

    return promise;
  }

  // --- API Surface ---

  async function checkHealth() {
    try {
      const res = await request('/health', { timeout: 3000 });
      isBackendAvailable = true;
      return { online: true, ...res };
    } catch (e) {
      isBackendAvailable = false;
      return { online: false, reason: e.message };
    }
  }

  async function getDispatches() {
    return request('/dispatches');
  }

  async function getSignals() {
    return request('/signals');
  }

  async function getFleet() {
    return request('/fleet');
  }

  async function getCorridors() {
    return request('/corridors');
  }

  async function getIncidents() {
    return request('/incidents');
  }

  async function triggerPreemption(missionId, vehicleId, signalId, speedKmh = 75) {
    return request('/preemption/trigger', {
      method: 'POST',
      body: JSON.stringify({
        mission_id: missionId,
        vehicle_id: vehicleId,
        signal_id: signalId,
        clearance_speed_kmh: speedKmh
      })
    });
  }

  async function releasePreemption(signalId, vehicleId = null, durationSec = 60) {
    return request('/preemption/release', {
      method: 'POST',
      body: JSON.stringify({
        signal_id: signalId,
        vehicle_id: vehicleId,
        duration_seconds: durationSec
      })
    });
  }

  async function createDispatch(data) {
    return request('/dispatches/new', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  return {
    checkHealth,
    getDispatches,
    getSignals,
    getFleet,
    getCorridors,
    getIncidents,
    triggerPreemption,
    releasePreemption,
    createDispatch,
    isOnline: () => isBackendAvailable
  };
});
