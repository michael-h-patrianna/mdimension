/**
 * Visual debug - take screenshot of what's actually rendered
 */
import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[DEBUG:')) {
      consoleLogs.push(text);
      console.log(text);
    }
  });
  
  console.log('Opening http://localhost:3000/?t=wythoff-polytope');
  await page.goto('http://localhost:3000/?t=wythoff-polytope');
  
  console.log('\nWaiting 2 seconds as per bug report...');
  await page.waitForTimeout(2000);
  
  // Take screenshot
  await page.screenshot({ path: 'screenshots/wythoff-bug-after-2s.png' });
  console.log('Screenshot saved: screenshots/wythoff-bug-after-2s.png');
  
  // Wait more and take another
  console.log('\nWaiting 3 more seconds...');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'screenshots/wythoff-bug-after-5s.png' });
  console.log('Screenshot saved: screenshots/wythoff-bug-after-5s.png');
  
  // Check WebGL context
  const webglStatus = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return 'NO CANVAS';
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return 'NO WEBGL CONTEXT';
    return `WEBGL OK - isContextLost: ${gl.isContextLost()}`;
  });
  console.log(`\nWebGL status: ${webglStatus}`);
  
  // Analyze key debug logs
  console.log('\n=== Debug Log Analysis ===');
  
  // Check PolytopeScene state
  const polytopeSceneLogs = consoleLogs.filter(l => l.includes('[DEBUG:F]'));
  console.log(`\nPolytopeScene renders: ${polytopeSceneLogs.length}`);
  if (polytopeSceneLogs.length > 0) {
    console.log('  Last PolytopeScene state:');
    const last = polytopeSceneLogs[polytopeSceneLogs.length - 1];
    console.log(`  ${last}`);
    
    // Check for shader compiling issue
    if (last.includes('isFaceShaderCompiling: true')) {
      console.log('\n  ⚠️ FOUND ISSUE: Shader is stuck compiling!');
    }
    if (last.includes('hasFaceMaterial: false')) {
      console.log('\n  ⚠️ FOUND ISSUE: Face material is null!');
    }
    if (last.includes('hasFaceGeometry: false')) {
      console.log('\n  ⚠️ FOUND ISSUE: Face geometry is null!');
    }
  } else {
    console.log('  ⚠️ No PolytopeScene logs - component may not be rendering!');
  }
  
  // Check Scene state
  const sceneLogs = consoleLogs.filter(l => l.includes('[DEBUG:G]'));
  console.log(`\nScene renders: ${sceneLogs.length}`);
  if (sceneLogs.length > 0) {
    console.log(`  Last: ${sceneLogs[sceneLogs.length - 1]}`);
  }
  
  console.log('\n=== All DEBUG Logs ===');
  consoleLogs.forEach(l => console.log(l));
  
  await browser.close();
}

main().catch(console.error);

