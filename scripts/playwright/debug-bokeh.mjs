/**
 * Debug script to test bokeh effect
 */

import { chromium } from 'playwright';

const BASE_URL = process.env.URL || 'http://localhost:3001';

async function debugBokeh() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();

  // Collect console logs
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('BokehPass') || text.includes('SSRPass') || text.includes('RefractionPass')) {
      console.log(`[BROWSER] ${text}`);
    }
  });

  try {
    console.log('Navigating to app...');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Enable bokeh via store
    console.log('Enabling bokeh...');
    await page.evaluate(() => {
      const stores = Object.values(window).filter(v => v?.getState && v?.subscribe);
      for (const store of stores) {
        const state = store.getState();
        if (state.setBokehEnabled) {
          state.setBokehEnabled(true);
          console.log('Bokeh enabled via store');
          break;
        }
      }
    });

    await page.waitForTimeout(2000);

    // Take screenshot
    await page.screenshot({ path: 'screenshots/debug-bokeh-enabled.png' });
    console.log('Screenshot saved');

    // Wait for logs
    await page.waitForTimeout(5000);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugBokeh().catch(console.error);
