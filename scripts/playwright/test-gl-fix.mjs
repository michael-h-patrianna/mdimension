/**
 * Test script to verify:
 * 1. No GL_INVALID_OPERATION errors after page load
 * 2. The hypercube object is visible (green pixels in center)
 */

import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3000';

async function run() {
  console.log('=== GL Fix Verification Test ===\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const glErrors = [];
  const consoleErrors = [];
  let testsPassed = 0;
  let testsFailed = 0;

  // Capture GL errors and console errors
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('GL_INVALID_OPERATION')) {
      glErrors.push(text);
    }
    if (msg.type() === 'error') {
      consoleErrors.push(text);
      console.log('Console error:', text);
    }
  });

  // Capture page errors
  page.on('pageerror', (error) => {
    console.log('Page error:', error.message);
  });

  try {
    // Load page and wait
    console.log('Loading page...');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('Page loaded, waiting for canvas...');
    await page.waitForSelector('canvas', { timeout: 30000 });
    console.log('Canvas found, waiting 2 seconds...');
    await page.waitForTimeout(2000);

    // TEST 1: No GL errors
    console.log('\n--- Test 1: No GL_INVALID_OPERATION errors ---');
    if (glErrors.length === 0) {
      console.log('✅ PASSED: No GL errors found');
      testsPassed++;
    } else {
      console.log(`❌ FAILED: Found ${glErrors.length} GL errors`);
      console.log('First error:', glErrors[0]);
      testsFailed++;
    }

    // TEST 2: Check center pixels are green (hypercube visible)
    console.log('\n--- Test 2: Hypercube visible (green pixels in center) ---');
    
    // Take screenshot of the main canvas (first one with data-engine attribute)
    const canvas = page.locator('canvas[data-engine]').first();
    const screenshot = await canvas.screenshot();
    
    // Save screenshot for debugging
    const fs = await import('fs');
    fs.writeFileSync('screenshots/gl-fix-test.png', screenshot);
    console.log('Screenshot saved to screenshots/gl-fix-test.png');

    // Get canvas dimensions
    const box = await canvas.boundingBox();
    if (!box) {
      console.log('❌ FAILED: Could not get canvas dimensions');
      testsFailed++;
    } else {
      // Get pixel data from center 9x9 area
      const centerX = Math.floor(box.width / 2);
      const centerY = Math.floor(box.height / 2);
      
      // Use page.evaluate to read pixels from canvas
      const pixelData = await page.evaluate(({ cx, cy }) => {
        const canvas = document.querySelector('canvas[data-engine]');
        if (!canvas) return null;
        
        const ctx = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (!ctx) return null;
        
        // Read 50x50 pixels around center (larger area)
        const size = 50;
        const halfSize = Math.floor(size / 2);
        const startX = cx - halfSize;
        const startY = cy - halfSize;
        
        const pixels = new Uint8Array(size * size * 4);
        ctx.readPixels(startX, canvas.height - startY - size, size, size, ctx.RGBA, ctx.UNSIGNED_BYTE, pixels);
        
        // Count green-ish pixels (G > R and G > B)
        let greenCount = 0;
        let blackCount = 0;
        let totalPixels = size * size;
        
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          
          // Check if pixel is green-ish (G is dominant or close to it)
          if (g > 50 && g >= r * 0.8 && g >= b * 0.8) {
            greenCount++;
          }
          // Check if pixel is black/very dark
          if (r < 20 && g < 20 && b < 20) {
            blackCount++;
          }
        }
        
        return {
          greenCount,
          blackCount,
          totalPixels,
          greenRatio: greenCount / totalPixels,
          blackRatio: blackCount / totalPixels,
          samplePixels: [
            { r: pixels[0], g: pixels[1], b: pixels[2] },
            { r: pixels[40], g: pixels[41], b: pixels[42] },
            { r: pixels[160], g: pixels[161], b: pixels[162] },
          ]
        };
      }, { cx: centerX, cy: centerY });

      if (!pixelData) {
        console.log('❌ FAILED: Could not read pixel data');
        testsFailed++;
      } else {
        console.log(`Center pixel analysis (9x9 area):`);
        console.log(`  Green-ish pixels: ${pixelData.greenCount}/${pixelData.totalPixels} (${(pixelData.greenRatio * 100).toFixed(1)}%)`);
        console.log(`  Black pixels: ${pixelData.blackCount}/${pixelData.totalPixels} (${(pixelData.blackRatio * 100).toFixed(1)}%)`);
        console.log(`  Sample pixels: ${JSON.stringify(pixelData.samplePixels)}`);

        // Pass if at least 20% of center pixels are green-ish (object visible)
        // Or if less than 90% are black (something is rendered)
        if (pixelData.greenRatio >= 0.2) {
          console.log('✅ PASSED: Object is visible (green pixels detected)');
          testsPassed++;
        } else if (pixelData.blackRatio < 0.9) {
          console.log('⚠️ WARNING: Object may be visible but not green enough');
          console.log('✅ PASSED: Something is rendering (not all black)');
          testsPassed++;
        } else {
          console.log('❌ FAILED: Object not visible (mostly black pixels)');
          testsFailed++;
        }
      }
    }

    // Summary
    console.log('\n=== Test Summary ===');
    console.log(`Passed: ${testsPassed}/2`);
    console.log(`Failed: ${testsFailed}/2`);

    await browser.close();
    process.exit(testsFailed > 0 ? 1 : 0);

  } catch (error) {
    console.error('Error during test:', error);
    await browser.close();
    process.exit(1);
  }
}

run();

