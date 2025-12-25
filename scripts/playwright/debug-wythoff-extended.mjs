/**
 * Extended debug - check wythoff over longer period with pixel sampling
 */
import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[DEBUG:')) {
      console.log(`[${Date.now()}] ${text}`);
    }
  });
  
  console.log('Opening wythoff-polytope...');
  await page.goto('http://localhost:3000/?t=wythoff-polytope');
  
  // Take screenshots at intervals
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(1000);
    const elapsed = i + 1;
    
    // Sample center pixel to see if anything is rendered
    const pixelData = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return { error: 'no canvas' };
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        const data = ctx.getImageData(canvas.width/2, canvas.height/2, 1, 1).data;
        return { r: data[0], g: data[1], b: data[2], a: data[3] };
      }
      // Try webgl
      const gl = canvas.getContext('webgl2');
      if (gl) {
        const pixels = new Uint8Array(4);
        gl.readPixels(canvas.width/2, canvas.height/2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        return { r: pixels[0], g: pixels[1], b: pixels[2], a: pixels[3], source: 'webgl' };
      }
      return { error: 'no context' };
    });
    
    console.log(`[${elapsed}s] Center pixel:`, pixelData);
    
    if (elapsed === 2 || elapsed === 5 || elapsed === 10) {
      await page.screenshot({ path: `screenshots/wythoff-${elapsed}s.png` });
      console.log(`Screenshot: screenshots/wythoff-${elapsed}s.png`);
    }
  }
  
  // Now try navigating to mandelbulb and back
  console.log('\n--- Navigating to Mandelbulb ---');
  await page.goto('http://localhost:3000/?t=mandelbulb');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'screenshots/mandelbulb-after-wythoff.png' });
  console.log('Screenshot: screenshots/mandelbulb-after-wythoff.png');
  
  // Check mandelbulb pixel
  const mandelbulbPixel = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const gl = canvas?.getContext('webgl2');
    if (gl) {
      const pixels = new Uint8Array(4);
      gl.readPixels(canvas.width/2, canvas.height/2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      return { r: pixels[0], g: pixels[1], b: pixels[2], a: pixels[3] };
    }
    return { error: 'no gl' };
  });
  console.log('Mandelbulb center pixel:', mandelbulbPixel);
  
  console.log('\n--- Navigating back to Wythoff ---');
  await page.goto('http://localhost:3000/?t=wythoff-polytope');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'screenshots/wythoff-after-mandelbulb.png' });
  console.log('Screenshot: screenshots/wythoff-after-mandelbulb.png');
  
  // Check wythoff pixel again
  const wythoffPixelAfter = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const gl = canvas?.getContext('webgl2');
    if (gl) {
      const pixels = new Uint8Array(4);
      gl.readPixels(canvas.width/2, canvas.height/2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      return { r: pixels[0], g: pixels[1], b: pixels[2], a: pixels[3] };
    }
    return { error: 'no gl' };
  });
  console.log('Wythoff center pixel (after mandelbulb):', wythoffPixelAfter);
  
  await browser.close();
}

main().catch(console.error);

