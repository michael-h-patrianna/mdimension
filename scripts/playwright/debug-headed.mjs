/**
 * Run in headed mode to verify WebGL works
 */
import { chromium } from 'playwright';

async function main() {
  // Run headed (not headless)
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[DEBUG:')) {
      console.log(text);
    }
  });
  
  console.log('Opening hypercube in headed mode...');
  await page.goto('http://localhost:3000/?t=hypercube');
  await page.waitForTimeout(3000);
  
  const pixelData = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const gl = canvas?.getContext('webgl2');
    if (gl) {
      const pixels = new Uint8Array(4);
      gl.readPixels(canvas.width/2, canvas.height/2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      return { r: pixels[0], g: pixels[1], b: pixels[2], a: pixels[3] };
    }
    return { error: 'no gl' };
  });
  console.log('Hypercube center pixel (headed):', pixelData);
  
  await page.screenshot({ path: 'screenshots/hypercube-headed.png' });
  console.log('Screenshot saved');
  
  // Navigate to wythoff
  console.log('Navigating to wythoff...');
  await page.goto('http://localhost:3000/?t=wythoff-polytope');
  await page.waitForTimeout(5000);
  
  const wythoffPixel = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const gl = canvas?.getContext('webgl2');
    if (gl) {
      const pixels = new Uint8Array(4);
      gl.readPixels(canvas.width/2, canvas.height/2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      return { r: pixels[0], g: pixels[1], b: pixels[2], a: pixels[3] };
    }
    return { error: 'no gl' };
  });
  console.log('Wythoff center pixel (headed):', wythoffPixel);
  
  await page.screenshot({ path: 'screenshots/wythoff-headed.png' });
  console.log('Screenshot saved');
  
  await browser.close();
}

main().catch(console.error);

