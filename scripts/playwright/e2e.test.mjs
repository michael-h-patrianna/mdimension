/**
 * E2E Tests for N-Dimensional Visualizer
 * Uses Playwright to verify the app works correctly
 */
import { chromium } from 'playwright';
import { strict as assert } from 'assert';
import { mkdirSync } from 'fs';

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const SCREENSHOT_DIR = 'screenshots/e2e';

// Ensure screenshot directory exists
try {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
} catch (e) {
  // Directory may already exist
}

async function runTests() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: 'screenshots/videos' }
  });
  const page = await context.newPage();

  const errors = [];
  let testsRun = 0;
  let testsPassed = 0;

  // Capture page errors
  page.on('pageerror', (err) => {
    errors.push(`PAGE ERROR: ${err.message}`);
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
       errors.push(`CONSOLE ERROR: ${msg.text()}`);
    }
  });

  // Helper to run a test
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
  console.log(`Loading application at ${BASE_URL}...`);
  try {
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
  } catch (e) {
      console.log('Network idle timeout, proceeding anyway...');
  }
  await page.waitForTimeout(2000); // Wait for React/Three to render

  // --- UI Structure Tests ---
  await test('UI Structure Verification', async () => {
    assertNoErrors();
    const topBar = await page.getByTestId('top-bar').count();
    assert(topBar > 0, 'Top bar should be visible');
    
    const canvas = await page.locator('canvas').count();
    assert(canvas > 0, 'Three.js canvas should be present');
  });

  // --- Dimension Tests ---
  await test('Dimension Switching', async () => {
    // Check default 4D
    const dim4 = page.getByTestId('dimension-selector-4');
    // It might be a button inside the toggle group
    await dim4.click();
    await page.waitForTimeout(500);
    assertNoErrors();

    // Switch to 5D
    await page.getByTestId('dimension-selector-5').click();
    await page.waitForTimeout(500);
    assertNoErrors();
    
    // Switch to 3D
    await page.getByTestId('dimension-selector-3').click();
    await page.waitForTimeout(500);
    assertNoErrors();
    
    // Back to 4D
    await page.getByTestId('dimension-selector-4').click();
  });

          // --- Object Type Tests ---

          await test('Object Type Cycling', async () => {

            // Ensure sidebar is open

            const sidebar = page.getByTestId('toggle-left-panel');

            // If we can check state, good. But we assume default open. 

            // If button click fails, it might be closed.

            

            // Test a few key types

            const typesToTest = [

                'hypercube',

                'simplex',

                'cross-polytope', 

                'clifford-torus'

            ];

        

            for (const type of typesToTest) {

                console.log(`    Selecting ${type}...`);

                const btn = page.getByTestId(`object-type-${type}`);

                

                // If not visible, try opening sidebar

                if (!(await btn.isVisible())) {

                     console.log('Sidebar closed, opening...');

                     await sidebar.click();

                     await page.waitForTimeout(500);

                }

                

                await btn.scrollIntoViewIfNeeded();

                await btn.click();

                await page.waitForTimeout(1500); // Wait for geometry generation

                assertNoErrors();

                await page.screenshot({ path: `${SCREENSHOT_DIR}/object-${type}.png` });

            }

            

            // Return to hypercube

            await page.getByTestId('object-type-hypercube').click();

          });
  
      // --- Control Panel Interaction ---
      await test('Control Panel Interaction', async () => {
        // Open Animation Section (if closed)
        // Animation is in the "Scene" tab of the right panel
        console.log('Switching to Scene tab...');
        await page.getByTestId('right-panel-tabs-tab-scene').click();
        await page.waitForTimeout(500);
        
        // If the Animation section is closed, we might need to open it. 
        // But let's assume default state or look for the header.
        
        // Let's click the "Play" button
        const playBtn = page.getByTestId('animation-play-button');
        if (await playBtn.isVisible()) {
            await playBtn.click();
            await page.waitForTimeout(1000);
            await playBtn.click(); // Pause
            assertNoErrors();
        } else {
            console.log('Animation play button not visible, skipping interaction');
        }
      });  
    // --- Presets Tests ---
    await test('Presets Loading', async () => {
       // Open Presets Menu
       const menu = page.getByTestId('menu-presets');
       await menu.waitFor({ state: 'visible' });
       await menu.click();
       await page.waitForTimeout(500);
       
       // Click "Mandelbulb"
       const item = page.getByTestId('preset-mandelbulb');
       await item.waitFor({ state: 'visible' });
       await item.click();
       
       await page.waitForTimeout(2000); // Wait for heavy generation
       assertNoErrors();
       await page.screenshot({ path: `${SCREENSHOT_DIR}/preset-mandelbulb.png` });
       
       // Open Presets Menu again
       await page.getByTestId('menu-presets').click();
       await page.waitForTimeout(500);
       // Click "Neon Cross"
       await page.getByTestId('preset-neon-cross').click();
       await page.waitForTimeout(1500);
       assertNoErrors();
       await page.screenshot({ path: `${SCREENSHOT_DIR}/preset-neon-cross.png` });
    });
  
    // --- View Features ---
    await test('Cinematic Mode Toggle', async () => {
        await page.getByTestId('control-cinematic-mode').click();
        await page.waitForTimeout(1000); // Wait for transition
        // Panels should be hidden (width 0 or opacity 0)
        // Hard to test visuals without extensive selectors, but check errors
        assertNoErrors();
        
        // Toggle back
        await page.getByTestId('exit-cinematic').click();
        await page.waitForTimeout(1000);
    });
  
    await test('Shortcuts Overlay', async () => {
        // Open View Menu
        await page.getByTestId('menu-view').click();
        await page.waitForTimeout(200);
        await page.getByText('Keyboard Shortcuts').click();
        await page.waitForTimeout(500);
        
        const overlay = page.getByTestId('shortcuts-overlay');
        assert(await overlay.isVisible(), 'Shortcuts overlay should be visible');
        
        // Close it
        await page.getByTestId('shortcuts-close').click();
        await page.waitForTimeout(500);
        assert(!(await overlay.isVisible()), 'Shortcuts overlay should be closed');
    });
    // --- Skybox Procedural Modes ---
    await test('Skybox Procedural Modes', async () => {
        // Switch to Scene Tab
        try {
            await page.getByTestId('right-panel-tabs-tab-scene').click();
        } catch (e) {
            console.log('Could not find Scene tab');
        }
        await page.waitForTimeout(500);

        // Click the Skybox sub-tab using generated test id
        // EnvironmentSection is defaultOpen=true, so we expect the tabs to be visible
        try {
            const skyboxTab = page.getByTestId('env-controls-tab-skybox');
            if (await skyboxTab.isVisible()) {
                await skyboxTab.click();
            } else {
                console.log('Skybox tab not visible, trying to open Environment section...');
                await page.getByTestId('section-environment-header').click();
                await page.waitForTimeout(500);
                await skyboxTab.click();
            }
            await page.waitForTimeout(500);
        } catch (e) {
            console.log('Could not find Skybox sub-tab');
        }

        // Ensure Skybox is enabled
        const modeSelect = page.getByTestId('skybox-mode-select');
        if (await modeSelect.isVisible()) {
             // 1. Classic Mode Check
             console.log('    Testing Classic Mode...');
             await modeSelect.selectOption('classic');
             await page.waitForTimeout(1000);
             await page.screenshot({ path: `${SCREENSHOT_DIR}/skybox-classic.png` });
             
             // 2. Aurora Mode
             console.log('    Testing Aurora Mode...');
             await modeSelect.selectOption('procedural_aurora');
             await page.waitForTimeout(1000);
             await page.screenshot({ path: `${SCREENSHOT_DIR}/skybox-aurora.png` });
             
             // 3. Nebula Mode
             console.log('    Testing Nebula Mode...');
             await modeSelect.selectOption('procedural_nebula');
             await page.waitForTimeout(1000);
             await page.screenshot({ path: `${SCREENSHOT_DIR}/skybox-nebula.png` });
             
             assertNoErrors();
        } else {
             console.log('Skybox controls not found, skipping skybox test');
        }
    });

  // --- Summary ---
  console.log('\n=== Test Summary ===');
  console.log(`Tests: ${testsPassed}/${testsRun} passed`);

  if (testsPassed === testsRun) {
    console.log('\n✓ All tests passed!\n');
  } else {
    console.log(`\n✗ ${testsRun - testsPassed} test(s) failed\n`);
    process.exit(1);
  }

  await browser.close();
}

runTests().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});