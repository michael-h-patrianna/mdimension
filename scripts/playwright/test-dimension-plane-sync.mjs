/**
 * Test for dimension-plane synchronization bug fix
 * 
 * Bug: When switching from 8D to Mandelbulb (4D), invalid rotation planes
 * like "XV" caused an error: "Invalid plane name 'XV' for 4D space"
 * 
 * This test verifies that the fix properly filters out invalid planes
 * when dimension changes.
 */

import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3000';

async function runTest() {
  console.log('🧪 Testing dimension-plane synchronization fix...\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Collect console errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  // Catch page errors
  const pageErrors = [];
  page.on('pageerror', err => {
    pageErrors.push(err.message);
  });

  try {
    // Navigate to the app
    console.log('📍 Navigating to app...');
    await page.goto(BASE_URL, { timeout: 30000 });
    await page.waitForTimeout(2000);

    // Wait for the canvas to load
    await page.waitForSelector('canvas', { timeout: 10000 });
    console.log('✅ Canvas loaded');

    // First, switch to hypercube (available in all dimensions)
    console.log('\n📦 Switching to hypercube...');
    await page.evaluate(() => {
      const { useGeometryStore } = window;
      if (useGeometryStore) {
        useGeometryStore.getState().setObjectType('hypercube');
      }
    });
    await page.waitForTimeout(500);

    // Set dimension to 8D
    console.log('🔢 Setting dimension to 8D...');
    await page.evaluate(() => {
      const { useGeometryStore } = window;
      if (useGeometryStore) {
        useGeometryStore.getState().setDimension(8);
      }
    });
    await page.waitForTimeout(500);

    // Verify we're at 8D
    const dim8 = await page.evaluate(() => {
      const { useGeometryStore } = window;
      return useGeometryStore?.getState().dimension;
    });
    console.log(`✅ Dimension set to: ${dim8}D`);

    // Animate all planes (this adds 8D planes like XV, XU, etc.)
    console.log('🔄 Animating all rotation planes (28 planes for 8D)...');
    await page.evaluate(() => {
      const { useAnimationStore } = window;
      if (useAnimationStore) {
        useAnimationStore.getState().animateAll(8);
      }
    });
    await page.waitForTimeout(500);

    // Check we have 8D planes
    const planesCount8D = await page.evaluate(() => {
      const { useAnimationStore } = window;
      return useAnimationStore?.getState().animatingPlanes.size;
    });
    console.log(`✅ Animating ${planesCount8D} planes`);

    // Check for XV plane specifically (the plane that caused the bug)
    const hasXV = await page.evaluate(() => {
      const { useAnimationStore } = window;
      return useAnimationStore?.getState().animatingPlanes.has('XV');
    });
    console.log(`✅ XV plane present: ${hasXV}`);

    // Wait a bit for animation to run
    console.log('\n⏳ Running animation for 2 seconds...');
    await page.waitForTimeout(2000);

    // Now switch to Mandelbulb (which forces 4D)
    console.log('\n🌀 Switching to Mandelbulb (forces 4D)...');
    const switchResult = await page.evaluate(() => {
      try {
        const { useGeometryStore } = window;
        if (useGeometryStore) {
          useGeometryStore.getState().setObjectType('mandelbulb');
        }
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });
    
    if (!switchResult.success) {
      console.error(`❌ Error during switch: ${switchResult.error}`);
    } else {
      console.log('✅ Switch initiated');
    }

    // Wait for the switch to complete
    await page.waitForTimeout(1000);

    // Verify dimension changed to 4D
    const dim4 = await page.evaluate(() => {
      const { useGeometryStore } = window;
      return useGeometryStore?.getState().dimension;
    });
    console.log(`✅ Dimension now: ${dim4}D`);

    // Check plane count after switch
    const planesCount4D = await page.evaluate(() => {
      const { useAnimationStore } = window;
      return useAnimationStore?.getState().animatingPlanes.size;
    });
    console.log(`✅ Animating ${planesCount4D} planes after switch`);

    // Verify XV is gone
    const hasXVAfter = await page.evaluate(() => {
      const { useAnimationStore } = window;
      return useAnimationStore?.getState().animatingPlanes.has('XV');
    });
    console.log(`✅ XV plane present after switch: ${hasXVAfter}`);

    // Wait for animation loop to run (this is where the error would occur)
    console.log('\n⏳ Running animation for 3 seconds (this is where the error would occur)...');
    await page.waitForTimeout(3000);

    // Check for errors
    console.log('\n📋 Checking for errors...');
    
    const invalidPlaneErrors = errors.filter(e => e.includes('Invalid plane name'));
    const pageInvalidPlaneErrors = pageErrors.filter(e => e.includes('Invalid plane name'));

    if (invalidPlaneErrors.length > 0 || pageInvalidPlaneErrors.length > 0) {
      console.error('❌ FAILED: Invalid plane name errors found:');
      [...invalidPlaneErrors, ...pageInvalidPlaneErrors].forEach(e => console.error(`   ${e}`));
      process.exitCode = 1;
    } else {
      console.log('✅ No "Invalid plane name" errors!');
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Initial dimension: 8D`);
    console.log(`Initial planes: ${planesCount8D}`);
    console.log(`After switch dimension: ${dim4}D`);
    console.log(`After switch planes: ${planesCount4D}`);
    console.log(`XV plane removed: ${hasXV && !hasXVAfter ? 'YES ✅' : 'NO ❌'}`);
    console.log(`Console errors: ${errors.length}`);
    console.log(`Page errors: ${pageErrors.length}`);
    
    if (planesCount4D !== 6) {
      console.error(`❌ Expected 6 planes for 4D, got ${planesCount4D}`);
      process.exitCode = 1;
    }
    
    if (hasXVAfter) {
      console.error('❌ XV plane should not exist in 4D');
      process.exitCode = 1;
    }

    if (!process.exitCode) {
      console.log('\n✅ TEST PASSED: Bug fix verified!');
    } else {
      console.log('\n❌ TEST FAILED');
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

runTest();

