/**
 * Verify that the Advanced Rendering section with gravitational lensing
 * controls is visible for Wythoff, Root System, and Torus object types.
 */
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3002';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture console logs
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log(`[Browser Error] ${msg.text()}`);
    }
  });

  try {
    console.log('Navigating to app...');
    await page.goto(BASE_URL);
    await page.waitForTimeout(3000); // Wait for initial load

    // Click Toggle Inspector to open right panel
    console.log('Opening right panel...');
    const toggleRightPanel = page.locator('[data-testid="toggle-right-panel"]');
    await toggleRightPanel.click();
    await page.waitForTimeout(500);

    // Open left panel
    console.log('Opening left panel...');
    const toggleLeftPanel = page.locator('[data-testid="toggle-left-panel"]');
    await toggleLeftPanel.click();
    await page.waitForTimeout(500);

    // Object types to test
    const testCases = [
      { type: 'clifford-torus', label: 'Clifford Torus' },
      { type: 'nested-torus', label: 'Nested Torus' },
      { type: 'root-system', label: 'Root System' },
      { type: 'wythoff-polytope', label: 'Wythoff Polytope' },
    ];

    let allPassed = true;

    for (const { type, label } of testCases) {
      console.log(`\nTesting ${label}...`);
      
      // Find and click on the object type button
      const objectTypeButton = page.locator(`[data-testid="object-type-${type}"]`);
      
      if (await objectTypeButton.count() > 0) {
        await objectTypeButton.click();
        await page.waitForTimeout(1500); // Wait for geometry to load
      } else {
        console.log(`  WARNING: Could not find selector for ${label}`);
        allPassed = false;
        continue;
      }

      // Check if Advanced Rendering section exists
      const advancedSection = page.locator('[data-testid="advanced-object-controls"]');
      const advancedSectionExists = await advancedSection.count() > 0;

      // Check if Gravitational Lensing toggle exists
      const gravityToggle = page.locator('[data-testid="gravity-toggle"]');
      const gravityToggleExists = await gravityToggle.count() > 0;

      if (advancedSectionExists && gravityToggleExists) {
        console.log(`  ✓ ${label}: Advanced section with gravity controls FOUND`);
      } else {
        console.log(`  ✗ ${label}: Advanced section: ${advancedSectionExists}, Gravity toggle: ${gravityToggleExists}`);
        allPassed = false;
      }
    }

    console.log('\n' + '='.repeat(50));
    if (allPassed) {
      console.log('✓ All tests PASSED!');
    } else {
      console.log('✗ Some tests FAILED');
      process.exitCode = 1;
    }

  } catch (error) {
    console.error('Test failed:', error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
