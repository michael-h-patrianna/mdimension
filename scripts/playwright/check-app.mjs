import { chromium } from 'playwright';

async function checkApp() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const logs = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => logs.push(`[PAGE ERROR] ${err.message}`));

  try {
    console.log('Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 30000 });

    console.log('Waiting for object explorer...');
    const mandelbulbButton = page.locator('[data-testid="object-type-mandelbulb"]');
    await mandelbulbButton.waitFor({ state: 'visible', timeout: 10000 });

    console.log('Selecting "mandelbulb"...');
    await mandelbulbButton.click();

    console.log('Waiting for shader compilation (5s)...');
    await page.waitForTimeout(5000);

    console.log('\n=== CONSOLE LOGS ===');
    logs.forEach(l => console.log(l));

    const errors = logs.filter(l => l.toLowerCase().includes('error'));
    if (errors.length > 0) {
        console.log('\n!!! ERRORS DETECTED !!!');
        errors.forEach(e => console.log(e));
        process.exit(1);
    } else {
        console.log('\nNo errors detected.');
    }

  } catch (err) {
    console.error('Test failed:', err);
    console.log('\n=== CONSOLE LOGS (Partial) ===');
    logs.forEach(l => console.log(l));
    process.exit(1);
  } finally {
    await browser.close();
  }
}

checkApp();