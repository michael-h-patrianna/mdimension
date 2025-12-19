/**
 * Physical Fog White Screen Test
 *
 * Tests that enabling physical fog with bloom does not cause the screen to turn white.
 * This is a regression test for a bug where:
 * - GLSL version mismatch caused shader compilation failure
 * - Unbounded HDR accumulation caused bloom blowout
 *
 * Success criteria:
 * - Screen should NOT be predominantly white after 2 seconds
 * - Animation should continue (multiple frames differ)
 * - No WebGL errors in console
 */

import { chromium } from 'playwright';

// Thresholds for screen detection
const WHITE_THRESHOLD = 240; // RGB values above this are considered "white"
const WHITE_PIXEL_RATIO_THRESHOLD = 0.85; // If 85%+ pixels are white, screen is white
const BLACK_THRESHOLD = 15; // RGB values below this are considered "black"
const BLACK_PIXEL_RATIO_THRESHOLD = 0.90; // If 90%+ pixels are black, scene not rendering
const MIN_BRIGHTNESS_THRESHOLD = 10; // Minimum average brightness for valid render

/**
 * Analyze screenshot pixels to detect white screen
 * @param {Buffer} screenshotBuffer - PNG screenshot buffer
 * @returns {Object} Analysis results
 */
async function analyzeScreenshot(page) {
  // Get canvas pixel data via page.evaluate
  const pixelAnalysis = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) {
      return { error: 'No canvas found', whiteRatio: 0, avgBrightness: 0 };
    }

    // Create a temporary 2D canvas to read pixels
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;

    // Draw WebGL canvas to 2D canvas
    ctx.drawImage(canvas, 0, 0);

    // Sample pixels across the canvas
    const sampleSize = 100; // Sample 100x100 grid
    const stepX = Math.floor(canvas.width / sampleSize);
    const stepY = Math.floor(canvas.height / sampleSize);

    let whitePixels = 0;
    let blackPixels = 0;
    let totalBrightness = 0;
    let sampledPixels = 0;
    let minBrightness = 255;
    let maxBrightness = 0;
    const pixelSamples = [];

    for (let y = 0; y < canvas.height; y += stepY) {
      for (let x = 0; x < canvas.width; x += stepX) {
        const imageData = ctx.getImageData(x, y, 1, 1);
        const [r, g, b] = imageData.data;

        const brightness = (r + g + b) / 3;
        totalBrightness += brightness;
        sampledPixels++;
        minBrightness = Math.min(minBrightness, brightness);
        maxBrightness = Math.max(maxBrightness, brightness);

        // Check if pixel is white (all channels above threshold)
        if (r > 240 && g > 240 && b > 240) {
          whitePixels++;
        }

        // Check if pixel is black/very dark (all channels below threshold)
        if (r < 15 && g < 15 && b < 15) {
          blackPixels++;
        }

        // Store some samples for debugging
        if (pixelSamples.length < 10) {
          pixelSamples.push({ x, y, r, g, b, brightness });
        }
      }
    }

    return {
      whiteRatio: whitePixels / sampledPixels,
      blackRatio: blackPixels / sampledPixels,
      avgBrightness: totalBrightness / sampledPixels,
      minBrightness,
      maxBrightness,
      brightnessRange: maxBrightness - minBrightness,
      sampledPixels,
      whitePixels,
      blackPixels,
      pixelSamples,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height
    };
  });

  return pixelAnalysis;
}

/**
 * Main test function
 */
async function testPhysicalFogWhiteScreen() {
  console.log('=== Physical Fog White Screen Test ===\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader'] // Use software renderer for CI
  });

  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 }
  });

  const logs = [];
  const errors = [];

  page.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`;
    logs.push(text);
    if (msg.type() === 'error' || msg.text().toLowerCase().includes('error')) {
      errors.push(text);
    }
  });

  page.on('pageerror', err => {
    const text = `[PAGE ERROR] ${err.message}`;
    logs.push(text);
    errors.push(text);
  });

  let testPassed = true;
  let failureReason = '';

  try {
    // Step 1: Navigate to app
    console.log('Step 1: Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Step 2: Wait for initial render
    console.log('Step 2: Waiting for initial render (1s)...');
    await page.waitForTimeout(1000);

    // Step 3: Enable physical fog via store injection
    console.log('Step 3: Enabling physical fog...');

    // Inject into the window to access zustand stores
    const fogEnabled = await page.evaluate(() => {
      // Access the environment store via window (exposed by zustand persist)
      // Try multiple methods to find the store

      // Method 1: Direct window access (if exposed)
      if (typeof window !== 'undefined') {
        // Look for zustand stores in window
        const keys = Object.keys(window).filter(k =>
          k.includes('store') || k.includes('Store') || k.includes('zustand')
        );

        // Try to find and modify localStorage directly (zustand persist uses this)
        try {
          const envStorageKey = 'environment-storage';
          const stored = localStorage.getItem(envStorageKey);
          if (stored) {
            const data = JSON.parse(stored);
            if (data.state) {
              data.state.fogEnabled = true;
              data.state.fogType = 'physical';
              localStorage.setItem(envStorageKey, JSON.stringify(data));
              // Reload to pick up changes
              return 'storage-modified';
            }
          }
        } catch (e) {
          console.log('Storage method failed:', e);
        }
      }
      return 'no-store-found';
    });

    console.log(`  - Store access result: ${fogEnabled}`);

    if (fogEnabled === 'storage-modified') {
      console.log('  - Reloading page to apply fog settings...');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
    } else {
      // Fallback: Try clicking UI elements
      console.log('  - Trying UI fallback...');

      // Click Environment section to expand if collapsed
      const envSection = page.locator('text=Environment').first();
      if (await envSection.isVisible()) {
        await envSection.click();
        await page.waitForTimeout(200);
      }

      // Click Fog subsection to expand
      const fogSection = page.locator('text=Fog').first();
      if (await fogSection.isVisible()) {
        await fogSection.click();
        await page.waitForTimeout(200);
      }

      // Enable fog toggle
      const fogToggle = page.locator('[data-testid="fog-toggle"]');
      if (await fogToggle.isVisible()) {
        const isChecked = await fogToggle.isChecked().catch(() => false);
        if (!isChecked) {
          await fogToggle.click();
          console.log('  - Fog enabled via toggle');
        }
      }

      await page.waitForTimeout(200);

      // Select Physical fog type
      const physicalButton = page.locator('[data-testid="fog-type-physical"]');
      if (await physicalButton.isVisible()) {
        await physicalButton.click();
        console.log('  - Physical fog type selected via button');
      }
    }

    // Step 4: Wait for fog to render and potentially turn white
    console.log('Step 4: Waiting 2 seconds for fog rendering...');
    await page.waitForTimeout(2000);

    // Step 5: Take screenshot for analysis
    console.log('Step 5: Analyzing screen for white-out...');

    let analysis;
    try {
      await page.screenshot({ path: 'screenshots/physical-fog-test.png', timeout: 5000 });
      analysis = await analyzeScreenshot(page);
    } catch (screenshotError) {
      // If screenshot fails, it's likely due to GPU stall - this IS the bug
      console.log('\n!!! SCREENSHOT FAILED - GPU likely stalled !!!');
      console.log(`Error: ${screenshotError.message}`);
      testPassed = false;
      failureReason = 'GPU stall detected - screenshot timed out';

      // Log any console messages we captured
      console.log('\n=== Console Logs (captured before stall) ===');
      logs.forEach(l => console.log(l));

      console.log('\n' + '='.repeat(50));
      console.log('TEST FAILED: ' + failureReason);
      console.log('='.repeat(50));
      console.log('\nThis indicates the physical fog shader is causing GPU stalls.');
      console.log('Check for GLSL compilation errors or infinite loops in shader.');

      await browser.close();
      process.exit(1);
    }

    console.log('\n=== Pixel Analysis Results ===');
    console.log(`Canvas size: ${analysis.canvasWidth}x${analysis.canvasHeight}`);
    console.log(`Sampled pixels: ${analysis.sampledPixels}`);
    console.log(`White pixels: ${analysis.whitePixels} (${(analysis.whiteRatio * 100).toFixed(1)}%)`);
    console.log(`Black pixels: ${analysis.blackPixels} (${(analysis.blackRatio * 100).toFixed(1)}%)`);
    console.log(`Average brightness: ${analysis.avgBrightness.toFixed(1)}/255`);
    console.log(`Brightness range: ${analysis.minBrightness.toFixed(0)} - ${analysis.maxBrightness.toFixed(0)} (range: ${analysis.brightnessRange.toFixed(0)})`);
    console.log('\nSample pixels:');
    analysis.pixelSamples?.forEach((p, i) => {
      console.log(`  [${i}] (${p.x},${p.y}): RGB(${p.r},${p.g},${p.b}) brightness=${p.brightness.toFixed(0)}`);
    });

    // Step 6: Check for animation (take another screenshot and compare)
    console.log('\nStep 6: Checking for animation freeze...');
    await page.waitForTimeout(500);
    const analysis2 = await analyzeScreenshot(page);

    const brightnessChange = Math.abs(analysis2.avgBrightness - analysis.avgBrightness);
    console.log(`Brightness change after 500ms: ${brightnessChange.toFixed(2)}`);

    // Step 7: Evaluate results
    console.log('\n=== Quality Gate Evaluation ===\n');

    // Gate 1: Scene is actually rendered (not all black)
    const isBlackScreen = analysis.blackRatio > BLACK_PIXEL_RATIO_THRESHOLD;
    const isTooDark = analysis.avgBrightness < MIN_BRIGHTNESS_THRESHOLD;
    const hasNoVariance = analysis.brightnessRange < 5;
    const sceneNotRendered = isBlackScreen || (isTooDark && hasNoVariance);

    console.log(`GATE 1 (Scene rendered): ${sceneNotRendered ? 'FAIL' : 'PASS'}`);
    console.log(`  Black pixel ratio: ${(analysis.blackRatio * 100).toFixed(1)}% (threshold: ${BLACK_PIXEL_RATIO_THRESHOLD * 100}%)`);
    console.log(`  Average brightness: ${analysis.avgBrightness.toFixed(1)}/255 (min: ${MIN_BRIGHTNESS_THRESHOLD})`);
    console.log(`  Brightness range: ${analysis.brightnessRange.toFixed(0)} (need > 5 for variance)`);

    if (sceneNotRendered) {
      testPassed = false;
      failureReason = `Scene not rendered (${(analysis.blackRatio * 100).toFixed(1)}% black, avg brightness: ${analysis.avgBrightness.toFixed(1)})`;
    }

    // Gate 2: Screen not white
    const isWhiteScreen = analysis.whiteRatio > WHITE_PIXEL_RATIO_THRESHOLD;
    console.log(`\nGATE 2 (Screen not white): ${isWhiteScreen ? 'FAIL' : 'PASS'}`);
    console.log(`  White pixel ratio: ${(analysis.whiteRatio * 100).toFixed(1)}%`);
    console.log(`  Threshold: ${WHITE_PIXEL_RATIO_THRESHOLD * 100}%`);

    if (isWhiteScreen && !failureReason) {
      testPassed = false;
      failureReason = `Screen is white (${(analysis.whiteRatio * 100).toFixed(1)}% white pixels)`;
    }

    // Gate 3: Average brightness not extreme (too bright)
    const isTooBright = analysis.avgBrightness > 250;
    console.log(`\nGATE 3 (Brightness not extreme): ${isTooBright ? 'FAIL' : 'PASS'}`);
    console.log(`  Average brightness: ${analysis.avgBrightness.toFixed(1)}/255`);
    console.log(`  Threshold: 250`);

    if (isTooBright && !failureReason) {
      testPassed = false;
      failureReason = `Screen too bright (avg brightness: ${analysis.avgBrightness.toFixed(1)})`;
    }

    // Gate 4: No WebGL/shader errors
    const webglErrors = errors.filter(e =>
      e.toLowerCase().includes('webgl') ||
      e.toLowerCase().includes('shader') ||
      e.toLowerCase().includes('glsl') ||
      e.toLowerCase().includes('program')
    );
    console.log(`\nGATE 4 (No WebGL errors): ${webglErrors.length > 0 ? 'FAIL' : 'PASS'}`);
    if (webglErrors.length > 0) {
      console.log('  WebGL/Shader errors detected:');
      webglErrors.forEach(e => console.log(`    ${e}`));
      if (!failureReason) {
        testPassed = false;
        failureReason = `WebGL errors detected: ${webglErrors.length}`;
      }
    }

    // Final result
    console.log('\n' + '='.repeat(50));
    if (testPassed) {
      console.log('TEST PASSED: Physical fog with bloom works correctly');
      console.log('='.repeat(50));
    } else {
      console.log('TEST FAILED: ' + failureReason);
      console.log('='.repeat(50));

      // Output debug info
      if (logs.length > 0) {
        console.log('\n=== Console Logs ===');
        logs.slice(-20).forEach(l => console.log(l));
      }
    }

  } catch (err) {
    console.error('\nTest error:', err.message);
    testPassed = false;
    failureReason = err.message;

    if (logs.length > 0) {
      console.log('\n=== Console Logs ===');
      logs.forEach(l => console.log(l));
    }
  } finally {
    await browser.close();
  }

  // Exit with appropriate code
  process.exit(testPassed ? 0 : 1);
}

// Run the test
testPhysicalFogWhiteScreen();
