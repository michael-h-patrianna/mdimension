/**
 * Debug SSR and Normal Buffer
 * 
 * Captures console logs and screenshots to diagnose SSR/normal buffer issues.
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const LOG_FILE = '/Users/Spare/Documents/code/mdimension/.cursor/debug.log';
const SCREENSHOT_DIR = '/Users/Spare/Documents/code/mdimension/screenshots';

async function main() {
  console.log('Starting SSR/Normal debug session...');
  
  // Ensure screenshot directory exists
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  // Collect console logs
  const consoleLogs = [];
  page.on('console', (msg) => {
    const text = msg.text();
    consoleLogs.push({ type: msg.type(), text, timestamp: Date.now() });
    // Also print to terminal for immediate feedback
    if (text.includes('[DEBUG:')) {
      console.log(text);
    }
  });

  try {
    // Navigate to app
    console.log('Navigating to app...');
    await page.goto('http://localhost:3000/?t=hypercube', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Enable SSR via UI clicks
    console.log('Looking for Reflections section to enable SSR...');
    
    // First, look for the Reflections tab/section
    const reflectionsTab = page.locator('text=Reflections').first();
    if (await reflectionsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await reflectionsTab.click();
      await page.waitForTimeout(300);
    }
    
    // Click on SSR tab within Reflections
    const ssrTab = page.locator('button:has-text("SSR")').first();
    if (await ssrTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await ssrTab.click();
      await page.waitForTimeout(300);
    }
    
    // Find and click the "Enable SSR" toggle
    const enableSSRSwitch = page.locator('text=Enable SSR').first();
    if (await enableSSRSwitch.isVisible({ timeout: 2000 }).catch(() => false)) {
      await enableSSRSwitch.click();
      await page.waitForTimeout(500);
      console.log('Clicked Enable SSR toggle');
    } else {
      console.log('Enable SSR toggle not found');
    }

    // Wait for render
    await page.waitForTimeout(1000);

    // Enable normal buffer preview via Debug View section
    console.log('Looking for Normal buffer debug toggle...');
    
    // Look for Debug View section and Normal button
    const normalToggle = page.locator('button:has-text("Normal")').first();
    if (await normalToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await normalToggle.click();
      await page.waitForTimeout(500);
      console.log('Clicked Normal debug toggle');
    } else {
      console.log('Normal debug toggle not found');
    }

    // Wait for more frames to capture debug logs (need 60+ frames for the periodic log)
    console.log('Waiting for frames to render with SSR enabled...');
    await page.waitForTimeout(5000);

    // Take screenshot
    const screenshotPath = path.join(SCREENSHOT_DIR, 'debug-ssr-normals.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`Screenshot saved: ${screenshotPath}`);

    // Filter and save debug logs
    const debugLogs = consoleLogs.filter(log => log.text.includes('[DEBUG:'));
    console.log(`\n=== DEBUG LOGS (${debugLogs.length} entries) ===`);
    for (const log of debugLogs.slice(0, 50)) { // Limit to first 50
      console.log(log.text);
    }

    // Write logs to file in NDJSON format
    const logEntries = debugLogs.map(log => JSON.stringify({
      timestamp: log.timestamp,
      type: log.type,
      message: log.text,
      sessionId: 'ssr-debug'
    })).join('\n');
    
    fs.writeFileSync(LOG_FILE, logEntries + '\n');
    console.log(`\nLogs written to: ${LOG_FILE}`);

    // Summary
    console.log('\n=== SUMMARY ===');
    console.log(`Total console logs: ${consoleLogs.length}`);
    console.log(`Debug logs: ${debugLogs.length}`);
    
    // Check for specific patterns
    const normalPassLogs = debugLogs.filter(l => l.text.includes('NormalPass'));
    const mrtPassLogs = debugLogs.filter(l => l.text.includes('MainObjectMRTPass'));
    const compositeLogs = debugLogs.filter(l => l.text.includes('normalComposite'));
    const getReadTextureLogs = debugLogs.filter(l => l.text.includes('getReadTexture'));
    
    console.log(`NormalPass executions: ${normalPassLogs.length}`);
    console.log(`MainObjectMRTPass executions: ${mrtPassLogs.length}`);
    console.log(`normalComposite executions: ${compositeLogs.length}`);
    console.log(`getReadTexture (MRT) calls: ${getReadTextureLogs.length}`);

    // Check for NULL textures in normalComposite
    const nullTextures = compositeLogs.filter(l => l.text.includes('NULL'));
    if (nullTextures.length > 0) {
      console.log('\n⚠️  NULL TEXTURES DETECTED IN normalComposite:');
      for (const log of nullTextures.slice(0, 10)) {
        console.log(`  ${log.text}`);
      }
    }

    // Check for ping-pong bug path
    const bugPathLogs = getReadTextureLogs.filter(l => l.text.includes('BUG PATH'));
    if (bugPathLogs.length > 0) {
      console.log('\n🐛 PING-PONG BUG PATH HIT:');
      for (const log of bugPathLogs.slice(0, 10)) {
        console.log(`  ${log.text}`);
      }
    }

  } catch (error) {
    console.error('Error during debug session:', error);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);

