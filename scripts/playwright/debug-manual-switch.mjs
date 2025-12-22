import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('console', msg => {
  const text = msg.text();
  if (text.includes('H27') || text.includes('H26') || text.includes('H7') || text.includes('shaderProgram')) {
    console.log('[' + msg.type() + ']', text.slice(0, 400));
  }
});

console.log('=== WORKING CASE: Manual switch ===');
console.log('Loading with default (mandelbulb)...');
await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);

console.log('\nNow switching to hypercube via URL navigation...');
// Simulate the manual switch by navigating with URL
await page.goto('http://localhost:3000/?t=hypercube', { waitUntil: 'networkidle' });
await page.waitForTimeout(5000);

// Take screenshot
await page.screenshot({ path: 'screenshots/debug-manual-switch-result.png' });
console.log('\nScreenshot saved to screenshots/debug-manual-switch-result.png');

await browser.close();


