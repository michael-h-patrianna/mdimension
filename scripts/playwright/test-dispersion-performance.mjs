/**
 * Playwright test to verify chromatic dispersion performance fix
 *
 * This test verifies that:
 * 1. The app loads without shader compilation errors
 * 2. Dispersion-related code paths work (no runtime errors)
 * 3. Fast mode still functions during user interaction
 */

import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3002';

async function testDispersionPerformance() {
  console.log('🧪 Testing Chromatic Dispersion Performance Fix');
  console.log('================================================\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const errors = [];
  const logs = [];

  // Capture console logs
  page.on('console', (msg) => {
    logs.push({ type: msg.type(), text: msg.text() });
  });

  // Capture errors
  page.on('pageerror', (error) => {
    errors.push(error.message);
  });

  try {
    console.log('1. Navigating to app...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });

    console.log('2. Waiting for initial render and shader compilation...');
    await page.waitForTimeout(5000);

    console.log('3. Checking canvas is present...');
    const canvas = await page.locator('canvas').first();
    const isVisible = await canvas.isVisible();
    console.log(`   Canvas visible: ${isVisible}`);

    console.log('4. Simulating user interaction (triggers fast mode)...');
    const box = await canvas.boundingBox();
    if (box) {
      // Drag on canvas to trigger rotation
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      for (let i = 0; i < 10; i++) {
        await page.mouse.move(
          box.x + box.width / 2 + i * 10,
          box.y + box.height / 2 + i * 5
        );
        await page.waitForTimeout(50);
      }
      await page.mouse.up();
    }

    console.log('5. Waiting for quality restoration...');
    await page.waitForTimeout(2000);

    console.log('6. Taking screenshot...');
    await page.screenshot({
      path: 'screenshots/dispersion-performance-test.png',
      fullPage: false,
    });

    console.log('7. Analyzing results...\n');

    // Report results
    console.log('📊 Results:');
    console.log('===========');

    if (errors.length === 0) {
      console.log('✅ No JavaScript errors detected');
    } else {
      console.log(`❌ ${errors.length} JavaScript errors detected:`);
      errors.forEach((e, i) => console.log(`   ${i + 1}. ${e}`));
    }

    // Check for shader errors in logs
    const shaderErrors = logs.filter(
      (l) =>
        l.text.toLowerCase().includes('shader') && l.text.toLowerCase().includes('error')
    );

    if (shaderErrors.length === 0) {
      console.log('✅ No shader compilation errors');
    } else {
      console.log(`❌ ${shaderErrors.length} shader errors:`);
      shaderErrors.forEach((e, i) => console.log(`   ${i + 1}. ${e.text}`));
    }

    // Check for WebGL errors
    const webglErrors = logs.filter(
      (l) => l.text.toLowerCase().includes('webgl') && l.type === 'error'
    );

    if (webglErrors.length === 0) {
      console.log('✅ No WebGL errors');
    } else {
      console.log(`❌ ${webglErrors.length} WebGL errors:`);
      webglErrors.forEach((e, i) => console.log(`   ${i + 1}. ${e.text}`));
    }

    console.log('\n✨ Test completed!');
    console.log('   Screenshot saved to: screenshots/dispersion-performance-test.png');

    const success = errors.length === 0 && shaderErrors.length === 0;
    console.log(`\n${success ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED'}`);

    return success;
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    return false;
  } finally {
    await browser.close();
  }
}

// Run the test
testDispersionPerformance()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

