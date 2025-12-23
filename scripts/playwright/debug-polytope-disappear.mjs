/**
 * Debug script for polytope disappearing bug
 * 
 * Bug: When opening with ?t=hypercube directly, the object is visible during
 * shader overlay but disappears when overlay disappears.
 * 
 * This script captures console logs to diagnose the issue.
 */

import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3000';

async function captureConsoleLogs(page, url, testName) {
  const logs = [];
  
  // Capture all console messages
  page.on('console', msg => {
    const text = msg.text();
    // Filter for our debug logs and relevant existing logs
    if (text.includes('[DEBUG') || 
        text.includes('[PolytopeScene]') || 
        text.includes('[UnifiedRenderer]') ||
        text.includes('[useTrackedShaderMaterial]') ||
        text.includes('renderMode')) {
      logs.push({ type: msg.type(), text, time: Date.now() });
    }
  });

  console.log(`\n${'='.repeat(60)}`);
  console.log(`TEST: ${testName}`);
  console.log(`URL: ${url}`);
  console.log('='.repeat(60));

  await page.goto(url);
  
  // Wait for initial render and shader compilation
  await page.waitForTimeout(3000);
  
  // Take a screenshot
  const screenshotName = `screenshots/debug-${testName.replace(/\s+/g, '-')}.png`;
  await page.screenshot({ path: screenshotName });
  console.log(`Screenshot saved: ${screenshotName}`);
  
  // Print collected logs
  console.log('\nConsole logs:');
  console.log('-'.repeat(40));
  for (const log of logs) {
    console.log(`[${log.type}] ${log.text}`);
  }
  
  return logs;
}

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  
  try {
    // Test 1: Direct polytope URL (BUG case)
    const page1 = await context.newPage();
    const logs1 = await captureConsoleLogs(
      page1, 
      `${BASE_URL}/?t=hypercube`, 
      'Direct Polytope URL (BUG)'
    );
    await page1.close();
    
    // Wait between tests
    await new Promise(r => setTimeout(r, 1000));
    
    // Test 2: Default then switch to polytope (WORKS case)
    const page2 = await context.newPage();
    const logs2Initial = [];
    
    page2.on('console', msg => {
      const text = msg.text();
      if (text.includes('[DEBUG') || 
          text.includes('[PolytopeScene]') || 
          text.includes('[UnifiedRenderer]') ||
          text.includes('renderMode')) {
        logs2Initial.push({ type: msg.type(), text, time: Date.now() });
      }
    });
    
    console.log(`\n${'='.repeat(60)}`);
    console.log('TEST: Default then switch to Polytope (WORKS)');
    console.log(`URL: ${BASE_URL}/`);
    console.log('='.repeat(60));
    
    await page2.goto(BASE_URL);
    await page2.waitForTimeout(2000);
    
    console.log('\nInitial logs (default object):');
    console.log('-'.repeat(40));
    for (const log of logs2Initial) {
      console.log(`[${log.type}] ${log.text}`);
    }
    
    // Now click on the hypercube option in the UI
    // Find the object type selector and click hypercube
    const logs2After = [];
    page2.on('console', msg => {
      const text = msg.text();
      if (text.includes('[DEBUG') || 
          text.includes('[PolytopeScene]') || 
          text.includes('[UnifiedRenderer]') ||
          text.includes('renderMode')) {
        logs2After.push({ type: msg.type(), text, time: Date.now() });
      }
    });
    
    // Try to find and click the hypercube option
    try {
      // Look for the object type explorer or selector
      const hypercubeButton = await page2.locator('text=Hypercube').first();
      if (await hypercubeButton.isVisible()) {
        await hypercubeButton.click();
        await page2.waitForTimeout(3000);
        
        console.log('\nLogs after switching to hypercube:');
        console.log('-'.repeat(40));
        for (const log of logs2After) {
          console.log(`[${log.type}] ${log.text}`);
        }
      } else {
        console.log('Could not find Hypercube button');
      }
    } catch (e) {
      console.log('Error clicking hypercube:', e.message);
    }
    
    await page2.screenshot({ path: 'screenshots/debug-after-switch.png' });
    await page2.close();
    
    // Compare the two test cases
    console.log(`\n${'='.repeat(60)}`);
    console.log('ANALYSIS');
    console.log('='.repeat(60));
    
    const bugLogs = logs1.filter(l => l.text.includes('rendersFaceReal') || l.text.includes('rendersNothing'));
    console.log('\nBug case final render state:');
    bugLogs.forEach(l => console.log(l.text));
    
  } finally {
    await browser.close();
  }
}

main().catch(console.error);





