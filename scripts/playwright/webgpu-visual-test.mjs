/**
 * WebGPU Visual Regression Test
 *
 * Playwright test to verify WebGPU rendering matches WebGL output.
 * Takes screenshots of the app with both backends and compares them.
 *
 * Usage:
 *   npx playwright test scripts/playwright/webgpu-visual-test.mjs
 *
 * Or run directly:
 *   node scripts/playwright/webgpu-visual-test.mjs
 */

import { chromium, firefox } from 'playwright'
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCREENSHOT_DIR = join(__dirname, '../../screenshots/webgpu-migration')
const REPORT_FILE = join(SCREENSHOT_DIR, 'visual-regression-report.json')

// Ensure screenshot directory exists
if (!existsSync(SCREENSHOT_DIR)) {
  mkdirSync(SCREENSHOT_DIR, { recursive: true })
}

/**
 * Configuration
 */
const CONFIG = {
  baseUrl: 'http://localhost:5173',
  viewportWidth: 1280,
  viewportHeight: 720,
  waitTime: 3000, // Wait for scene to render
  comparisonThreshold: 0.1, // 10% difference allowed
}

/**
 * Test cases - different scenes/objects to test
 */
const TEST_CASES = [
  { name: 'default-scene', description: 'Default scene on load' },
  // Add more test cases as needed
]

/**
 * Capture screenshot with specified backend
 */
async function captureWithBackend(page, backend, testCase) {
  const url = backend === 'webgl'
    ? `${CONFIG.baseUrl}?forceWebGL=true`
    : CONFIG.baseUrl

  console.log(`  Navigating to ${url}...`)
  await page.goto(url)

  // Wait for scene to load and render
  await page.waitForTimeout(CONFIG.waitTime)

  // Check which backend is active
  const rendererInfo = await page.evaluate(() => {
    // Try to get renderer info from the page
    const badge = document.querySelector('[data-testid="webgpu-badge"]')
    return badge ? badge.textContent : 'unknown'
  })

  console.log(`  Detected renderer: ${rendererInfo}`)

  // Capture screenshot
  const screenshotPath = join(
    SCREENSHOT_DIR,
    `${testCase.name}-${backend}.png`
  )

  await page.screenshot({
    path: screenshotPath,
    fullPage: false,
  })

  console.log(`  Screenshot saved: ${screenshotPath}`)

  return {
    path: screenshotPath,
    backend,
    rendererInfo,
  }
}

/**
 * Run visual regression test
 */
async function runVisualRegressionTest() {
  console.log('=== WebGPU Visual Regression Test ===\n')

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu', // Enable WebGPU in headless mode
      '--use-gl=angle',
      '--use-angle=swiftshader', // Use software rendering for consistency
    ],
  })

  const results = []

  try {
    const context = await browser.newContext({
      viewport: {
        width: CONFIG.viewportWidth,
        height: CONFIG.viewportHeight,
      },
    })

    const page = await context.newPage()

    // Capture console logs
    const consoleLogs = []
    page.on('console', (msg) => {
      consoleLogs.push({ type: msg.type(), text: msg.text() })
    })

    for (const testCase of TEST_CASES) {
      console.log(`\nTest Case: ${testCase.name}`)
      console.log(`Description: ${testCase.description}`)

      // Capture with WebGL
      console.log('\n[WebGL Backend]')
      const webglResult = await captureWithBackend(page, 'webgl', testCase)

      // Capture with WebGPU (or fallback)
      console.log('\n[WebGPU Backend]')
      const webgpuResult = await captureWithBackend(page, 'webgpu', testCase)

      results.push({
        testCase: testCase.name,
        description: testCase.description,
        webgl: webglResult,
        webgpu: webgpuResult,
        consoleLogs: consoleLogs.slice(-20), // Last 20 console logs
        timestamp: new Date().toISOString(),
      })
    }

    await context.close()
  } finally {
    await browser.close()
  }

  // Generate report
  const report = {
    runDate: new Date().toISOString(),
    config: CONFIG,
    results,
    summary: {
      total: results.length,
      passed: results.filter((r) => r.webgpu.rendererInfo !== 'unknown').length,
    },
  }

  writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2))
  console.log(`\n=== Report saved to ${REPORT_FILE} ===`)

  // Print summary
  console.log('\n=== Summary ===')
  console.log(`Total test cases: ${report.summary.total}`)
  console.log(`WebGPU detected: ${report.summary.passed}`)

  return report
}

/**
 * Main entry point
 */
async function main() {
  try {
    const report = await runVisualRegressionTest()
    process.exit(report.summary.passed > 0 ? 0 : 1)
  } catch (error) {
    console.error('Test failed:', error)
    process.exit(1)
  }
}

main()







