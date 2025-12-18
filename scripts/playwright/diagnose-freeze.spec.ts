import { test, expect } from '@playwright/test';

test('diagnose app loading and capture errors', async ({ page }) => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Capture console errors and warnings
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    } else if (msg.type() === 'warning') {
      warnings.push(msg.text());
    }
  });

  // Capture page errors
  page.on('pageerror', (err) => {
    errors.push(`PAGE ERROR: ${err.message}`);
  });

  // Navigate to app with timeout
  await page.goto('/', { timeout: 30000, waitUntil: 'domcontentloaded' });

  // Wait for canvas
  try {
    await page.waitForSelector('canvas', { timeout: 10000 });
    console.log('✓ Canvas loaded successfully');
  } catch (e) {
    console.log('✗ Canvas failed to load');
    errors.push('Canvas did not appear within 10 seconds');
  }

  // Wait a bit for any WebGL initialization errors
  await page.waitForTimeout(3000);

  // Report findings
  console.log('\n=== DIAGNOSTIC REPORT ===');
  console.log(`Errors captured: ${errors.length}`);
  errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
  console.log(`Warnings captured: ${warnings.length}`);
  warnings.slice(0, 10).forEach((w, i) => console.log(`  ${i + 1}. ${w}`));

  // Check for WebGL context
  const hasWebGL = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return 'no-canvas';
    try {
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      return gl ? 'ok' : 'no-context';
    } catch (e) {
      return `error: ${e}`;
    }
  });
  console.log(`WebGL Status: ${hasWebGL}`);

  // Check if the app froze (no animations, no response)
  const isResponsive = await page.evaluate(() => {
    return new Promise((resolve) => {
      let responded = false;
      requestAnimationFrame(() => {
        responded = true;
        resolve(true);
      });
      setTimeout(() => {
        if (!responded) resolve(false);
      }, 2000);
    });
  });
  console.log(`Animation Frame Response: ${isResponsive ? 'OK' : 'FROZEN'}`);

  // Expect no critical errors
  const criticalErrors = errors.filter(e =>
    e.includes('shader') ||
    e.includes('WebGL') ||
    e.includes('GLSL') ||
    e.includes('compilation')
  );

  if (criticalErrors.length > 0) {
    console.log('\n=== CRITICAL WebGL/Shader Errors ===');
    criticalErrors.forEach(e => console.log(e));
  }

  expect(criticalErrors.length).toBe(0);
});
