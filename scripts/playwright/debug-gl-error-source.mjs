/**
 * Debug GL_INVALID_OPERATION error source
 *
 * Traces all setRenderTarget and render calls to find where the error originates
 */
import { chromium } from 'playwright';

const URL = process.env.URL || 'http://localhost:3000';

async function main() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Capture console messages
  const glErrors = [];
  const renderCalls = [];

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('GL_INVALID_OPERATION')) {
      glErrors.push(text);
      console.log('🔴 GL ERROR:', text);
    }
  });

  // Inject debugging before page loads
  await page.addInitScript(() => {
    window.__DEBUG_RENDER_CALLS = [];
    window.__DEBUG_GL_ERRORS = [];

    // Hook into WebGL2 to catch the exact moment of error
    const originalGetError = WebGL2RenderingContext.prototype.getError;
    WebGL2RenderingContext.prototype.getError = function() {
      const error = originalGetError.call(this);
      if (error !== 0) {
        const stack = new Error().stack;
        window.__DEBUG_GL_ERRORS.push({
          error,
          errorName: error === 0x0502 ? 'GL_INVALID_OPERATION' : `0x${error.toString(16)}`,
          stack,
          timestamp: performance.now()
        });
      }
      return error;
    };

    // Hook drawElements to catch the error location
    const originalDrawElements = WebGL2RenderingContext.prototype.drawElements;
    WebGL2RenderingContext.prototype.drawElements = function(...args) {
      const result = originalDrawElements.apply(this, args);
      const error = originalGetError.call(this);
      if (error !== 0) {
        const stack = new Error().stack;
        console.error(`[DrawElements Error] error=${error}, stack:`, stack.split('\n').slice(0, 10).join('\n'));
        window.__DEBUG_GL_ERRORS.push({
          call: 'drawElements',
          args: args.map(a => typeof a === 'number' ? a : String(a)),
          error,
          stack,
          timestamp: performance.now()
        });
      }
      return result;
    };

    // Hook drawArrays too
    const originalDrawArrays = WebGL2RenderingContext.prototype.drawArrays;
    WebGL2RenderingContext.prototype.drawArrays = function(...args) {
      const result = originalDrawArrays.apply(this, args);
      const error = originalGetError.call(this);
      if (error !== 0) {
        const stack = new Error().stack;
        console.error(`[DrawArrays Error] error=${error}, stack:`, stack.split('\n').slice(0, 10).join('\n'));
        window.__DEBUG_GL_ERRORS.push({
          call: 'drawArrays',
          args: args.map(a => typeof a === 'number' ? a : String(a)),
          error,
          stack,
          timestamp: performance.now()
        });
      }
      return result;
    };
  });

  console.log('Navigating to', URL);
  await page.goto(URL, { waitUntil: 'networkidle' });

  // Wait for rendering to stabilize
  await page.waitForTimeout(3000);

  // Get debug info
  const debugInfo = await page.evaluate(() => {
    return {
      glErrors: window.__DEBUG_GL_ERRORS || [],
      renderCalls: window.__DEBUG_RENDER_CALLS || []
    };
  });

  console.log('\n=== GL Errors Captured ===');
  if (debugInfo.glErrors.length === 0) {
    console.log('No GL errors captured via hooks');
  } else {
    for (const err of debugInfo.glErrors.slice(0, 5)) {
      console.log(`\nError: ${err.errorName || err.error}`);
      console.log(`Call: ${err.call || 'unknown'}`);
      console.log(`Args: ${JSON.stringify(err.args)}`);
      console.log(`Stack (first 10 lines):\n${err.stack?.split('\n').slice(0, 10).join('\n')}`);
    }
  }

  // Check what's in the scene
  const sceneInfo = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas || !canvas.__three_scene) {
      return { error: 'No scene found' };
    }

    const scene = canvas.__three_scene;
    const children = [];

    scene.traverse(obj => {
      if (obj.type !== 'Scene' && obj.type !== 'Group') {
        children.push({
          name: obj.name || obj.type,
          type: obj.type,
          visible: obj.visible,
          layers: obj.layers?.mask,
          material: obj.material?.type || 'none'
        });
      }
    });

    return {
      childCount: children.length,
      children: children.slice(0, 20),
      background: scene.background?.constructor?.name || 'null',
      environment: scene.environment?.constructor?.name || 'null'
    };
  });

  console.log('\n=== Scene Info ===');
  console.log(JSON.stringify(sceneInfo, null, 2));

  // Take screenshot
  await page.screenshot({ path: 'screenshots/gl-error-debug.png' });
  console.log('\nScreenshot saved to screenshots/gl-error-debug.png');

  // Keep browser open for manual inspection
  console.log('\nBrowser staying open for inspection. Press Ctrl+C to close.');
  await new Promise(() => {}); // Keep alive
}

main().catch(console.error);
