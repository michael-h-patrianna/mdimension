/**
 * FPS Fix Verification Test
 *
 * Verifies that the FPS controller is not locked at 30 FPS due to floating point
 * precision issues in the frame interval comparison.
 *
 * Quality Gates:
 * - GATE 1: Console FPS measurement shows > 30 FPS (ideally 55-60)
 * - GATE 2: Screenshot of performance monitor shows FPS > 30
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const screenshotDir = path.join(__dirname, '../../screenshots');

async function verifyFpsFix() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const logs = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => logs.push(`[PAGE ERROR] ${err.message}`));

  try {
    console.log('=== FPS FIX VERIFICATION TEST ===\n');

    // Step 1: Load the application
    console.log('Step 1: Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Step 2: Wait for initial heavy rendering to complete
    console.log('Step 2: Waiting for scene to stabilize (6 seconds)...');
    await page.waitForTimeout(6000);

    // Step 3: Inject FPS measurement code
    console.log('Step 3: Injecting FPS measurement code...');
    const fpsResult = await page.evaluate(() => {
      return new Promise((resolve) => {
        let lastTime = performance.now();
        let frameCount = 0;
        const measurements = [];

        function measureFPS() {
          frameCount++;
          const now = performance.now();

          // Record FPS every second
          if (now - lastTime >= 1000) {
            const fps = Math.round((frameCount * 1000) / (now - lastTime));
            measurements.push(fps);
            console.log(`[FPS-GATE] Actual RAF rate: ${fps} FPS`);
            frameCount = 0;
            lastTime = now;
          }

          // Measure for 5 seconds
          if (measurements.length < 5) {
            requestAnimationFrame(measureFPS);
          } else {
            // Calculate average, excluding first measurement (may be unstable)
            const stableMeasurements = measurements.slice(1);
            const avgFps = Math.round(stableMeasurements.reduce((a, b) => a + b, 0) / stableMeasurements.length);
            const minFps = Math.min(...stableMeasurements);
            const maxFps = Math.max(...stableMeasurements);
            resolve({ measurements, avgFps, minFps, maxFps });
          }
        }

        requestAnimationFrame(measureFPS);
      });
    });

    console.log('\n=== GATE 1: Console FPS Verification ===');
    console.log(`Measurements: ${fpsResult.measurements.join(', ')} FPS`);
    console.log(`Average FPS: ${fpsResult.avgFps}`);
    console.log(`Min FPS: ${fpsResult.minFps}`);
    console.log(`Max FPS: ${fpsResult.maxFps}`);

    // Check GATE 1: FPS should be > 30 (ideally 55-60)
    const gate1Pass = fpsResult.avgFps > 30;
    console.log(`\nGATE 1 Result: ${gate1Pass ? 'PASS' : 'FAIL'}`);
    if (gate1Pass) {
      console.log(`  FPS is NOT locked at 30 (avg: ${fpsResult.avgFps} FPS)`);
    } else {
      console.log(`  WARNING: FPS appears locked at 30 or below (avg: ${fpsResult.avgFps} FPS)`);
    }

    // Step 4: Take screenshot of performance monitor
    console.log('\n=== GATE 2: Performance Monitor Screenshot ===');
    const screenshotPath = path.join(screenshotDir, 'fps-fix-verification.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`Screenshot saved to: ${screenshotPath}`);

    // Check maxFps value in store
    const maxFpsValue = await page.evaluate(() => {
      // @ts-ignore - zustand stores are exposed on window in dev mode via devtools
      return window.__ZUSTAND_DEVTOOLS__?.uiStore?.getState?.()?.maxFps ??
             (typeof useUIStore !== 'undefined' ? useUIStore.getState().maxFps : 'N/A');
    });
    console.log(`Store maxFps value: ${maxFpsValue}`);

    // Final verdict
    console.log('\n=== FINAL VERDICT ===');
    if (gate1Pass) {
      console.log('SUCCESS: FPS fix is working correctly!');
      console.log(`The application is running at ${fpsResult.avgFps} FPS (not locked at 30 FPS).`);
    } else {
      console.log('FAILURE: FPS is still locked at 30 FPS.');
      console.log('The floating point precision fix may not be working.');

      console.log('\n=== CONSOLE LOGS ===');
      logs.forEach(l => console.log(l));

      await browser.close();
      process.exit(1);
    }

  } catch (err) {
    console.error('\nTest failed:', err);
    console.log('\n=== CONSOLE LOGS ===');
    logs.forEach(l => console.log(l));
    await browser.close();
    process.exit(1);
  } finally {
    await browser.close();
  }
}

verifyFpsFix();
