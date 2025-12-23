/**
 * Debug script to test if shadows are causing the GL errors
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

const logs = [];
page.on('console', msg => {
  const text = msg.text();
  logs.push(`[${msg.type()}] ${text}`);
  if (text.includes('GL') || text.includes('ERROR') || text.includes('shadow')) {
    console.log(`[${msg.type()}] ${text}`);
  }
});

await page.goto('http://localhost:3000');

// Wait for app to initialize
await page.waitForTimeout(2000);

console.log('\n=== With shadows (default) ===');
const shadowErrors = logs.filter(l => l.includes('INVALID') || l.includes('1282'));
console.log(`Errors: ${shadowErrors.length}`);

// Disable shadows via UI
console.log('\n=== Disabling shadows ===');
await page.evaluate(() => {
  // Access store and disable shadows
  const lightingStore = window.__ZUSTAND_STORES__?.lighting;
  if (lightingStore) {
    lightingStore.getState().setShadowEnabled(false);
    console.log('[DEBUG] Shadows disabled');
  } else {
    // Try finding store through React devtools or other means
    console.log('[DEBUG] Could not find lighting store');
  }
});

// Wait and observe
await page.waitForTimeout(3000);

const afterLogs = [];
page.on('console', msg => {
  afterLogs.push(msg.text());
});

await page.waitForTimeout(2000);

console.log('\n=== After disabling shadows ===');
const afterErrors = afterLogs.filter(l => l.includes('INVALID') || l.includes('1282'));
console.log(`Errors after: ${afterErrors.length}`);

await browser.close();
