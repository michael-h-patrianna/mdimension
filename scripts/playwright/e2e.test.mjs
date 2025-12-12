/**
 * E2E Tests for N-Dimensional Visualizer
 * Uses Playwright to verify the app works correctly
 */
import { chromium } from 'playwright';
import { strict as assert } from 'assert';

const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = 'screenshots/e2e';

async function runTests() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const errors = [];
  let testsRun = 0;
  let testsPassed = 0;

  // Capture page errors
  page.on('pageerror', (err) => {
    errors.push(`PAGE ERROR: ${err.message}`);
  });

  // Helper to run a test
  async function test(name, fn) {
    testsRun++;
    try {
      await fn();
      testsPassed++;
      console.log(`  ✓ ${name}`);
    } catch (err) {
      console.log(`  ✗ ${name}`);
      console.log(`    Error: ${err.message}`);
    }
  }

  // Helper to wait for no errors
  function assertNoErrors() {
    if (errors.length > 0) {
      const msg = `Page errors detected: ${errors.join(', ')}`;
      errors.length = 0; // Clear for next test
      throw new Error(msg);
    }
  }

  console.log('\n=== E2E Tests for N-Dimensional Visualizer ===\n');

  // Navigate to app
  console.log('Loading application...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000); // Wait for React to render

  console.log('\n[App Loading Tests]');

  await test('App loads without errors', async () => {
    assertNoErrors();
  });

  await test('Canvas element is present', async () => {
    const canvas = await page.locator('canvas').count();
    assert(canvas > 0, 'Expected canvas element to be present');
  });

  await test('Title is correct', async () => {
    const title = await page.title();
    assert(title.includes('N-Dimensional'), `Expected title to contain "N-Dimensional", got "${title}"`);
  });

  await test('Dimension selector is present', async () => {
    const selector = await page.locator('[data-testid="dimension-selector"]').count();
    assert(selector > 0, 'Expected dimension selector to be present');
  });

  await test('Object type selector is present', async () => {
    const selector = await page.locator('[data-testid="object-type-selector"]').count();
    assert(selector > 0, 'Expected object type selector to be present');
  });

  await test('Animation play button is present', async () => {
    const button = await page.locator('[data-testid="animation-play-button"]').count();
    assert(button > 0, 'Expected animation play button to be present');
  });

  // Take initial screenshot
  await page.screenshot({ path: `${SCREENSHOT_DIR}/01-initial-load.png`, fullPage: true });

  console.log('\n[Dimension Switching Tests]');

  await test('Can switch to 3D', async () => {
    errors.length = 0;
    await page.locator('[data-testid="dimension-selector-3"]').click();
    await page.waitForTimeout(500);
    assertNoErrors();
    // Verify the button is now selected (has cyan border)
    const button = page.locator('[data-testid="dimension-selector-3"]');
    const classes = await button.getAttribute('class');
    assert(classes?.includes('border-accent'), 'Expected 3D button to be selected');
  });

  await page.screenshot({ path: `${SCREENSHOT_DIR}/02-3d-mode.png`, fullPage: true });

  await test('Can switch to 5D', async () => {
    errors.length = 0;
    await page.locator('[data-testid="dimension-selector-5"]').click();
    await page.waitForTimeout(500);
    assertNoErrors();
  });

  await page.screenshot({ path: `${SCREENSHOT_DIR}/03-5d-mode.png`, fullPage: true });

  await test('Can switch to 6D', async () => {
    errors.length = 0;
    await page.locator('[data-testid="dimension-selector-6"]').click();
    await page.waitForTimeout(500);
    assertNoErrors();
  });

  await page.screenshot({ path: `${SCREENSHOT_DIR}/04-6d-mode.png`, fullPage: true });

  await test('Can switch back to 4D', async () => {
    errors.length = 0;
    await page.locator('[data-testid="dimension-selector-4"]').click();
    await page.waitForTimeout(500);
    assertNoErrors();
  });

  console.log('\n[Object Type Tests]');

  await test('Can switch to simplex', async () => {
    errors.length = 0;
    await page.locator('[data-testid="object-type-selector"]').selectOption('simplex');
    await page.waitForTimeout(500);
    assertNoErrors();
  });

  await page.screenshot({ path: `${SCREENSHOT_DIR}/05-simplex.png`, fullPage: true });

  await test('Can switch to cross-polytope', async () => {
    errors.length = 0;
    await page.locator('[data-testid="object-type-selector"]').selectOption('cross-polytope');
    await page.waitForTimeout(500);
    assertNoErrors();
  });

  await page.screenshot({ path: `${SCREENSHOT_DIR}/06-cross-polytope.png`, fullPage: true });

  await test('Can switch back to hypercube', async () => {
    errors.length = 0;
    await page.locator('[data-testid="object-type-selector"]').selectOption('hypercube');
    await page.waitForTimeout(500);
    assertNoErrors();
  });

  console.log('\n[Animation Tests]');

  await test('Can click play button without error', async () => {
    errors.length = 0;
    // First select a plane
    const xyButton = page.locator('button:has-text("XY")').first();
    await xyButton.click();
    await page.waitForTimeout(200);

    // Now click play
    await page.locator('[data-testid="animation-play-button"]').click();
    await page.waitForTimeout(1000); // Let animation run briefly
    assertNoErrors();
  });

  await page.screenshot({ path: `${SCREENSHOT_DIR}/07-animation-running.png`, fullPage: true });

  await test('Animation changes the view', async () => {
    // Take two screenshots 500ms apart and verify they differ
    // (This is a simple check that animation is working)
    const screenshot1 = await page.screenshot({ type: 'png' });
    await page.waitForTimeout(500);
    const screenshot2 = await page.screenshot({ type: 'png' });

    // Compare screenshots - they should be different if animation is running
    const different = !screenshot1.equals(screenshot2);
    assert(different, 'Expected animation to change the view');
  });

  await test('Can stop animation', async () => {
    errors.length = 0;
    await page.locator('[data-testid="animation-play-button"]').click();
    await page.waitForTimeout(200);
    assertNoErrors();
  });

  console.log('\n[All Dimension + Object Combinations]');

  const dimensions = ['3', '4', '5', '6'];
  const objectTypes = ['hypercube', 'simplex', 'cross-polytope'];

  for (const dim of dimensions) {
    for (const objType of objectTypes) {
      await test(`${dim}D ${objType} renders without error`, async () => {
        errors.length = 0;
        await page.locator(`[data-testid="dimension-selector-${dim}"]`).click();
        await page.waitForTimeout(100);
        await page.locator('[data-testid="object-type-selector"]').selectOption(objType);
        await page.waitForTimeout(300);
        assertNoErrors();

        // Verify canvas is still present and rendered
        const canvas = await page.locator('canvas').count();
        assert(canvas > 0, 'Canvas should still be present');
      });
    }
  }

  // Final state - 4D hypercube
  await page.locator('[data-testid="dimension-selector-4"]').click();
  await page.locator('[data-testid="object-type-selector"]').selectOption('hypercube');
  await page.screenshot({ path: `${SCREENSHOT_DIR}/08-final-state.png`, fullPage: true });

  // Summary
  console.log('\n=== Test Summary ===');
  console.log(`Tests: ${testsPassed}/${testsRun} passed`);

  if (testsPassed === testsRun) {
    console.log('\n✓ All tests passed!\n');
  } else {
    console.log(`\n✗ ${testsRun - testsPassed} test(s) failed\n`);
  }

  await browser.close();

  // Exit with error code if tests failed
  if (testsPassed !== testsRun) {
    process.exit(1);
  }
}

// Create screenshot directory
import { mkdirSync } from 'fs';
try {
  mkdirSync('screenshots/e2e', { recursive: true });
} catch (e) {
  // Directory may already exist
}

runTests().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
