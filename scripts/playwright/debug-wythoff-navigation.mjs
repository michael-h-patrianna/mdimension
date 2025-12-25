/**
 * Debug Playwright script - Test navigation between object types
 * 
 * This simulates the user's reported issue where:
 * 1. Navigating to wythoff shows empty scene
 * 2. Other polytopes also don't render initially
 * 3. But work after visiting raymarching objects
 */

import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3000';

async function debugWythoffNavigation() {
  console.log('=== Wythoff Navigation Debug ===\n');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const consoleLogs = [];
  
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('[DEBUG:')) {
      consoleLogs.push({ text, timestamp: Date.now() });
      console.log(`[CONSOLE] ${text}`);
    }
  });
  
  page.on('pageerror', (err) => {
    console.log(`[PAGE ERROR] ${err.message}`);
  });
  
  try {
    // Test 1: Load app without ?t parameter, then switch to wythoff
    console.log('=== TEST 1: Default load then navigate to Wythoff ===\n');
    
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    console.log('1. Loaded default page (hypercube)');
    await page.waitForTimeout(2000);
    
    // Check current state
    let lastLog = consoleLogs[consoleLogs.length - 1]?.text || 'none';
    console.log(`   Last log: ${lastLog}\n`);
    
    // Now programmatically navigate to wythoff by changing the URL
    consoleLogs.length = 0; // Clear logs
    console.log('2. Navigating to Wythoff polytope via URL change...');
    await page.goto(`${BASE_URL}/?t=wythoff-polytope`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    // Analyze
    const hasGeometryLog = consoleLogs.find(l => l.text.includes('hasGeometry: true'));
    const renderModeLog = consoleLogs.find(l => l.text.includes('Render mode determined'));
    console.log(`   hasGeometry: ${hasGeometryLog ? 'TRUE' : 'FALSE'}`);
    console.log(`   renderMode: ${renderModeLog?.text.match(/mode: (\w+)/)?.[1] || 'NOT FOUND'}`);
    
    // Test 2: Try clicking on object type selector if available
    console.log('\n=== TEST 2: Navigate via UI (if available) ===\n');
    consoleLogs.length = 0;
    
    // Go back to default
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Look for object type dropdown or selector
    const geometrySection = await page.$('[data-testid="geometry-section"]');
    if (geometrySection) {
      console.log('Found geometry section, trying to click...');
      await geometrySection.click();
      await page.waitForTimeout(500);
    }
    
    // Look for wythoff option
    const wythoffOption = await page.$('text=Wythoff');
    if (wythoffOption) {
      consoleLogs.length = 0;
      console.log('Found Wythoff option, clicking...');
      await wythoffOption.click();
      await page.waitForTimeout(3000);
      
      const hasGeo = consoleLogs.find(l => l.text.includes('hasGeometry: true'));
      console.log(`   hasGeometry after click: ${hasGeo ? 'TRUE' : 'FALSE'}`);
    } else {
      console.log('Wythoff option not found in UI');
    }
    
    // Test 3: Check the initial load state without geometry loading
    console.log('\n=== TEST 3: Check initial geometry state ===\n');
    consoleLogs.length = 0;
    
    await page.goto(`${BASE_URL}/?t=wythoff-polytope`, { waitUntil: 'domcontentloaded' });
    
    // Wait for first few renders
    await page.waitForTimeout(500);
    
    const firstRenders = consoleLogs.filter(l => l.text.includes('Visualizer render'));
    console.log(`First 500ms renders: ${firstRenders.length}`);
    for (const log of firstRenders.slice(0, 5)) {
      console.log(`   ${log.text}`);
    }
    
    // Check if geometryLoading starts as false (suspicious)
    const firstWithGeometryLoadingFalse = consoleLogs.find(l => 
      l.text.includes('geometryLoading: false') && l.text.includes('hasGeometry: false')
    );
    if (firstWithGeometryLoadingFalse) {
      console.log('\n⚠️  SUSPICIOUS: geometryLoading=false but hasGeometry=false');
      console.log(`   This suggests async generation not starting immediately`);
    }
    
    // Test 4: Screenshot comparison
    console.log('\n=== TEST 4: Take screenshot for visual verification ===\n');
    await page.waitForTimeout(3000);
    
    const screenshotPath = 'screenshots/debug-wythoff-state.png';
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`Screenshot saved to: ${screenshotPath}`);
    
    // Final summary
    console.log('\n=== Final State ===');
    const finalLogs = consoleLogs.slice(-5);
    for (const log of finalLogs) {
      console.log(log.text);
    }
    
  } catch (error) {
    console.error('Error during debug:', error);
  } finally {
    await browser.close();
  }
}

debugWythoffNavigation().catch(console.error);

