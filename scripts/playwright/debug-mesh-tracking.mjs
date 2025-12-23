/**
 * Track mesh state frame-by-frame around the overlay disappear moment
 */

import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  
  const meshLogs = [];
  const renderConditionLogs = [];
  const scenePassLogs = [];
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('DEBUG-MESH-STATE')) {
      meshLogs.push(text);
    }
    if (text.includes('DEBUG-RENDER-CONDITIONS')) {
      renderConditionLogs.push(text);
    }
    if (text.includes('DEBUG-H26-ScenePass')) {
      scenePassLogs.push(text);
    }
    if (text.includes('setFaceMeshRef')) {
      console.log('>>> REF:', text);
    }
  });

  console.log('Loading page...');
  await page.goto('http://localhost:3000/?t=hypercube', { waitUntil: 'domcontentloaded', timeout: 10000 });
  
  // Wait for full initialization
  await page.waitForTimeout(6000);
  
  console.log('\n=== RENDER CONDITIONS ===');
  renderConditionLogs.slice(-5).forEach(l => console.log(l.slice(0, 200)));
  
  console.log('\n=== MESH STATE ===');
  meshLogs.slice(-3).forEach(l => console.log(l));
  
  console.log('\n=== SCENE PASS (last 3) ===');
  scenePassLogs.slice(-3).forEach(l => {
    // Extract just the mesh details
    try {
      const json = JSON.parse(l.replace('[log] [DEBUG-H26-ScenePass] ', ''));
      console.log('meshDetails:', JSON.stringify(json.data.meshDetails, null, 2));
    } catch { console.log(l.slice(0, 200)); }
  });
  
  // Take final screenshot
  await page.screenshot({ path: 'screenshots/debug-mesh-tracking-final.png' });
  
  await browser.close();
}

main().catch(console.error);







