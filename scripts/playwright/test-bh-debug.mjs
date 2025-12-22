import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const allLogs = [];
page.on('console', msg => allLogs.push(`[${msg.type()}] ${msg.text()}`));

await page.goto('http://localhost:3000/?t=blackhole', { waitUntil: 'networkidle' });
await page.waitForTimeout(5000);

// Check scene state
const info = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return { error: 'No canvas' };

  const gl = canvas.getContext('webgl2');
  if (!gl) return { error: 'No WebGL2' };

  // Check for WebGL errors
  const glError = gl.getError();

  // Count pixels
  const w = canvas.width, h = canvas.height;
  const pixels = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  let colored = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i] > 5 || pixels[i+1] > 5 || pixels[i+2] > 5) colored++;
  }

  // Check if black hole mesh exists via R3F internals
  let bhMesh = null;
  const allMeshes = [];
  document.querySelectorAll('canvas').forEach(c => {
    const r3f = c.__r3f;
    if (r3f?.root) {
      const state = r3f.root.getState();
      if (state?.scene) {
        state.scene.traverse(obj => {
          if (obj.isMesh) allMeshes.push(obj.name || obj.type);
          if (obj.material?.uniforms?.uHorizonRadius !== undefined) {
            bhMesh = {
              name: obj.name,
              visible: obj.visible,
              layers: obj.layers.mask,
              parent: obj.parent?.name || obj.parent?.type,
            };
          }
        });
      }
    }
  });

  return {
    canvasSize: [w, h],
    glError,
    coloredPct: (colored / (w * h) * 100).toFixed(1),
    blackHoleMesh: bhMesh,
    meshCount: allMeshes.length,
    meshNames: allMeshes.slice(0, 10),
  };
});

console.log('Scene info:', JSON.stringify(info, null, 2));

// Check for GL errors in logs
const glErrors = allLogs.filter(l => l.includes('GL_INVALID') || l.includes('WebGL'));
if (glErrors.length) {
  console.log('\nWebGL errors:', glErrors.slice(0, 5).join('\n'));
}

await page.screenshot({ path: 'screenshots/bh-debug.png' });
console.log('\nScreenshot: screenshots/bh-debug.png');
await browser.close();
