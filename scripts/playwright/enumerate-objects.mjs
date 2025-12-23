/**
 * Enumerate ALL objects in the scene and their layers
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

// Suppress most console logs during initial render
let suppressLogs = true;
page.on('console', msg => {
  if (!suppressLogs) {
    console.log(`[${msg.type()}] ${msg.text()}`);
  }
});

await page.goto('http://localhost:3000');
await page.waitForTimeout(2000);
suppressLogs = false;

// Enumerate all objects
const result = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  // Try multiple ways to access the scene
  let scene = canvas?.__r3f?.scene;

  if (!scene) {
    // Try accessing through R3F store
    const store = canvas?.__r3f?.store?.getState?.();
    scene = store?.scene;
  }

  if (!scene) {
    // Try looking for THREE in global scope
    const THREE = window.THREE;
    if (THREE?.Cache?.files) {
      console.log('Found THREE but no scene access');
    }
  }

  // Try to find scene via fiber root
  const fiberRoot = canvas?._reactRootContainer?._internalRoot?.current;
  console.log('Fiber root:', fiberRoot ? 'found' : 'not found');

  if (!scene) {
    return { error: 'Scene not found' };
  }

  const objects = [];

  scene.traverse((obj) => {
    const info = {
      type: obj.constructor.name,
      name: obj.name || '',
      visible: obj.visible,
      layerMask: obj.layers?.mask,
      layers: [],
      hasMaterial: false,
      materialType: null,
      hasFragmentShader: false,
      outputCount: 0,
      parent: obj.parent?.constructor?.name || null,
    };

    // Decode layer mask to array of layer numbers
    if (obj.layers?.mask) {
      for (let i = 0; i < 32; i++) {
        if (obj.layers.mask & (1 << i)) {
          info.layers.push(i);
        }
      }
    }

    // Check if it has renderable material
    if (obj.isMesh || obj.isLine || obj.isLineSegments || obj.isPoints) {
      const mat = obj.material;
      if (mat) {
        info.hasMaterial = true;
        info.materialType = mat.constructor.name;
        if (mat.fragmentShader) {
          info.hasFragmentShader = true;
          // Count layout(location outputs
          const matches = mat.fragmentShader.match(/layout\s*\(\s*location\s*=/g);
          info.outputCount = matches ? matches.length : 0;
        }
      }
    }

    objects.push(info);
  });

  return objects;
});

// Analyze results
console.log('\n=== All Scene Objects ===\n');

if (result.error) {
  console.log('Error:', result.error);
  await browser.close();
  process.exit(1);
}

// Group by layer
const byLayer = {};
for (const obj of result) {
  for (const layer of obj.layers) {
    if (!byLayer[layer]) byLayer[layer] = [];
    byLayer[layer].push(obj);
  }
}

const layerNames = {
  0: 'ENVIRONMENT',
  1: 'MAIN_OBJECT',
  2: 'SKYBOX',
  3: 'VOLUMETRIC',
  4: 'DEBUG',
};

for (const [layer, objs] of Object.entries(byLayer).sort((a, b) => a[0] - b[0])) {
  const layerName = layerNames[layer] || `LAYER_${layer}`;
  console.log(`\n--- Layer ${layer} (${layerName}): ${objs.length} objects ---`);

  for (const obj of objs) {
    const flags = [];
    if (!obj.visible) flags.push('HIDDEN');
    if (obj.hasMaterial) {
      flags.push(`mat:${obj.materialType}`);
      if (obj.hasFragmentShader) {
        flags.push(`outputs:${obj.outputCount}`);
      }
    }

    console.log(`  ${obj.type}${obj.name ? ` "${obj.name}"` : ''} [${flags.join(', ')}]`);
  }
}

// Check for potential issues
console.log('\n=== Potential MRT Issues ===\n');

const mrtLayers = [0, 1, 2]; // ENVIRONMENT, MAIN_OBJECT, SKYBOX
let foundIssues = false;

for (const obj of result) {
  // Check if object is on MRT layers
  const onMRTLayer = obj.layers.some(l => mrtLayers.includes(l));

  if (onMRTLayer && obj.visible && obj.hasMaterial) {
    // Check for potential issues
    if (obj.hasFragmentShader && obj.outputCount < 3) {
      console.log(`WARNING: ${obj.type} "${obj.name}" has only ${obj.outputCount} MRT outputs on layer ${obj.layers}`);
      foundIssues = true;
    }
    if (!obj.hasFragmentShader && obj.materialType !== 'ShaderMaterial') {
      // Standard Three.js materials don't have MRT outputs
      console.log(`WARNING: ${obj.type} "${obj.name}" uses ${obj.materialType} (no MRT) on layer ${obj.layers}`);
      foundIssues = true;
    }
  }
}

if (!foundIssues) {
  console.log('No obvious issues found in visible objects.');
}

await browser.close();
