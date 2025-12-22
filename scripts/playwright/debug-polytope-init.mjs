/**
 * Focused debug script for polytope disappearing bug
 * Captures only initialization-related logs
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const BASE_URL = 'http://localhost:3000';

async function captureInitLogs(url, testName) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const logs = [];
  let overlayDisappeared = false;
  
  // Capture relevant console messages
  page.on('console', msg => {
    const text = msg.text();
    logs.push({ time: Date.now(), type: msg.type(), text });
    
    // Detect when shader overlay disappears
    if (text.includes('isShaderCompiling') && text.includes('false')) {
      overlayDisappeared = true;
    }
  });

  console.log(`\nTest: ${testName}`);
  console.log(`URL: ${url}`);
  console.log('Waiting for page to load and stabilize...');

  await page.goto(url);
  
  // Wait for shader compilation to complete and capture mesh state logs (need ~120 frames for H7 log)
  await page.waitForTimeout(8000);
  
  // Take screenshot
  await page.screenshot({ path: `screenshots/debug-${testName}.png` });
  
  await browser.close();
  
  return logs;
}

async function main() {
  console.log('='.repeat(60));
  console.log('POLYTOPE DISAPPEARING BUG DIAGNOSIS');
  console.log('='.repeat(60));
  
  // Test 1: Direct polytope URL (BUG case)
  const bugLogs = await captureInitLogs(`${BASE_URL}/?t=hypercube`, 'direct-polytope');
  
  // Filter for relevant initialization logs
  const relevantPatterns = [
    'DEBUG-URL-STATE',
    'DEBUG-POSTPROC',
    'DEBUG-SHADER-MATERIAL',
    'DEBUG-RENDER-CONDITIONS',
    'DEBUG-MESH-STATE',
    'DEBUG-H26',
    'DEBUG-H7',
    'meshDetails',
    'UnifiedRenderer',
    'PolytopeScene',
    'renderMode',
    'facesVisible',
    'isFaceShaderCompiling',
    'hasFaceMaterial',
    'rendersFaceReal',
    'rendersNothing',
    'objectType',
    'isPolytope',
    'MRT cache',
    'uOpacity',
    'uProjDist',
    'shaderProgram',
  ];
  
  const filteredLogs = bugLogs.filter(log => 
    relevantPatterns.some(pattern => log.text.includes(pattern))
  );
  
  console.log('\n' + '='.repeat(60));
  console.log('FILTERED INITIALIZATION LOGS (Direct Polytope URL)');
  console.log('='.repeat(60));
  
  for (const log of filteredLogs) {
    console.log(`[${log.type}] ${log.text}`);
  }
  
  // Write all logs to file for detailed analysis
  writeFileSync('screenshots/debug-polytope-all-logs.json', JSON.stringify(filteredLogs, null, 2));
  console.log('\nAll logs written to screenshots/debug-polytope-all-logs.json');
  
  // Summary analysis
  console.log('\n' + '='.repeat(60));
  console.log('ANALYSIS SUMMARY');
  console.log('='.repeat(60));
  
  const renderConditionLogs = filteredLogs.filter(l => l.text.includes('DEBUG-RENDER-CONDITIONS') || l.text.includes('rendersFace'));
  console.log('\nRender condition changes:');
  for (const log of renderConditionLogs) {
    console.log(log.text);
  }
  
  const shaderMaterialLogs = filteredLogs.filter(l => l.text.includes('DEBUG-SHADER-MATERIAL'));
  console.log('\nShader material state changes:');
  for (const log of shaderMaterialLogs) {
    console.log(log.text);
  }
}

main().catch(console.error);

