/**
 * Playwright script to capture normal buffer debug information
 * Used to verify Gate 1, 2, and 3 for the Schrödinger normal buffer bug
 */

import { chromium } from 'playwright';

const DEBUG_PREFIX = '[NORMAL-DEBUG]';
const GATE_PREFIX = '[GATE-';
const URL = process.env.APP_URL || 'http://localhost:3001';
const WAIT_TIME = 4000;

async function main() {
  console.log('Starting normal buffer debug capture...');
  console.log(`Target URL: ${URL}`);

  const browser = await chromium.launch({
    headless: false,
    args: ['--use-gl=desktop']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();

  // Collect ALL console messages including warnings/errors
  const consoleMessages = [];
  page.on('console', (msg) => {
    const text = msg.text();
    consoleMessages.push({ type: msg.type(), text });
    // Log debug messages in real-time
    if (text.includes(DEBUG_PREFIX) || text.includes(GATE_PREFIX)) {
      console.log(`[Browser] ${text}`);
    }
    // Also log WebGL errors
    if (text.toLowerCase().includes('webgl') || text.toLowerCase().includes('glsl') || text.toLowerCase().includes('shader')) {
      console.log(`[Browser WebGL] ${text.substring(0, 500)}`);
    }
  });

  page.on('pageerror', (err) => {
    console.error(`[Page Error] ${err.message}`);
  });

  // Navigate to the app
  console.log(`Navigating to ${URL}...`);
  try {
    await page.goto(URL, { timeout: 30000, waitUntil: 'domcontentloaded' });
    console.log('Page loaded successfully');
  } catch (e) {
    console.error('Failed to navigate:', e.message);
    await browser.close();
    process.exit(1);
  }

  // Wait for debug logs
  console.log(`Waiting ${WAIT_TIME}ms for debug logs to appear...`);
  await page.waitForTimeout(WAIT_TIME);

  // Take screenshot with a shorter timeout
  console.log('Taking screenshot...');
  try {
    await page.screenshot({ path: 'screenshots/normal-buffer-debug.png', timeout: 5000 });
    console.log('Screenshot saved');
  } catch (e) {
    console.log('Screenshot failed:', e.message);
  }

  // Analyze gate results
  console.log('\n=== Gate Check Results ===');
  const gateResults = { gate1: null, gate2: null, gate3: null };
  const debugMessages = consoleMessages.filter(m =>
    m.text.includes(DEBUG_PREFIX) || m.text.includes(GATE_PREFIX)
  );

  for (const msg of debugMessages) {
    if (msg.text.includes('[GATE-1]')) gateResults.gate1 = msg.text.includes('PASS');
    if (msg.text.includes('[GATE-2]')) gateResults.gate2 = msg.text.includes('PASS');
    if (msg.text.includes('[GATE-3]')) gateResults.gate3 = msg.text.includes('PASS');
  }

  console.log(`Gate 1 (Variance): ${gateResults.gate1 === null ? 'NOT RUN' : gateResults.gate1 ? 'PASS' : 'FAIL'}`);
  console.log(`Gate 2 (Plausible): ${gateResults.gate2 === null ? 'NOT RUN' : gateResults.gate2 ? 'PASS' : 'FAIL'}`);
  console.log(`Gate 3 (Obj+Wall): ${gateResults.gate3 === null ? 'NOT RUN' : gateResults.gate3 ? 'PASS' : 'FAIL'}`);

  const allPassed = gateResults.gate1 && gateResults.gate2 && gateResults.gate3;
  console.log(`\nAll Gates Passed: ${allPassed ? 'YES' : 'NO'}`);

  // Print shader/WebGL errors if any
  const webglErrors = consoleMessages.filter(m =>
    m.type === 'error' || m.text.toLowerCase().includes('error')
  );
  if (webglErrors.length > 0) {
    console.log('\n=== Errors ===');
    for (const e of webglErrors.slice(0, 10)) {
      console.log(`[${e.type}] ${e.text.substring(0, 300)}`);
    }
  }

  await browser.close();
  console.log('\nBrowser closed.');
  process.exit(allPassed ? 0 : 1);
}

main().catch((e) => {
  console.error('Script error:', e);
  process.exit(1);
});
