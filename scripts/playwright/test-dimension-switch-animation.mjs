/**
 * Test for bug fix: Switching dimensions while animation is running
 *
 * Bug: If animation was running with 10D planes (like XA6), switching to 6D
 * would throw "Invalid plane XA6 for 6D space" and freeze the app.
 *
 * Fix: animationStore.setDimension() filters out invalid planes when dimension changes.
 */
import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  // Track console errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  page.on('pageerror', err => {
    errors.push(err.message);
  });

  console.log('Testing dimension switch while animation is running...\n');

  try {
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(2000);

    // Step 1: Select 10D
    console.log('1. Selecting 10D...');
    const dim10Button = page.locator('button:has-text("10D")');
    await dim10Button.click();
    await page.waitForTimeout(500);

    // Step 2: Click "Animate All" to start animating all 45 planes
    console.log('2. Clicking "Animate All" to animate all 45 planes...');
    const animateAllButton = page.locator('button:has-text("Animate All")');
    if (await animateAllButton.count() > 0) {
      await animateAllButton.click();
      await page.waitForTimeout(1000);
    } else {
      // Try clicking Play if Animate All isn't visible
      const playButton = page.locator('button:has-text("Play")');
      if (await playButton.count() > 0) {
        await playButton.click();
        await page.waitForTimeout(1000);
      }
    }

    // Step 3: Switch to 6D while animation is running
    console.log('3. Switching to 6D while animation is running...');
    const dim6Button = page.locator('button:has-text("6D")');
    await dim6Button.click();
    await page.waitForTimeout(1500);

    // Step 4: Check for errors
    if (errors.length > 0) {
      console.log('\n❌ FAIL: Errors detected:');
      errors.forEach(err => console.log(`   - ${err}`));
      process.exit(1);
    }

    // Step 5: Verify app is still responsive by clicking another dimension
    console.log('4. Verifying app is still responsive...');
    const dim4Button = page.locator('button:has-text("4D")');
    await dim4Button.click();
    await page.waitForTimeout(500);

    // Step 6: Verify the canvas is still rendering
    const canvas = page.locator('canvas');
    const canvasVisible = await canvas.isVisible();

    if (!canvasVisible) {
      console.log('\n❌ FAIL: Canvas is not visible - app may have crashed');
      process.exit(1);
    }

    console.log('\n✅ PASS: Dimension switch with animation running works correctly!');
    console.log('   - No errors thrown');
    console.log('   - App remains responsive');
    console.log('   - Canvas continues rendering');

  } catch (error) {
    console.log(`\n❌ FAIL: ${error.message}`);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
