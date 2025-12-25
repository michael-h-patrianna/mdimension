/**
 * Final visual test for Wythoff polytope rendering
 */
import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  
  console.log('Loading Wythoff polytope...');
  await page.goto('http://localhost:3000/?t=wythoff-polytope');
  await page.waitForTimeout(10000); // Wait for shader compilation (can take 8+ seconds)
  
  // Take screenshot
  await page.screenshot({ path: 'screenshots/wythoff-fix-test.png' });
  console.log('Screenshot saved to screenshots/wythoff-fix-test.png');
  
  // Check pixel color at center
  const pixels = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return null;
    const ctx = canvas.getContext('webgl2');
    if (!ctx) return null;
    const w = canvas.width;
    const h = canvas.height;
    const data = new Uint8Array(4);
    ctx.readPixels(w/2, h/2, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, data);
    return Array.from(data);
  });
  
  console.log('Center pixel:', pixels);
  
  if (pixels && (pixels[0] > 0 || pixels[1] > 0 || pixels[2] > 0)) {
    console.log('✓ SUCCESS: Scene has visible content!');
  } else {
    console.log('✗ FAIL: Scene appears empty (black pixels)');
  }
  
  await browser.close();
}

main().catch(console.error);

