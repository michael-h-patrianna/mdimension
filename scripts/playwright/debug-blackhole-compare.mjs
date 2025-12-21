/**
 * Compare debug output between initial load and after object type switch
 *
 * Captures:
 * 1. Initial page load debug output (broken state)
 * 2. After switching to another object and back (working state)
 */

import { chromium } from 'playwright';

async function captureDebugOutput(page, label, duration = 3000) {
  const logs = [];

  // Collect logs for specified duration
  const startTime = Date.now();
  page.on('console', msg => {
    if (msg.text().includes('[DEBUG]')) {
      logs.push({
        time: Date.now() - startTime,
        text: msg.text()
      });
    }
  });

  await page.waitForTimeout(duration);

  console.log(`\n${'='.repeat(80)}`);
  console.log(`${label}`);
  console.log(`${'='.repeat(80)}`);

  logs.forEach(log => {
    console.log(`[${log.time}ms] ${log.text}`);
  });

  return logs;
}

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Setup console listener before navigation
  const initialLogs = [];
  const switchLogs = [];
  let logTarget = initialLogs;
  let startTime = Date.now();

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[DEBUG]') || text.includes('BlackHole') || text.includes('Skybox') || text.includes('envMap')) {
      logTarget.push({
        time: Date.now() - startTime,
        text: text
      });
    }
  });

  console.log('\n========== PHASE 1: INITIAL PAGE LOAD (BROKEN STATE) ==========\n');

  // Navigate to the app with black hole
  await page.goto('http://localhost:3000/?objectType=blackhole');

  // Wait for initial render
  await page.waitForTimeout(4000);

  // Take screenshot of broken state
  await page.screenshot({ path: 'screenshots/blackhole-debug-initial.png' });
  console.log('Screenshot saved: blackhole-debug-initial.png');

  // Print initial logs
  console.log('\n--- Initial Load Debug Logs ---');
  initialLogs.forEach(log => {
    console.log(`[${log.time}ms] ${log.text}`);
  });

  console.log('\n========== PHASE 2: SWITCHING OBJECT TYPES ==========\n');

  // Switch log target
  logTarget = switchLogs;
  startTime = Date.now();

  // Click on object type selector to switch to Mandelbulb
  // First, open the Objects drawer
  try {
    const objectsDrawer = page.locator('button:has-text("Object")').first();
    await objectsDrawer.click();
    await page.waitForTimeout(500);
  } catch (e) {
    console.log('Could not find Objects drawer, trying sidebar...');
  }

  // Find and click Mandelbulb option
  try {
    const mandelbulbOption = page.locator('text=Mandelbulb').first();
    await mandelbulbOption.click();
    console.log('Switched to Mandelbulb');
  } catch (e) {
    // Try direct URL navigation
    console.log('Direct click failed, using URL navigation...');
    await page.goto('http://localhost:3000/?objectType=mandelbulb');
  }

  await page.waitForTimeout(2000);

  // Switch back to Black Hole
  console.log('Switching back to Black Hole...');

  try {
    const blackholeOption = page.locator('text=Black Hole').first();
    await blackholeOption.click();
    console.log('Switched to Black Hole');
  } catch (e) {
    // Try direct URL navigation
    await page.goto('http://localhost:3000/?objectType=blackhole');
  }

  await page.waitForTimeout(4000);

  // Take screenshot of working state
  await page.screenshot({ path: 'screenshots/blackhole-debug-after-switch.png' });
  console.log('Screenshot saved: blackhole-debug-after-switch.png');

  // Print switch logs
  console.log('\n--- After Switch Debug Logs ---');
  switchLogs.forEach(log => {
    console.log(`[${log.time}ms] ${log.text}`);
  });

  console.log('\n========== ANALYSIS ==========\n');

  // Compare key metrics
  const getEnvMapReadyLogs = (logs) => logs.filter(l => l.text.includes('envMapReady') || l.text.includes('uEnvMapReady'));
  const getSceneBackgroundLogs = (logs) => logs.filter(l => l.text.includes('scene.background'));
  const getMaterialLogs = (logs) => logs.filter(l => l.text.includes('material') || l.text.includes('Material'));

  console.log('EnvMap Ready Events:');
  console.log('  Initial:', getEnvMapReadyLogs(initialLogs).length);
  console.log('  After Switch:', getEnvMapReadyLogs(switchLogs).length);

  console.log('\nScene Background Events:');
  console.log('  Initial:', getSceneBackgroundLogs(initialLogs).length);
  console.log('  After Switch:', getSceneBackgroundLogs(switchLogs).length);

  console.log('\nMaterial Events:');
  console.log('  Initial:', getMaterialLogs(initialLogs).length);
  console.log('  After Switch:', getMaterialLogs(switchLogs).length);

  // Look for key differences
  console.log('\n--- Key Initial Load Events ---');
  initialLogs.slice(0, 30).forEach(log => {
    console.log(`[${log.time}ms] ${log.text.substring(0, 120)}`);
  });

  console.log('\n--- Key After-Switch Events ---');
  switchLogs.slice(0, 30).forEach(log => {
    console.log(`[${log.time}ms] ${log.text.substring(0, 120)}`);
  });

  await page.waitForTimeout(2000);
  await browser.close();
}

main().catch(console.error);
