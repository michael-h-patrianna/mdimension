import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Collect console messages
const logs = [];
page.on('console', msg => {
  logs.push(`[${msg.type()}] ${msg.text()}`);
});

page.on('pageerror', err => {
  logs.push(`[PAGE ERROR] ${err.message}`);
});

console.log('Navigating to root-system...');
await page.goto('http://localhost:3000/?t=root-system', { waitUntil: 'networkidle' });

// Wait a bit for async operations
await page.waitForTimeout(3000);

console.log('\n=== Console Logs ===');
for (const log of logs) {
  console.log(log);
}

// Check if geometry was generated
const debugState = await page.evaluate(() => {
  // Try to get debug info from the page
  const canvas = document.querySelector('canvas');
  return {
    hasCanvas: !!canvas,
    canvasWidth: canvas?.width,
    canvasHeight: canvas?.height,
  };
});

console.log('\n=== Page State ===');
console.log(JSON.stringify(debugState, null, 2));

await browser.close();
