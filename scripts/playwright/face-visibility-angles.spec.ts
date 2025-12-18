/**
 * Face Visibility Angle Test
 *
 * Tests face visibility at specific rotation angles by directly
 * manipulating the rotation store. This finds exact angles where
 * faces disappear.
 */

import { test, expect } from '@playwright/test';

test.describe('Face Visibility at Specific Angles', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3002');
    await page.waitForSelector('canvas', { timeout: 15000 });
    await page.waitForTimeout(3000);
  });

  test('test face visibility at 360 degree rotation', async ({ page }) => {
    // Function to count red pixels
    const countRedPixels = async (): Promise<number> => {
      return await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return 0;
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (!gl) return 0;
        const width = canvas.width;
        const height = canvas.height;
        const pixels = new Uint8Array(width * height * 4);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        let count = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i] > 20) count++;
        }
        return count;
      });
    };

    // Set a specific rotation angle via store
    const setRotation = async (xy: number, xz: number, yz: number) => {
      await page.evaluate(
        ({ xy, xz, yz }) => {
          // Access rotation store via window
          const rotationStore = (window as any).__ZUSTAND_STORES__?.rotation;
          if (rotationStore) {
            const store = rotationStore.getState();
            store.setAngle('XY', xy);
            store.setAngle('XZ', xz);
            store.setAngle('YZ', yz);
          } else {
            // Try to find store via React internals or global
            console.warn('Rotation store not found via __ZUSTAND_STORES__');
          }
        },
        { xy, xz, yz }
      );
      await page.waitForTimeout(200);
    };

    console.log('\n=== ROTATION ANGLE TEST ===');

    const results: { angle: string; pixels: number }[] = [];

    // Test rotation in XY plane (0 to 360 degrees in 15-degree increments)
    for (let angle = 0; angle < 360; angle += 15) {
      const radians = (angle * Math.PI) / 180;
      await setRotation(radians, 0, 0);
      const pixels = await countRedPixels();
      results.push({ angle: `XY:${angle}°`, pixels });
      console.log(`XY ${angle}°: ${pixels} pixels`);
    }

    // Test rotation in XZ plane
    for (let angle = 0; angle < 360; angle += 15) {
      const radians = (angle * Math.PI) / 180;
      await setRotation(0, radians, 0);
      const pixels = await countRedPixels();
      results.push({ angle: `XZ:${angle}°`, pixels });
      console.log(`XZ ${angle}°: ${pixels} pixels`);
    }

    // Test rotation in YZ plane
    for (let angle = 0; angle < 360; angle += 15) {
      const radians = (angle * Math.PI) / 180;
      await setRotation(0, 0, radians);
      const pixels = await countRedPixels();
      results.push({ angle: `YZ:${angle}°`, pixels });
      console.log(`YZ ${angle}°: ${pixels} pixels`);
    }

    // Find minimum and maximum
    const pixelCounts = results.map((r) => r.pixels);
    const minPixels = Math.min(...pixelCounts);
    const maxPixels = Math.max(...pixelCounts);
    const avgPixels = pixelCounts.reduce((a, b) => a + b, 0) / pixelCounts.length;

    console.log(`\n=== SUMMARY ===`);
    console.log(`Min: ${minPixels} pixels`);
    console.log(`Max: ${maxPixels} pixels`);
    console.log(`Avg: ${avgPixels.toFixed(0)} pixels`);

    // Find angles with unusually low pixel counts
    const threshold = avgPixels * 0.5;
    const problematic = results.filter((r) => r.pixels < threshold);

    if (problematic.length > 0) {
      console.log(`\n⚠️  LOW PIXEL COUNT ANGLES (<50% of average):`);
      problematic.forEach((r) => {
        console.log(`  ${r.angle}: ${r.pixels} pixels`);
      });
    }

    // Find angles with zero pixels (complete failure)
    const zeroPixels = results.filter((r) => r.pixels === 0);
    if (zeroPixels.length > 0) {
      console.log(`\n❌ ZERO PIXEL ANGLES (complete failure):`);
      zeroPixels.forEach((r) => {
        console.log(`  ${r.angle}`);
      });
    }

    // Test should pass if no zero-pixel angles
    expect(minPixels).toBeGreaterThan(0);
  });

  test('compare opaque vs transparent faces', async ({ page }) => {
    // This test compares behavior at opacity=1 vs opacity=0.5
    // The bug only appears with transparency

    const countRedPixels = async (): Promise<number> => {
      return await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return 0;
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (!gl) return 0;
        const width = canvas.width;
        const height = canvas.height;
        const pixels = new Uint8Array(width * height * 4);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        let count = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i] > 20) count++;
        }
        return count;
      });
    };

    const setOpacity = async (opacity: number) => {
      await page.evaluate((opacity) => {
        const appearanceStore = (window as any).__ZUSTAND_STORES__?.appearance;
        if (appearanceStore) {
          appearanceStore.getState().setFaceOpacity(opacity);
        }
      }, opacity);
      await page.waitForTimeout(500);
    };

    console.log('\n=== OPACITY COMPARISON TEST ===');

    // Test with current (transparent) setting
    const transparentPixels = await countRedPixels();
    console.log(`Transparent (opacity=0.5): ${transparentPixels} pixels`);

    // Change to opaque
    await setOpacity(1.0);
    const opaquePixels = await countRedPixels();
    console.log(`Opaque (opacity=1.0): ${opaquePixels} pixels`);

    // Change back to transparent
    await setOpacity(0.5);
    const transparentAgain = await countRedPixels();
    console.log(`Transparent again (opacity=0.5): ${transparentAgain} pixels`);

    // With opaque faces, only front faces are visible
    // With transparent faces, all faces should contribute
    // So transparent should have MORE pixels than opaque
    console.log(`\nExpected: transparent >= opaque (see through front to back faces)`);
    console.log(`Actual ratio: ${(transparentAgain / opaquePixels).toFixed(2)}x`);

    // Both should have non-zero pixels
    expect(transparentPixels).toBeGreaterThan(0);
    expect(opaquePixels).toBeGreaterThan(0);
  });
});
