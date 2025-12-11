/**
 * Visual verification of projection fix for higher dimensions
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenshotDir = path.join(__dirname, '../../screenshots/projection-fix');

async function main() {
  // Create screenshots directory
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  console.log('Navigating to app...');
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(2000);

  // Test configurations
  const configs = [
    { dimension: '7D', objectType: 'Hypercube' },
    { dimension: '10D', objectType: 'Hypercube' },
    { dimension: '11D', objectType: 'Simplex' },
  ];

  for (const config of configs) {
    console.log(`Testing ${config.dimension} ${config.objectType}...`);

    // Select dimension
    const dimButton = page.locator(`button:has-text("${config.dimension}")`);
    if (await dimButton.count() > 0) {
      await dimButton.first().click();
      await page.waitForTimeout(500);
    }

    // Select object type
    const typeSelector = page.locator('button[role="combobox"]').first();
    if (await typeSelector.count() > 0) {
      await typeSelector.click();
      await page.waitForTimeout(200);
      const option = page.locator(`[role="option"]:has-text("${config.objectType}")`).first();
      if (await option.count() > 0) {
        await option.click();
        await page.waitForTimeout(500);
      }
    }

    // Wait for render
    await page.waitForTimeout(1000);

    // Take screenshot
    const filename = `${config.dimension.toLowerCase()}-${config.objectType.toLowerCase()}-projection-fixed.png`;
    await page.screenshot({
      path: path.join(screenshotDir, filename),
      fullPage: false
    });
    console.log(`Saved: ${filename}`);
  }

  await browser.close();
  console.log('\nScreenshots saved to screenshots/projection-fix/');
  console.log('Compare these with screenshots/10d-hypercube.png and screenshots/11d-simplex.png');
}

main().catch(console.error);
