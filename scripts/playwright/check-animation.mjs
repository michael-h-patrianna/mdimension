import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Capture console messages
page.on('console', msg => {
  if (msg.text().includes('[ANIM]')) {
    console.log('Browser:', msg.text());
  }
});

await page.goto('http://localhost:3004');
await page.waitForTimeout(2000);

// Inject debugging into the animation store
await page.evaluate(() => {
  // Find and log animation state
  const checkStores = setInterval(() => {
    // Try to access stores through module system
    const storeState = localStorage.getItem('animation-storage');
    console.log('[ANIM] localStorage:', storeState);
  }, 1000);

  setTimeout(() => clearInterval(checkStores), 3000);
});

// Take screenshots to see if object is moving
console.log('Taking screenshot 1...');
await page.screenshot({ path: 'screenshots/anim-1.png' });
await page.waitForTimeout(2000);
console.log('Taking screenshot 2...');
await page.screenshot({ path: 'screenshots/anim-2.png' });

// Check the Pause/Play button state
const buttonState = await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('button'));
  const animButton = buttons.find(b =>
    b.textContent?.includes('Pause') || b.textContent?.includes('Play')
  );
  return animButton ? animButton.textContent : 'not found';
});
console.log('Animation button text:', buttonState);

await browser.close();
