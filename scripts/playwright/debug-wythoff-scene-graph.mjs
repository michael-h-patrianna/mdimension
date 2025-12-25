/**
 * Debug - Check Three.js scene graph to see what objects are in the scene
 */
import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[DEBUG:') || text.includes('[SCENE]')) {
      console.log(text);
    }
  });
  
  console.log('Opening http://localhost:3000/?t=wythoff-polytope');
  await page.goto('http://localhost:3000/?t=wythoff-polytope');
  
  console.log('Waiting 3 seconds...');
  await page.waitForTimeout(3000);
  
  // Inject code to inspect Three.js scene
  console.log('\n=== Inspecting Three.js Scene Graph ===');
  const sceneInfo = await page.evaluate(() => {
    // Access R3F's root state
    const canvas = document.querySelector('canvas');
    if (!canvas) return { error: 'No canvas found' };
    
    // R3F stores state on canvas.__r3f
    const r3fState = canvas.__r3f;
    if (!r3fState) return { error: 'No R3F state found' };
    
    const scene = r3fState.root.getState().scene;
    if (!scene) return { error: 'No scene found' };
    
    // Traverse scene and collect object info
    const objects = [];
    scene.traverse((obj) => {
      const info = {
        type: obj.constructor.name,
        name: obj.name || '(unnamed)',
        visible: obj.visible,
        layer: obj.layers?.mask,
      };
      
      if (obj.geometry) {
        const geo = obj.geometry;
        info.vertexCount = geo.attributes?.position?.count || 0;
      }
      
      if (obj.material) {
        const mat = obj.material;
        info.materialType = mat.constructor.name;
        info.transparent = mat.transparent;
        info.visible = mat.visible;
        info.depthWrite = mat.depthWrite;
        if (mat.uniforms?.uOpacity) {
          info.opacity = mat.uniforms.uOpacity.value;
        }
      }
      
      // Only include meshes and groups
      if (obj.isMesh || obj.isLineSegments || obj.isGroup) {
        objects.push(info);
      }
    });
    
    return {
      objectCount: objects.length,
      objects: objects,
      sceneBackground: scene.background ? scene.background.constructor.name : null,
      sceneEnvironment: scene.environment ? scene.environment.constructor.name : null,
    };
  });
  
  console.log('\nScene inspection result:');
  console.log(JSON.stringify(sceneInfo, null, 2));
  
  // Check camera
  const cameraInfo = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const r3fState = canvas?.__r3f;
    if (!r3fState) return { error: 'No R3F state' };
    
    const camera = r3fState.root.getState().camera;
    return {
      type: camera.constructor.name,
      position: [camera.position.x, camera.position.y, camera.position.z],
      near: camera.near,
      far: camera.far,
      fov: camera.fov,
    };
  });
  
  console.log('\nCamera info:');
  console.log(JSON.stringify(cameraInfo, null, 2));
  
  // Check WebGL state
  const glState = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const gl = canvas?.getContext('webgl2');
    if (!gl) return { error: 'No WebGL context' };
    
    return {
      viewport: gl.getParameter(gl.VIEWPORT),
      clearColor: gl.getParameter(gl.COLOR_CLEAR_VALUE),
      depthTest: gl.isEnabled(gl.DEPTH_TEST),
      blend: gl.isEnabled(gl.BLEND),
      cullFace: gl.isEnabled(gl.CULL_FACE),
    };
  });
  
  console.log('\nWebGL state:');
  console.log(JSON.stringify(glState, null, 2));
  
  await browser.close();
}

main().catch(console.error);

