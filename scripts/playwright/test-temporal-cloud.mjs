/**
 * Test script for temporal cloud accumulation quality gates
 *
 * Quality Gate Requirements:
 * - QG1: With object rendering disabled, center pixel should NOT be black (background visible)
 * - QG2: With object rendering active, temporal debug buffer center vs (1,1) pixels should have different colors
 */

import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3000';

async function main() {
  console.log('Starting temporal cloud quality gate test...\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Collect console messages
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[TEMPORAL DEBUG]')) {
      consoleLogs.push(text);
      console.log('Console:', text);
    }
  });

  try {
    // Navigate to the app
    console.log('Navigating to app...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // Wait for canvas to be ready
    await page.waitForSelector('canvas');
    console.log('Canvas found. Waiting for initial render...');

    // Wait for scene to be fully loaded
    await page.waitForTimeout(2000);

    // Check if Schrödinger is the selected object type
    // The app should already have it selected, but let's verify via console logs
    console.log('\nWaiting for temporal debug output...');

    // Wait for quality gate logs to appear
    let attempts = 0;
    const maxAttempts = 30;
    let qg1Passed = false;
    let qg2Passed = false;
    let cloudHasData = false;

    while (attempts < maxAttempts && (!qg1Passed || !qg2Passed)) {
      await page.waitForTimeout(1000);
      attempts++;

      // Check logs for quality gate results
      for (const log of consoleLogs) {
        if (log.includes('QUALITY_GATE_1_cornerNotBlack') && log.includes('PASS')) {
          qg1Passed = true;
        }
        if (log.includes('QUALITY_GATE_2') && log.includes('PASS')) {
          qg2Passed = true;
        }
        if (log.includes('CLOUD_HAS_DATA') && log.includes('YES')) {
          cloudHasData = true;
        }
      }

      if (cloudHasData && !qg1Passed && !qg2Passed) {
        console.log(`Attempt ${attempts}/${maxAttempts}: Cloud has data but gates not passed yet...`);
      }
    }

    console.log('\n=== TEST RESULTS ===');
    console.log(`Cloud has data: ${cloudHasData ? 'YES' : 'NO'}`);
    console.log(`Quality Gate 1 (corner not black): ${qg1Passed ? 'PASS' : 'FAIL'}`);
    console.log(`Quality Gate 2 (center vs corner different): ${qg2Passed ? 'PASS' : 'FAIL'}`);

    // Take multiple screenshots at different times
    const screenshotPath1 = 'screenshots/temporal-cloud-test-1.png';
    await page.screenshot({ path: screenshotPath1 });
    console.log(`\nScreenshot 1 saved to: ${screenshotPath1}`);

    await page.waitForTimeout(2000);
    const screenshotPath2 = 'screenshots/temporal-cloud-test-2.png';
    await page.screenshot({ path: screenshotPath2 });
    console.log(`Screenshot 2 saved to: ${screenshotPath2}`);

    // Print all relevant console logs
    console.log('\n=== TEMPORAL DEBUG LOGS ===');
    const uniqueLogs = [...new Set(consoleLogs)];
    uniqueLogs.forEach(log => console.log(log));

    if (cloudHasData && qg1Passed && qg2Passed) {
      console.log('\n✅ ALL QUALITY GATES PASSED!');
    } else if (cloudHasData) {
      console.log('\n⚠️  Cloud has data but quality gates need verification.');
    } else {
      console.log('\n❌ Cloud render target is empty - fix needed.');
    }

  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
