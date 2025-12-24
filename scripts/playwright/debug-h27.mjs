import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('console', msg => {
  const text = msg.text();
  if (text.includes('H27') || text.includes('triangles') || text.includes('programs') || text.includes('shaderProgram')) {
    console.log('[' + msg.type() + ']', text.slice(0, 400));
  }
});

console.log('Loading polytope directly via URL...');
await page.goto('http://localhost:3000/?t=hypercube', { waitUntil: 'networkidle' });
await page.waitForTimeout(5000);
console.log('Done capturing logs');
await browser.close();











