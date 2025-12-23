/**
 * Debug IBL (Image-Based Lighting) execution path
 * 
 * Traces the complete IBL data flow to identify where it's breaking.
 */

import { chromium } from 'playwright';

const URL = process.env.URL || 'http://localhost:3002';

async function debugIBL() {
  console.log('=== IBL Debug Script ===\n');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Collect console logs
  const logs = [];
  page.on('console', msg => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
  });
  
  try {
    console.log('1. Loading page...');
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    console.log('2. Checking initial IBL state...');
    const initialState = await page.evaluate(() => {
      // Get environment store state
      const envStore = window.__ZUSTAND_STORES__?.environment?.getState?.();
      if (!envStore) {
        return { error: 'Environment store not found' };
      }
      
      return {
        iblQuality: envStore.iblQuality,
        iblIntensity: envStore.iblIntensity,
        skyboxEnabled: envStore.skyboxEnabled,
        skyboxMode: envStore.skyboxMode,
        activeWalls: envStore.activeWalls,
      };
    });
    console.log('Initial state:', JSON.stringify(initialState, null, 2));
    
    console.log('\n3. Enabling IBL (setting quality to "low")...');
    await page.evaluate(() => {
      const envStore = window.__ZUSTAND_STORES__?.environment?.getState?.();
      if (envStore?.setIBLQuality) {
        envStore.setIBLQuality('low');
      }
    });
    await page.waitForTimeout(500);
    
    console.log('4. Enabling skybox...');
    await page.evaluate(() => {
      const envStore = window.__ZUSTAND_STORES__?.environment?.getState?.();
      if (envStore?.setSkyboxEnabled) {
        envStore.setSkyboxEnabled(true);
      }
      if (envStore?.setSkyboxMode) {
        envStore.setSkyboxMode('procedural_cosmic');
      }
    });
    await page.waitForTimeout(2000);
    
    console.log('\n5. Checking state after enabling IBL and skybox...');
    const afterState = await page.evaluate(() => {
      const envStore = window.__ZUSTAND_STORES__?.environment?.getState?.();
      return {
        iblQuality: envStore?.iblQuality,
        iblIntensity: envStore?.iblIntensity,
        skyboxEnabled: envStore?.skyboxEnabled,
        skyboxMode: envStore?.skyboxMode,
        activeWalls: envStore?.activeWalls,
      };
    });
    console.log('After state:', JSON.stringify(afterState, null, 2));
    
    console.log('\n6. Checking scene.background...');
    const sceneState = await page.evaluate(() => {
      // Try to find the Three.js scene
      const canvas = document.querySelector('canvas');
      if (!canvas) return { error: 'No canvas found' };
      
      // Check if there's a global reference to the scene
      const scene = window.__THREE_SCENE__;
      if (!scene) {
        return { error: 'Scene not exposed globally' };
      }
      
      return {
        hasBackground: !!scene.background,
        backgroundType: scene.background?.constructor?.name,
        backgroundMapping: scene.background?.mapping,
        hasEnvironment: !!scene.environment,
        environmentType: scene.environment?.constructor?.name,
      };
    });
    console.log('Scene state:', JSON.stringify(sceneState, null, 2));
    
    console.log('\n7. Checking render graph state...');
    const graphState = await page.evaluate(() => {
      const graph = window.__RENDER_GRAPH__;
      if (!graph) {
        return { error: 'Render graph not exposed globally' };
      }
      
      // Try to get frame context
      const frameContext = graph.getLastFrameContext?.();
      if (!frameContext) {
        return { error: 'No frame context available' };
      }
      
      return {
        frameNumber: frameContext.frameNumber,
        environment: {
          iblQuality: frameContext.stores?.environment?.iblQuality,
          iblIntensity: frameContext.stores?.environment?.iblIntensity,
          skyboxEnabled: frameContext.stores?.environment?.skyboxEnabled,
          skyboxMode: frameContext.stores?.environment?.skyboxMode,
          activeWalls: frameContext.stores?.environment?.activeWalls,
        }
      };
    });
    console.log('Graph state:', JSON.stringify(graphState, null, 2));
    
    console.log('\n8. Checking material uniforms on main object...');
    const materialState = await page.evaluate(() => {
      const scene = window.__THREE_SCENE__;
      if (!scene) return { error: 'Scene not found' };
      
      let mainMesh = null;
      scene.traverse((obj) => {
        if (obj.isMesh && obj.material?.uniforms?.uIBLQuality) {
          mainMesh = obj;
        }
      });
      
      if (!mainMesh) {
        return { error: 'No mesh with IBL uniforms found' };
      }
      
      const u = mainMesh.material.uniforms;
      return {
        meshName: mainMesh.name || 'unnamed',
        uIBLQuality: u.uIBLQuality?.value,
        uIBLIntensity: u.uIBLIntensity?.value,
        uEnvMapIsSet: !!u.uEnvMap?.value,
        uEnvMapType: u.uEnvMap?.value?.constructor?.name,
      };
    });
    console.log('Material state:', JSON.stringify(materialState, null, 2));
    
    console.log('\n9. Checking CubemapCapturePass state...');
    const passState = await page.evaluate(() => {
      const graph = window.__RENDER_GRAPH__;
      if (!graph) return { error: 'Render graph not found' };
      
      // Try to find cubemap pass in passes
      const passes = graph.compiled?.passes || [];
      const cubemapPass = passes.find(p => p.config?.id === 'cubemapCapture');
      
      if (!cubemapPass) {
        return { 
          error: 'CubemapCapturePass not found in compiled passes',
          passIds: passes.map(p => p.config?.id)
        };
      }
      
      return {
        passId: cubemapPass.config.id,
        hasValidCubemap: cubemapPass.hasValidCubemap?.(),
        framesSinceReset: cubemapPass.getFramesSinceReset?.(),
      };
    });
    console.log('Pass state:', JSON.stringify(passState, null, 2));
    
    console.log('\n10. Checking external bridge exports...');
    const bridgeState = await page.evaluate(() => {
      const graph = window.__RENDER_GRAPH__;
      if (!graph) return { error: 'Render graph not found' };
      
      const bridge = graph.externalBridge;
      if (!bridge) return { error: 'External bridge not found' };
      
      const debugInfo = bridge.getDebugInfo?.();
      return debugInfo || { error: 'No debug info available' };
    });
    console.log('Bridge state:', JSON.stringify(bridgeState, null, 2));
    
    // Print any relevant console logs
    const relevantLogs = logs.filter(l => 
      l.toLowerCase().includes('ibl') || 
      l.toLowerCase().includes('cubemap') ||
      l.toLowerCase().includes('envmap') ||
      l.toLowerCase().includes('background')
    );
    if (relevantLogs.length > 0) {
      console.log('\n=== Relevant Console Logs ===');
      relevantLogs.forEach(l => console.log(l));
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

debugIBL().catch(console.error);

