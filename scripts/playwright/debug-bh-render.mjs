/**
 * Debug script - check render pipeline state for black hole
 */
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function main() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const allLogs = [];
  const glErrors = [];

  page.on('console', msg => {
    const text = msg.text();
    allLogs.push({ type: msg.type(), text });
    if (text.includes('GL_INVALID') || text.includes('WebGL')) {
      glErrors.push(text);
    }
  });

  try {
    console.log(`Navigating to ${BASE_URL}/?t=blackhole ...`);
    await page.goto(`${BASE_URL}/?t=blackhole`, { waitUntil: 'networkidle' });

    console.log('Waiting 8 seconds for full initialization...');
    await page.waitForTimeout(8000);

    // Get detailed scene info
    const sceneInfo = await page.evaluate(() => {
      // Find Three.js scene by traversing window
      let threeScene = null;
      let renderer = null;

      // Check for R3F fiber root
      const canvas = document.querySelector('canvas');
      if (canvas && canvas.__r3f) {
        threeScene = canvas.__r3f.scene || canvas.__r3f.root?.getState?.()?.scene;
        renderer = canvas.__r3f.gl || canvas.__r3f.root?.getState?.()?.gl;
      }

      if (!threeScene) {
        return { error: 'Could not find Three.js scene' };
      }

      // Find black hole mesh
      let blackHoleMesh = null;
      let blackHoleMaterial = null;
      const allMeshes = [];

      threeScene.traverse((obj) => {
        if (obj.isMesh) {
          const mat = obj.material;
          const info = {
            name: obj.name || 'unnamed',
            type: obj.type,
            visible: obj.visible,
            layers: obj.layers.mask,
            materialType: mat?.type || 'none',
            hasFragmentShader: !!mat?.fragmentShader,
            fragmentShaderLength: mat?.fragmentShader?.length || 0,
          };
          allMeshes.push(info);

          // Check if it's the black hole (has blackhole-specific uniforms)
          if (mat?.uniforms?.uHorizonRadius !== undefined) {
            blackHoleMesh = obj;
            blackHoleMaterial = mat;
          }
        }
      });

      const result = {
        sceneFound: true,
        sceneBackground: threeScene.background ? 'SET' : 'NULL',
        backgroundType: threeScene.background?.constructor?.name || 'none',
        meshCount: allMeshes.length,
        meshes: allMeshes.slice(0, 10), // First 10
      };

      if (blackHoleMesh && blackHoleMaterial) {
        result.blackHole = {
          found: true,
          visible: blackHoleMesh.visible,
          layers: blackHoleMesh.layers.mask,
          materialType: blackHoleMaterial.type,
          fragmentShaderLength: blackHoleMaterial.fragmentShader?.length || 0,
          uniforms: {
            uHorizonRadius: blackHoleMaterial.uniforms.uHorizonRadius?.value,
            uEnvMapReady: blackHoleMaterial.uniforms.uEnvMapReady?.value,
            uTime: blackHoleMaterial.uniforms.uTime?.value,
          },
          transparent: blackHoleMaterial.transparent,
          depthWrite: blackHoleMaterial.depthWrite,
          side: blackHoleMaterial.side,
        };
      } else {
        result.blackHole = { found: false };
      }

      return result;
    });

    console.log('\n=== Scene Analysis ===');
    console.log(JSON.stringify(sceneInfo, null, 2));

    // Get pixel info
    const pixelInfo = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return { error: 'No canvas' };

      const gl = canvas.getContext('webgl2');
      if (!gl) return { error: 'No WebGL2' };

      const w = canvas.width, h = canvas.height;
      const pixels = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      let black = 0, nonBlack = 0, maxBrightness = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const brightness = (pixels[i] + pixels[i+1] + pixels[i+2]) / 3;
        if (brightness > maxBrightness) maxBrightness = brightness;
        if (pixels[i] < 5 && pixels[i+1] < 5 && pixels[i+2] < 5) black++;
        else nonBlack++;
      }

      return {
        width: w,
        height: h,
        black,
        nonBlack,
        blackPct: (black / (w*h) * 100).toFixed(1),
        maxBrightness
      };
    });

    console.log('\n=== Pixel Analysis ===');
    console.log(JSON.stringify(pixelInfo, null, 2));

    if (glErrors.length > 0) {
      console.log('\n=== GL Errors ===');
      // Unique errors only
      const unique = [...new Set(glErrors)];
      unique.forEach(e => console.log(`  - ${e}`));
      console.log(`(${glErrors.length} total, ${unique.length} unique)`);
    }

    // Filter logs for rendering-related
    const renderLogs = allLogs.filter(l =>
      l.text.includes('BlackHole') ||
      l.text.includes('TrackedShader') ||
      l.text.includes('envMap') ||
      l.text.includes('SYNCED') ||
      l.text.includes('material')
    );
    if (renderLogs.length > 0) {
      console.log('\n=== Rendering Logs ===');
      renderLogs.slice(0, 30).forEach(l => console.log(`[${l.type}] ${l.text}`));
    }

  } finally {
    await browser.close();
  }
}

main().catch(console.error);
