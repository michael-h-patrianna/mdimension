/**
 * Two-Sided Lighting Test
 *
 * Verifies that polytope faces have consistent brightness from both viewing directions.
 * This tests that two-sided lighting is working correctly.
 *
 * Method:
 * 1. Measure average brightness of visible pixels
 * 2. Rotate object 180 degrees around Y axis (XZ plane)
 * 3. Measure average brightness again
 * 4. Compare - they should be similar (within tolerance)
 */

import { test, expect } from '@playwright/test';

test.describe('Two-Sided Lighting', () => {
  test('faces should have similar brightness from front and back', async ({ page }) => {
    await page.goto('http://localhost:3002');
    await page.waitForSelector('canvas', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // Expose rotation store on window for testing
    await page.evaluate(() => {
      // Access Zustand stores - they use useSyncExternalStore internally
      // We need to find the store instance
      const win = window as any;

      // Try to import the store dynamically
      // Since this is a Vite app, we can use import()
      return import('/src/stores/rotationStore.ts').then((module) => {
        win.__TEST_ROTATION_STORE__ = module.useRotationStore;
        return true;
      }).catch((e) => {
        console.error('Failed to import rotation store:', e);
        return false;
      });
    });

    // Wait for import
    await page.waitForTimeout(500);

    // Function to measure average brightness of red pixels
    const measureBrightness = async (): Promise<{ avgBrightness: number; pixelCount: number }> => {
      return await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return { avgBrightness: 0, pixelCount: 0 };

        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (!gl) return { avgBrightness: 0, pixelCount: 0 };

        const width = canvas.width;
        const height = canvas.height;
        const pixels = new Uint8Array(width * height * 4);

        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

        let totalBrightness = 0;
        let pixelCount = 0;
        const threshold = 10;

        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i]!;
          const g = pixels[i + 1]!;
          const b = pixels[i + 2]!;

          // Only count pixels that are not background (have some color)
          if (r > threshold || g > threshold || b > threshold) {
            // Calculate perceived brightness (luminance)
            const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
            totalBrightness += brightness;
            pixelCount++;
          }
        }

        return {
          avgBrightness: pixelCount > 0 ? totalBrightness / pixelCount : 0,
          pixelCount,
        };
      });
    };

    // Function to rotate object by angle in XZ plane (Y-axis rotation)
    const rotateObject = async (angleRadians: number) => {
      await page.evaluate((angle) => {
        const win = window as any;
        const store = win.__TEST_ROTATION_STORE__;
        if (store) {
          store.getState().setRotation('XZ', angle);
        } else {
          console.error('Rotation store not found');
        }
      }, angleRadians);
      await page.waitForTimeout(500); // Wait for re-render
    };

    // Measure initial brightness (front view)
    const initial = await measureBrightness();
    console.log(`\n=== TWO-SIDED LIGHTING TEST ===`);
    console.log(`Initial (front): avg brightness = ${initial.avgBrightness.toFixed(1)}, pixels = ${initial.pixelCount}`);

    // Rotate 180 degrees (π radians)
    await rotateObject(Math.PI);

    // Measure brightness after rotation (back view)
    const rotated = await measureBrightness();
    console.log(`After 180° rotation (back): avg brightness = ${rotated.avgBrightness.toFixed(1)}, pixels = ${rotated.pixelCount}`);

    // Calculate difference
    const brightnessDiff = Math.abs(initial.avgBrightness - rotated.avgBrightness);
    const avgBrightness = (initial.avgBrightness + rotated.avgBrightness) / 2;
    const percentDiff = avgBrightness > 0 ? (brightnessDiff / avgBrightness) * 100 : 0;

    console.log(`\n=== RESULTS ===`);
    console.log(`Brightness difference: ${brightnessDiff.toFixed(1)} (${percentDiff.toFixed(1)}%)`);

    if (percentDiff < 20) {
      console.log(`✅ Two-sided lighting is working (< 20% difference)`);
    } else {
      console.log(`❌ Two-sided lighting FAILED (> 20% difference)`);
      console.log(`   Front view: ${initial.avgBrightness.toFixed(1)}`);
      console.log(`   Back view:  ${rotated.avgBrightness.toFixed(1)}`);
    }

    // Test passes if brightness difference is less than 20%
    expect(percentDiff).toBeLessThan(20);
  });

  test('measure brightness at multiple angles', async ({ page }) => {
    await page.goto('http://localhost:3002');
    await page.waitForSelector('canvas', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // Import rotation store
    await page.evaluate(() => {
      const win = window as any;
      return import('/src/stores/rotationStore.ts').then((module) => {
        win.__TEST_ROTATION_STORE__ = module.useRotationStore;
        return true;
      }).catch(() => false);
    });
    await page.waitForTimeout(500);

    const measureBrightness = async (): Promise<number> => {
      return await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return 0;
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (!gl) return 0;

        const width = canvas.width;
        const height = canvas.height;
        const pixels = new Uint8Array(width * height * 4);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

        let totalBrightness = 0;
        let pixelCount = 0;

        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i]!;
          if (r > 10) {
            totalBrightness += r;
            pixelCount++;
          }
        }
        return pixelCount > 0 ? totalBrightness / pixelCount : 0;
      });
    };

    const rotateObject = async (angleRadians: number) => {
      await page.evaluate((angle) => {
        const win = window as any;
        const store = win.__TEST_ROTATION_STORE__;
        if (store) {
          store.getState().setRotation('XZ', angle);
        }
      }, angleRadians);
      await page.waitForTimeout(300);
    };

    console.log(`\n=== BRIGHTNESS AT MULTIPLE ANGLES ===`);

    const results: { angle: number; brightness: number }[] = [];

    // Test every 30 degrees
    for (let deg = 0; deg < 360; deg += 30) {
      const rad = (deg * Math.PI) / 180;
      await rotateObject(rad);
      const brightness = await measureBrightness();
      results.push({ angle: deg, brightness });
      console.log(`${deg}°: brightness = ${brightness.toFixed(1)}`);
    }

    // Analyze
    const brightnesses = results.map((r) => r.brightness);
    const minB = Math.min(...brightnesses);
    const maxB = Math.max(...brightnesses);
    const avgB = brightnesses.reduce((a, b) => a + b, 0) / brightnesses.length;
    const variation = ((maxB - minB) / avgB) * 100;

    console.log(`\nMin: ${minB.toFixed(1)}, Max: ${maxB.toFixed(1)}, Avg: ${avgB.toFixed(1)}`);
    console.log(`Variation: ${variation.toFixed(1)}%`);

    if (variation < 30) {
      console.log(`✅ Brightness is consistent across angles`);
    } else {
      console.log(`❌ Brightness varies too much across angles`);
    }

    // Find problematic angles (much darker than average)
    const darkAngles = results.filter((r) => r.brightness < avgB * 0.7);
    if (darkAngles.length > 0) {
      console.log(`\nDark angles (<70% of average):`);
      darkAngles.forEach((r) => console.log(`  ${r.angle}°: ${r.brightness.toFixed(1)}`));
    }

    expect(variation).toBeLessThan(50);
  });
});
