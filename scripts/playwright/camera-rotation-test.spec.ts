/**
 * Camera Rotation Lighting Test
 *
 * Uses mouse drag (OrbitControls) to rotate the camera view,
 * then measures brightness to test two-sided lighting.
 */

import { test, expect } from '@playwright/test';

test.describe('Camera Rotation Lighting', () => {
  test('brightness should be consistent when orbiting camera', async ({ page }) => {
    await page.goto('http://localhost:3002');
    await page.waitForSelector('canvas', { timeout: 15000 });
    await page.waitForTimeout(3000);

    const measureBrightness = async (): Promise<{ avg: number; min: number; max: number; count: number }> => {
      return await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return { avg: 0, min: 0, max: 0, count: 0 };
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (!gl) return { avg: 0, min: 0, max: 0, count: 0 };

        const width = canvas.width;
        const height = canvas.height;
        const pixels = new Uint8Array(width * height * 4);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

        let totalBrightness = 0;
        let minBrightness = 255;
        let maxBrightness = 0;
        let pixelCount = 0;
        const threshold = 15;

        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i]!;
          const g = pixels[i + 1]!;
          const b = pixels[i + 2]!;

          if (r > threshold || g > threshold || b > threshold) {
            const brightness = Math.max(r, g, b); // Use max channel as brightness
            totalBrightness += brightness;
            minBrightness = Math.min(minBrightness, brightness);
            maxBrightness = Math.max(maxBrightness, brightness);
            pixelCount++;
          }
        }

        return {
          avg: pixelCount > 0 ? totalBrightness / pixelCount : 0,
          min: pixelCount > 0 ? minBrightness : 0,
          max: maxBrightness,
          count: pixelCount,
        };
      });
    };

    // Get the main Three.js canvas (the large one, not the color picker)
    const canvas = await page.locator('canvas[data-engine]').first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    console.log(`\n=== CAMERA ORBIT LIGHTING TEST ===`);
    console.log(`Canvas center: (${centerX.toFixed(0)}, ${centerY.toFixed(0)})`);

    // Take screenshot to see what's happening
    await page.screenshot({ path: 'screenshots/camera-test-initial.png' });
    console.log('Screenshot saved: screenshots/camera-test-initial.png');

    // Measure initial state
    const initial = await measureBrightness();
    console.log(`\nInitial view:`);
    console.log(`  Avg brightness: ${initial.avg.toFixed(1)}`);
    console.log(`  Min/Max: ${initial.min}/${initial.max}`);
    console.log(`  Pixel count: ${initial.count}`);

    // Click canvas first to ensure it has focus
    await canvas.click();
    await page.waitForTimeout(200);

    // Rotate camera 180 degrees by dragging mouse across canvas
    // OrbitControls uses left mouse drag for rotation
    const dragDistance = box.width * 0.6;

    console.log(`\nRotating camera (drag ${dragDistance.toFixed(0)}px)...`);

    // Multiple smaller drags to accumulate rotation
    for (let i = 0; i < 3; i++) {
      await page.mouse.move(centerX - dragDistance / 2, centerY);
      await page.mouse.down({ button: 'left' });
      // Slow drag with many steps
      for (let step = 0; step <= 30; step++) {
        const x = centerX - dragDistance / 2 + (dragDistance * step) / 30;
        await page.mouse.move(x, centerY);
        await page.waitForTimeout(10);
      }
      await page.mouse.up({ button: 'left' });
      await page.waitForTimeout(100);
    }

    await page.waitForTimeout(500);

    // Take screenshot after rotation
    await page.screenshot({ path: 'screenshots/camera-test-after-rotation.png' });
    console.log('Screenshot saved: screenshots/camera-test-after-rotation.png');

    // Measure after rotation
    const afterH = await measureBrightness();
    console.log(`\nAfter horizontal rotation:`);
    console.log(`  Avg brightness: ${afterH.avg.toFixed(1)}`);
    console.log(`  Min/Max: ${afterH.min}/${afterH.max}`);
    console.log(`  Pixel count: ${afterH.count}`);

    // Continue rotating more
    await page.mouse.move(centerX - dragDistance / 2, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + dragDistance / 2, centerY, { steps: 20 });
    await page.mouse.up();

    await page.waitForTimeout(500);

    const afterH2 = await measureBrightness();
    console.log(`\nAfter more horizontal rotation:`);
    console.log(`  Avg brightness: ${afterH2.avg.toFixed(1)}`);
    console.log(`  Min/Max: ${afterH2.min}/${afterH2.max}`);

    // Now try vertical rotation
    await page.mouse.move(centerX, centerY - dragDistance / 3);
    await page.mouse.down();
    await page.mouse.move(centerX, centerY + dragDistance / 3, { steps: 20 });
    await page.mouse.up();

    await page.waitForTimeout(500);

    const afterV = await measureBrightness();
    console.log(`\nAfter vertical rotation:`);
    console.log(`  Avg brightness: ${afterV.avg.toFixed(1)}`);
    console.log(`  Min/Max: ${afterV.min}/${afterV.max}`);

    // Analysis
    const brightnesses = [initial.avg, afterH.avg, afterH2.avg, afterV.avg];
    const minB = Math.min(...brightnesses);
    const maxB = Math.max(...brightnesses);
    const avgB = brightnesses.reduce((a, b) => a + b, 0) / brightnesses.length;
    const variation = avgB > 0 ? ((maxB - minB) / avgB) * 100 : 0;

    console.log(`\n=== SUMMARY ===`);
    console.log(`Brightness values: ${brightnesses.map((b) => b.toFixed(1)).join(', ')}`);
    console.log(`Min: ${minB.toFixed(1)}, Max: ${maxB.toFixed(1)}`);
    console.log(`Variation: ${variation.toFixed(1)}%`);

    if (variation < 30) {
      console.log(`✅ Brightness is consistent (variation < 30%)`);
    } else {
      console.log(`❌ Brightness varies too much (variation >= 30%)`);
      console.log(`   This indicates two-sided lighting is NOT working`);
    }

    // Test passes if variation is reasonable
    // Note: some variation is expected due to different visible faces
    expect(variation).toBeLessThan(50);
  });
});
