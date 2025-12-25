/**
 * Quick test - check if hypercube also fails
 */
import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[DEBUG:')) {
      console.log(text);
    }
  });
  
  console.log('Testing HYPERCUBE (sync geometry)...');
  await page.goto('http://localhost:3000/?t=hypercube');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshots/hypercube-test.png' });
  console.log('Screenshot: screenshots/hypercube-test.png');
  
  await browser.close();
}

main().catch(console.error);

