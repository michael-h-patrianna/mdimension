/**
 * Thorough debug test for polytope disappearing bug
 * Takes multiple screenshots at different times to catch the disappearing
 */

import { chromium } from 'playwright';

async function main() {
  console.log('=== Thorough Polytope Bug Test ===\n');
  
  // Use headless mode for faster execution
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  
  const logs = [];
  let overlayVisible = false;
  let overlayDisappeared = false;
  
  page.on('console', msg => {
    const text = msg.text();
    logs.push({ time: Date.now(), text });
    
    // Track overlay state
    if (text.includes('isFaceShaderCompiling: true')) {
      overlayVisible = true;
    }
    if (text.includes('isFaceShaderCompiling: false') && overlayVisible) {
      overlayDisappeared = true;
      console.log('>>> Shader overlay just disappeared!');
    }
  });

  console.log('1. Loading page with ?t=hypercube...');
  await page.goto('http://localhost:3000/?t=hypercube', { waitUntil: 'domcontentloaded', timeout: 10000 });
  
  console.log('2. Taking screenshot during shader compilation...');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/debug-thorough-1-during-overlay.png' });
  
  console.log('3. Waiting for shader to compile...');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'screenshots/debug-thorough-2-after-compile.png' });
  
  console.log('4. Waiting 5 more seconds...');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'screenshots/debug-thorough-3-after-5s.png' });
  
  console.log('5. Waiting 10 more seconds...');
  await page.waitForTimeout(10000);
  await page.screenshot({ path: 'screenshots/debug-thorough-4-after-15s.png' });
  
  console.log('\n=== Test Complete ===');
  console.log('Overlay disappeared:', overlayDisappeared);
  console.log('Check the screenshots to see if polytope disappeared.');
  
  // Keep browser open briefly so user can see
  await page.waitForTimeout(2000);
  
  await browser.close();
}

main().catch(console.error);

