/**
 * Black hole rendering test - counts non-black pixels
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const errors = [];
  const logs = [];

  page.on('console', msg => {
    const text = msg.text();
    logs.push(`[${msg.type()}] ${text}`);
    if (msg.type() === 'error' || text.includes('GL_INVALID')) {
      errors.push(text);
    }
  });

  try {
    console.log(`Navigating to ${BASE_URL}/?t=blackhole ...`);
    await page.goto(`${BASE_URL}/?t=blackhole`, { waitUntil: 'networkidle' });

    // Wait for shader compilation
    console.log('Waiting 3 seconds for shader compilation...');
    await page.waitForTimeout(3000);

    // Just wait for everything to stabilize
    console.log('Waiting 2 more seconds for rendering to stabilize...');
    await page.waitForTimeout(2000);

    // Take screenshot with longer timeout
    const screenshotPath = 'screenshots/blackhole-debug.png';
    await page.screenshot({ path: screenshotPath, timeout: 60000 });
    console.log(`Screenshot saved: ${screenshotPath}`);

    // Analyze pixels
    const result = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return { error: 'No canvas found' };

      const gl = canvas.getContext('webgl2');
      if (!gl) return { error: 'No WebGL2 context' };

      const w = canvas.width, h = canvas.height;
      const pixels = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      let blackPixels = 0, coloredPixels = 0;
      let totalBrightness = 0;
      let minBrightness = 255, maxBrightness = 0;
      let orangePixels = 0;

      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i], g = pixels[i+1], b = pixels[i+2];
        const brightness = Math.round((r + g + b) / 3);

        totalBrightness += brightness;
        if (brightness < minBrightness) minBrightness = brightness;
        if (brightness > maxBrightness) maxBrightness = brightness;

        if (r < 5 && g < 5 && b < 5) {
          blackPixels++;
        } else {
          coloredPixels++;
          // Check for orange/red (accretion disk colors)
          if (r > 150 && g > 50 && g < 200 && b < 100) {
            orangePixels++;
          }
        }
      }

      // Sample center pixels (where event horizon should be)
      const centerX = Math.floor(w / 2);
      const centerY = Math.floor(h / 2);
      const centerSamples = [];
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const idx = ((centerY + dy) * w + (centerX + dx)) * 4;
          centerSamples.push({
            r: pixels[idx],
            g: pixels[idx + 1],
            b: pixels[idx + 2],
            brightness: Math.round((pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) / 3)
          });
        }
      }

      const totalPixels = w * h;
      return {
        canvasWidth: w,
        canvasHeight: h,
        totalPixels,
        blackPixels,
        coloredPixels,
        orangePixels,
        blackPercent: (blackPixels / totalPixels * 100).toFixed(1),
        coloredPercent: (coloredPixels / totalPixels * 100).toFixed(1),
        avgBrightness: (totalBrightness / totalPixels).toFixed(1),
        minBrightness,
        maxBrightness,
        brightnessRange: maxBrightness - minBrightness,
        centerSamples,
        centerAvgBrightness: (centerSamples.reduce((s, p) => s + p.brightness, 0) / centerSamples.length).toFixed(1)
      };
    });

    console.log('\n=== Black Hole Pixel Analysis ===');
    console.log(`Canvas: ${result.canvasWidth}x${result.canvasHeight}`);
    console.log(`Total pixels: ${result.totalPixels}`);
    console.log(`Black pixels: ${result.blackPixels} (${result.blackPercent}%)`);
    console.log(`Colored pixels: ${result.coloredPixels} (${result.coloredPercent}%)`);
    console.log(`Orange pixels: ${result.orangePixels}`);
    console.log(`Brightness: avg=${result.avgBrightness}, min=${result.minBrightness}, max=${result.maxBrightness}, range=${result.brightnessRange}`);
    console.log(`Center avg brightness: ${result.centerAvgBrightness}`);

    if (errors.length > 0) {
      console.log('\n=== Errors ===');
      errors.slice(0, 10).forEach(e => console.log(`  - ${e}`));
    }

    // Print relevant console logs (filter for rendering-related)
    const relevantLogs = logs.filter(l =>
      l.includes('render') || l.includes('shader') || l.includes('black') ||
      l.includes('error') || l.includes('Error') || l.includes('uniform') ||
      l.includes('pipeline') || l.includes('graph') || l.includes('pass')
    );
    if (relevantLogs.length > 0) {
      console.log('\n=== Relevant Console Logs ===');
      relevantLogs.slice(0, 20).forEach(l => console.log(`  ${l}`));
    }

    // Gate check
    const hasColoredPixels = result.coloredPixels > 1000;
    const notMostlyBlack = parseFloat(result.blackPercent) < 95;
    const noGLErrors = errors.filter(e => e.includes('GL_INVALID')).length === 0;

    console.log('\n=== Gate Check ===');
    console.log(`Has colored pixels (>1000): ${hasColoredPixels ? 'PASS' : 'FAIL'} (${result.coloredPixels})`);
    console.log(`Not mostly black (<95%): ${notMostlyBlack ? 'PASS' : 'FAIL'} (${result.blackPercent}%)`);
    console.log(`No GL errors: ${noGLErrors ? 'PASS' : 'FAIL'}`);

    const passed = hasColoredPixels && notMostlyBlack && noGLErrors;
    console.log(`\n=== RESULT: ${passed ? 'PASS' : 'FAIL'} ===`);

    process.exit(passed ? 0 : 1);

  } finally {
    await browser.close();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
