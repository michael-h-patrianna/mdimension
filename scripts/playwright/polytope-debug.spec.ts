/**
 * Polytope Debug Test
 *
 * Diagnoses why polytopes aren't rendering by checking:
 * 1. Store state (objectType, dimension, facesVisible)
 * 2. Geometry generation (vertices count)
 * 3. Render mode determination
 * 4. Console errors
 */

import { test, expect, ConsoleMessage } from '@playwright/test';

test.setTimeout(60000);

test('Debug hypercube rendering', async ({ page }) => {
  const consoleMessages: { type: string; text: string }[] = [];

  // Collect ALL console messages
  page.on('console', (msg: ConsoleMessage) => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
    });
  });

  // Navigate to hypercube - URL param 't' is used for objectType (see state-serializer.ts)
  await page.goto('/?t=hypercube');

  // Wait for canvas to appear
  await page.waitForSelector('canvas', { state: 'visible', timeout: 30000 });
  await page.waitForTimeout(5000);

  // Check geometry store state and try to understand rendering
  const geometryState = await page.evaluate(() => {
    // @ts-ignore
    const store = window.__GEOMETRY_STORE__;
    if (!store) return { error: 'GEOMETRY_STORE not found' };

    const state = store.getState();
    return {
      objectType: state.objectType,
      dimension: state.dimension,
    };
  });

  // Check if Three.js scene has polytope objects
  const sceneDebug = await page.evaluate(() => {
    // Try to find the Three.js scene and check what's in it
    // @ts-ignore
    const canvas = document.querySelector('canvas');
    if (!canvas) return { error: 'No canvas' };

    // Check if any meshes are in the scene
    // Look for the fiber store in the canvas
    // @ts-ignore
    const fiberStore = canvas.__r3f;
    if (!fiberStore) return { error: 'No R3F store on canvas' };

    const rootState = fiberStore.store?.getState?.();
    if (!rootState) return { error: 'No root state' };

    const scene = rootState.scene;
    if (!scene) return { error: 'No scene' };

    // Count objects in scene
    let meshCount = 0;
    let lineCount = 0;
    const objectNames: string[] = [];

    scene.traverse((obj: { type: string; name?: string }) => {
      if (obj.type === 'Mesh') {
        meshCount++;
        if (obj.name) objectNames.push(`Mesh:${obj.name}`);
      }
      if (obj.type === 'Line' || obj.type === 'LineSegments') {
        lineCount++;
        if (obj.name) objectNames.push(`Line:${obj.name}`);
      }
    });

    return {
      meshCount,
      lineCount,
      objectNames: objectNames.slice(0, 20), // Limit to first 20
      sceneChildren: scene.children.length,
    };
  });

  console.log('Scene Debug:', sceneDebug);

  console.log('Geometry Store State:', geometryState);

  // Check appearance store state
  const appearanceState = await page.evaluate(() => {
    // @ts-ignore
    const store = window.__APPEARANCE_STORE__;
    // Fall back to checking directly on window
    if (!store) {
      // Try accessing via module
      return { error: 'APPEARANCE_STORE not found - need to expose it' };
    }

    const state = store.getState();
    return {
      facesVisible: state.facesVisible,
      edgesVisible: state.edgesVisible,
      verticesVisible: state.verticesVisible,
      faceColor: state.faceColor,
      edgeColor: state.edgeColor,
    };
  });

  console.log('Appearance Store State:', appearanceState);

  // Try to get render mode from the app
  const renderDebug = await page.evaluate(() => {
    // Check if there's a Three.js scene
    // @ts-ignore
    const canvas = document.querySelector('canvas');
    if (!canvas) return { error: 'No canvas found' };

    // Check if there are any WebGL errors
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return { error: 'No WebGL context' };

    const glError = gl.getError();

    return {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      webglError: glError !== gl.NO_ERROR ? `GL Error: ${glError}` : 'No error',
      contextType: gl instanceof WebGL2RenderingContext ? 'webgl2' : 'webgl',
    };
  });

  console.log('Render Debug:', renderDebug);

  // Log console errors
  const errors = consoleMessages.filter(m => m.type === 'error');
  const warnings = consoleMessages.filter(m => m.type === 'warning');

  console.log('\n=== Console Errors ===');
  if (errors.length === 0) {
    console.log('No errors');
  } else {
    errors.forEach(e => console.log(`  ERROR: ${e.text}`));
  }

  console.log('\n=== Console Warnings ===');
  if (warnings.length === 0) {
    console.log('No warnings');
  } else {
    warnings.slice(0, 10).forEach(w => console.log(`  WARN: ${w.text}`));
  }

  // Take a screenshot with timestamp
  await page.screenshot({
    path: `screenshots/polytopes/debug-hypercube-${Date.now()}.png`,
    fullPage: false,
  });

  // Check that geometry state is correct
  expect(geometryState).not.toHaveProperty('error');
  expect(geometryState.objectType).toBe('hypercube');
  expect(geometryState.dimension).toBeGreaterThanOrEqual(3);
});

test('Check if PolytopeScene receives vertices', async ({ page }) => {
  const consoleMessages: string[] = [];

  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'log') {
      consoleMessages.push(msg.text());
    }
  });

  // Navigate with debug query param - URL param 't' is used for objectType
  await page.goto('/?t=hypercube&debug=true');
  await page.waitForSelector('canvas', { state: 'visible', timeout: 30000 });
  await page.waitForTimeout(5000);

  // Inject a debug probe to check geometry vertices
  const vertexCount = await page.evaluate(() => {
    // @ts-ignore
    const store = window.__GEOMETRY_STORE__;
    if (!store) return -1;

    // We need to check what useGeometryGenerator produces
    // Since we can't hook into React easily, let's check the store
    return store.getState().dimension;
  });

  console.log('Dimension from store:', vertexCount);

  // Check UI store for any render-blocking states
  const uiState = await page.evaluate(() => {
    // @ts-ignore
    const store = window.__UI_STORE__;
    if (!store) return { error: 'UI_STORE not found' };

    const state = store.getState();
    return {
      sidebarOpen: state.sidebarOpen,
      showPerfMonitor: state.showPerfMonitor,
    };
  });

  console.log('UI State:', uiState);

  // Log what console messages we got
  console.log('\n=== Console Logs ===');
  consoleMessages.slice(0, 20).forEach(m => console.log(`  LOG: ${m}`));
});
