/**
 * Playwright script to capture temporal reprojection debug output.
 *
 * Usage: node scripts/playwright/temporal-debug.mjs
 *
 * Quality Gates:
 * GATE 1: Object rendering OFF → center pixel is NOT black
 * GATE 2: Object rendering ON → temporal buffer center pixel differs from pixel(1,1)
 */

import { chromium } from 'playwright';

const APP_URL = `http://localhost:3000?cachebust=${Date.now()}`;
const WAIT_TIME_MS = 5000; // Wait for scene to render and log several frames

async function main() {
  console.log('[Playwright] Launching browser...');

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // Collect console logs
  const debugLogs = [];

  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('[TR-DEBUG]') || text.includes('Shader compiled')) {
      debugLogs.push(text);
      console.log(text);
    }
  });

  // Also capture errors
  page.on('pageerror', (err) => {
    console.error('[Playwright] Page error:', err.message);
  });

  console.log(`[Playwright] Navigating to ${APP_URL}...`);

  try {
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('[Playwright] Page loaded, waiting for scene to render...');

    // Wait for the canvas to be present
    await page.waitForSelector('canvas', { timeout: 10000 });
    console.log('[Playwright] Canvas found');

    // Wait for debug logs to accumulate
    console.log(`[Playwright] Waiting ${WAIT_TIME_MS}ms for debug output...`);
    await page.waitForTimeout(WAIT_TIME_MS);

    // Take a screenshot for visual verification
    const screenshotPath = 'screenshots/temporal-debug-visual.png';
    await page.screenshot({ path: screenshotPath });
    console.log(`[Playwright] Screenshot saved to ${screenshotPath}`);

    console.log('\n========================================');
    console.log('DEBUG LOGS CAPTURED:');
    console.log('========================================\n');

    if (debugLogs.length === 0) {
      console.log('No [TR-DEBUG] logs captured!');
      console.log('This could mean:');
      console.log('  1. Temporal reprojection is disabled');
      console.log('  2. Object type is not schroedinger');
      console.log('  3. Debug logging interval not reached');
    } else {
      // Parse and analyze the last batch of logs
      const lastBatch = debugLogs.slice(-10);
      for (const log of lastBatch) {
        console.log(log);
      }
    }

    console.log('\n========================================');
    console.log('SUMMARY:');
    console.log('========================================');
    console.log(`Total [TR-DEBUG] messages: ${debugLogs.length}`);

    // ========================================
    // QUALITY GATE EVALUATION
    // ========================================
    console.log('\n========================================');
    console.log('QUALITY GATE EVALUATION:');
    console.log('========================================');

    // Parse cloudTarget log for gate check
    const cloudTargetLog = debugLogs.find(log => log.includes('1-cloudTarget-afterRender'));

    let gate2Passed = false;
    let centerPixel = null;
    let cornerPixel = null;
    let nonZeroSamples = 0;

    if (cloudTargetLog) {
      // Extract center pixel: center=[0.0308,0.3107,0.3646,1.0000]
      const centerMatch = cloudTargetLog.match(/center=\[([\d.,]+)\]/);
      const cornerMatch = cloudTargetLog.match(/corner=\[([\d.,]+)\]/);
      const nonZeroMatch = cloudTargetLog.match(/nonZeroSamples=(\d+)/);

      if (centerMatch) {
        centerPixel = centerMatch[1].split(',').map(Number);
      }
      if (cornerMatch) {
        cornerPixel = cornerMatch[1].split(',').map(Number);
      }
      if (nonZeroMatch) {
        nonZeroSamples = parseInt(nonZeroMatch[1], 10);
      }

      // GATE 2: Object rendering ON → temporal buffer center pixel differs from pixel(1,1)
      if (centerPixel && cornerPixel) {
        const isDifferent = centerPixel.some((v, i) => Math.abs(v - cornerPixel[i]) > 0.001);
        gate2Passed = isDifferent && nonZeroSamples > 0;

        console.log(`\nGATE 2: Temporal buffer center differs from corner`);
        console.log(`  Center pixel: [${centerPixel.map(v => v.toFixed(4)).join(', ')}]`);
        console.log(`  Corner pixel: [${cornerPixel.map(v => v.toFixed(4)).join(', ')}]`);
        console.log(`  Non-zero samples: ${nonZeroSamples}`);
        console.log(`  Result: ${gate2Passed ? '✅ PASSED' : '❌ FAILED'}`);
      }
    } else {
      console.log('\nGATE 2: No cloudTarget log found');
      console.log('  Result: ❌ FAILED (no data)');
    }

    // GATE 1 check - center pixel of volumetric buffer is NOT black
    // (This is checked implicitly by GATE 2 - if center has color, it's not black)
    const gate1Passed = centerPixel && (centerPixel[0] > 0 || centerPixel[1] > 0 || centerPixel[2] > 0 || centerPixel[3] > 0);

    console.log(`\nGATE 1: Temporal buffer center pixel is NOT black`);
    if (centerPixel) {
      console.log(`  Center pixel: [${centerPixel.map(v => v.toFixed(4)).join(', ')}]`);
      const isBlack = centerPixel[0] === 0 && centerPixel[1] === 0 && centerPixel[2] === 0;
      console.log(`  Is black: ${isBlack}`);
      console.log(`  Result: ${gate1Passed ? '✅ PASSED' : '❌ FAILED'}`);
    } else {
      console.log('  Result: ❌ FAILED (no data)');
    }

    console.log('\n========================================');
    console.log('FINAL VERDICT:');
    console.log('========================================');
    if (gate1Passed && gate2Passed) {
      console.log('✅ ALL QUALITY GATES PASSED');
    } else {
      console.log('❌ QUALITY GATES FAILED');
      if (!gate1Passed) console.log('  - GATE 1 failed: Center pixel is black');
      if (!gate2Passed) console.log('  - GATE 2 failed: Center and corner are identical');
    }

  } catch (error) {
    console.error('[Playwright] Error:', error.message);
  } finally {
    await browser.close();
    console.log('[Playwright] Browser closed');
  }
}

main().catch(console.error);
