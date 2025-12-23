/**
 * Debug script to capture console logs for GL_INVALID_OPERATION investigation.
 * 
 * This script:
 * 1. Opens the app without a skybox
 * 2. Waits for the scene to render
 * 3. Selects a skybox to trigger the bug
 * 4. Captures all [DEBUG_AGENT] logs and WebGL errors
 */

import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3000';
const LOG_PREFIX = '[DEBUG_AGENT]';
const GL_ERROR_PATTERN = /GL_INVALID_OPERATION/;

async function run() {
  console.log('Starting debug session for GL_INVALID_OPERATION investigation...\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const debugLogs = [];
  const glErrors = [];

  // Capture console logs
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes(LOG_PREFIX)) {
      debugLogs.push({ type: 'debug', text, timestamp: Date.now() });
      console.log('📊', text);
    }
    if (GL_ERROR_PATTERN.test(text)) {
      glErrors.push({ type: 'gl_error', text, timestamp: Date.now() });
      console.log('❌', text);
    }
  });

  // Also capture warnings/errors
  page.on('console', (msg) => {
    if (msg.type() === 'warning' || msg.type() === 'error') {
      const text = msg.text();
      if (GL_ERROR_PATTERN.test(text) || text.includes('WebGL')) {
        glErrors.push({ type: msg.type(), text, timestamp: Date.now() });
        console.log(`⚠️ [${msg.type()}]`, text);
      }
    }
  });

  try {
    // Step 1: Load the app (no skybox initially)
    console.log('\n=== Step 1: Loading app without skybox ===');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    
    // Wait for canvas to be rendered
    await page.waitForSelector('canvas', { timeout: 10000 });
    console.log('Canvas found, waiting for initial render...');
    
    // Wait a bit for rendering to stabilize
    await page.waitForTimeout(2000);
    
    console.log(`Debug logs captured so far: ${debugLogs.length}`);
    console.log(`GL errors captured so far: ${glErrors.length}`);

    // Step 2: Enable skybox by clicking the skybox panel
    console.log('\n=== Step 2: Enabling skybox ===');
    
    // Find and click the Environment panel to expand it
    const envPanel = page.locator('button:has-text("Environment")');
    if (await envPanel.isVisible()) {
      await envPanel.click();
      await page.waitForTimeout(500);
    }

    // Look for skybox toggle or skybox selector
    // Try to find a skybox enable checkbox or toggle
    const skyboxToggle = page.locator('[data-testid="skybox-enabled"]').or(
      page.locator('label:has-text("Skybox")').locator('input[type="checkbox"]')
    ).or(
      page.locator('input[type="checkbox"]').filter({ hasText: /skybox/i })
    );

    if (await skyboxToggle.first().isVisible()) {
      console.log('Found skybox toggle, clicking...');
      await skyboxToggle.first().click();
      await page.waitForTimeout(1000);
    } else {
      console.log('Skybox toggle not found directly, looking for skybox selector...');
      
      // Try to find a skybox texture selector dropdown
      const skyboxSelect = page.locator('select').filter({ hasText: /skybox|texture|environment/i }).first();
      if (await skyboxSelect.isVisible()) {
        console.log('Found skybox selector');
        // Select the first non-empty option
        const options = await skyboxSelect.locator('option').all();
        if (options.length > 1) {
          await skyboxSelect.selectOption({ index: 1 });
          await page.waitForTimeout(1000);
        }
      }
    }

    // Wait for errors to appear after skybox change
    console.log('Waiting for potential GL errors...');
    await page.waitForTimeout(3000);

    // Step 3: Print results
    console.log('\n=== Results ===');
    console.log(`Total debug logs: ${debugLogs.length}`);
    console.log(`Total GL errors: ${glErrors.length}`);

    if (debugLogs.length > 0) {
      console.log('\n--- Debug Logs ---');
      debugLogs.forEach((log, i) => {
        console.log(`${i + 1}. ${log.text}`);
      });
    }

    if (glErrors.length > 0) {
      console.log('\n--- GL Errors ---');
      glErrors.forEach((err, i) => {
        console.log(`${i + 1}. [${err.type}] ${err.text}`);
      });
    }

    // Keep browser open for manual inspection
    console.log('\nBrowser will stay open for 30 seconds for manual inspection...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await browser.close();
  }

  // Return data for analysis
  return { debugLogs, glErrors };
}

run().catch(console.error);

