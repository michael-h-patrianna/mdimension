/**
 * Quick diagnostic script to check if the app loads properly
 */
import { chromium } from 'playwright';

async function checkApp() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const errors = [];
  const logs = [];

  // Capture console messages
  page.on('console', msg => {
    const text = msg.text();
    logs.push(`[${msg.type()}] ${text}`);
    if (msg.type() === 'error') {
      errors.push(text);
    }
  });

  // Capture page errors
  page.on('pageerror', err => {
    errors.push(`PAGE ERROR: ${err.message}`);
  });

  console.log('Navigating to http://localhost:3000...');

  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });

    // Wait a bit for React to render
    await page.waitForTimeout(2000);

    // Take a screenshot
    await page.screenshot({ path: 'screenshots/app-check.png', fullPage: true });
    console.log('Screenshot saved to screenshots/app-check.png');

    // Check what's rendered
    const title = await page.title();
    console.log(`\nPage title: ${title}`);

    // Check for key elements
    const hasCanvas = await page.locator('canvas').count();
    console.log(`Canvas elements: ${hasCanvas}`);

    const hasControls = await page.locator('[data-testid]').count();
    console.log(`Elements with data-testid: ${hasControls}`);

    // Get visible text on page
    const bodyText = await page.locator('body').innerText();
    console.log(`\nVisible text on page:\n${bodyText.slice(0, 500)}`);

    // Check for specific elements
    const dimensionSelector = await page.locator('[data-testid="dimension-selector"]').count();
    console.log(`\nDimension selector: ${dimensionSelector > 0 ? 'FOUND' : 'NOT FOUND'}`);

    const objectTypeSelector = await page.locator('[data-testid="object-type-selector"]').count();
    console.log(`Object type selector: ${objectTypeSelector > 0 ? 'FOUND' : 'NOT FOUND'}`);

    const playButton = await page.locator('[data-testid="animation-play-button"]').count();
    console.log(`Play button: ${playButton > 0 ? 'FOUND' : 'NOT FOUND'}`);

    // Log any errors
    if (errors.length > 0) {
      console.log('\n=== ERRORS ===');
      errors.forEach(e => console.log(e));
    } else {
      console.log('\n=== NO ERRORS DETECTED ===');
    }

    if (logs.length > 0) {
      console.log('\n=== CONSOLE LOGS ===');
      logs.forEach(l => console.log(l));
    }

  } catch (err) {
    console.error('Failed to load page:', err.message);
  }

  await browser.close();
}

checkApp().catch(console.error);
