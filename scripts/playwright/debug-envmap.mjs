/**
 * Debug script to verify envMap state for black hole gravitational lensing
 */
import { chromium } from 'playwright';

async function debugEnvMap() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Collect console logs
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
  });

  console.log('Navigating to black hole...');
  await page.goto('http://localhost:3000/?t=blackhole');

  // Wait for shader to compile (large shader needs more time)
  console.log('Waiting for shader compilation...');
  await page.waitForTimeout(15000);

  // Check skybox state
  const skyboxState = await page.evaluate(() => {
    const environmentStore = window.__ZUSTAND_STORES?.environment;
    if (!environmentStore) return { error: 'No environment store' };

    const state = environmentStore.getState();
    return {
      skyboxEnabled: state.skyboxEnabled,
      skyboxMode: state.skyboxMode,
      skyboxTexture: state.skyboxTexture,
      skyboxLoading: state.skyboxLoading,
    };
  });
  console.log('\n=== Skybox Store State ===');
  console.log(JSON.stringify(skyboxState, null, 2));

  // Check envMap state
  const envMapState = await page.evaluate(() => {
    const result = {
      sceneBackground: null,
      sceneBackgroundType: null,
      sceneBackgroundMapping: null,
      blackHoleMesh: null,
      envMapUniform: null,
      uEnvMapReady: null,
      shaderHasUSE_ENVMAP: null,
      fragmentShaderLength: null,
    };

    // Check scene
    const scene = window.__R3F__?.scene;
    if (scene) {
      result.sceneBackground = scene.background ? 'SET' : 'NULL';
      if (scene.background) {
        result.sceneBackgroundType = scene.background.constructor.name;
        result.sceneBackgroundMapping = scene.background.mapping;
        result.isCubeTexture = scene.background.isCubeTexture === true;
      }
    }

    // Find black hole mesh
    if (scene) {
      scene.traverse(obj => {
        if (obj.isMesh && obj.material?.fragmentShader?.includes('sampleBackground')) {
          result.blackHoleMesh = 'FOUND';
          const uniforms = obj.material.uniforms;
          if (uniforms) {
            result.envMapUniform = uniforms.envMap?.value ? 'SET' : 'NULL';
            result.uEnvMapReady = uniforms.uEnvMapReady?.value;
            if (uniforms.envMap?.value) {
              result.envMapType = uniforms.envMap.value.constructor.name;
              result.envMapMapping = uniforms.envMap.value.mapping;
            }
          }
          // Check if USE_ENVMAP is in shader
          result.shaderHasUSE_ENVMAP = obj.material.fragmentShader.includes('USE_ENVMAP');
          result.fragmentShaderLength = obj.material.fragmentShader.length;

          // Check for #define USE_ENVMAP
          result.shaderHasDefineUSE_ENVMAP = obj.material.fragmentShader.includes('#define USE_ENVMAP') ||
                                              obj.material.fragmentShader.includes('texture(envMap');
        }
      });
    }

    return result;
  });

  console.log('\n=== envMap Debug State ===');
  console.log(JSON.stringify(envMapState, null, 2));

  // Check relevant logs
  const envMapLogs = logs.filter(l =>
    l.includes('envMap') ||
    l.includes('EnvMapReady') ||
    l.includes('composeBlackHoleShader')
  );

  console.log('\n=== Relevant Console Logs ===');
  envMapLogs.forEach(l => console.log(l));

  // Take screenshot
  await page.screenshot({ path: 'screenshots/debug-envmap.png' });
  console.log('\nScreenshot saved: screenshots/debug-envmap.png');

  // Check canvas content
  const canvasInfo = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { error: 'No canvas found' };

    const ctx = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!ctx) return { error: 'No WebGL context' };

    // Read a sample of pixels from the center
    const width = canvas.width;
    const height = canvas.height;
    const pixels = new Uint8Array(4 * 100 * 100);
    ctx.readPixels(
      Math.floor(width/2) - 50,
      Math.floor(height/2) - 50,
      100, 100,
      ctx.RGBA, ctx.UNSIGNED_BYTE, pixels
    );

    // Count non-black pixels
    let nonBlack = 0;
    let totalBrightness = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i+1];
      const b = pixels[i+2];
      if (r > 5 || g > 5 || b > 5) nonBlack++;
      totalBrightness += r + g + b;
    }

    return {
      width,
      height,
      centerNonBlackPixels: nonBlack,
      totalSampled: 10000,
      avgBrightness: totalBrightness / (10000 * 3),
    };
  });

  console.log('\n=== Canvas Center Sample ===');
  console.log(JSON.stringify(canvasInfo, null, 2));

  await browser.close();
}

debugEnvMap().catch(console.error);
