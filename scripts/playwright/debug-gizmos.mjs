/**
 * Debug script to verify light gizmos are rendering
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function debugGizmos() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Listen to console logs
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Console error:', msg.text());
    }
  });

  console.log('Navigating to app...');
  await page.goto('http://localhost:3003');

  // Wait for canvas to load
  await page.waitForSelector('canvas', { timeout: 10000 });
  console.log('Canvas found');

  // Wait for rendering to settle
  await page.waitForTimeout(3000);

  // Take screenshot
  const screenshotDir = path.join(process.cwd(), 'screenshots', 'debug-gizmos');
  fs.mkdirSync(screenshotDir, { recursive: true });

  await page.screenshot({
    path: path.join(screenshotDir, 'initial.png'),
    fullPage: true
  });
  console.log('Screenshot saved to screenshots/debug-gizmos/initial.png');

  // Check store state for gizmos
  const storeState = await page.evaluate(() => {
    // Access the Zustand store from window if exposed
    if (window.__ZUSTAND_DEVTOOLS__) {
      return 'Zustand devtools present';
    }
    return 'Cannot access store';
  });
  console.log('Store check:', storeState);

  // Inject a test to check if lights and gizmos are in scene
  const sceneInfo = await page.evaluate(() => {
    const scene = document.querySelector('canvas')?.__r3f?.scene;
    if (!scene) return 'Cannot access scene';

    let gizmoCount = 0;
    let lightCount = 0;
    scene.traverse(obj => {
      if (obj.name?.includes('gizmo') || obj.name?.includes('Gizmo')) gizmoCount++;
      if (obj.isLight) lightCount++;
    });

    return { gizmoCount, lightCount, childCount: scene.children.length };
  });
  console.log('Scene info:', sceneInfo);

  // Keep browser open for manual inspection
  console.log('\nBrowser left open for manual inspection. Press Ctrl+C to close.');

  // Wait indefinitely (user can close manually)
  await new Promise(() => {});
}

debugGizmos().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
