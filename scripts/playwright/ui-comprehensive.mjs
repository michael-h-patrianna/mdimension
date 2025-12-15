import { chromium } from 'playwright';
import { strict as assert } from 'assert';
import { mkdirSync } from 'fs';

const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = '/Users/Spare/.gemini/tmp/ac85140e3a55d728d11c7ee24bbf67459d410d2bacc1a36da1b88478140f8365';

try {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
} catch (e) {}

async function runTests() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();
  
  // Handle Dialogs
  page.on('dialog', async dialog => {
      console.log(`Dialog message: ${dialog.message()}`);
      if (dialog.message().includes('Enter a name')) {
          await dialog.accept('Test Preset');
      } else {
          await dialog.dismiss();
      }
  });

  const errors = [];
  let testsRun = 0;
  let testsPassed = 0;

  page.on('pageerror', (err) => errors.push(`PAGE ERROR: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`CONSOLE ERROR: ${msg.text()}`);
  });

  async function test(name, fn) {
    testsRun++;
    console.log(`Running: ${name}...`);
    try {
      await fn();
      testsPassed++;
      console.log(`  ✓ PASSED`);
    } catch (err) {
      console.log(`  ✗ FAILED`);
      console.log(`    Error: ${err.message}`);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/FAIL-${name.replace(/ /g, '_')}.png` });
    }
  }

  function assertNoErrors() {
    if (errors.length > 0) {
      const msg = `Page errors detected: ${errors.join(', ')}`;
      errors.length = 0; 
      throw new Error(msg);
    }
  }

  console.log('\n=== UI Comprehensive Tests ===\n');

  try {
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000); 
  } catch (e) {
      console.error('Failed to load page:', e.message);
      process.exit(1);
  }

  await test('UI Components Load', async () => {
    assert(await page.getByTestId('top-bar').isVisible(), 'Top bar not visible');
    assert(await page.getByTestId('left-panel-tabs').isVisible(), 'Left panel not visible');
    assert(await page.getByTestId('view-control-performance-monitor').isVisible(), 'Perf button not visible');
  });

  await test('Sidebar Toggles', async () => {
      const leftToggle = page.getByTestId('toggle-left-panel');
      
      // Toggle OFF
      await leftToggle.click({ force: true });
      await page.waitForTimeout(1500); 
      
      const leftPanel = page.getByTestId('left-panel-tabs');
      if (await leftPanel.isVisible()) {
          const width = await leftPanel.evaluate(el => {
              return el.closest('.overflow-hidden')?.getBoundingClientRect().width;
          });
          // Tolerance for animation
          if (width > 20) throw new Error(`Left panel width is ${width}, should be ~0`);
      }
      
      // Toggle ON
      await leftToggle.click({ force: true });
      await page.waitForTimeout(1500);
      assert(await page.getByTestId('left-panel-tabs').isVisible(), 'Left panel should be visible');
  });

  await test('Dimensions Switching', async () => {
     // Scroll to top of Left Panel first
     const leftPanel = page.getByTestId('left-panel-tabs');
     await leftPanel.evaluate(el => el.scrollTop = 0);
     
     await page.waitForTimeout(500);

     await page.getByTestId('dimension-selector-3').click({ force: true });
     await page.waitForTimeout(500);
     const is3D = await page.getByTestId('dimension-selector-3').getAttribute('aria-checked');
     assert.equal(is3D, 'true', '3D should be selected');
     
     await page.getByTestId('dimension-selector-4').click({ force: true });
     await page.waitForTimeout(500);
     const is4D = await page.getByTestId('dimension-selector-4').getAttribute('aria-checked');
     assert.equal(is4D, 'true', '4D should be selected');
  });

  await test('Faces Section Interaction', async () => {
      // Ensure we are in a state where Faces section is available
      // It's in the Left Panel -> Geometry Tab -> Object Settings -> Faces Section?
      // Wait, FacesSection is only visible if `facesVisible` is true.
      
      // Check tabs in left panel
      const geometryTab = page.locator('button[role="tab"]').filter({ hasText: 'Geometry' });
      if (await geometryTab.isVisible()) {
          await geometryTab.click({ force: true });
          await page.waitForTimeout(500);
      }
      
      const facesSection = page.getByTestId('section-faces');
      if (await facesSection.isVisible()) {
           // Find Opacity Slider Input
          const opacityInput = page.getByTestId('slider-face-opacity-input');
          if (await opacityInput.isVisible()) {
              await opacityInput.fill('0.8');
              await opacityInput.press('Enter');
              await page.waitForTimeout(200);
              assert.equal(await opacityInput.inputValue(), '0.8', 'Opacity input value should update');
          }
      } else {
          console.log('Faces section not visible, skipping interaction test');
      }
  });

  await test('View Controls & Perf Monitor', async () => {
      const perfBtn = page.getByTestId('view-control-performance-monitor');
      
      // Toggle ON
      await perfBtn.click({ force: true });
      await page.waitForTimeout(1000); 
      
      const fpsText = page.getByText('FPS', { exact: false });
      const visible = await fpsText.first().isVisible();
      assert(visible, 'Perf monitor should appear (checked "FPS" text)');
      
      // Toggle OFF
      await perfBtn.click({ force: true });
      await page.waitForTimeout(500);
      assert(!(await fpsText.first().isVisible()), 'Perf monitor should disappear');
  });

  await test('Shortcuts Overlay', async () => {
      await page.getByTestId('view-control-keyboard-shortcuts').click({ force: true });
      await page.waitForTimeout(1000);
      assert(await page.getByTestId('shortcuts-overlay').isVisible(), 'Shortcuts overlay should appear');
      
      await page.getByTestId('shortcuts-close').click({ force: true });
      await page.waitForTimeout(1000);
      assert(!(await page.getByTestId('shortcuts-overlay').isVisible()), 'Shortcuts overlay should close');
  });

  await test('Presets Manager', async () => {
      await page.getByTestId('menu-presets').click({ force: true });
      await page.getByTestId('preset-save-new').click({ force: true });
      await page.waitForTimeout(500);
      
      await page.getByTestId('menu-presets').click({ force: true });
      await page.waitForTimeout(200);
      
      const savedItem = page.getByText('Test Preset');
      assert(await savedItem.count() > 0, 'Saved preset should appear in menu');
  });

  console.log('\n=== Summary ===');
  console.log(`${testsPassed}/${testsRun} passed.`);
  
  await browser.close();
  if (testsPassed !== testsRun) process.exit(1);
}

runTests().catch(e => {
    console.error(e);
    process.exit(1);
});
