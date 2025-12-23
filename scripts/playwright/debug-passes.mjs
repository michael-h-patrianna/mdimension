/**
 * Debug script to systematically disable passes and find which causes GL errors
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

let glErrors = [];
let suppressLogs = true;

page.on('console', msg => {
  const text = msg.text();
  if (text.includes('GL_INVALID_OPERATION') || text.includes('1282')) {
    glErrors.push(text);
    if (!suppressLogs) {
      console.log(`[GL ERROR] ${text}`);
    }
  }
});

console.log('Loading app...');
await page.goto('http://localhost:3000');
await page.waitForTimeout(3000);
suppressLogs = false;

// Get baseline error count
const baselineErrors = glErrors.length;
console.log(`\n=== Baseline: ${baselineErrors} GL errors in first 3 seconds ===\n`);

// Get list of passes
const passIds = await page.evaluate(() => {
  if (window.__RENDER_GRAPH__) {
    return window.__RENDER_GRAPH__.getPassOrder();
  }
  return [];
});

if (passIds.length === 0) {
  console.log('ERROR: Could not access render graph. Make sure the app is running.');
  await browser.close();
  process.exit(1);
}

console.log(`Found ${passIds.length} passes: ${passIds.join(', ')}\n`);
console.log('Testing each pass by DISABLING IT and checking if errors stop...\n');

const results = [];

for (const passId of passIds) {
  // Reset error counter
  glErrors = [];

  // Disable the pass
  const disabled = await page.evaluate((id) => {
    return window.__RENDER_GRAPH__?.debugDisablePass(id) ?? false;
  }, passId);

  if (!disabled) {
    console.log(`  ${passId}: Could not disable`);
    continue;
  }

  // Wait for a few frames
  await page.waitForTimeout(1000);
  const errorsDuringDisable = glErrors.length;

  // Re-enable
  await page.evaluate((id) => {
    window.__RENDER_GRAPH__?.debugEnablePass(id);
  }, passId);

  // Wait a bit more
  await page.waitForTimeout(500);

  const status = errorsDuringDisable === 0 ? '✅ NO ERRORS when disabled' : `❌ ${errorsDuringDisable} errors`;
  console.log(`  ${passId}: ${status}`);

  results.push({
    passId,
    errorsWhenDisabled: errorsDuringDisable,
    isCulprit: errorsDuringDisable === 0 && baselineErrors > 0,
  });
}

console.log('\n=== Summary ===\n');

const culprits = results.filter(r => r.isCulprit);
if (culprits.length > 0) {
  console.log('POTENTIAL CULPRITS (no errors when disabled):');
  for (const c of culprits) {
    console.log(`  - ${c.passId}`);
  }
} else {
  console.log('No single pass identified as the culprit.');
  console.log('The error might be:');
  console.log('  1. Caused by interaction between multiple passes');
  console.log('  2. Happening outside the render graph (e.g., CubeCamera)');
  console.log('  3. In a pass that cannot be disabled');
}

await browser.close();
