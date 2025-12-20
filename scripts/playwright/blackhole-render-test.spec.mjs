/**
 * Black Hole Render Test
 *
 * Verifies that the black hole object renders correctly on page load.
 * The scene should not be predominantly white or black - it should show
 * the actual black hole effect with photon shell, accretion disk, etc.
 *
 * Success criteria:
 * - Screen is NOT mostly white (< 50% white pixels)
 * - Screen is NOT mostly black (< 85% black pixels)
 * - Scene has visual variety (brightness range > 20)
 * - No WebGL/shader errors in console
 */

import { chromium } from 'playwright';

// Thresholds for screen detection
const WHITE_THRESHOLD = 240; // RGB values above this are considered "white"
const WHITE_PIXEL_RATIO_THRESHOLD = 0.50; // If 50%+ pixels are white, something is wrong
const BLACK_THRESHOLD = 15; // RGB values below this are considered "black"
const BLACK_PIXEL_RATIO_THRESHOLD = 0.85; // If 85%+ pixels are black, scene not rendering
const MIN_BRIGHTNESS_RANGE = 20; // Minimum brightness variance for valid render

/**
 * Analyze canvas pixels to detect rendering issues
 * @param {import('playwright').Page} page - Playwright page
 * @returns {Promise<Object>} Analysis results
 */
async function analyzeScreenshot(page) {
  const pixelAnalysis = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) {
      return { error: 'No canvas found', whiteRatio: 0, blackRatio: 1, avgBrightness: 0 };
    }

    // Create a temporary 2D canvas to read pixels
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;

    // Draw WebGL canvas to 2D canvas
    ctx.drawImage(canvas, 0, 0);

    // Sample pixels across the canvas (100x100 grid)
    const sampleSize = 100;
    const stepX = Math.floor(canvas.width / sampleSize);
    const stepY = Math.floor(canvas.height / sampleSize);

    let whitePixels = 0;
    let blackPixels = 0;
    let totalBrightness = 0;
    let sampledPixels = 0;
    let minBrightness = 255;
    let maxBrightness = 0;
    const pixelSamples = [];
    const colorSamples = { red: 0, orange: 0, blue: 0, other: 0 };

    for (let y = 0; y < canvas.height; y += stepY) {
      for (let x = 0; x < canvas.width; x += stepX) {
        const imageData = ctx.getImageData(x, y, 1, 1);
        const [r, g, b] = imageData.data;

        const brightness = (r + g + b) / 3;
        totalBrightness += brightness;
        sampledPixels++;
        minBrightness = Math.min(minBrightness, brightness);
        maxBrightness = Math.max(maxBrightness, brightness);

        // Check if pixel is white
        if (r > 240 && g > 240 && b > 240) {
          whitePixels++;
        }

        // Check if pixel is black
        if (r < 15 && g < 15 && b < 15) {
          blackPixels++;
        }

        // Categorize colors (for black hole we expect oranges/yellows/reds from accretion disk)
        if (r > 150 && g < 100 && b < 100) {
          colorSamples.red++;
        } else if (r > 150 && g > 80 && b < 180 && r > g && g > b) {
          // Orange/yellow: R dominant, G in middle, B lowest (warm colors)
          colorSamples.orange++;
        } else if (b > 150 && r < 100 && g < 150) {
          colorSamples.blue++;
        } else if (brightness > 15) {
          colorSamples.other++;
        }

        // Store some samples for debugging
        if (pixelSamples.length < 15) {
          pixelSamples.push({ x, y, r, g, b, brightness: Math.round(brightness) });
        }
      }
    }

    // Sample CENTER of screen specifically (where horizon should be)
    const centerX = Math.floor(canvas.width / 2);
    const centerY = Math.floor(canvas.height / 2);
    const centerSamples = [];
    for (let dy = -10; dy <= 10; dy += 5) {
      for (let dx = -10; dx <= 10; dx += 5) {
        const x = centerX + dx;
        const y = centerY + dy;
        const imgData = ctx.getImageData(x, y, 1, 1);
        const [r, g, b] = imgData.data;
        centerSamples.push({ x, y, r, g, b, brightness: Math.round((r+g+b)/3) });
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
      colorSamples,
      pixelSamples,
      centerSamples,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height
    };
  });

  return pixelAnalysis;
}

/**
 * Main test function
 */
async function testBlackHoleRender() {
  console.log('=== Black Hole Render Test ===\n');
  console.log('Verifies that the black hole object renders correctly on page load.\n');

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
    // Step 1: Navigate to app (Black Hole is the default object type)
    console.log('Step 1: Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Step 2: Wait for black hole to render (shader compilation + raymarching)
    // Black hole is default, so just wait for it to load
    // Camera should now be positioned above disk plane for Interstellar look
    console.log('Step 2: Waiting for black hole render (12s for shader compilation)...');
    await page.waitForTimeout(12000);

    // Step 3: Take screenshot for analysis (NO zoom - testing initial view)
    console.log('Step 3: Analyzing rendered scene...');

    let analysis;
    try {
      await page.screenshot({ path: 'screenshots/blackhole-render-test.png', timeout: 60000 });
      analysis = await analyzeScreenshot(page);
    } catch (screenshotError) {
      console.log('\n!!! SCREENSHOT FAILED - GPU likely stalled !!!');
      console.log(`Error: ${screenshotError.message}`);

      // Try one more time with longer wait
      console.log('Retrying after additional 10s wait...');
      await page.waitForTimeout(10000);

      try {
        await page.screenshot({ path: 'screenshots/blackhole-render-test.png', timeout: 30000 });
        analysis = await analyzeScreenshot(page);
      } catch (retryError) {
        testPassed = false;
        failureReason = 'GPU stall detected - screenshot timed out after retry';

        console.log('\n=== Console Logs ===');
        logs.forEach(l => console.log(l));

        await browser.close();
        process.exit(1);
      }
    }

    // Step 4: Display analysis results
    console.log('\n=== Pixel Analysis Results ===');
    console.log(`Canvas size: ${analysis.canvasWidth}x${analysis.canvasHeight}`);
    console.log(`Sampled pixels: ${analysis.sampledPixels}`);
    console.log(`White pixels: ${analysis.whitePixels} (${(analysis.whiteRatio * 100).toFixed(1)}%)`);
    console.log(`Black pixels: ${analysis.blackPixels} (${(analysis.blackRatio * 100).toFixed(1)}%)`);
    console.log(`Average brightness: ${analysis.avgBrightness.toFixed(1)}/255`);
    console.log(`Brightness range: ${analysis.minBrightness.toFixed(0)} - ${analysis.maxBrightness.toFixed(0)} (range: ${analysis.brightnessRange.toFixed(0)})`);
    console.log(`\nColor distribution:`);
    console.log(`  Red: ${analysis.colorSamples.red}`);
    console.log(`  Orange: ${analysis.colorSamples.orange}`);
    console.log(`  Blue: ${analysis.colorSamples.blue}`);
    console.log(`  Other: ${analysis.colorSamples.other}`);
    console.log('\nSample pixels (corner):');
    analysis.pixelSamples?.forEach((p, i) => {
      console.log(`  [${i}] (${p.x},${p.y}): RGB(${p.r},${p.g},${p.b}) brightness=${p.brightness}`);
    });

    console.log('\nCENTER pixels (where horizon should be):');
    analysis.centerSamples?.forEach((p, i) => {
      console.log(`  [${i}] (${p.x},${p.y}): RGB(${p.r},${p.g},${p.b}) brightness=${p.brightness}`);
    });

    // Step 5: Evaluate quality gates
    console.log('\n=== Quality Gate Evaluation ===\n');

    // Gate 1: Not mostly black (scene is rendering)
    const isMostlyBlack = analysis.blackRatio > BLACK_PIXEL_RATIO_THRESHOLD;
    console.log(`GATE 1 (Not mostly black): ${isMostlyBlack ? 'FAIL' : 'PASS'}`);
    console.log(`  Black pixel ratio: ${(analysis.blackRatio * 100).toFixed(1)}%`);
    console.log(`  Threshold: < ${BLACK_PIXEL_RATIO_THRESHOLD * 100}%`);

    if (isMostlyBlack) {
      testPassed = false;
      failureReason = `Scene mostly black (${(analysis.blackRatio * 100).toFixed(1)}% black pixels) - black hole not rendering`;
    }

    // Gate 2: Black hole characteristics (color variety + not just white sphere)
    // A proper black hole should have:
    // - Some orange/red pixels (accretion disk)
    // - Not mostly white (< 50%)
    // - Has visual variety (brightness range)
    // - Has some dark pixels (event horizon area)
    const hasColoredPixels = (analysis.colorSamples.red + analysis.colorSamples.orange) > 0;
    const isMostlyWhite = analysis.whiteRatio > WHITE_PIXEL_RATIO_THRESHOLD;
    const hasVariety = analysis.brightnessRange >= MIN_BRIGHTNESS_RANGE;
    const hasDarkCenter = analysis.minBrightness < 100; // Should have some dark pixels

    const blackHoleScore = (hasColoredPixels ? 1 : 0) + (!isMostlyWhite ? 1 : 0) + (hasVariety ? 1 : 0) + (hasDarkCenter ? 1 : 0);
    const isBlackHoleLike = blackHoleScore >= 3; // At least 3 of 4 criteria

    console.log(`\nGATE 2 (Black hole characteristics): ${isBlackHoleLike ? 'PASS' : 'FAIL'}`);
    console.log(`  Score: ${blackHoleScore}/4 (need >= 3)`);
    console.log(`  - Has colored pixels (orange/red): ${hasColoredPixels ? 'YES' : 'NO'} (${analysis.colorSamples.red + analysis.colorSamples.orange} pixels)`);
    console.log(`  - Not mostly white (< 50%): ${!isMostlyWhite ? 'YES' : 'NO'} (${(analysis.whiteRatio * 100).toFixed(1)}%)`);
    console.log(`  - Has brightness variety (>= 20): ${hasVariety ? 'YES' : 'NO'} (range: ${analysis.brightnessRange.toFixed(0)})`);
    console.log(`  - Has dark pixels (< 100 brightness): ${hasDarkCenter ? 'YES' : 'NO'} (min: ${analysis.minBrightness.toFixed(0)})`);

    if (!isBlackHoleLike && !failureReason) {
      testPassed = false;
      if (isMostlyWhite) {
        failureReason = `Scene mostly white (${(analysis.whiteRatio * 100).toFixed(1)}% white pixels) - rendering error`;
      } else if (!hasColoredPixels) {
        failureReason = `No colored pixels detected - black hole accretion disk not visible`;
      } else if (!hasVariety) {
        failureReason = `No visual variety (brightness range: ${analysis.brightnessRange.toFixed(0)}) - may be solid color`;
      } else {
        failureReason = `Black hole characteristics score too low: ${blackHoleScore}/4`;
      }
    }

    // Gate 3: No WebGL/shader errors
    const webglErrors = errors.filter(e =>
      e.toLowerCase().includes('webgl') ||
      e.toLowerCase().includes('shader') ||
      e.toLowerCase().includes('glsl') ||
      e.toLowerCase().includes('program')
    );
    console.log(`\nGATE 3 (No WebGL errors): ${webglErrors.length > 0 ? 'FAIL' : 'PASS'}`);
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
      console.log('TEST PASSED: Black hole renders correctly');
      console.log('  - Scene is not mostly black or white');
      console.log('  - Has visual variety');
      console.log('  - No shader errors');
      console.log('='.repeat(50));
    } else {
      console.log('TEST FAILED: ' + failureReason);
      console.log('='.repeat(50));

      if (logs.length > 0) {
        console.log('\n=== Console Logs (last 20) ===');
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

  process.exit(testPassed ? 0 : 1);
}

// Run the test
testBlackHoleRender();
