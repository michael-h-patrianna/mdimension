/**
 * Trace GL error source by injecting detailed logging
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

const logs = [];

page.on('console', msg => {
  const text = msg.text();
  logs.push(`[${msg.type()}] ${text}`);

  // Only log MRT-related and error messages to keep output clean
  if (text.includes('MRT') || text.includes('GL') || text.includes('drawBuffers') ||
      text.includes('INVALID') || text.includes('ERROR') || text.includes('render')) {
    console.log(`[${msg.type()}] ${text}`);
  }
});

await page.goto('http://localhost:3000');

// Wait for initial render
await page.waitForTimeout(2000);

// Inject GL call tracing
await page.evaluate(() => {
  const gl = document.querySelector('canvas')?.getContext('webgl2');
  if (!gl) {
    console.error('No WebGL2 context found');
    return;
  }

  // Track drawBuffers calls
  const originalDrawBuffers = gl.drawBuffers.bind(gl);
  gl.drawBuffers = function(buffers) {
    console.log('[GL_TRACE] drawBuffers:', JSON.stringify(buffers.map(b => {
      if (b === gl.BACK) return 'BACK';
      if (b === gl.NONE) return 'NONE';
      if (b >= gl.COLOR_ATTACHMENT0 && b <= gl.COLOR_ATTACHMENT15) {
        return `COLOR_ATTACHMENT${b - gl.COLOR_ATTACHMENT0}`;
      }
      return b;
    })));
    return originalDrawBuffers(buffers);
  };

  // Track drawElements to catch when error occurs
  const originalDrawElements = gl.drawElements.bind(gl);
  let drawCount = 0;
  gl.drawElements = function(mode, count, type, offset) {
    const result = originalDrawElements(mode, count, type, offset);
    drawCount++;

    // Check for error after every 10 draws to reduce overhead
    if (drawCount % 10 === 0) {
      const error = gl.getError();
      if (error !== gl.NO_ERROR) {
        console.error(`[GL_TRACE] ERROR ${error} after drawElements #${drawCount}`);
      }
    }
    return result;
  };

  // Track useProgram to see which shader is active
  const originalUseProgram = gl.useProgram.bind(gl);
  let lastProgramId = null;
  gl.useProgram = function(program) {
    if (program !== lastProgramId) {
      lastProgramId = program;
      // Don't log every program change - too noisy
    }
    return originalUseProgram(program);
  };

  console.log('[GL_TRACE] Tracing enabled');
});

// Wait and observe
await page.waitForTimeout(5000);

console.log('\n\n=== Summary ===');
const glErrors = logs.filter(l => l.includes('INVALID') || l.includes('ERROR'));
console.log(`Total GL errors: ${glErrors.length}`);
if (glErrors.length > 0) {
  console.log('First 5 errors:');
  glErrors.slice(0, 5).forEach(e => console.log(e));
}

await browser.close();
