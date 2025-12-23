/**
 * Debug IBL using console.log capture
 * Tests hypotheses about why IBL cubemap history is never valid
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const URL = process.env.URL || 'http://localhost:3000';
const LOG_PATH = '/Users/Spare/Documents/code/mdimension/.cursor/debug.log';

async function debugIBL() {
  console.log('=== IBL Debug with Console Capture ===\n');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Collect console logs
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('IBL-DEBUG')) {
      logs.push({ type: msg.type(), text, timestamp: Date.now() });
      console.log(text);
    }
  });
  
  page.on('pageerror', error => {
    console.log('[PAGE ERROR]', error.message);
    logs.push({ type: 'error', text: error.message, timestamp: Date.now() });
  });
  
  try {
    console.log('1. Loading page and waiting for render...');
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait for multiple frames to execute
    console.log('2. Waiting 5 seconds for frames to accumulate...');
    await page.waitForTimeout(5000);
    
    console.log('\n3. Summary of captured logs:');
    console.log(`   Total IBL-DEBUG logs: ${logs.length}`);
    
    // Count by type
    const counts = {
      'IBL-DEBUG-A': logs.filter(l => l.text.includes('IBL-DEBUG-A')).length,
      'IBL-DEBUG-B': logs.filter(l => l.text.includes('IBL-DEBUG-B')).length,
      'IBL-DEBUG-C': logs.filter(l => l.text.includes('IBL-DEBUG-C')).length,
      'IBL-DEBUG-D': logs.filter(l => l.text.includes('IBL-DEBUG-D')).length,
      'IBL-DEBUG-E': logs.filter(l => l.text.includes('IBL-DEBUG-E')).length,
    };
    console.log('   Counts:', counts);
    
    // Write logs to file
    const logLines = logs.map(l => JSON.stringify(l)).join('\n');
    writeFileSync(LOG_PATH, logLines);
    console.log(`\n4. Logs written to ${LOG_PATH}`);
    
    // Take screenshot
    await page.screenshot({ path: 'screenshots/ibl-debug-console.png' });
    console.log('5. Screenshot saved to screenshots/ibl-debug-console.png');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

debugIBL().catch(console.error);

