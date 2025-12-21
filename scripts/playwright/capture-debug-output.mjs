/**
 * Capture debug output from black hole lensing initialization
 *
 * This script opens the app with black hole as default object
 * and captures all console output for timing analysis.
 */

import { chromium } from 'playwright';

async function main() {
  console.log('Starting debug capture...\n');

  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-web-security'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  // Collect all console messages - no filtering for now
  const allLogs = [];
  page.on('console', (msg) => {
    const text = msg.text();
    // Capture logs containing our markers
    if (text.includes('[') && text.includes(']')) {
      allLogs.push(text);
      console.log(text);
    }
  });

  // Navigate to app - assumes black hole is default object
  console.log('Navigating to app...\n');
  await page.goto('http://localhost:3003', { waitUntil: 'domcontentloaded' });

  // Wait for initial rendering to complete
  await page.waitForTimeout(5000);

  console.log('\n\n=== SUMMARY ===\n');
  console.log(`Total logs captured: ${allLogs.length}`);

  // Group logs by component
  const components = {};
  allLogs.forEach(log => {
    const match = log.match(/\[([^\]]+)\]/);
    if (match) {
      const component = match[1];
      if (!components[component]) components[component] = [];
      components[component].push(log);
    }
  });

  console.log('\n=== LOGS BY COMPONENT ===\n');
  for (const [component, logs] of Object.entries(components)) {
    console.log(`${component}: ${logs.length} logs`);
  }

  // Find specific events
  console.log('\n=== SKYBOX CAPTURE LOGS ===\n');
  allLogs.filter(l => l.includes('SkyboxCapture') || l.includes('ProceduralSkybox')).slice(0, 30).forEach(l => console.log(l));

  console.log('\n=== BLACK HOLE LOGS ===\n');
  allLogs.filter(l => l.includes('BlackHole')).slice(0, 30).forEach(l => console.log(l));

  console.log('\n=== SCENE.BACKGROUND LOGS ===\n');
  allLogs.filter(l => l.includes('scene.background')).slice(0, 20).forEach(l => console.log(l));

  console.log('\n=== FIRST 50 LOGS (CHRONOLOGICAL) ===\n');
  allLogs.slice(0, 50).forEach(l => console.log(l));

  await browser.close();
  console.log('\nDone!');
}

main().catch(console.error);
