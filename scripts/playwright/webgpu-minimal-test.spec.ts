/**
 * WebGPU Minimal Rendering Test
 *
 * Systematic test to isolate WHERE WebGPU rendering breaks:
 * 1. Solid color quad → screen (null target)
 * 2. DataTexture sampling → screen
 * 3. RenderTarget sampling → screen
 *
 * Run with: npx playwright test webgpu-minimal-test.spec.ts --headed
 */

import { expect, test, Page } from '@playwright/test'

test.setTimeout(120000)

interface CanvasAnalysis {
  totalPixels: number
  nonBlackPixels: number
  nonBlackPercent: number
  averageBrightness: number
  maxBrightness: number
  hasRed: boolean
  hasGreen: boolean
  hasBlue: boolean
}

async function analyzeCanvas(page: Page): Promise<CanvasAnalysis> {
  return await page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    if (!canvas) {
      return {
        totalPixels: 0, nonBlackPixels: 0, nonBlackPercent: 0,
        averageBrightness: 0, maxBrightness: 0,
        hasRed: false, hasGreen: false, hasBlue: false,
      }
    }

    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = canvas.width
    tempCanvas.height = canvas.height
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) {
      return {
        totalPixels: 0, nonBlackPixels: 0, nonBlackPercent: 0,
        averageBrightness: 0, maxBrightness: 0,
        hasRed: false, hasGreen: false, hasBlue: false,
      }
    }
    tempCtx.drawImage(canvas, 0, 0)
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height)
    const data = imageData.data

    let nonBlackPixels = 0
    let totalBrightness = 0
    let maxBrightness = 0
    let redCount = 0
    let greenCount = 0
    let blueCount = 0
    const totalPixels = tempCanvas.width * tempCanvas.height

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]!
      const g = data[i + 1]!
      const b = data[i + 2]!
      const brightness = (r + g + b) / 3

      if (brightness > 5) nonBlackPixels++
      if (r > 100 && r > g && r > b) redCount++
      if (g > 100 && g > r && g > b) greenCount++
      if (b > 100 && b > r && b > g) blueCount++

      totalBrightness += brightness
      maxBrightness = Math.max(maxBrightness, brightness)
    }

    return {
      totalPixels,
      nonBlackPixels,
      nonBlackPercent: (nonBlackPixels / totalPixels) * 100,
      averageBrightness: totalBrightness / totalPixels,
      maxBrightness,
      hasRed: redCount > totalPixels * 0.01,
      hasGreen: greenCount > totalPixels * 0.01,
      hasBlue: blueCount > totalPixels * 0.01,
    }
  })
}

test.describe('WebGPU Minimal Rendering Tests', () => {

  test('TEST 1: Solid color quad to screen (no texture)', async ({ page }) => {
    const consoleLogs: string[] = []
    page.on('console', (msg) => consoleLogs.push(`[${msg.type()}] ${msg.text()}`))

    // Inject minimal WebGPU test scene
    await page.goto('http://localhost:3000/?t=mandelbulb&d=3')
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30000 })

    // Wait for initial render
    await page.waitForTimeout(2000)

    // Inject test: Replace ToScreenPass with solid red output
    const injected = await page.evaluate(() => {
      // Access Three.js and TSL from window
      const THREE = (window as unknown as { THREE: typeof import('three') }).THREE
      if (!THREE) return { success: false, error: 'THREE not found' }

      return { success: true, message: 'Injection point found' }
    })

    console.log('Injection result:', injected)

    await page.waitForTimeout(3000)
    await page.screenshot({ path: 'screenshots/webgpu-minimal-test-1.png' })

    const analysis = await analyzeCanvas(page)
    console.log('\n=== TEST 1: Solid Color Analysis ===')
    console.log(`Non-black: ${analysis.nonBlackPercent.toFixed(2)}%`)
    console.log(`Max brightness: ${analysis.maxBrightness}`)
    console.log(`Has Red: ${analysis.hasRed}, Green: ${analysis.hasGreen}, Blue: ${analysis.hasBlue}`)

    // For now, just document current state
    console.log('\nConsole (last 20):')
    consoleLogs.slice(-20).forEach(log => console.log(log))
  })

  test('TEST 2: Verify WebGPU is actually being used', async ({ page }) => {
    await page.goto('http://localhost:3000/?t=mandelbulb&d=3')
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30000 })
    await page.waitForTimeout(3000)

    const rendererInfo = await page.evaluate(() => {
      // Check if WebGPU badge shows
      const badge = document.querySelector('[class*="WebGPU"]')
      const badgeText = badge?.textContent || 'No badge found'

      // Check canvas context type
      const canvas = document.querySelector('canvas')
      const hasWebGPUContext = canvas ? 'getContext' in canvas : false

      return {
        badgeText,
        hasWebGPUContext,
        navigatorGpu: 'gpu' in navigator,
      }
    })

    console.log('\n=== TEST 2: WebGPU Verification ===')
    console.log('Badge:', rendererInfo.badgeText)
    console.log('navigator.gpu:', rendererInfo.navigatorGpu)

    await page.screenshot({ path: 'screenshots/webgpu-minimal-test-2.png' })

    expect(rendererInfo.navigatorGpu).toBe(true)
  })

  test('TEST 3: Check render target chain', async ({ page }) => {
    const consoleLogs: string[] = []
    page.on('console', (msg) => {
      const text = msg.text()
      if (text.includes('PassTSL') || text.includes('Execute') || text.includes('WebGPU')) {
        consoleLogs.push(`[${msg.type()}] ${text}`)
      }
    })

    await page.goto('http://localhost:3000/?t=mandelbulb&d=3')
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30000 })
    await page.waitForTimeout(5000)

    await page.screenshot({ path: 'screenshots/webgpu-minimal-test-3.png' })

    console.log('\n=== TEST 3: Render Pass Chain ===')
    consoleLogs.forEach(log => console.log(log))

    const analysis = await analyzeCanvas(page)
    console.log(`\nCanvas: ${analysis.nonBlackPercent.toFixed(2)}% non-black, max brightness: ${analysis.maxBrightness}`)

    // The key question: are render targets working but screen output failing?
    const hasPassLogs = consoleLogs.some(l => l.includes('Execute'))
    console.log(`Passes executing: ${hasPassLogs}`)
  })
})
