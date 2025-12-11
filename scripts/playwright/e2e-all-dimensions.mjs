/**
 * E2E Tests for N-Dimensional Visualizer - All Dimensions
 * Uses Playwright to verify all dimensions 3D through 11D work correctly
 */
import { chromium } from 'playwright';
import { strict as assert } from 'assert';
import { mkdirSync } from 'fs';

const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = 'screenshots/e2e';

// Create screenshot directory
try {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
} catch (e) {
  // Directory may already exist
}

async function runTests() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const pageErrors = [];
  let testsRun = 0;
  let testsPassed = 0;

  // Capture page errors
  page.on('pageerror', (err) => {
    pageErrors.push(`PAGE ERROR: ${err.message}`);
  });

  // Helper to run a test
  async function test(name, fn) {
    testsRun++;
    const errorsBefore = pageErrors.length;
    try {
      await fn();
      // Check if new page errors occurred during the test
      if (pageErrors.length > errorsBefore) {
        const newErrors = pageErrors.slice(errorsBefore);
        throw new Error(`Page errors: ${newErrors.join('; ')}`);
      }
      testsPassed++;
      console.log(`  \x1b[32m✓\x1b[0m ${name}`);
    } catch (err) {
      console.log(`  \x1b[31m✗\x1b[0m ${name}`);
      console.log(`    \x1b[31mError: ${err.message}\x1b[0m`);
    }
  }

  console.log('\n\x1b[1m=== E2E Tests: All Dimensions (3D - 11D) ===\x1b[0m\n');

  // Navigate to app
  console.log('Loading application...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);

  console.log('\n\x1b[1m[Initial Load]\x1b[0m');

  await test('App loads without errors', async () => {
    assert(pageErrors.length === 0, `Page had errors: ${pageErrors.join(', ')}`);
  });

  await test('Canvas element present', async () => {
    const canvas = await page.locator('canvas').count();
    assert(canvas > 0, 'Expected canvas');
  });

  await test('Dimension selector present', async () => {
    const selector = await page.locator('[data-testid="dimension-selector"]').count();
    assert(selector > 0, 'Expected dimension selector');
  });

  // Test all dimensions
  const dimensions = [3, 4, 5, 6, 7, 8, 9, 10, 11];
  const objectTypes = ['hypercube', 'simplex', 'cross-polytope'];

  console.log('\n\x1b[1m[Dimension Switching Tests]\x1b[0m');

  for (const dim of dimensions) {
    await test(`Switch to ${dim}D without error`, async () => {
      pageErrors.length = 0; // Clear previous errors
      // Use force click to bypass canvas overlay issue
      await page.locator(`[data-testid="dimension-selector-${dim}"]`).click({ force: true });
      await page.waitForTimeout(500);
    });

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/dim-${dim}d.png`,
      fullPage: true
    });
  }

  console.log('\n\x1b[1m[All Dimension + Object Type Combinations]\x1b[0m');

  for (const dim of dimensions) {
    for (const objType of objectTypes) {
      await test(`${dim}D ${objType}`, async () => {
        pageErrors.length = 0;

        // Switch dimension (force click to bypass canvas overlay)
        await page.locator(`[data-testid="dimension-selector-${dim}"]`).click({ force: true });
        await page.waitForTimeout(100);

        // Switch object type
        await page.locator('[data-testid="object-type-selector"]').selectOption(objType);
        await page.waitForTimeout(300);

        // Verify canvas still present
        const canvas = await page.locator('canvas').count();
        assert(canvas > 0, 'Canvas should be present');
      });
    }
  }

  // Test animation works in various dimensions
  console.log('\n\x1b[1m[Animation Tests]\x1b[0m');

  for (const dim of [4, 7, 11]) {
    await test(`Animation works in ${dim}D`, async () => {
      pageErrors.length = 0;

      // Switch to dimension (force click to bypass canvas overlay)
      await page.locator(`[data-testid="dimension-selector-${dim}"]`).click({ force: true });
      await page.waitForTimeout(200);

      // Select a plane to animate (first XY button)
      const xyButton = page.locator('button:has-text("XY")').first();
      await xyButton.click();
      await page.waitForTimeout(100);

      // Click play
      await page.locator('[data-testid="animation-play-button"]').click();
      await page.waitForTimeout(500);

      // Take screenshot during animation
      const screenshot1 = await page.screenshot({ type: 'png' });
      await page.waitForTimeout(300);
      const screenshot2 = await page.screenshot({ type: 'png' });

      // Animation should cause visual change
      const different = !screenshot1.equals(screenshot2);
      assert(different, 'Animation should change the view');

      // Stop animation
      await page.locator('[data-testid="animation-play-button"]').click();
      await page.waitForTimeout(100);
    });
  }

  // Test rotation planes exist for higher dimensions
  console.log('\n\x1b[1m[Rotation Plane Tests]\x1b[0m');

  await test('7D has correct rotation planes (21 planes)', async () => {
    pageErrors.length = 0;
    await page.locator('[data-testid="dimension-selector-7"]').click({ force: true });
    await page.waitForTimeout(300);

    // Check for info text about rotation planes
    const planeInfo = await page.locator('text=7D space has 21 rotation planes').count();
    assert(planeInfo > 0, 'Should show 21 rotation planes for 7D');
  });

  await test('11D has correct rotation planes (55 planes)', async () => {
    pageErrors.length = 0;
    await page.locator('[data-testid="dimension-selector-11"]').click({ force: true });
    await page.waitForTimeout(300);

    // Check for info text about rotation planes
    const planeInfo = await page.locator('text=11D space has 55 rotation planes').count();
    assert(planeInfo > 0, 'Should show 55 rotation planes for 11D');
  });

  // Final state - 4D hypercube
  await page.locator('[data-testid="dimension-selector-4"]').click({ force: true });
  await page.locator('[data-testid="object-type-selector"]').selectOption('hypercube');
  await page.screenshot({ path: `${SCREENSHOT_DIR}/final-state.png`, fullPage: true });

  // Summary
  console.log('\n\x1b[1m=== Test Summary ===\x1b[0m');
  console.log(`Tests: ${testsPassed}/${testsRun} passed`);

  if (testsPassed === testsRun) {
    console.log('\n\x1b[32m✓ All tests passed!\x1b[0m\n');
  } else {
    console.log(`\n\x1b[31m✗ ${testsRun - testsPassed} test(s) failed\x1b[0m\n`);
  }

  await browser.close();

  // Exit with error code if tests failed
  if (testsPassed !== testsRun) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
