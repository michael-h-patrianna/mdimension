/**
 * Quick debug script for black hole rendering - NO screenshots
 * Just checks console for errors and reports mesh state
 */

import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function main() {
  console.log('Launching browser (headless)...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  // Collect console logs
  const errors = [];
  const warnings = [];
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error') {
      errors.push(text);
    } else if (msg.type() === 'warning' && text.includes('BlackHole')) {
      warnings.push(text);
    }
  });

  try {
    // Navigate directly to black hole
    console.log('Loading black hole...');
    await page.goto(`${BASE_URL}/?t=blackhole`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Check if black hole mesh exists and get its state
    const meshInfo = await page.evaluate(() => {
      const scene = window.__THREE_DEVTOOLS__?.scenes?.[0];
      if (!scene) return { error: 'No THREE.js scene found' };

      let blackHoleMesh = null;
      scene.traverse((obj) => {
        if (obj.material?.uniforms?.uHorizonRadius !== undefined) {
          blackHoleMesh = obj;
        }
      });

      if (!blackHoleMesh) return { error: 'No black hole mesh found' };

      const u = blackHoleMesh.material.uniforms;
      return {
        found: true,
        visible: blackHoleMesh.visible,
        layerMask: blackHoleMesh.layers.mask,
        uHorizonRadius: u.uHorizonRadius?.value,
        uManifoldThickness: u.uManifoldThickness?.value,
        uManifoldIntensity: u.uManifoldIntensity?.value,
        uEnvMapReady: u.uEnvMapReady?.value,
        uDiskInnerRadiusMul: u.uDiskInnerRadiusMul?.value,
        uDiskOuterRadiusMul: u.uDiskOuterRadiusMul?.value,
        uBloomBoost: u.uBloomBoost?.value,
        materialSide: blackHoleMesh.material.side,
        transparent: blackHoleMesh.material.transparent,
        depthWrite: blackHoleMesh.material.depthWrite,
      };
    });

    console.log('\n=== Black Hole Mesh State ===');
    console.log(JSON.stringify(meshInfo, null, 2));

    // Get a pixel sample from the center of the canvas to check if anything renders
    const pixelInfo = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return { error: 'No canvas found' };

      const gl = canvas.getContext('webgl2');
      if (!gl) return { error: 'No WebGL2 context' };

      // Read a few pixels from the center
      const width = canvas.width;
      const height = canvas.height;
      const centerX = Math.floor(width / 2);
      const centerY = Math.floor(height / 2);

      const pixels = new Uint8Array(16 * 4); // 4x4 block of pixels
      gl.readPixels(centerX - 2, centerY - 2, 4, 4, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      // Calculate average color
      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        r += pixels[i];
        g += pixels[i + 1];
        b += pixels[i + 2];
        count++;
      }
      r = Math.round(r / count);
      g = Math.round(g / count);
      b = Math.round(b / count);

      const isBlack = r < 10 && g < 10 && b < 10;
      const hasColor = r > 20 || g > 20 || b > 20;

      return {
        centerPixelRGB: [r, g, b],
        isBlack,
        hasColor,
        canvasSize: [width, height],
      };
    });

    console.log('\n=== Pixel Sample (Center of Canvas) ===');
    console.log(JSON.stringify(pixelInfo, null, 2));

    if (errors.length > 0) {
      console.log('\n=== Console Errors ===');
      errors.forEach(e => console.log('ERROR:', e));
    }

    if (warnings.length > 0) {
      console.log('\n=== BlackHole Warnings ===');
      warnings.forEach(w => console.log('WARN:', w));
    }

    // Check for specific issues
    console.log('\n=== Diagnosis ===');
    if (meshInfo.error) {
      console.log('PROBLEM: Black hole mesh not found in scene');
    } else if (!meshInfo.visible) {
      console.log('PROBLEM: Black hole mesh is not visible');
    } else if (meshInfo.uEnvMapReady < 0.5) {
      console.log('INFO: EnvMap not ready - background will be black');
    }

    if (pixelInfo.isBlack) {
      console.log('PROBLEM: Center pixels are black - no color output');
    } else if (pixelInfo.hasColor) {
      console.log('OK: Center pixels have color - rendering may be working');
    }

    console.log('\n=== Debug Complete ===');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
