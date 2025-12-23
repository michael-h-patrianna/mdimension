import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

// Navigate to the app
await page.goto('http://localhost:3000');
await page.waitForTimeout(3000); // Wait for initial render

// Take initial screenshot
await page.screenshot({ path: 'screenshots/bug-01-initial.png' });
console.log('Initial state captured');

// Keep browser open for manual inspection
console.log('Browser open at localhost:3000. Press Ctrl+C to close.');
await page.waitForTimeout(120000);

await browser.close();
