/**
 * Debug script to test bloom effect
 * Tests whether bloom renders correctly (should NOT be dark gray)
 */

import { chromium } from 'playwright';

const BASE_URL = process.env.URL || 'http://localhost:3001';

async function debugBloom() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();

  // Collect console logs
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('BloomPass') || text.includes('bloom')) {
      console.log(`[BROWSER ${msg.type()}] ${text}`);
    }
  });

  try {
    console.log('Navigating to app (bloom enabled by default)...');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    console.log('Waiting for render...');
    await page.waitForTimeout(3000);

    // Take screenshot
    console.log('Taking screenshot with bloom enabled...');
    await page.screenshot({ path: 'screenshots/debug-bloom-enabled.png' });

    console.log('Waiting another 5 seconds...');
    await page.waitForTimeout(5000);

    // Take another screenshot
    await page.screenshot({ path: 'screenshots/debug-bloom-enabled-5s.png' });

    console.log('\nScreenshots saved. Check screenshots/debug-bloom-*.png');
    console.log('Browser will close in 10 seconds...');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('Error:', error);
    await page.screenshot({ path: 'screenshots/debug-bloom-error.png' });
  } finally {
    await browser.close();
  }
}

debugBloom().catch(console.error);
