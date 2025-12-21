/**
 * Debug script to investigate black hole skybox lensing issue on initial load
 */

import { chromium } from 'playwright';

async function debugBlackHoleLensing() {
  console.log('Starting Playwright debug session...');

  const browser = await chromium.launch({
    headless: false,  // Show the browser
    devtools: true    // Open DevTools
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();

  // Collect console messages
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push({ type: msg.type(), text });
    if (text.includes('[BlackHole')) {
      console.log(`[CONSOLE ${msg.type()}] ${text}`);
    }
  });

  // Collect errors
  page.on('pageerror', error => {
    console.error('[PAGE ERROR]', error.message);
  });

  // Try multiple ports since Vite may use different ones
  const ports = [3000, 3001, 3002];
  let connected = false;
  for (const port of ports) {
    try {
      console.log(`Trying localhost:${port}...`);
      await page.goto(`http://localhost:${port}`, { waitUntil: 'networkidle', timeout: 5000 });
      connected = true;
      console.log(`Connected to localhost:${port}`);
      break;
    } catch (e) {
      console.log(`Port ${port} not available`);
    }
  }
  if (!connected) {
    console.error('Could not connect to any port!');
    await browser.close();
    return;
  }

  // Wait a bit for rendering to stabilize
  console.log('Waiting for initial render...');
  await page.waitForTimeout(3000);

  // Take a screenshot
  const screenshotPath = 'screenshots/blackhole-debug-initial.png';
  await page.screenshot({ path: screenshotPath });
  console.log(`Screenshot saved to ${screenshotPath}`);

  // Print all BlackHole debug logs
  console.log('\n=== BLACK HOLE DEBUG LOGS ===');
  consoleLogs
    .filter(log => log.text.includes('[BlackHole'))
    .forEach(log => console.log(log.text));

  // Check if there are any WebGL errors
  console.log('\n=== WEBGL ERRORS ===');
  consoleLogs
    .filter(log => log.text.toLowerCase().includes('webgl') || log.text.toLowerCase().includes('gl error'))
    .forEach(log => console.log(log.text));

  // Keep browser open for manual inspection
  console.log('\n=== BROWSER OPEN FOR INSPECTION ===');
  console.log('Check the DevTools console for more details.');
  console.log('Press Ctrl+C to close.\n');

  // Wait for user to close
  await new Promise(() => {}); // Keep running indefinitely
}

debugBlackHoleLensing().catch(console.error);
