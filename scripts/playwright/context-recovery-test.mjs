/**
 * Context Recovery Test
 *
 * Tests WebGL context loss and recovery for the Schroedinger object.
 * Takes before/after screenshots and captures console errors.
 *
 * Run with: node scripts/playwright/context-recovery-test.mjs
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, '../../screenshots/context-recovery');

async function runTest() {
  console.log('[CONTEXT-DEBUG] Starting context recovery test...\n');

  // Ensure screenshot directory exists
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: false,
    args: ['--use-gl=angle'] // Use ANGLE for consistent WebGL behavior
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  // Collect console messages
  const consoleMessages = [];
  page.on('console', msg => {
    const entry = {
      type: msg.type(),
      text: msg.text(),
      time: new Date().toISOString()
    };
    consoleMessages.push(entry);

    // Log WebGL-related messages immediately
    if (msg.text().includes('WebGL') ||
        msg.text().includes('Context') ||
        msg.text().includes('INVALID') ||
        msg.text().includes('[CONTEXT-DEBUG]')) {
      console.log(`  [${msg.type()}] ${msg.text()}`);
    }
  });

  // Also capture page errors
  page.on('pageerror', error => {
    consoleMessages.push({
      type: 'error',
      text: `PAGE ERROR: ${error.message}`,
      time: new Date().toISOString()
    });
    console.log(`  [PAGE ERROR] ${error.message}`);
  });

  try {
    // Navigate and wait for initial render
    console.log('[CONTEXT-DEBUG] Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

    console.log('[CONTEXT-DEBUG] Waiting for scene to fully load (3s)...');
    await page.waitForTimeout(3000);

    // Take BEFORE screenshot
    const beforePath = path.join(SCREENSHOT_DIR, 'before-context-loss.png');
    await page.screenshot({ path: beforePath });
    console.log(`\n[CONTEXT-DEBUG] BEFORE screenshot saved: ${beforePath}`);

    // Mark the time of context loss trigger
    const contextLossTime = new Date().toISOString();
    console.log(`\n[CONTEXT-DEBUG] Triggering context loss at ${contextLossTime}...`);

    // Trigger context loss via store action
    const triggered = await page.evaluate(() => {
      // Try to find the Zustand store
      // The store might be exposed differently - try multiple approaches

      // Approach 1: Direct store access (if exposed)
      if (typeof window !== 'undefined') {
        // Try to trigger via the webglContextStore
        try {
          // Import dynamically won't work in browser, try to find exposed store
          const storeState = document.querySelector('canvas')?.__r3f?.store?.getState?.();
          if (storeState) {
            console.log('[CONTEXT-DEBUG] Found R3F store');
          }
        } catch (e) {
          console.log('[CONTEXT-DEBUG] R3F store access failed:', e.message);
        }

        // Approach 2: Dispatch custom event that ContextEventHandler listens to
        // Actually, let's just call the WEBGL_lose_context extension directly
        const canvas = document.querySelector('canvas');
        if (canvas) {
          const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
          if (gl) {
            const ext = gl.getExtension('WEBGL_lose_context');
            if (ext) {
              console.log('[CONTEXT-DEBUG] Calling loseContext()...');
              ext.loseContext();

              // Schedule restore after 3 seconds
              setTimeout(() => {
                console.log('[CONTEXT-DEBUG] Calling restoreContext()...');
                ext.restoreContext();
              }, 3000);

              return true;
            } else {
              console.log('[CONTEXT-DEBUG] WEBGL_lose_context extension not available');
              return false;
            }
          }
        }
        console.log('[CONTEXT-DEBUG] Could not find canvas or WebGL context');
        return false;
      }
      return false;
    });

    if (!triggered) {
      console.error('[CONTEXT-DEBUG] Failed to trigger context loss!');
      await browser.close();
      return;
    }

    // Wait for recovery (3s delay + 2s buffer)
    console.log('[CONTEXT-DEBUG] Waiting for recovery (5s total)...');
    await page.waitForTimeout(5000);

    // Take AFTER screenshot
    const afterPath = path.join(SCREENSHOT_DIR, 'after-context-recovery.png');
    await page.screenshot({ path: afterPath });
    console.log(`\n[CONTEXT-DEBUG] AFTER screenshot saved: ${afterPath}`);

    // Wait a bit more and take another screenshot to verify animation continues
    await page.waitForTimeout(2000);
    const afterPath2 = path.join(SCREENSHOT_DIR, 'after-context-recovery-2.png');
    await page.screenshot({ path: afterPath2 });
    console.log(`[CONTEXT-DEBUG] Second AFTER screenshot saved: ${afterPath2}`);

    // Analyze console messages for WebGL errors
    const webglErrors = consoleMessages.filter(msg =>
      msg.text.includes('INVALID_OPERATION') ||
      msg.text.includes('does not belong') ||
      (msg.text.includes('WebGL:') && msg.type === 'warning') ||
      msg.text.includes('GL ERROR')
    );

    // Find context-related messages
    const contextMessages = consoleMessages.filter(msg =>
      msg.text.includes('Context Lost') ||
      msg.text.includes('Context Restored') ||
      msg.text.includes('[ContextEventHandler]') ||
      msg.text.includes('TemporalDepthManager') ||
      msg.text.includes('TemporalCloudManager')
    );

    console.log(`\n${'='.repeat(60)}`);
    console.log('[CONTEXT-DEBUG] === TEST RESULTS ===');
    console.log(`${'='.repeat(60)}`);
    console.log(`Before screenshot: ${beforePath}`);
    console.log(`After screenshot: ${afterPath}`);
    console.log(`After screenshot 2: ${afterPath2}`);
    console.log(`Total console messages: ${consoleMessages.length}`);
    console.log(`WebGL errors found: ${webglErrors.length}`);
    console.log(`Context-related messages: ${contextMessages.length}`);

    if (contextMessages.length > 0) {
      console.log('\nContext Timeline:');
      contextMessages.forEach((msg, i) => {
        console.log(`  ${i + 1}. [${msg.time}] ${msg.text.substring(0, 100)}`);
      });
    }

    if (webglErrors.length > 0) {
      console.log('\nWebGL Errors (GATE 2 FAIL):');
      // Group and count similar errors
      const errorCounts = {};
      webglErrors.forEach(err => {
        const key = err.text.substring(0, 80);
        errorCounts[key] = (errorCounts[key] || 0) + 1;
      });
      Object.entries(errorCounts).forEach(([key, count]) => {
        console.log(`  - (${count}x) ${key}`);
      });
    } else {
      console.log('\nGATE 2: PASS - No WebGL errors found');
    }

    // Save full console log
    const logPath = path.join(SCREENSHOT_DIR, 'console-log.json');
    fs.writeFileSync(logPath, JSON.stringify(consoleMessages, null, 2));
    console.log(`\nFull console log saved: ${logPath}`);

    // Gate results summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('GATE CHECK SUMMARY');
    console.log(`${'='.repeat(60)}`);
    console.log(`GATE 1 (Object visible): MANUAL CHECK REQUIRED`);
    console.log(`  Compare ${beforePath} and ${afterPath}`);
    console.log(`  Schroedinger object should be visible in AFTER screenshot`);
    console.log(`\nGATE 2 (Zero WebGL errors): ${webglErrors.length === 0 ? 'PASS' : 'FAIL'}`);
    console.log(`  Error count: ${webglErrors.length}`);
    console.log(`\nGATE 3 (Render continues): MANUAL CHECK REQUIRED`);
    console.log(`  Compare ${afterPath} and ${afterPath2}`);
    console.log(`  If rotation is enabled, images should differ slightly`);

    await browser.close();

    // Return results
    return {
      beforeScreenshot: beforePath,
      afterScreenshot: afterPath,
      afterScreenshot2: afterPath2,
      webglErrorCount: webglErrors.length,
      webglErrors,
      contextMessages,
      allMessages: consoleMessages,
      gateResults: {
        gate1: 'MANUAL_CHECK',
        gate2: webglErrors.length === 0 ? 'PASS' : 'FAIL',
        gate3: 'MANUAL_CHECK'
      }
    };

  } catch (error) {
    console.error('[CONTEXT-DEBUG] Test failed with error:', error);
    await browser.close();
    throw error;
  }
}

// Run the test
runTest()
  .then(results => {
    console.log('\n[CONTEXT-DEBUG] Test completed.');
    if (results.gateResults.gate2 === 'FAIL') {
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('[CONTEXT-DEBUG] Test crashed:', error);
    process.exit(1);
  });
