/**
 * Debug script to verify gravitational lensing after shader compilation
 */
import { chromium } from 'playwright';

async function debugLensing() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Collect console logs
  const logs = [];
  page.on('console', msg => logs.push(msg.text()));

  console.log('Navigating to black hole...');
  await page.goto('http://localhost:3000/?t=blackhole');

  // Wait for shader compilation to complete (dialog to disappear)
  console.log('Waiting for shader compilation...');
  try {
    // Wait for the "Building shader" dialog to disappear
    await page.waitForFunction(() => {
      const shaderDialog = document.querySelector('[class*="loading"]');
      return !shaderDialog || shaderDialog.textContent?.includes('Building') === false;
    }, { timeout: 60000 });
  } catch {
    console.log('Timed out waiting for shader dialog');
  }

  // Wait additional time for envMap to be set
  await page.waitForTimeout(3000);

  // Check shader and envMap state
  const state = await page.evaluate(() => {
    const result = {
      hasBlackHoleMesh: false,
      envMapReady: null,
      envMapValue: null,
      shaderFeatures: [],
      uniformsSet: [],
      sceneBackground: null,
    };

    const scene = window.__R3F__?.scene;
    if (!scene) return { error: 'No R3F scene' };

    result.sceneBackground = scene.background ? {
      type: scene.background.constructor.name,
      mapping: scene.background.mapping,
      isCubeTexture: scene.background.isCubeTexture || false,
    } : null;

    // Find black hole mesh by checking for specific uniforms
    scene.traverse(obj => {
      if (obj.isMesh && obj.material?.uniforms?.uHorizonRadius) {
        result.hasBlackHoleMesh = true;
        const uniforms = obj.material.uniforms;

        // Check envMap uniform
        result.envMapReady = uniforms.uEnvMapReady?.value;
        result.envMapValue = uniforms.envMap?.value ? {
          type: uniforms.envMap.value.constructor.name,
          mapping: uniforms.envMap.value.mapping,
        } : null;

        // List all set uniforms
        for (const [key, uniform] of Object.entries(uniforms)) {
          if (uniform.value !== null && uniform.value !== undefined) {
            const type = typeof uniform.value;
            const isThreeObj = uniform.value?.isVector3 || uniform.value?.isColor || uniform.value?.isMatrix4;
            result.uniformsSet.push(`${key}: ${isThreeObj ? 'THREE obj' : type}`);
          }
        }

        // Check shader defines
        if (obj.material.fragmentShader) {
          if (obj.material.fragmentShader.includes('#define USE_ENVMAP')) {
            result.shaderFeatures.push('USE_ENVMAP');
          }
          if (obj.material.fragmentShader.includes('texture(envMap')) {
            result.shaderFeatures.push('texture(envMap)');
          }
          if (obj.material.fragmentShader.includes('sampleBackground')) {
            result.shaderFeatures.push('sampleBackground()');
          }
        }
      }
    });

    return result;
  });

  console.log('\n=== Black Hole State ===');
  console.log(JSON.stringify(state, null, 2));

  // Read center pixels
  const pixels = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { error: 'No canvas' };

    const gl = canvas.getContext('webgl2');
    if (!gl) return { error: 'No WebGL2' };

    const w = canvas.width;
    const h = canvas.height;

    // Sample multiple regions
    const regions = {
      center: { x: w/2 - 10, y: h/2 - 10, w: 20, h: 20 },
      topLeft: { x: 10, y: h - 30, w: 20, h: 20 },
      topRight: { x: w - 30, y: h - 30, w: 20, h: 20 },
      bottomLeft: { x: 10, y: 10, w: 20, h: 20 },
      bottomRight: { x: w - 30, y: 10, w: 20, h: 20 },
    };

    const results = {};
    for (const [name, r] of Object.entries(regions)) {
      const pixels = new Uint8Array(4 * r.w * r.h);
      gl.readPixels(r.x, r.y, r.w, r.h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      let nonBlack = 0;
      let totalR = 0, totalG = 0, totalB = 0;
      const count = r.w * r.h;

      for (let i = 0; i < pixels.length; i += 4) {
        totalR += pixels[i];
        totalG += pixels[i + 1];
        totalB += pixels[i + 2];
        if (pixels[i] > 5 || pixels[i + 1] > 5 || pixels[i + 2] > 5) nonBlack++;
      }

      results[name] = {
        nonBlackPct: (nonBlack / count * 100).toFixed(1),
        avgR: (totalR / count).toFixed(1),
        avgG: (totalG / count).toFixed(1),
        avgB: (totalB / count).toFixed(1),
      };
    }

    return results;
  });

  console.log('\n=== Pixel Samples ===');
  console.log(JSON.stringify(pixels, null, 2));

  // Take screenshot
  await page.screenshot({ path: 'screenshots/debug-lensing.png', timeout: 60000 });
  console.log('\nScreenshot: screenshots/debug-lensing.png');

  // Show relevant logs
  const relevantLogs = logs.filter(l =>
    l.includes('envMap') ||
    l.includes('SYNCED') ||
    l.includes('transitioned')
  );
  if (relevantLogs.length > 0) {
    console.log('\n=== Relevant Logs ===');
    relevantLogs.forEach(l => console.log(l));
  }

  await browser.close();
}

debugLensing().catch(console.error);
