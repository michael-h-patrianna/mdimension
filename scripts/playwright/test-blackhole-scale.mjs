/**
 * Black Hole Scale Diagnostic Test
 * 
 * Tests whether the black hole scale parameter actually affects visual output.
 * Captures screenshots at different scale values and compares them.
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, '../../screenshots/blackhole-scale-test');

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function testBlackHoleScale() {
  console.log('🔍 Black Hole Scale Diagnostic Test\n');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  // Collect console logs
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    if (text.includes('[BlackHole]') || text.includes('scale')) {
      console.log(`  📝 Console: ${text}`);
    }
  });

  try {
    // Navigate to the app
    console.log('1️⃣ Navigating to app...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Black Hole should now be the default object type
    console.log('2️⃣ Waiting for Black Hole to render (now default)...');
    await page.waitForTimeout(3000);
    
    // Verify we're on Black Hole by checking for its controls
    const pageContent = await page.content();
    if (pageContent.includes('Horizon Radius') || pageContent.includes('blackhole')) {
      console.log('   ✅ Black Hole detected as default!');
    } else {
      console.log('   ⚠️ Black Hole may not be selected, continuing anyway...');
    }
    
    await page.waitForTimeout(3000);
    
    // Get initial scale value from store
    console.log('\n3️⃣ Reading initial scale value from store...');
    const initialScaleInfo = await page.evaluate(() => {
      // Try to access the store
      const stores = window.__ZUSTAND_STORES__;
      if (stores?.extendedObject) {
        const state = stores.extendedObject.getState();
        return {
          scale: state.blackhole?.scale,
          horizonRadius: state.blackhole?.horizonRadius,
          farRadius: state.blackhole?.farRadius,
          storeFound: true
        };
      }
      return { storeFound: false };
    });
    
    console.log(`   Store found: ${initialScaleInfo.storeFound}`);
    if (initialScaleInfo.storeFound) {
      console.log(`   Initial scale: ${initialScaleInfo.scale}`);
      console.log(`   Horizon radius: ${initialScaleInfo.horizonRadius}`);
      console.log(`   Far radius: ${initialScaleInfo.farRadius}`);
    }

    // Take screenshot at initial scale
    console.log('\n4️⃣ Taking screenshot at initial scale...');
    await page.waitForTimeout(5000); // Wait longer for black hole to render
    const screenshot1Path = path.join(SCREENSHOT_DIR, 'scale-initial.png');
    await page.screenshot({ path: screenshot1Path, timeout: 60000 });
    const screenshot1Size = fs.statSync(screenshot1Path).size;
    console.log(`   ✅ Saved: scale-initial.png (${screenshot1Size} bytes)`);

    // Change scale to minimum (0.1)
    console.log('\n5️⃣ Setting scale to minimum (0.1)...');
    await page.evaluate(() => {
      const stores = window.__ZUSTAND_STORES__;
      if (stores?.extendedObject) {
        const state = stores.extendedObject.getState();
        if (state.setBlackHoleScale) {
          console.log('[BlackHole] Setting scale to 0.1 via store');
          state.setBlackHoleScale(0.1);
        }
      }
    });
    
    await page.waitForTimeout(2000);
    
    // Verify scale changed
    const scaleAfterMin = await page.evaluate(() => {
      const stores = window.__ZUSTAND_STORES__;
      if (stores?.extendedObject) {
        return stores.extendedObject.getState().blackhole?.scale;
      }
      return null;
    });
    console.log(`   Scale after setting to 0.1: ${scaleAfterMin}`);
    
    // Take screenshot at min scale
    const screenshot2Path = path.join(SCREENSHOT_DIR, 'scale-minimum.png');
    await page.screenshot({ path: screenshot2Path, timeout: 60000 });
    const screenshot2Size = fs.statSync(screenshot2Path).size;
    console.log(`   ✅ Saved: scale-minimum.png (${screenshot2Size} bytes)`);

    // Change scale to maximum (0.7)
    console.log('\n6️⃣ Setting scale to maximum (0.7)...');
    await page.evaluate(() => {
      const stores = window.__ZUSTAND_STORES__;
      if (stores?.extendedObject) {
        const state = stores.extendedObject.getState();
        if (state.setBlackHoleScale) {
          console.log('[BlackHole] Setting scale to 0.7 via store');
          state.setBlackHoleScale(0.7);
        }
      }
    });
    
    await page.waitForTimeout(2000);
    
    // Verify scale changed
    const scaleAfterMax = await page.evaluate(() => {
      const stores = window.__ZUSTAND_STORES__;
      if (stores?.extendedObject) {
        return stores.extendedObject.getState().blackhole?.scale;
      }
      return null;
    });
    console.log(`   Scale after setting to 0.7: ${scaleAfterMax}`);
    
    // Take screenshot at max scale
    const screenshot3Path = path.join(SCREENSHOT_DIR, 'scale-maximum.png');
    await page.screenshot({ path: screenshot3Path, timeout: 60000 });
    const screenshot3Size = fs.statSync(screenshot3Path).size;
    console.log(`   ✅ Saved: scale-maximum.png (${screenshot3Size} bytes)`);

    // Check mesh scale in Three.js scene
    console.log('\n7️⃣ Checking Three.js mesh scale...');
    const meshInfo = await page.evaluate(() => {
      // Try to find the R3F fiber root
      const canvas = document.querySelector('canvas');
      if (!canvas) return { error: 'No canvas found' };
      
      // Access Three.js scene through R3F internals
      const fiberRoot = canvas.__r3f;
      if (!fiberRoot) return { error: 'No R3F fiber root' };
      
      const scene = fiberRoot.store?.getState()?.scene;
      if (!scene) return { error: 'No scene found' };
      
      // Find black hole mesh
      let blackHoleMesh = null;
      scene.traverse((obj) => {
        if (obj.type === 'Mesh' && obj.material?.uniforms?.uHorizonRadius) {
          blackHoleMesh = obj;
        }
      });
      
      if (!blackHoleMesh) return { error: 'Black hole mesh not found' };
      
      return {
        meshFound: true,
        scale: {
          x: blackHoleMesh.scale.x,
          y: blackHoleMesh.scale.y,
          z: blackHoleMesh.scale.z
        },
        matrixWorld: blackHoleMesh.matrixWorld.elements.slice(0, 16),
        uniforms: {
          uHorizonRadius: blackHoleMesh.material.uniforms.uHorizonRadius?.value,
          uFarRadius: blackHoleMesh.material.uniforms.uFarRadius?.value,
          uScale: blackHoleMesh.material.uniforms.uScale?.value
        }
      };
    });
    
    console.log('   Mesh info:', JSON.stringify(meshInfo, null, 2));

    // Compare screenshots
    console.log('\n8️⃣ Comparing screenshots...');
    const screenshot1 = fs.readFileSync(screenshot1Path);
    const screenshot2 = fs.readFileSync(screenshot2Path);
    const screenshot3 = fs.readFileSync(screenshot3Path);
    
    const identical12 = screenshot1.equals(screenshot2);
    const identical13 = screenshot1.equals(screenshot3);
    const identical23 = screenshot2.equals(screenshot3);
    
    console.log(`   Initial vs Min: ${identical12 ? '❌ IDENTICAL (BUG!)' : '✅ Different'}`);
    console.log(`   Initial vs Max: ${identical13 ? '❌ IDENTICAL (BUG!)' : '✅ Different'}`);
    console.log(`   Min vs Max: ${identical23 ? '❌ IDENTICAL (BUG!)' : '✅ Different'}`);

    // Summary
    console.log('\n📊 DIAGNOSTIC SUMMARY:');
    console.log('========================');
    if (identical12 && identical13 && identical23) {
      console.log('❌ CONFIRMED BUG: All screenshots are identical!');
      console.log('   The scale parameter has NO visual effect.');
    } else if (!identical12 && !identical13 && !identical23) {
      console.log('✅ Scale parameter IS working - all screenshots differ.');
    } else {
      console.log('⚠️ Partial effect - some screenshots differ.');
    }
    
    // Print relevant console logs
    console.log('\n📝 Relevant Console Logs:');
    const relevantLogs = consoleLogs.filter(log => 
      log.includes('scale') || 
      log.includes('BlackHole') || 
      log.includes('matrix')
    );
    relevantLogs.forEach(log => console.log(`   ${log}`));

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

testBlackHoleScale().catch(console.error);

