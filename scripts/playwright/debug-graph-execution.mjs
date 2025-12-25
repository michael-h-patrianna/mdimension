/**
 * Debug render graph execution
 */
import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  
  let graphLogs = [];
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[DEBUG:')) {
      graphLogs.push(text);
    }
  });
  
  console.log('=== Testing WYTHOFF (5 seconds) ===');
  await page.goto('http://localhost:3000/?t=wythoff-polytope');
  await page.waitForTimeout(5000);
  console.log(`Wythoff: ${graphLogs.length} graph executions\n`);
  
  // Show all logs
  graphLogs.forEach(l => console.log(l));
  
  await browser.close();
}

main().catch(console.error);

