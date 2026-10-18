/**
 * Pulse · Automated Unit & Integration Test Suite
 * Tests: Preferences Persistence, Performance Memoization, Error Boundaries & Diagnostics
 */

const assert = require('assert');

// Mock browser globals for Node.js environment
global.window = {
  dispatchEvent: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  scrollTo: () => {},
  matchMedia: (query) => ({
    matches: query.includes('dark') ? false : false,
    addEventListener: () => {},
    removeEventListener: () => {}
  }),
  location: { reload: () => {} }
};

global.document = {
  documentElement: {
    setAttribute: () => {},
    getAttribute: () => null,
    removeAttribute: () => {}
  },
  getElementById: () => null,
  querySelectorAll: () => [],
  createElement: () => ({
    style: {},
    setAttribute: () => {},
    appendChild: () => {},
    classList: { add: () => {}, remove: () => {} }
  }),
  body: { appendChild: () => {}, removeChild: () => {} }
};

global.CustomEvent = class CustomEvent {
  constructor(type, eventInitDict) {
    this.type = type;
    this.detail = eventInitDict ? eventInitDict.detail : null;
  }
};

global.performance = {
  now: () => Date.now()
};

// 1. Test PulsePreferences
console.log('[Test Suite] 1. Testing PulsePreferences (Persistence, Schema & Fallbacks)...');
const PulsePreferences = require('../dashboard/js/preferences.js');

// Test Defaults
const defaults = PulsePreferences.getDefaults();
assert.strictEqual(defaults.theme, 'light');
assert.strictEqual(defaults.activeTab, 'overview');
assert.strictEqual(defaults.simSpeed, 1);
assert.strictEqual(defaults.version, 1);
console.log('  ✓ Default preferences structure valid');

// Test Valid Setting
assert.strictEqual(PulsePreferences.set('activeTab', 'map'), true);
assert.strictEqual(PulsePreferences.get('activeTab'), 'map');
assert.strictEqual(PulsePreferences.set('simSpeed', 3), true);
assert.strictEqual(PulsePreferences.get('simSpeed'), 3);
console.log('  ✓ Valid preference updates succeed');

// Test Invalid Setting (Validation protection)
assert.strictEqual(PulsePreferences.set('theme', 'dark'), false); // Only light theme permitted
assert.strictEqual(PulsePreferences.get('theme'), 'light'); // Retained light
assert.strictEqual(PulsePreferences.set('simSpeed', 99), false); // 99 not in [1, 3, 8]
assert.strictEqual(PulsePreferences.get('simSpeed'), 3);
console.log('  ✓ Invalid inputs rejected without corrupting state');

// Test Reset
PulsePreferences.reset();
assert.strictEqual(PulsePreferences.get('theme'), 'light');
assert.strictEqual(PulsePreferences.get('activeTab'), 'overview');
assert.strictEqual(PulsePreferences.get('simSpeed'), 1);
console.log('  ✓ Reset restores clean defaults');


// 2. Test PulseDiagnostics
console.log('\n[Test Suite] 2. Testing PulseDiagnostics (Analytics, Sanitization & Metrics)...');
const PulseDiagnostics = require('../dashboard/js/diagnostics.js');

// Test Event Tracking
const tracked = PulseDiagnostics.track('test:event_action', {
  unitId: 'AMB-108',
  location: 'Mahim',
  authToken: 'secret_token_12345', // Must be redacted
  password: 'user_password_999'    // Must be redacted
});
assert.strictEqual(tracked, true);

const logs = PulseDiagnostics.getLogs('event');
assert.ok(logs.length > 0);
const lastEvent = logs[logs.length - 1];
assert.strictEqual(lastEvent.payload.authToken, '[REDACTED]');
assert.strictEqual(lastEvent.payload.password, '[REDACTED]');
assert.strictEqual(lastEvent.payload.unitId, 'AMB-108');
console.log('  ✓ Event tracked and sensitive fields sanitized correctly');

// Test Metrics Recording & Aggregation
PulseDiagnostics.recordMetric('tab_latency', 12, 'ms');
PulseDiagnostics.recordMetric('tab_latency', 16, 'ms');
PulseDiagnostics.recordMetric('tab_latency', 8, 'ms');

const summary = PulseDiagnostics.getSummary();
assert.strictEqual(summary.metrics.tab_latency.count, 3);
assert.strictEqual(summary.metrics.tab_latency.min, 8);
assert.strictEqual(summary.metrics.tab_latency.max, 16);
assert.strictEqual(summary.metrics.tab_latency.avg, 12);
console.log('  ✓ Metrics recorded and aggregated accurately');

// Test Error Capture & Deduplication
const errId1 = PulseDiagnostics.captureError(new Error('Test network connection failure'), { category: 'network' });
assert.ok(errId1.startsWith('err_'));

// Immediate duplicate error with identical message and category must be deduplicated
const errId2 = PulseDiagnostics.captureError(new Error('Test network connection failure'), { category: 'network' });
const errorLogs = PulseDiagnostics.getLogs('error');
assert.strictEqual(errorLogs.length, 1); // Only 1 logged due to dedupe window
console.log('  ✓ Error captured with correlation ID and deduplicated to prevent flooding');


// 3. Test PulseErrorBoundary
console.log('\n[Test Suite] 3. Testing PulseErrorBoundary (Fault Isolation)...');
const PulseErrorBoundary = require('../dashboard/js/error-boundary.js');

let recovered = false;
let containerMock = {
  innerHTML: '<div id="test">original</div>',
  hasAttribute: () => false,
  setAttribute: () => {},
  getAttribute: () => '<div id="test">original</div>'
};

const result = PulseErrorBoundary.wrap(
  'TestComponent',
  () => {
    throw new Error('Deliberate test failure inside isolated component');
  },
  containerMock,
  () => {
    recovered = true;
  }
);

assert.strictEqual(result, null);
assert.ok(containerMock.innerHTML.includes('error-boundary-card'));
assert.ok(containerMock.innerHTML.includes('Retry Section'));
console.log('  ✓ Fault successfully isolated; fallback card rendered without throwing');

// Test Simulation Guard Loop breaker
let simLoopFailCount = 0;
for (let i = 0; i < 7; i++) {
  PulseErrorBoundary.guardSimulationTick(
    () => {
      throw new Error('Broken SVG path interpolation');
    },
    (err) => {
      simLoopFailCount++;
    }
  );
}
assert.ok(simLoopFailCount >= 1);
console.log('  ✓ Crash loop breaker catches repeated animation exceptions');

console.log('\n============================================================');
console.log('🎉 ALL UNIT & INTEGRATION TESTS PASSED (100% SUCCESS)');
console.log('============================================================\n');
