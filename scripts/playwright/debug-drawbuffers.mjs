/**
 * Debug script to trace ALL gl.drawBuffers calls
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

page.on('console', msg => {
  const text = msg.text();
  // Filter for relevant logs
  if (text.includes('DRAW_BUFFERS') || text.includes('GL_INVALID') || text.includes('ERROR') ||
      text.includes('MRTStateManager') || text.includes('setRenderTarget')) {
    console.log(`[${msg.type()}] ${text}`);
  }
});

await page.goto('http://localhost:3000');

// Wait for app to initialize
await page.waitForTimeout(500);

// Inject drawBuffers tracer EARLY
await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  const gl = canvas?.getContext('webgl2');
  if (!gl) {
    console.error('No WebGL2 context');
    return;
  }

  // Patch gl.drawBuffers to log all calls with stack trace
  const originalDrawBuffers = gl.drawBuffers.bind(gl);
  let callCount = 0;
  let lastBuffers = null;

  gl.drawBuffers = function(buffers) {
    callCount++;

    // Convert to readable format
    const bufferNames = buffers.map(b => {
      if (b === gl.BACK) return 'BACK';
      if (b === gl.NONE) return 'NONE';
      if (b >= gl.COLOR_ATTACHMENT0 && b <= gl.COLOR_ATTACHMENT15) {
        return `CA${b - gl.COLOR_ATTACHMENT0}`;
      }
      return String(b);
    });

    // Only log if different from last call (reduce noise)
    const buffersStr = bufferNames.join(',');
    if (buffersStr !== lastBuffers) {
      console.log(`[DRAW_BUFFERS #${callCount}] ${buffersStr}`);
      lastBuffers = buffersStr;
    }

    return originalDrawBuffers(buffers);
  };

  // Also track drawElements errors
  const originalDrawElements = gl.drawElements.bind(gl);
  let drawCount = 0;
  gl.drawElements = function(mode, count, type, offset) {
    const result = originalDrawElements(mode, count, type, offset);
    drawCount++;

    // Check for error periodically
    if (drawCount % 5 === 0) {
      const error = gl.getError();
      if (error !== gl.NO_ERROR) {
        console.error(`[ERROR after draw #${drawCount}] GL Error: ${error}, lastDrawBuffers: ${lastBuffers}`);
      }
    }
    return result;
  };

  console.log('[DRAW_BUFFERS] Tracer installed');
});

// Wait and observe
await page.waitForTimeout(4000);

await browser.close();
