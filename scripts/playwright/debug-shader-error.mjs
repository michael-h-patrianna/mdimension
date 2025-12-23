/**
 * Debug shader that causes GL_INVALID_OPERATION
 *
 * Traces:
 * 1. Every setRenderTarget call with target info
 * 2. Every drawBuffers call
 * 3. Every useProgram call (shader switch)
 * 4. Error with full context on draw
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

console.log('Injecting comprehensive shader/draw tracer...\n');

await page.goto('http://localhost:3000');
await page.waitForTimeout(500);

// Inject tracer
await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  const gl = canvas?.getContext('webgl2');
  if (!gl) {
    console.error('No WebGL2 context');
    return;
  }

  let frameNum = 0;
  let callNum = 0;
  let currentProgram = null;
  let currentTarget = 'screen';
  let currentDrawBuffers = 'unknown';

  // Track programs for identification
  const programNames = new WeakMap();
  let programCounter = 0;

  // Patch useProgram to track current shader
  const origUseProgram = gl.useProgram.bind(gl);
  gl.useProgram = function(program) {
    if (program && !programNames.has(program)) {
      programNames.set(program, `prog_${programCounter++}`);
    }
    currentProgram = program ? programNames.get(program) : 'null';
    return origUseProgram(program);
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
    currentDrawBuffers = names.join(',');

    if (frameNum <= 3) {
      console.log(`[${frameNum}:${callNum++}] drawBuffers(${currentDrawBuffers})`);
    }
    return origDrawBuffers(buffers);
  };

  // Patch bindFramebuffer
  const origBindFramebuffer = gl.bindFramebuffer.bind(gl);
  gl.bindFramebuffer = function(target, fb) {
    currentTarget = fb ? 'FBO' : 'screen';
    return origBindFramebuffer(target, fb);
  };

  // Patch drawElements
  const origDrawElements = gl.drawElements.bind(gl);
  gl.drawElements = function(mode, count, type, offset) {
    const result = origDrawElements(mode, count, type, offset);
    const error = gl.getError();

    if (error !== gl.NO_ERROR) {
      console.error(`[${frameNum}:${callNum++}] !! DRAW ERROR ${error} !!`);
      console.error(`  target=${currentTarget}`);
      console.error(`  drawBuffers=${currentDrawBuffers}`);
      console.error(`  program=${currentProgram}`);
      console.error(`  count=${count}`);

      // Get shader source for identification
      if (currentProgram !== 'null') {
        const programs = gl.getProgramParameter;
        console.error(`  (Check console for shader details)`);
      }
    }

    return result;
  };

  // Patch drawArrays
  const origDrawArrays = gl.drawArrays.bind(gl);
  gl.drawArrays = function(mode, first, count) {
    const result = origDrawArrays(mode, first, count);
    const error = gl.getError();

    if (error !== gl.NO_ERROR) {
      console.error(`[${frameNum}:${callNum++}] !! DRAWARRAYS ERROR ${error} !!`);
      console.error(`  target=${currentTarget}`);
      console.error(`  drawBuffers=${currentDrawBuffers}`);
      console.error(`  program=${currentProgram}`);
      console.error(`  count=${count}`);
    }

    return result;
  };

  // Track frames
  const origRAF = window.requestAnimationFrame;
  window.requestAnimationFrame = function(cb) {
    return origRAF((time) => {
      frameNum++;
      callNum = 0;
      if (frameNum <= 3) {
        console.log(`\n========== FRAME ${frameNum} ==========`);
      }
      cb(time);
    });
  };

  console.log('[TRACER] Comprehensive shader/draw tracer installed');
});

// Collect console output
page.on('console', msg => {
  const text = msg.text();
  if (text.includes('FRAME') || text.includes('ERROR') || text.includes('drawBuffers') || text.includes('TRACER')) {
    console.log(text);
  }
});

await page.waitForTimeout(4000);
await browser.close();
