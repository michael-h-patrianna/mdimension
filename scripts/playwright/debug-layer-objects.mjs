/**
 * Debug script to enumerate all objects on each render layer
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

page.on('console', msg => {
  console.log(`[${msg.type()}] ${msg.text()}`);
});

await page.goto('http://localhost:3000');

// Wait for scene to fully load
await page.waitForTimeout(3000);

// Inject debug code to enumerate objects per layer
const layerInfo = await page.evaluate(() => {
  // Access Three.js scene via R3F
  const canvas = document.querySelector('canvas');
  const gl = canvas?.__r3f?.gl;
  const scene = canvas?.__r3f?.scene;

  if (!scene) {
    return { error: 'Scene not found' };
  }

  const RENDER_LAYERS = {
    ENVIRONMENT: 0,
    MAIN_OBJECT: 1,
    SKYBOX: 2,
    VOLUMETRIC: 3,
    DEBUG: 4,
  };

  const layerObjects = {
    ENVIRONMENT: [],
    MAIN_OBJECT: [],
    SKYBOX: [],
    VOLUMETRIC: [],
    DEBUG: [],
    OTHER: [],
  };

  scene.traverse((obj) => {
    // Get object info
    const info = {
      type: obj.constructor.name,
      name: obj.name || '(unnamed)',
      visible: obj.visible,
      layersMask: obj.layers?.mask,
      material: null,
    };

    // If it's a mesh with material, get material info
    if (obj.isMesh || obj.isLine || obj.isLineSegments || obj.isPoints) {
      const mat = obj.material;
      if (mat) {
        info.material = {
          type: mat.constructor.name,
          isShaderMaterial: mat.isShaderMaterial,
          hasGlslVersion: mat.glslVersion === 768, // THREE.GLSL3 = 0x300 = 768
        };
        // Check if it's a custom shader with MRT outputs
        if (mat.isShaderMaterial && mat.fragmentShader) {
          info.material.hasMRTOutputs = mat.fragmentShader.includes('layout(location');
          info.material.outputCount = (mat.fragmentShader.match(/layout\(location/g) || []).length;
        }
      }
    }

    // Determine which layer(s) the object is on
    const mask = obj.layers?.mask || 0;
    let assigned = false;

    for (const [layerName, layerNum] of Object.entries(RENDER_LAYERS)) {
      if (mask & (1 << layerNum)) {
        layerObjects[layerName].push(info);
        assigned = true;
      }
    }

    if (!assigned && mask !== 0) {
      layerObjects.OTHER.push({ ...info, mask });
    }
  });

  return layerObjects;
});

console.log('\n=== Layer Analysis ===\n');

for (const [layerName, objects] of Object.entries(layerInfo)) {
  if (objects.length === 0) continue;

  console.log(`\n--- ${layerName} Layer (${objects.length} objects) ---`);

  // Group by type
  const typeGroups = {};
  for (const obj of objects) {
    const key = `${obj.type}:${obj.material?.type || 'no-material'}`;
    if (!typeGroups[key]) typeGroups[key] = [];
    typeGroups[key].push(obj);
  }

  for (const [key, group] of Object.entries(typeGroups)) {
    console.log(`  ${key}: ${group.length} objects`);
    // Show first example
    const example = group[0];
    if (example.material) {
      console.log(`    - ShaderMaterial: ${example.material.isShaderMaterial}`);
      console.log(`    - GLSL3: ${example.material.hasGlslVersion}`);
      if (example.material.hasMRTOutputs !== undefined) {
        console.log(`    - MRT outputs: ${example.material.hasMRTOutputs} (${example.material.outputCount} locations)`);
      }
    }
  }
}

// Also check for any objects with non-MRT shaders on MRT-rendered layers
console.log('\n\n=== Potential MRT Issues ===');
const mrtLayers = ['ENVIRONMENT', 'MAIN_OBJECT', 'SKYBOX'];
let foundIssues = false;

for (const layerName of mrtLayers) {
  const objects = layerInfo[layerName] || [];
  for (const obj of objects) {
    if (obj.material && obj.visible) {
      const mat = obj.material;
      // Check if shader material without MRT outputs
      if (mat.isShaderMaterial && mat.hasMRTOutputs === false) {
        console.log(`WARNING: ${layerName}/${obj.type}/${obj.name} has ShaderMaterial without MRT outputs!`);
        foundIssues = true;
      }
      // Check if standard Three.js material
      if (!mat.isShaderMaterial && mat.type !== 'ShaderMaterial') {
        console.log(`WARNING: ${layerName}/${obj.type}/${obj.name} uses ${mat.type} (non-MRT compatible)`);
        foundIssues = true;
      }
    }
  }
}

if (!foundIssues) {
  console.log('No obvious MRT issues found in object materials.');
}

await browser.close();
