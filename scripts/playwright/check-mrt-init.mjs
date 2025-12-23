/**
 * Simple script to check if MRT initialization is happening
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

const logs = [];

page.on('console', msg => {
  const text = msg.text();
  logs.push(`[${msg.type()}] ${text}`);
  console.log(`[${msg.type()}] ${text}`);
});

await page.goto('http://localhost:3000');

// Wait a bit for initialization
await page.waitForTimeout(3000);

console.log('\n\n=== MRT-related logs ===');
const mrtLogs = logs.filter(l => l.includes('MRT') || l.includes('Canvas created'));
console.log(mrtLogs.length ? mrtLogs.join('\n') : 'No MRT logs found');

console.log('\n\n=== GL errors ===');
const glErrors = logs.filter(l => l.includes('GL_INVALID') || l.includes('WebGL'));
console.log(`Found ${glErrors.length} GL-related messages`);

await browser.close();
