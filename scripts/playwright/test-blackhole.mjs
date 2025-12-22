/**
 * Black hole rendering test - counts non-black pixels
 */
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3002';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.text().includes('GL_INVALID')) {
      errors.push(msg.text());
    }
  });

  try {
    await page.goto(`${BASE_URL}/?object=blackhole`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Count non-black pixels in center region
    const result = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return { error: 'No canvas' };

      const gl = canvas.getContext('webgl2');
      if (!gl) return { error: 'No WebGL2' };

      const w = canvas.width, h = canvas.height;
      const pixels = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      let blackPixels = 0, coloredPixels = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i], g = pixels[i+1], b = pixels[i+2];
        if (r < 5 && g < 5 && b < 5) blackPixels++;
        else coloredPixels++;
      }

      return {
        total: w * h,
        black: blackPixels,
        colored: coloredPixels,
        coloredPercent: (coloredPixels / (w * h) * 100).toFixed(1)
      };
    });

    console.log('=== Black Hole Pixel Test ===');
    console.log(JSON.stringify(result, null, 2));

    if (errors.length > 0) {
      console.log('\n=== WebGL Errors ===');
      errors.slice(0, 5).forEach(e => console.log(e));
    }

    // Pass/fail
    const passed = result.colored > 1000 && errors.filter(e => e.includes('GL_INVALID')).length === 0;
    console.log(`\nResult: ${passed ? 'PASS' : 'FAIL'}`);
    process.exit(passed ? 0 : 1);

  } finally {
    await browser.close();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
