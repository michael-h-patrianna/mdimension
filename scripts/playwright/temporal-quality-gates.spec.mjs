/**
 * Temporal Reprojection Quality Gate Tests
 *
 * Reads debug output from the browser console to verify:
 * 1. Quality Gate 1: Background visible (corner not black)
 * 2. Quality Gate 2: Temporal buffer shows object shape (center vs corner pixels different)
 */
import { test, expect } from 'playwright/test';

test('Temporal Reprojection Quality Gates', async ({ page }) => {
  test.setTimeout(60000); // Increase timeout to 60 seconds

  const debugLogs = [];

  // Capture console messages
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[TEMPORAL DEBUG]')) {
      console.log('CAPTURED:', text);
      debugLogs.push(text);
    }
  });

  // Navigate to app
  console.log('Navigating to app...');
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(2000); // Wait for initial load

  // Select Schrödinger object type via JavaScript (Zustand store)
  console.log('Setting Schrödinger object type via store...');
  await page.evaluate(() => {
    // Access the Zustand store directly
    const geometryStore = window.__ZUSTAND_STORES__?.geometry;
    if (geometryStore) {
      geometryStore.getState().setObjectType('schroedinger');
      console.log('Set objectType to schroedinger via store');
    } else {
      // Try alternative approach - dispatch an event that changes the object type
      console.log('Store not found, looking for alternative...');
    }
  });

  await page.waitForTimeout(1000);

  // Verify object type was set by checking the store
  const objectType = await page.evaluate(() => {
    const geometryStore = window.__ZUSTAND_STORES__?.geometry;
    return geometryStore?.getState()?.objectType;
  });
  console.log('Current object type:', objectType);

  // If store approach didn't work, try clicking in the UI
  if (objectType !== 'schroedinger') {
    console.log('Store approach failed, trying UI click...');
    try {
      // Scroll to find Schrödinger Slices in the type list
      await page.evaluate(() => {
        const panels = document.querySelectorAll('.overflow-y-auto');
        panels.forEach(p => p.scrollTop = p.scrollHeight);
      });
      await page.waitForTimeout(500);

      // Click on Schrödinger Slices
      await page.click('text=Schrödinger Slices', { timeout: 5000 });
      console.log('Clicked Schrödinger Slices');
    } catch (e) {
      console.log('UI click failed:', e.message);
    }
  }

  // Wait for temporal system to stabilize and emit debug logs
  console.log('Waiting for temporal debug output...');
  await page.waitForTimeout(10000); // Wait ~10 seconds for debug logs to appear

  console.log(`\n=== Captured ${debugLogs.length} debug logs ===\n`);

  // Parse the debug logs
  let qualityGate1Pass = false;
  let qualityGate2Pass = false;
  let accumulationAnalysis = null;
  let sceneAnalysis = null;

  for (const log of debugLogs) {
    console.log(log);

    // Check for Quality Gate 2 result from Accumulation Buffer
    if (log.includes('Accumulation Buffer Analysis')) {
      if (log.includes('QUALITY_GATE_2: PASS')) {
        qualityGate2Pass = true;
      }
      // Extract the analysis object
      const match = log.match(/Accumulation Buffer Analysis:\s*(\{[\s\S]*\})/);
      if (match) {
        try {
          // This is a simplified parse - the actual object is logged as JS object
          accumulationAnalysis = log;
        } catch (e) {}
      }
    }

    // Check for Quality Gate 1 result from Scene Target
    if (log.includes('Final Scene Target')) {
      if (log.includes('QUALITY_GATE_1_cornerNotBlack: PASS')) {
        qualityGate1Pass = true;
      }
      sceneAnalysis = log;
    }
  }

  console.log('\n=== QUALITY GATE RESULTS ===');
  console.log('Quality Gate 1 (Background visible):', qualityGate1Pass ? 'PASS ✓' : 'FAIL ✗');
  console.log('Quality Gate 2 (Object shape in temporal buffer):', qualityGate2Pass ? 'PASS ✓' : 'FAIL ✗');

  if (accumulationAnalysis) {
    console.log('\nAccumulation Buffer Details:', accumulationAnalysis);
  }
  if (sceneAnalysis) {
    console.log('\nScene Target Details:', sceneAnalysis);
  }

  // Take screenshot for visual verification
  await page.screenshot({ path: 'screenshots/temporal-quality-gates.png' });
  console.log('\nScreenshot saved to screenshots/temporal-quality-gates.png');

  // Assert quality gates
  expect(debugLogs.length, 'No temporal debug logs captured - is Schrödinger object type loaded?').toBeGreaterThan(0);
  expect(qualityGate1Pass, 'Quality Gate 1 FAILED: Background is black').toBe(true);
  expect(qualityGate2Pass, 'Quality Gate 2 FAILED: Temporal buffer does not show object shape').toBe(true);
});
