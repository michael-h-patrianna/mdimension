/**
 * Deep IBL Debug - Trace exactly what's happening during render
 */

import { chromium } from 'playwright';

const URL = process.env.URL || 'http://localhost:3002';

async function debugIBLDeep() {
  console.log('=== Deep IBL Debug ===\n');
  
  const browser = await chromium.launch({ headless: false }); // Use headed mode
  const page = await browser.newPage();
  
  // Collect ALL console logs including errors
  const logs = [];
  page.on('console', msg => {
    const text = `[${msg.type().toUpperCase()}] ${msg.text()}`;
    logs.push(text);
    if (msg.type() === 'error' || msg.type() === 'warn') {
      console.log(text);
    }
  });
  
  page.on('pageerror', error => {
    console.log('[PAGE ERROR]', error.message);
    logs.push(`[PAGE ERROR] ${error.message}`);
  });
  
  try {
    console.log('1. Loading page...');
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    console.log('\n2. Injecting debug instrumentation...');
    await page.evaluate(() => {
      // Try to find and instrument the CubemapCapturePass
      const graph = window.__RENDER_GRAPH__;
      if (!graph?.compiled?.passes) {
        console.log('[DEBUG] No render graph or passes found');
        return;
      }
      
      const cubemapPass = graph.compiled.passes.find(p => p.config?.id === 'cubemapCapture');
      if (!cubemapPass) {
        console.log('[DEBUG] CubemapCapturePass not found');
        return;
      }
      
      console.log('[DEBUG] Found CubemapCapturePass, checking state:');
      console.log('[DEBUG] - needsCapture:', cubemapPass.needsCapture);
      console.log('[DEBUG] - cubemapHistory exists:', !!cubemapPass.cubemapHistory);
      console.log('[DEBUG] - cubeCamera exists:', !!cubemapPass.cubeCamera);
      
      if (cubemapPass.cubemapHistory) {
        console.log('[DEBUG] - cubemapHistory.disposed:', cubemapPass.cubemapHistory.disposed);
        console.log('[DEBUG] - cubemapHistory.framesSinceReset:', cubemapPass.cubemapHistory.framesSinceReset);
        console.log('[DEBUG] - cubemapHistory.writeIndex:', cubemapPass.cubemapHistory.writeIndex);
        console.log('[DEBUG] - cubemapHistory.history.length:', cubemapPass.cubemapHistory.history?.length);
      }
      
      // Check if pass is in enabled state
      const frameContext = graph.getLastFrameContext?.();
      if (frameContext && cubemapPass.config.enabled) {
        const isEnabled = cubemapPass.config.enabled(frameContext);
        console.log('[DEBUG] - pass.enabled() returns:', isEnabled);
      }
    });
    
    console.log('\n3. Waiting and checking again...');
    await page.waitForTimeout(2000);
    
    const state = await page.evaluate(() => {
      const graph = window.__RENDER_GRAPH__;
      const cubemapPass = graph?.compiled?.passes?.find(p => p.config?.id === 'cubemapCapture');
      
      if (!cubemapPass) return { error: 'Pass not found' };
      
      return {
        needsCapture: cubemapPass.needsCapture,
        hasHistory: !!cubemapPass.cubemapHistory,
        historyDisposed: cubemapPass.cubemapHistory?.disposed,
        framesSinceReset: cubemapPass.cubemapHistory?.framesSinceReset,
        writeIndex: cubemapPass.cubemapHistory?.writeIndex,
        historyLength: cubemapPass.cubemapHistory?.history?.length,
        hasValidCubemap: cubemapPass.hasValidCubemap?.(),
      };
    });
    
    console.log('\nCubemapCapturePass state:', JSON.stringify(state, null, 2));
    
    console.log('\n4. Manually calling postFrame() once...');
    const afterPostFrame = await page.evaluate(() => {
      const graph = window.__RENDER_GRAPH__;
      const cubemapPass = graph?.compiled?.passes?.find(p => p.config?.id === 'cubemapCapture');
      
      if (!cubemapPass) return { error: 'Pass not found' };
      
      try {
        console.log('[DEBUG] Calling postFrame()...');
        cubemapPass.postFrame();
        console.log('[DEBUG] postFrame() completed');
        
        return {
          success: true,
          framesSinceReset: cubemapPass.cubemapHistory?.framesSinceReset,
          writeIndex: cubemapPass.cubemapHistory?.writeIndex,
          hasValidCubemap: cubemapPass.hasValidCubemap?.(),
        };
      } catch (e) {
        return { error: e.message, stack: e.stack };
      }
    });
    
    console.log('After postFrame():', JSON.stringify(afterPostFrame, null, 2));
    
    console.log('\n5. Waiting to see if rendering continues...');
    await page.waitForTimeout(2000);
    
    // Take a screenshot
    await page.screenshot({ path: 'screenshots/ibl-debug.png' });
    console.log('Screenshot saved to screenshots/ibl-debug.png');
    
    // Print relevant logs
    const relevantLogs = logs.filter(l => 
      l.includes('DEBUG') || 
      l.includes('ERROR') || 
      l.includes('cubemap') ||
      l.includes('IBL') ||
      l.includes('Temporal')
    );
    if (relevantLogs.length > 0) {
      console.log('\n=== Relevant Console Logs ===');
      relevantLogs.forEach(l => console.log(l));
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await page.waitForTimeout(5000); // Keep browser open briefly
    await browser.close();
  }
}

debugIBLDeep().catch(console.error);

