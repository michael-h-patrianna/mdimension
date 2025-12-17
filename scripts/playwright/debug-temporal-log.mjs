
import { test, expect, chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Capture console logs
  page.on('console', msg => {
    if (msg.text().includes('[TR-DEBUG]')) {
      console.log(msg.text());
    }
  });

  try {
    console.log('Navigating to app...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    
    // Wait for a few seconds to capture logs
    console.log('Waiting for logs...');
    await page.waitForTimeout(5000); // 5 seconds should be enough for 10-frame interval logs

    // Take a screenshot for visual confirmation
    await page.screenshot({ path: 'screenshots/debug-observation.png' });
    console.log('Screenshot saved to screenshots/debug-observation.png');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
})();
