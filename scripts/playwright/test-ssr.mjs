/**
 * SSR (Screen Space Reflections) Debug Test
 *
 * This test verifies that SSR is working correctly by:
 * 1. Enabling SSR via the UI
 * 2. Checking console for any errors
 * 3. Taking screenshots to visually verify reflections
 *
 * @fileoverview Playwright test for SSR functionality
 */

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCREENSHOT_DIR = path.join(__dirname, '../../screenshots/ssr-test');
const BASE_URL = 'http://localhost:3002';

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function run() {
  console.log('🚀 Starting SSR test...\n');

  const browser = await chromium.launch({
    headless: false, // Run with visible browser for debugging
  });

  const page = await browser.newPage();
  
  // Collect console messages
  const consoleLogs = [];
  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    consoleLogs.push({ type, text });
    if (type === 'error') {
      console.log(`❌ Console error: ${text}`);
    }
  });

  try {
    // Navigate to the app
    console.log('📍 Navigating to app...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    
    // Wait for the app to fully load
    await page.waitForTimeout(3000);
    
    // Take initial screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-initial.png'),
      fullPage: false,
    });
    console.log('📸 Screenshot: 01-initial.png');

    // Open the panel sidebar to access SSR controls
    // First, check if panel is already open
    const settingsSection = await page.$('[data-testid="settings-panel"]');
    if (!settingsSection) {
      // Look for a button to open settings/panel
      const panelToggle = await page.$('button:has-text("Settings")') ||
                          await page.$('[data-testid="panel-toggle"]') ||
                          await page.$('button:has-text("Panel")');
      if (panelToggle) {
        await panelToggle.click();
        await page.waitForTimeout(500);
      }
    }

    // Look for post-processing or reflections section
    console.log('🔍 Looking for SSR/Reflections controls...');
    
    // Try to find and expand reflections section
    const reflectionsSection = await page.$('text="Reflections"') ||
                                await page.$('text="SSR"') ||
                                await page.$('button:has-text("Reflections")');
    
    if (reflectionsSection) {
      await reflectionsSection.click();
      await page.waitForTimeout(500);
      console.log('✅ Found Reflections section');
    }

    // Look for SSR toggle/checkbox
    const ssrToggle = await page.$('[data-testid="ssr-toggle"]') ||
                      await page.$('input[type="checkbox"]:near(:text("SSR"))') ||
                      await page.$('button:has-text("SSR")');
    
    if (ssrToggle) {
      await ssrToggle.click();
      await page.waitForTimeout(500);
      console.log('✅ Toggled SSR');
    } else {
      console.log('⚠️ Could not find SSR toggle, checking store directly...');
    }

    // Wait for SSR to render
    await page.waitForTimeout(2000);

    // Take screenshot with SSR enabled
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-ssr-enabled.png'),
      fullPage: false,
    });
    console.log('📸 Screenshot: 02-ssr-enabled.png');

    // Check the current SSR state via console
    const ssrState = await page.evaluate(() => {
      // Access render graph if available
      const renderGraph = window.__RENDER_GRAPH__;
      if (renderGraph) {
        return {
          passOrder: renderGraph.getPassOrder(),
        };
      }
      return null;
    });

    if (ssrState) {
      console.log(`\n📊 Render Graph Info:`);
      console.log(`   Pass order: ${ssrState.passOrder?.join(' → ')}`);
    }

    // Try to enable SSR via render graph
    console.log('\n🔧 Checking SSR state in render graph...');
    await page.evaluate(() => {
      // Access render graph for debugging
      const renderGraph = window.__RENDER_GRAPH__;
      if (renderGraph) {
        const frameContext = renderGraph.getLastFrameContext();
        if (frameContext) {
          console.log('SSR enabled:', frameContext.stores?.postProcessing?.ssrEnabled);
          console.log('SSR intensity:', frameContext.stores?.postProcessing?.ssrIntensity);
        }
      }
    });

    // Wait for changes to apply
    await page.waitForTimeout(2000);

    // Take final screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03-ssr-forced.png'),
      fullPage: false,
    });
    console.log('📸 Screenshot: 03-ssr-forced.png');

    // Check for WebGL errors
    const errors = consoleLogs.filter((log) => log.type === 'error');
    if (errors.length > 0) {
      console.log('\n⚠️ Console errors found:');
      errors.forEach((err) => console.log(`   ${err.text}`));
    } else {
      console.log('\n✅ No console errors');
    }

    // Get render graph debug info
    const graphDebug = await page.evaluate(() => {
      const renderGraph = (window as any).__RENDER_GRAPH__;
      if (renderGraph) {
        return {
          passOrder: renderGraph.getPassOrder(),
          frameStats: renderGraph.getFrameStats(),
        };
      }
      return null;
    });

    if (graphDebug) {
      console.log('\n📊 Render Graph Info:');
      console.log('   Pass order:', graphDebug.passOrder?.join(' → '));
    }

    console.log('\n✅ Test complete! Check screenshots in:', SCREENSHOT_DIR);

  } catch (error) {
    console.error('❌ Test failed:', error);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'error.png'),
      fullPage: false,
    });
  } finally {
    // Keep browser open for manual inspection
    console.log('\n🔍 Browser will stay open for manual inspection. Press Ctrl+C to close.');
    await page.waitForTimeout(60000); // Keep open for 1 minute
    await browser.close();
  }
}

run().catch(console.error);

