/**
 * Debug script to analyze root-system face rendering issues
 * Captures debug logs to understand face vs edge vertex mismatches
 */
import { chromium } from 'playwright';

async function main() {
  console.log('Starting root-system face debugging...\n');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  
  // Collect relevant debug logs
  const debugLogs = [];
  const allLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    allLogs.push(text);
    if (text.includes('[DEBUG:')) {
      debugLogs.push(text);
    }
  });
  
  // Load 8D D_n root system
  console.log('1. Loading 8D root-system with D_n type...');
  await page.goto('http://localhost:3002/?t=root-system&d=8&fv=1');
  
  // Wait for geometry and face detection (convex hull can take time in 8D)
  await page.waitForTimeout(12000);
  
  console.log('\n=== Debug Logs ===');
  for (const log of debugLogs) {
    console.log(log);
  }
  
  console.log('\n=== Summary ===');
  console.log(`Total debug logs: ${debugLogs.length}`);
  console.log(`Total all logs: ${allLogs.length}`);

  // Print all logs that look interesting
  console.log('\n=== Interesting Logs ===');
  for (const log of allLogs) {
    if (log.includes('root') || log.includes('Root') || 
        log.includes('face') || log.includes('Face') ||
        log.includes('dimension') || log.includes('Dimension') ||
        log.includes('8') || log.includes('geometry') ||
        log.includes('Geometry') || log.includes('hull') ||
        log.includes('DEBUG')) {
      console.log(log);
    }
  }
  
  if (allLogs.length > 0 && debugLogs.length === 0) {
    console.log('\n=== Sample All Logs (first 20) ===');
    for (const log of allLogs.slice(0, 20)) {
      console.log(log);
    }
  }
  
  // Check for face/edge mismatch logs
  const mismatchLogs = debugLogs.filter(l => l.includes('FACE_EDGE_MISMATCH'));
  if (mismatchLogs.length > 0) {
    console.log('\nFace/Edge mismatch detected:');
    for (const log of mismatchLogs) {
      console.log(log);
    }
  }
  
  await browser.close();
  console.log('\nDone!');
}

main().catch(console.error);

