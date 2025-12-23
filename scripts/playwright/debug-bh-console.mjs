/**
 * Debug script - capture ALL console output for black hole
 */
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function main() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const allLogs = [];

  page.on('console', msg => {
    allLogs.push({ type: msg.type(), text: msg.text() });
  });

  page.on('pageerror', err => {
    allLogs.push({ type: 'pageerror', text: err.message });
  });

  try {
    console.log(`Navigating to ${BASE_URL}/?t=blackhole ...`);
    await page.goto(`${BASE_URL}/?t=blackhole`, { waitUntil: 'networkidle' });

    console.log('Waiting 5 seconds for initialization...');
    await page.waitForTimeout(5000);

    // Get pixel info
    const pixelInfo = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return { error: 'No canvas' };

      const gl = canvas.getContext('webgl2');
      if (!gl) return { error: 'No WebGL2' };

      const w = canvas.width, h = canvas.height;
      const pixels = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      let black = 0, nonBlack = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] < 5 && pixels[i+1] < 5 && pixels[i+2] < 5) black++;
        else nonBlack++;
      }

      return { width: w, height: h, black, nonBlack, blackPct: (black / (w*h) * 100).toFixed(1) };
    });

    console.log('\n=== Pixel Analysis ===');
    console.log(JSON.stringify(pixelInfo, null, 2));

    console.log('\n=== ALL Console Logs ===');
    allLogs.forEach(log => {
      console.log(`[${log.type}] ${log.text}`);
    });

    // Look for specific issues
    console.log('\n=== Issue Summary ===');
    const errors = allLogs.filter(l => l.type === 'error' || l.type === 'pageerror');
    const warnings = allLogs.filter(l => l.type === 'warning');

    if (errors.length > 0) {
      console.log('ERRORS:');
      errors.forEach(e => console.log(`  - ${e.text}`));
    }

    if (warnings.length > 0) {
      console.log('WARNINGS:');
      warnings.forEach(w => console.log(`  - ${w.text}`));
    }

  } finally {
    await browser.close();
  }
}

main().catch(console.error);
