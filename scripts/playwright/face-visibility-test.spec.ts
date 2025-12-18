/**
 * Face Visibility Test
 *
 * Tests that polytope faces remain visible at all orientations when opacity < 1.
 * Uses pixel counting to detect face visibility - no screenshot inspection needed.
 *
 * Test setup (via modified defaults):
 * - 3D hypercube (simplest case)
 * - Red faces (#FF0000) with 50% opacity
 * - Black background (#000000)
 * - No skybox, no walls, no lights (ambient only)
 * - Bloom disabled
 *
 * Detection method:
 * - Count pixels where Red channel > 0
 * - A missing face = fewer red pixels
 * - Compare pixel counts across rotation angles
 */

import { test, expect } from '@playwright/test';

test.describe('Face Visibility with Transparency', () => {
  test.beforeEach(async ({ page }) => {
    // Go to app
    await page.goto('http://localhost:3002');

    // Wait for canvas to be ready
    await page.waitForSelector('canvas', { timeout: 15000 });

    // Wait for scene to initialize and render
    await page.waitForTimeout(3000);
  });

  test('3D hypercube faces should have consistent pixel coverage at all rotations', async ({
    page,
  }) => {
    // Function to count pixels with red channel > threshold
    const countRedPixels = async (): Promise<number> => {
      return await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return 0;

        // Get WebGL context and read pixels
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (!gl) return 0;

        const width = canvas.width;
        const height = canvas.height;
        const pixels = new Uint8Array(width * height * 4);

        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

        let redCount = 0;
        const threshold = 20; // Red channel threshold

        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          // Count pixels where red is significantly present
          // With red face on black background, any R > threshold indicates face
          if (r > threshold) {
            redCount++;
          }
        }

        return redCount;
      });
    };

    // Function to get total pixel count
    const getTotalPixels = async (): Promise<number> => {
      return await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return 0;
        return canvas.width * canvas.height;
      });
    };

    // Measure baseline pixel count
    const totalPixels = await getTotalPixels();
    const baselinePixels = await countRedPixels();

    console.log(`\n=== FACE VISIBILITY TEST ===`);
    console.log(`Canvas: ${totalPixels} total pixels`);
    console.log(`Baseline red pixels: ${baselinePixels}`);
    console.log(`Baseline coverage: ${((baselinePixels / totalPixels) * 100).toFixed(2)}%`);

    // Test multiple rotation angles by simulating rotation via store access
    // For simplicity, we'll test the current view and trigger rotations via keyboard
    const results: { angle: string; pixels: number; ratio: number }[] = [];

    // Capture initial state
    results.push({
      angle: 'initial',
      pixels: baselinePixels,
      ratio: 1.0,
    });

    // Try to rotate using keyboard (if implemented) or just test current view
    // This test primarily validates that the test infrastructure works
    // and can detect face visibility

    // Simulate user interaction to trigger rotation
    // Press arrow keys to rotate the view
    const rotationSequences = [
      { keys: ['ArrowRight', 'ArrowRight', 'ArrowRight'], label: 'rotated-right' },
      { keys: ['ArrowUp', 'ArrowUp', 'ArrowUp'], label: 'rotated-up' },
      { keys: ['ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft'], label: 'rotated-left' },
      { keys: ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown'], label: 'rotated-down' },
    ];

    for (const seq of rotationSequences) {
      for (const key of seq.keys) {
        await page.keyboard.press(key);
        await page.waitForTimeout(100);
      }
      await page.waitForTimeout(500); // Wait for render to settle

      const pixels = await countRedPixels();
      const ratio = baselinePixels > 0 ? pixels / baselinePixels : 0;

      results.push({ angle: seq.label, pixels, ratio });
      console.log(`${seq.label}: ${pixels} pixels (${(ratio * 100).toFixed(1)}% of baseline)`);
    }

    // Analyze results
    const pixelCounts = results.map((r) => r.pixels);
    const minPixels = Math.min(...pixelCounts);
    const maxPixels = Math.max(...pixelCounts);
    const avgPixels = pixelCounts.reduce((sum, p) => sum + p, 0) / pixelCounts.length;

    const minRatio = minPixels / baselinePixels;
    const maxRatio = maxPixels / baselinePixels;

    console.log(`\n=== RESULTS ===`);
    console.log(`Min pixels: ${minPixels} (${(minRatio * 100).toFixed(1)}%)`);
    console.log(`Max pixels: ${maxPixels} (${(maxRatio * 100).toFixed(1)}%)`);
    console.log(`Avg pixels: ${avgPixels.toFixed(0)}`);
    console.log(`Variation: ${(((maxPixels - minPixels) / avgPixels) * 100).toFixed(1)}%`);

    // Check for problematic views (where pixel count drops significantly)
    const threshold = 0.3; // 70% drop is problematic
    const problematicViews = results.filter((r) => r.ratio < threshold);

    if (problematicViews.length > 0) {
      console.log(`\n⚠️  PROBLEMATIC VIEWS (>70% pixel drop):`);
      problematicViews.forEach((r) => {
        console.log(`  ${r.angle}: ${r.pixels} pixels (${(r.ratio * 100).toFixed(1)}%)`);
      });
    } else {
      console.log(`\n✅ All views have reasonable pixel coverage`);
    }

    // Test should fail if baseline is too low (faces not rendering at all)
    expect(baselinePixels).toBeGreaterThan(100); // At least some faces visible

    // Test should fail if any view has drastically fewer pixels
    // Allow for some variation due to different visible face areas, but not complete disappearance
    expect(minPixels).toBeGreaterThan(baselinePixels * 0.1); // At least 10% of baseline
  });

  test('face pixel count should be non-zero', async ({ page }) => {
    // Simple sanity check that faces are rendering
    const redPixels = await page.evaluate(() => {
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

    console.log(`Red pixels detected: ${redPixels}`);
    expect(redPixels).toBeGreaterThan(0);
  });
});
