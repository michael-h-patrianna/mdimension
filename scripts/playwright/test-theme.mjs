import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1920, height: 1080 });
await page.goto('http://localhost:3004');
await page.waitForTimeout(2000);

// Check initial theme
const initialTheme = await page.evaluate(() => {
  return {
    dataTheme: document.documentElement.getAttribute('data-theme'),
    themeAccent: getComputedStyle(document.documentElement).getPropertyValue('--theme-accent').trim()
  };
});
console.log('Initial state:', initialTheme);
await page.screenshot({ path: 'screenshots/theme-1-initial.png' });

// Open Settings section and change theme
await page.click('text=SETTINGS');
await page.waitForTimeout(500);

// Find and click the theme dropdown
const themeSelect = await page.$('select');
if (themeSelect) {
  await themeSelect.selectOption('green');
  await page.waitForTimeout(500);

  const afterGreen = await page.evaluate(() => {
    return {
      dataTheme: document.documentElement.getAttribute('data-theme'),
      themeAccent: getComputedStyle(document.documentElement).getPropertyValue('--theme-accent').trim()
    };
  });
  console.log('After selecting green:', afterGreen);
  await page.screenshot({ path: 'screenshots/theme-2-green.png' });

  // Change to magenta
  await themeSelect.selectOption('magenta');
  await page.waitForTimeout(500);

  const afterMagenta = await page.evaluate(() => {
    return {
      dataTheme: document.documentElement.getAttribute('data-theme'),
      themeAccent: getComputedStyle(document.documentElement).getPropertyValue('--theme-accent').trim()
    };
  });
  console.log('After selecting magenta:', afterMagenta);
  await page.screenshot({ path: 'screenshots/theme-3-magenta.png' });
} else {
  console.log('Theme select not found');
}

await browser.close();
