import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3000';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });

  await page.goto(`${BASE_URL}/?t=blackhole`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);

  const meshState = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    // Try multiple ways to get the scene
    let scene = null;
    if (canvas?.__r3f) {
      scene = canvas.__r3f.scene || canvas.__r3f.root?.getState?.()?.scene;
    }
    // Try window globals
    if (!scene && window.__THREE_DEVTOOLS__) {
      const scenes = window.__THREE_DEVTOOLS__.scenes;
      if (scenes && scenes.length > 0) scene = scenes[0];
    }
    // Try fiber store
    if (!scene) {
      const fiber = canvas?._reactRootContainer?._internalRoot?.current;
      // This is getting complicated, let's just check if mesh renders
    }
    if (!scene) return { error: 'No scene accessible' };

    let blackHoleMesh = null;
    const meshes = [];

    scene.traverse((obj) => {
      if (obj.isMesh && obj.material?.uniforms?.uHorizonRadius) {
        blackHoleMesh = obj;
      }
      if (obj.isMesh) {
        meshes.push({
          name: obj.name || obj.uuid.slice(0, 8),
          visible: obj.visible,
          layers: obj.layers.mask,
          frustumCulled: obj.frustumCulled,
          materialType: obj.material?.type,
          hasUniforms: !!obj.material?.uniforms,
        });
      }
    });

    if (!blackHoleMesh) return { error: 'No black hole mesh found', meshCount: meshes.length, meshes };

    const mat = blackHoleMesh.material;
    return {
      found: true,
      visible: blackHoleMesh.visible,
      layers: blackHoleMesh.layers.mask,
      frustumCulled: blackHoleMesh.frustumCulled,
      position: [blackHoleMesh.position.x, blackHoleMesh.position.y, blackHoleMesh.position.z],
      scale: [blackHoleMesh.scale.x, blackHoleMesh.scale.y, blackHoleMesh.scale.z],
      materialVisible: mat?.visible,
      materialType: mat?.type,
      fragmentShaderLen: mat?.fragmentShader?.length || 0,
      uniformsCount: mat?.uniforms ? Object.keys(mat.uniforms).length : 0,
    };
  });

  console.log(JSON.stringify(meshState, null, 2));
  await browser.close();
}

main().catch(console.error);
