import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const logs = [];
page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));

await page.goto('http://localhost:3000/?t=blackhole', { waitUntil: 'networkidle' });
await page.waitForTimeout(5000);

// Count canvas pixels
const result = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return { error: 'No canvas' };
  const gl = canvas.getContext('webgl2');
  if (!gl) return { error: 'No WebGL2' };
  const w = canvas.width, h = canvas.height;
  const pixels = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  let black = 0, colored = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i] < 5 && pixels[i+1] < 5 && pixels[i+2] < 5) black++;
    else colored++;
  }
  return { total: w*h, black, colored, pct: (colored/(w*h)*100).toFixed(1) };
});

console.log('Canvas:', JSON.stringify(result));
console.log('Relevant logs:', logs.filter(l => l.includes('black') || l.includes('Black') || l.includes('error') || l.includes('Error')).slice(0, 10).join('\n'));

await page.screenshot({ path: 'screenshots/bh-test.png' });
console.log('Screenshot: screenshots/bh-test.png');
await browser.close();
