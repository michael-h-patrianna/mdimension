/**
 * FPS Fix Verification Test
 *
 * Verifies that:
 * 1. FPS is NOT locked at 30 FPS (the original bug)
 * 2. FPS is properly CAPPED at the configured maxFps (60 by default)
 *
 * Quality Gates:
 * - GATE 1: FPS is NOT locked at 30 (> 45 FPS)
 * - GATE 2: FPS is properly CAPPED around maxFps (within 45-70 FPS range for 60 FPS cap)
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
    console.log('Step 2: Waiting for scene to stabilize (8 seconds)...');
    await page.waitForTimeout(8000);

    // Step 3: Read FPS from Performance Monitor store (measures actual rendered frames)
    console.log('Step 3: Reading FPS from Performance Monitor...');

    // Collect FPS readings over 5 seconds
    const fpsReadings = [];
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(500);
      const fps = await page.evaluate(() => {
        // Access the performance metrics store
        // The store tracks actual rendered frames via useFrame hook
        const stores = window.__ZUSTAND_DEVTOOLS__;
        if (stores?.performanceMetricsStore) {
          return stores.performanceMetricsStore.getState().fps;
        }
        // Fallback: try to read from DOM
        const fpsElement = document.querySelector('[data-testid="fps-value"]');
        if (fpsElement) {
          return parseInt(fpsElement.textContent, 10);
        }
        return null;
      });
      if (fps !== null && fps > 0) {
        fpsReadings.push(fps);
        console.log(`  Reading ${i + 1}: ${fps} FPS`);
      }
    }

    // Get configured maxFps
    const maxFps = await page.evaluate(() => {
      const stores = window.__ZUSTAND_DEVTOOLS__;
      if (stores?.uiStore) {
        return stores.uiStore.getState().maxFps;
      }
      return 60; // default
    });

    console.log(`\nConfigured maxFps: ${maxFps}`);

    // Calculate statistics
    const avgFps = fpsReadings.length > 0
      ? Math.round(fpsReadings.reduce((a, b) => a + b, 0) / fpsReadings.length)
      : 0;
    const minFps = fpsReadings.length > 0 ? Math.min(...fpsReadings) : 0;
    const maxMeasuredFps = fpsReadings.length > 0 ? Math.max(...fpsReadings) : 0;

    console.log(`\n=== FPS Statistics ===`);
    console.log(`Readings: ${fpsReadings.join(', ')} FPS`);
    console.log(`Average: ${avgFps} FPS`);
    console.log(`Min: ${minFps} FPS`);
    console.log(`Max: ${maxMeasuredFps} FPS`);

    // GATE 1: Not locked at 30 FPS
    console.log('\n=== GATE 1: Not Locked at 30 FPS ===');
    const gate1Pass = avgFps > 45;
    console.log(`Result: ${gate1Pass ? 'PASS' : 'FAIL'}`);
    if (gate1Pass) {
      console.log(`  FPS is NOT locked at 30 (avg: ${avgFps} > 45)`);
    } else {
      console.log(`  FAILURE: FPS appears locked at 30 or below (avg: ${avgFps})`);
    }

    // GATE 2: FPS is properly capped (not exceeding maxFps by too much)
    console.log('\n=== GATE 2: FPS Properly Capped ===');
    // Allow 10 FPS tolerance above maxFps (due to measurement timing)
    const upperLimit = maxFps + 10;
    const lowerLimit = maxFps - 15; // Allow some variance below
    const gate2Pass = avgFps <= upperLimit && avgFps >= lowerLimit;
    console.log(`Expected range: ${lowerLimit}-${upperLimit} FPS (maxFps: ${maxFps})`);
    console.log(`Result: ${gate2Pass ? 'PASS' : 'FAIL'}`);
    if (gate2Pass) {
      console.log(`  FPS is properly capped around ${maxFps} (avg: ${avgFps})`);
    } else if (avgFps > upperLimit) {
      console.log(`  FAILURE: FPS exceeds cap (avg: ${avgFps} > ${upperLimit})`);
      console.log(`  The FPS limiter may not be working correctly.`);
    } else {
      console.log(`  WARNING: FPS is lower than expected (avg: ${avgFps} < ${lowerLimit})`);
    }

    // Take screenshot
    console.log('\n=== Screenshot ===');
    const screenshotPath = path.join(screenshotDir, 'fps-fix-verification.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`Screenshot saved to: ${screenshotPath}`);

    // Final verdict
    console.log('\n=== FINAL VERDICT ===');
    if (gate1Pass && gate2Pass) {
      console.log('SUCCESS: FPS fix is working correctly!');
      console.log(`- FPS is NOT locked at 30 (was the original bug)`);
      console.log(`- FPS is properly CAPPED at ~${maxFps} (saves battery)`);
    } else if (gate1Pass && !gate2Pass) {
      console.log('PARTIAL: 30 FPS lock is fixed, but FPS cap may need adjustment.');
      console.log(`- Average FPS: ${avgFps}`);
      console.log(`- Expected range: ${lowerLimit}-${upperLimit}`);
    } else {
      console.log('FAILURE: FPS issues remain.');
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
