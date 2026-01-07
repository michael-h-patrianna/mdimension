/**
 * WebGPU Black Screen Bug Test
 *
 * Tests that the WebGPU renderer renders visible content (not all black).
 * Uses algorithmic pixel analysis instead of visual screenshot comparison.
 *
 * Run with:
 *   npx playwright test webgpu-black-screen.spec.ts
 */

import { expect, test, Page } from '@playwright/test'

test.setTimeout(60000)

interface CanvasAnalysis {
  totalPixels: number
  nonBlackPixels: number
  nonBlackPercent: number
  averageBrightness: number
  maxBrightness: number
}

/**
 * Analyze canvas pixel data to detect non-black content.
 */
async function analyzeCanvas(page: Page): Promise<CanvasAnalysis> {
  return await page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    if (!canvas) {
      return {
        totalPixels: 0,
        nonBlackPixels: 0,
        nonBlackPercent: 0,
        averageBrightness: 0,
        maxBrightness: 0,
      }
    }

    // Get canvas context and pixel data
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) {
      // For WebGL/WebGPU canvas, we need to create a temporary 2D canvas
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = canvas.width
      tempCanvas.height = canvas.height
      const tempCtx = tempCanvas.getContext('2d')
      if (!tempCtx) {
        return {
          totalPixels: 0,
          nonBlackPixels: 0,
          nonBlackPercent: 0,
          averageBrightness: 0,
          maxBrightness: 0,
        }
      }
      tempCtx.drawImage(canvas, 0, 0)
      const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height)
      const data = imageData.data

      let nonBlackPixels = 0
      let totalBrightness = 0
      let maxBrightness = 0
      const totalPixels = tempCanvas.width * tempCanvas.height

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]!
        const g = data[i + 1]!
        const b = data[i + 2]!
        const brightness = (r + g + b) / 3

        if (brightness > 5) {
          // Threshold for "non-black"
          nonBlackPixels++
        }
        totalBrightness += brightness
        maxBrightness = Math.max(maxBrightness, brightness)
      }

      return {
        totalPixels,
        nonBlackPixels,
        nonBlackPercent: (nonBlackPixels / totalPixels) * 100,
        averageBrightness: totalBrightness / totalPixels,
        maxBrightness,
      }
    }

    // For 2D canvas
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data

    let nonBlackPixels = 0
    let totalBrightness = 0
    let maxBrightness = 0
    const totalPixels = canvas.width * canvas.height

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]!
      const g = data[i + 1]!
      const b = data[i + 2]!
      const brightness = (r + g + b) / 3

      if (brightness > 5) {
        nonBlackPixels++
      }
      totalBrightness += brightness
      maxBrightness = Math.max(maxBrightness, brightness)
    }

    return {
      totalPixels,
      nonBlackPixels,
      nonBlackPercent: (nonBlackPixels / totalPixels) * 100,
      averageBrightness: totalBrightness / totalPixels,
      maxBrightness,
    }
  })
}

test.describe('WebGPU Black Screen Bug', () => {
  test('Scene renders visible content (not all black)', async ({ page }) => {
    // Collect ALL console logs for debugging
    const consoleLogs: string[] = []
    page.on('console', (msg) => {
      const text = msg.text()
      consoleLogs.push(`[${msg.type()}] ${text}`)
    })

    // Navigate to the Mandelbulb fractal (known working renderer)
    await page.goto('http://localhost:3000/?t=hypercube&d=4')

    // Wait for canvas to be visible
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30000 })

    // Check if WebGPU is available
    const webgpuAvailable = await page.evaluate(() => {
      return 'gpu' in navigator
    })
    console.log(`\n=== WebGPU Available: ${webgpuAvailable} ===`)

    // Wait for shader compilation and scene initialization
    await page.waitForTimeout(5000)

    // Take a screenshot for visual debugging
    await page.screenshot({ path: 'screenshots/webgpu-black-screen-debug.png' })
    console.log('\n=== Screenshot saved to screenshots/webgpu-black-screen-debug.png ===')

    // Analyze the canvas
    const analysis = await analyzeCanvas(page)

    // Log debug output
    console.log('\n=== Debug Console Output (last 50) ===')
    consoleLogs.slice(-50).forEach((log) => console.log(log))

    console.log('\n=== Canvas Analysis ===')
    console.log(`Total pixels: ${analysis.totalPixels}`)
    console.log(`Non-black pixels: ${analysis.nonBlackPixels}`)
    console.log(`Non-black percent: ${analysis.nonBlackPercent.toFixed(2)}%`)
    console.log(`Average brightness: ${analysis.averageBrightness.toFixed(2)}`)
    console.log(`Max brightness: ${analysis.maxBrightness}`)

    // GATE 1: Scene must not be all black
    // At minimum, we expect some non-black pixels (object, background, anything)
    expect(analysis.nonBlackPixels, 'Scene is completely black - nothing rendered').toBeGreaterThan(0)

    // GATE 2: At least 1% of pixels should be non-black
    // This ensures we're not just seeing noise or a tiny artifact
    expect(
      analysis.nonBlackPercent,
      `Scene is too dark - only ${analysis.nonBlackPercent.toFixed(2)}% non-black pixels`
    ).toBeGreaterThan(1)

    // GATE 3: Average brightness should be meaningful
    // A rendered scene with objects/background should have some brightness
    expect(
      analysis.averageBrightness,
      `Scene too dark - average brightness ${analysis.averageBrightness.toFixed(2)}`
    ).toBeGreaterThan(1)
  })
})
