/**
 * Trace EVERY render call and drawBuffers state to understand the exact sequence
 * that causes GL_INVALID_OPERATION
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

console.log('Injecting comprehensive GL tracer...\n');

await page.goto('http://localhost:3000');
await page.waitForTimeout(500);

// Inject tracer EARLY
await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  const gl = canvas?.getContext('webgl2');
  if (!gl) {
    console.error('No WebGL2 context');
    return;
  }

  let frameNum = 0;
  let callNum = 0;
  let lastDrawBuffers = null;
  let lastFramebuffer = null;

  // Track current state
  const state = {
    drawBuffers: 'unknown',
    framebuffer: 'default',
    program: null
  };

  // Patch drawBuffers
  const origDrawBuffers = gl.drawBuffers.bind(gl);
  gl.drawBuffers = function(buffers) {
    const names = buffers.map(b => {
      if (b === gl.BACK) return 'BACK';
      if (b === gl.NONE) return 'NONE';
      if (b >= gl.COLOR_ATTACHMENT0 && b <= gl.COLOR_ATTACHMENT15) {
        return `CA${b - gl.COLOR_ATTACHMENT0}`;
      }
      return b;
    });
    state.drawBuffers = names.join(',');
    console.log(`[${frameNum}:${callNum++}] drawBuffers(${state.drawBuffers})`);
    return origDrawBuffers(buffers);
  };

  // Patch bindFramebuffer
  const origBindFramebuffer = gl.bindFramebuffer.bind(gl);
  gl.bindFramebuffer = function(target, fb) {
    state.framebuffer = fb ? 'FBO' : 'default';
    // Don't log every bind - too noisy
    return origBindFramebuffer(target, fb);
  };

  // Patch drawElements to catch the actual render
  const origDrawElements = gl.drawElements.bind(gl);
  gl.drawElements = function(mode, count, type, offset) {
    const result = origDrawElements(mode, count, type, offset);

    // Check for error immediately after draw
    const error = gl.getError();
    if (error !== gl.NO_ERROR) {
      console.error(`[${frameNum}:${callNum++}] !! DRAW ERROR ${error} !! fb=${state.framebuffer} drawBuffers=${state.drawBuffers}`);
    }

    return result;
  };

  // Patch drawArrays too
  const origDrawArrays = gl.drawArrays.bind(gl);
  gl.drawArrays = function(mode, first, count) {
    const result = origDrawArrays(mode, first, count);

    const error = gl.getError();
    if (error !== gl.NO_ERROR) {
      console.error(`[${frameNum}:${callNum++}] !! DRAWARRAYS ERROR ${error} !! fb=${state.framebuffer} drawBuffers=${state.drawBuffers}`);
    }

    return result;
  };

  // Track frame boundaries via requestAnimationFrame
  const origRAF = window.requestAnimationFrame;
  window.requestAnimationFrame = function(cb) {
    return origRAF((time) => {
      frameNum++;
      callNum = 0;
      if (frameNum <= 5) {
        console.log(`\n========== FRAME ${frameNum} ==========`);
      }
      cb(time);
    });
  };

  console.log('[TRACER] Installed - watching for errors');
});

// Collect console output
page.on('console', msg => {
  const text = msg.text();
  // Only show relevant logs
  if (text.includes('FRAME') || text.includes('ERROR') || text.includes('drawBuffers')) {
    console.log(text);
  }
});

await page.waitForTimeout(3000);
await browser.close();
