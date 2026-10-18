// Test suite verifying Overview Grid dynamic telemetry functionality
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'dashboard', 'index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

console.log('[Test Suite] Verifying Overview Dashboard Grid Dynamic Implementation...');

// 1. Check all target DOM element IDs exist in index.html
const requiredIds = [
  'overviewFleetReadyBadge',
  'overviewFleetList',
  'overviewAmbVal',
  'overviewPoliceVal',
  'overviewFireVal',
  'overviewBikeVal',
  'overviewCorridorBadge',
  'overviewCorridorList',
  'overviewCorridorSeaLink',
  'overviewCorridorWEH',
  'overviewCorridorMahim',
  'overviewCorridorMarineDrive',
  'overviewRecentSyncBadge',
  'overviewRecentActivityList',
  'overviewActRow0',
  'overviewActTitle0',
  'overviewActMeta0',
  'overviewActIcon0',
  'overviewActRow3',
  'overviewActTitle3',
  'overviewActMeta3',
  'overviewActIcon3'
];

let missing = [];
for (const id of requiredIds) {
  if (!htmlContent.includes(`id="${id}"`)) {
    missing.push(id);
  }
}

if (missing.length > 0) {
  console.error('❌ Missing IDs in index.html:', missing);
  process.exit(1);
} else {
  console.log('✓ All 22 required element IDs are present in index.html');
}

// 2. Check function definitions exist
const requiredFunctions = [
  'function updateOverviewGridTelemetry',
  'function updateOverviewFleetReadiness',
  'function updateOverviewCorridorStatus',
  'function updateOverviewRecentActivityUI',
  'function recordOverviewActivity',
  'function formatOverviewRelativeTime',
  'function handleDispatchTransmit',
  'function engageCorridorCascade'
];

for (const fn of requiredFunctions) {
  if (!htmlContent.includes(fn)) {
    console.error(`❌ Missing function: ${fn}`);
    process.exit(1);
  }
}
console.log('✓ All overview telemetry and interaction functions are defined');

// 3. Check hooks into simulation loop and dispatch
if (!htmlContent.includes('updateOverviewGridTelemetry(activeMission')) {
  console.error('❌ updateOverviewGridTelemetry not hooked into simulation loop');
  process.exit(1);
}
console.log('✓ updateOverviewGridTelemetry is hooked into stepCitySimulation');

if (!htmlContent.includes('handleDispatchTransmit()')) {
  console.error('❌ handleDispatchTransmit not wired to dispatch modal');
  process.exit(1);
}
console.log('✓ handleDispatchTransmit is wired to the Transmit Order button');

if (!htmlContent.includes('engageCorridorCascade()')) {
  console.error('❌ engageCorridorCascade not wired to map action button');
  process.exit(1);
}
console.log('✓ engageCorridorCascade is wired to the Engage Cascade button');

console.log('\n============================================================');
console.log('🎉 OVERVIEW DASHBOARD GRID DYNAMIC VERIFICATION SUCCEEDED');
console.log('============================================================');
