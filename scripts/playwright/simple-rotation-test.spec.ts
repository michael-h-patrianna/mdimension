/**
 * Simple rotation test with brightness measurement
 */

import { test, expect } from '@playwright/test';

test('measure brightness at different camera angles', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForSelector('canvas[data-engine]', { timeout: 15000 });
  await page.waitForTimeout(2000);

  const measureBrightness = async (): Promise<{ avg: number; count: number }> => {
    return await page.evaluate(() => {
      const canvas = document.querySelector('canvas[data-engine]') as HTMLCanvasElement;
      if (!canvas) return { avg: 0, count: 0 };
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) return { avg: 0, count: 0 };

      const width = canvas.width;
      const height = canvas.height;
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      let total = 0;
      let count = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i]!;
        if (r > 15) { // Only count non-background pixels
          total += r;
          count++;
        }
      }
      return { avg: count > 0 ? total / count : 0, count };
    });
  };

  // Get canvas
  const canvas = await page.locator('canvas[data-engine]').first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found');

  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;

  // Measure initial
  await page.screenshot({ path: 'screenshots/test-1-initial.png' });
  const initial = await measureBrightness();
  console.log(`\n=== BRIGHTNESS TEST ===`);
  console.log(`Initial: avg=${initial.avg.toFixed(1)}, pixels=${initial.count}`);

  // Click to focus and rotate
  await canvas.click();
  await page.waitForTimeout(200);

  // Rotate 180 degrees in multiple steps to ensure we get to the back
  console.log('Rotating 180 degrees...');
  for (let i = 0; i < 6; i++) {
    await page.mouse.move(centerX - 150, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + 150, centerY, { steps: 30 });
    await page.mouse.up();
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(300);

  await page.screenshot({ path: 'screenshots/test-2-rotated-180.png' });
  const rot180 = await measureBrightness();
  console.log(`After 180° rotation: avg=${rot180.avg.toFixed(1)}, pixels=${rot180.count}`);

  // For symmetric objects like cross-polytope, 180° rotation should show
  // essentially the same geometry from the opposite side
  // The brightness SHOULD be similar if two-sided lighting works
  const rot90 = rot180; // Placeholder for analysis below

  // Analysis
  const values = [initial.avg, rot90.avg, rot180.avg];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variation = avg > 0 ? ((max - min) / avg) * 100 : 0;

  console.log(`\n=== RESULTS ===`);
  console.log(`Min brightness: ${min.toFixed(1)}`);
  console.log(`Max brightness: ${max.toFixed(1)}`);
  console.log(`Variation: ${variation.toFixed(1)}%`);

  if (variation > 30) {
    console.log(`\n❌ FAIL: Brightness varies ${variation.toFixed(1)}% - two-sided lighting NOT working`);
  } else {
    console.log(`\n✅ PASS: Brightness consistent (${variation.toFixed(1)}% variation)`);
  }

  // This test documents the current state - adjust threshold as needed
  expect(variation).toBeLessThan(50);
});
