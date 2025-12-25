/**
 * Debug Playwright script to investigate Wythoff polytope rendering issue
 * 
 * Captures console logs from the browser to analyze the rendering pipeline
 * for Wythoff polytopes.
 * 
 * Hypotheses being tested:
 * A: Worker Request Never Resolves
 * B: Inflated Geometry Missing Metadata (analyticalFaces)
 * C: Worker Response Discarded Due to Request ID Mismatch
 * D: useEffect dependency causes infinite re-renders or cancellation
 * E: Render Mode Returns 'none' Due to Empty Geometry
 */

import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3000';

async function debugWythoffRendering() {
  console.log('=== Wythoff Polytope Rendering Debug ===\n');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Collect all console logs
  const consoleLogs = [];
  
  page.on('console', (msg) => {
    const text = msg.text();
    // Filter for our debug logs
    if (text.includes('[DEBUG:')) {
      consoleLogs.push({
        type: msg.type(),
        text: text,
        timestamp: Date.now()
      });
      console.log(`[CONSOLE] ${text}`);
    }
  });
  
  // Also capture any errors
  page.on('pageerror', (err) => {
    console.log(`[PAGE ERROR] ${err.message}`);
  });
  
  try {
    console.log('1. Navigating to Wythoff polytope URL...');
    await page.goto(`${BASE_URL}/?t=wythoff-polytope`, { waitUntil: 'networkidle' });
    
    console.log('\n2. Waiting 5 seconds for worker and rendering...');
    await page.waitForTimeout(5000);
    
    console.log('\n3. Checking canvas state...');
    
    // Check if canvas exists
    const canvas = await page.$('canvas');
    if (canvas) {
      const boundingBox = await canvas.boundingBox();
      console.log(`   Canvas found: ${boundingBox?.width}x${boundingBox?.height}`);
    } else {
      console.log('   Canvas NOT found!');
    }
    
    // Check for loading indicator
    const loadingIndicator = await page.$('[data-testid="geometry-loading"]');
    if (loadingIndicator) {
      console.log('   Loading indicator is still visible!');
    } else {
      console.log('   No loading indicator visible');
    }
    
    // Check for shader compilation overlay
    const shaderOverlay = await page.$('[data-testid="shader-compilation-overlay"]');
    if (shaderOverlay) {
      const isVisible = await shaderOverlay.isVisible();
      console.log(`   Shader overlay visible: ${isVisible}`);
    }
    
    console.log('\n=== Console Log Summary ===');
    console.log(`Total DEBUG logs captured: ${consoleLogs.length}`);
    
    // Analyze hypotheses
    console.log('\n=== Hypothesis Analysis ===');
    
    // Hypothesis A: Did we send a request and receive a response?
    const requestSent = consoleLogs.some(l => l.text.includes('Sending worker request'));
    const responseReceived = consoleLogs.some(l => l.text.includes('Worker response received'));
    console.log(`[A] Worker Request Sent: ${requestSent}`);
    console.log(`[A] Worker Response Received: ${responseReceived}`);
    
    // Hypothesis C: Was response discarded?
    const responseDiscarded = consoleLogs.some(l => l.text.includes('Request ID mismatch'));
    console.log(`[C] Response Discarded (ID mismatch): ${responseDiscarded}`);
    
    // Hypothesis B/E: Check geometry inflation
    const inflationLogs = consoleLogs.filter(l => l.text.includes('Geometry inflated'));
    if (inflationLogs.length > 0) {
      console.log(`[B/E] Geometry inflated: YES`);
      for (const log of inflationLogs) {
        console.log(`   ${log.text}`);
      }
    } else {
      console.log(`[B/E] Geometry inflated: NO`);
    }
    
    // Hypothesis D: Check effect triggers
    const effectTriggers = consoleLogs.filter(l => l.text.includes('useEffect triggered'));
    const cleanupTriggers = consoleLogs.filter(l => l.text.includes('useEffect cleanup'));
    console.log(`[D] Effect triggers: ${effectTriggers.length}`);
    console.log(`[D] Effect cleanups: ${cleanupTriggers.length}`);
    
    // Hypothesis E: Check render mode
    const renderModeLogs = consoleLogs.filter(l => l.text.includes('Render mode determined'));
    if (renderModeLogs.length > 0) {
      console.log(`[E] Render mode logs:`);
      for (const log of renderModeLogs) {
        console.log(`   ${log.text}`);
      }
    } else {
      console.log(`[E] No render mode logs captured - geometry may be null`);
    }
    
    // Check Visualizer render state
    const visualizerLogs = consoleLogs.filter(l => l.text.includes('Visualizer render'));
    console.log(`\nVisualizer render calls: ${visualizerLogs.length}`);
    for (const log of visualizerLogs) {
      console.log(`   ${log.text}`);
    }
    
    console.log('\n=== All DEBUG Logs (chronological) ===');
    for (const log of consoleLogs) {
      console.log(log.text);
    }
    
  } catch (error) {
    console.error('Error during debug:', error);
  } finally {
    await browser.close();
  }
}

debugWythoffRendering().catch(console.error);

