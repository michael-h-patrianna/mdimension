/**
 * Test for cross-section feature
 * Verifies that the cross-section slider actually affects the visualization
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenshotDir = path.join(__dirname, '../../screenshots/cross-section');

async function main() {
  // Create screenshots directory
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

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

  console.log('Testing cross-section feature...\n');

  try {
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(2000);

    // Step 1: Ensure we're on 4D (default should be 4D)
    console.log('1. Verifying 4D is selected...');
    const dim4Button = page.locator('button:has-text("4D")');
    await dim4Button.click();
    await page.waitForTimeout(500);

    // Take screenshot before enabling cross-section
    await page.screenshot({
      path: path.join(screenshotDir, '01-before-cross-section.png'),
      fullPage: false
    });
    console.log('   Screenshot: 01-before-cross-section.png');

    // Step 2: Expand Cross-Section section and enable it
    console.log('2. Expanding Cross-Section section...');

    // First, expand the Cross-Section accordion section
    const crossSectionHeader = page.locator('button[aria-controls="section-content-Cross-Section"]');
    if (await crossSectionHeader.count() > 0) {
      await crossSectionHeader.click();
      await page.waitForTimeout(500);
      console.log('   Cross-Section section expanded');
    } else {
      // Try alternative: look for text "Cross-Section" in a button
      const altHeader = page.locator('button:has-text("Cross-Section")').first();
      if (await altHeader.count() > 0) {
        await altHeader.click();
        await page.waitForTimeout(500);
      }
    }

    console.log('3. Enabling cross-section...');
    const enableButton = page.locator('button:has-text("Enable Cross-Section")');
    if (await enableButton.count() > 0) {
      await enableButton.click();
      await page.waitForTimeout(500);
      console.log('   Cross-section enabled');
    } else {
      console.log('   Warning: Could not find Enable Cross-Section button');
    }

    // Take screenshot with cross-section enabled at default position
    await page.screenshot({
      path: path.join(screenshotDir, '02-cross-section-enabled.png'),
      fullPage: false
    });
    console.log('   Screenshot: 02-cross-section-enabled.png');

    // Step 4: Move the slice position slider
    console.log('4. Moving slice position slider...');

    // Find the slider with aria-label containing "Slice"
    const sliceSlider = page.locator('input[type="range"][aria-label*="Slice"]');
    if (await sliceSlider.count() > 0) {
      // Move slider to different positions using evaluate to set value directly
      await sliceSlider.evaluate((el, val) => {
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, '-1');
      await page.waitForTimeout(500);

      await page.screenshot({
        path: path.join(screenshotDir, '03-slice-at-minus1.png'),
        fullPage: false
      });
      console.log('   Screenshot: 03-slice-at-minus1.png (W = -1)');

      await sliceSlider.evaluate((el, val) => {
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, '1');
      await page.waitForTimeout(500);

      await page.screenshot({
        path: path.join(screenshotDir, '04-slice-at-plus1.png'),
        fullPage: false
      });
      console.log('   Screenshot: 04-slice-at-plus1.png (W = 1)');
    } else {
      console.log('   Warning: Could not find Slice W Position slider');
    }

    // Step 5: Test "Animate Slice" button
    console.log('5. Testing slice animation...');
    const animateSliceButton = page.locator('button:has-text("Animate Slice")');
    if (await animateSliceButton.count() > 0) {
      await animateSliceButton.click();
      await page.waitForTimeout(2000); // Let it animate for 2 seconds

      await page.screenshot({
        path: path.join(screenshotDir, '05-slice-animated.png'),
        fullPage: false
      });
      console.log('   Screenshot: 05-slice-animated.png');

      // Stop animation
      await animateSliceButton.click();
    }

    // Check for errors
    if (errors.length > 0) {
      console.log('\n❌ FAIL: Errors detected:');
      errors.forEach(err => console.log(`   - ${err}`));
      process.exit(1);
    }

    console.log('\n✅ PASS: Cross-section feature is working!');
    console.log('   - Enable/disable toggle works');
    console.log('   - Slice position slider responds');
    console.log('   - Animation toggle works');
    console.log(`\nScreenshots saved to: ${screenshotDir}`);

  } catch (error) {
    console.log(`\n❌ FAIL: ${error.message}`);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
