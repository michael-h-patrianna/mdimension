/**
 * Debug script to test tone mapping effect
 * Tests whether changing tone mapping algorithm and exposure has visible effect
 */

import { chromium } from 'playwright';

const BASE_URL = process.env.URL || 'http://localhost:3001';

async function debugToneMapping() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();

  // Collect console logs
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('ToneMapping') || text.includes('toneMapping') || text.includes('exposure')) {
      console.log(`[BROWSER ${msg.type()}] ${text}`);
    }
  });

  try {
    console.log('Navigating to app...');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Take screenshot with default settings
    console.log('Screenshot 1: Default settings...');
    await page.screenshot({ path: 'screenshots/debug-tonemapping-default.png' });

    // Open the System panel to access tone mapping settings
    console.log('Looking for tone mapping controls...');

    // Click on SYSTEM tab in the visuals panel
    const systemTab = await page.locator('text=System').first();
    if (await systemTab.isVisible()) {
      await systemTab.click();
      await page.waitForTimeout(500);
    }

    // Take screenshot after opening system panel
    await page.screenshot({ path: 'screenshots/debug-tonemapping-panel.png' });

    // Try to find exposure slider and change it
    const exposureSlider = await page.locator('text=Exposure').first();
    if (await exposureSlider.isVisible()) {
      console.log('Found Exposure control');
    }

    // Change exposure using JavaScript
    console.log('Changing exposure to 2.0 via store...');
    await page.evaluate(() => {
      // Access the store directly
      const store = window.__ZUSTAND_DEVTOOLS_GLOBAL__?.['lightingStore'] ||
                    window.__ZUSTAND_STORE__;
      if (store) {
        store.getState().setExposure(2.0);
        console.log('Exposure set to 2.0');
      } else {
        // Try to find store another way
        console.log('Looking for store alternative...');
      }
    });
    await page.waitForTimeout(1000);

    // Take screenshot with high exposure
    console.log('Screenshot 2: High exposure (2.0)...');
    await page.screenshot({ path: 'screenshots/debug-tonemapping-exposure2.png' });

    // Change to ACES tone mapping and set exposure
    console.log('Setting ACES tone mapping...');
    await page.evaluate(() => {
      // Try multiple ways to access the store
      const stores = Object.values(window).filter(v => v?.getState && v?.subscribe);
      for (const store of stores) {
        const state = store.getState();
        if (state.setToneMappingAlgorithm) {
          state.setToneMappingEnabled(true);
          state.setToneMappingAlgorithm('aces');
          state.setExposure(1.5);
          console.log('Set ACES tone mapping with exposure 1.5');
          break;
        }
      }
    });
    await page.waitForTimeout(1000);

    // Take screenshot with ACES
    console.log('Screenshot 3: ACES tone mapping...');
    await page.screenshot({ path: 'screenshots/debug-tonemapping-aces.png' });

    console.log('\nScreenshots saved to screenshots/debug-tonemapping-*.png');
    console.log('Browser will close in 10 seconds...');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('Error:', error);
    await page.screenshot({ path: 'screenshots/debug-tonemapping-error.png' });
  } finally {
    await browser.close();
  }
}

debugToneMapping().catch(console.error);
