/**
 * Debug script for black hole rendering issues
 *
 * Tests:
 * 1. Black hole visibility
 * 2. Accretion disk rendering
 * 3. Gravitational lensing
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.join(process.cwd(), 'screenshots');
const BASE_URL = 'http://localhost:3002';

async function main() {
  // Ensure screenshot directory exists
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  // Collect console logs
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push({ type: msg.type(), text });
    if (text.includes('BlackHole') || text.includes('blackhole') || text.includes('error')) {
      console.log(`[${msg.type()}] ${text}`);
    }
  });

  try {
    // Navigate directly to black hole
    console.log('\n=== Loading Black Hole ===');
    await page.goto(`${BASE_URL}/?object=blackhole`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Take initial screenshot
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'debug-blackhole-initial.png') });
    console.log('Saved: debug-blackhole-initial.png');

    // Check if black hole mesh exists
    const meshExists = await page.evaluate(() => {
      const scene = window.__THREE_DEVTOOLS__?.scenes?.[0];
      if (!scene) return { error: 'No THREE.js scene found' };

      let blackHoleMesh = null;
      scene.traverse((obj) => {
        if (obj.material?.uniforms?.uHorizonRadius !== undefined) {
          blackHoleMesh = obj;
        }
      });

      if (!blackHoleMesh) return { error: 'No black hole mesh found' };

      const uniforms = blackHoleMesh.material.uniforms;
      return {
        found: true,
        visible: blackHoleMesh.visible,
        layers: blackHoleMesh.layers.mask,
        position: [blackHoleMesh.position.x, blackHoleMesh.position.y, blackHoleMesh.position.z],
        scale: [blackHoleMesh.scale.x, blackHoleMesh.scale.y, blackHoleMesh.scale.z],
        uniforms: {
          uHorizonRadius: uniforms.uHorizonRadius?.value,
          uFarRadius: uniforms.uFarRadius?.value,
          uDiskInnerRadiusMul: uniforms.uDiskInnerRadiusMul?.value,
          uDiskOuterRadiusMul: uniforms.uDiskOuterRadiusMul?.value,
          uManifoldIntensity: uniforms.uManifoldIntensity?.value,
          uManifoldThickness: uniforms.uManifoldThickness?.value,
          uEnvMapReady: uniforms.uEnvMapReady?.value,
          uBloomBoost: uniforms.uBloomBoost?.value,
          uGravityStrength: uniforms.uGravityStrength?.value,
          uTime: uniforms.uTime?.value,
        },
        materialType: blackHoleMesh.material.type,
        fragmentShaderLength: blackHoleMesh.material.fragmentShader?.length,
      };
    });

    console.log('\n=== Black Hole Mesh Info ===');
    console.log(JSON.stringify(meshExists, null, 2));

    // Wait and take another screenshot
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'debug-blackhole-2s.png') });
    console.log('Saved: debug-blackhole-2s.png');

    // Check WebGL state
    const webglInfo = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return { error: 'No canvas found' };

      const gl = canvas.getContext('webgl2');
      if (!gl) return { error: 'No WebGL2 context' };

      return {
        drawingBufferWidth: gl.drawingBufferWidth,
        drawingBufferHeight: gl.drawingBufferHeight,
        // Check for WebGL errors
        error: gl.getError(),
      };
    });

    console.log('\n=== WebGL Info ===');
    console.log(JSON.stringify(webglInfo, null, 2));

    // Try to get shader compilation status
    const shaderInfo = await page.evaluate(() => {
      const scene = window.__THREE_DEVTOOLS__?.scenes?.[0];
      if (!scene) return { error: 'No scene' };

      let blackHoleMesh = null;
      scene.traverse((obj) => {
        if (obj.material?.uniforms?.uHorizonRadius !== undefined) {
          blackHoleMesh = obj;
        }
      });

      if (!blackHoleMesh) return { error: 'No mesh' };

      const mat = blackHoleMesh.material;

      // Check if shader has vertex/fragment shader defined
      const hasVertexShader = !!mat.vertexShader && mat.vertexShader.length > 10;
      const hasFragmentShader = !!mat.fragmentShader && mat.fragmentShader.length > 10;

      // Check for common shader issues
      const fragmentShaderPreview = mat.fragmentShader?.substring(0, 500) || 'N/A';

      return {
        hasVertexShader,
        hasFragmentShader,
        vertexShaderLength: mat.vertexShader?.length,
        fragmentShaderLength: mat.fragmentShader?.length,
        glslVersion: mat.glslVersion,
        transparent: mat.transparent,
        depthWrite: mat.depthWrite,
        depthTest: mat.depthTest,
        side: mat.side, // 0=FrontSide, 1=BackSide, 2=DoubleSide
        blending: mat.blending,
        fragmentShaderPreview,
      };
    });

    console.log('\n=== Shader Info ===');
    console.log(JSON.stringify(shaderInfo, null, 2));

    // Check camera position
    const cameraInfo = await page.evaluate(() => {
      const scene = window.__THREE_DEVTOOLS__?.scenes?.[0];
      const camera = window.__THREE_DEVTOOLS__?.cameras?.[0];

      if (!camera) return { error: 'No camera found' };

      return {
        position: [camera.position.x, camera.position.y, camera.position.z],
        fov: camera.fov,
        near: camera.near,
        far: camera.far,
        layers: camera.layers.mask,
      };
    });

    console.log('\n=== Camera Info ===');
    console.log(JSON.stringify(cameraInfo, null, 2));

    // Enable debug mode and check for shader errors
    await page.evaluate(() => {
      // Try to find any WebGL program errors
      const canvas = document.querySelector('canvas');
      const gl = canvas?.getContext('webgl2');
      if (gl) {
        console.log('[DEBUG] WebGL error state:', gl.getError());
      }
    });

    // Wait longer and take final screenshot
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'debug-blackhole-7s.png') });
    console.log('Saved: debug-blackhole-7s.png');

    // Analyze screenshot colors
    console.log('\n=== Console Logs Summary ===');
    const blackHoleLogs = consoleLogs.filter(l =>
      l.text.includes('BlackHole') ||
      l.text.includes('blackhole') ||
      l.text.includes('error') ||
      l.text.includes('Error')
    );
    if (blackHoleLogs.length > 0) {
      blackHoleLogs.forEach(l => console.log(`[${l.type}] ${l.text}`));
    } else {
      console.log('No black hole specific logs found');
    }

    console.log('\n=== Debug Complete ===');
    console.log('Check screenshots in:', SCREENSHOT_DIR);

  } catch (error) {
    console.error('Error:', error);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'debug-blackhole-error.png') });
  } finally {
    // Close browser after analysis
    console.log('\nClosing browser...');
    await browser.close();
  }
}

main().catch(console.error);
