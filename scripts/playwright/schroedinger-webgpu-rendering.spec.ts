/**
 * Schroedinger WebGPU Rendering Test
 *
 * Gate test to verify Schroedinger object renders in WebGPU mode.
 * Success criteria:
 * - Scene is NOT all black (has non-black pixels)
 * - No critical WGSL/WebGPU errors
 *
 * Run with:
 *   npx playwright test schroedinger-webgpu-rendering.spec.ts
 */

import { ConsoleMessage, expect, Page, test } from '@playwright/test'

// Extended timeout for WebGPU initialization
test.setTimeout(60000)

interface ConsoleCollector {
  errors: string[]
  warnings: string[]
  debugLogs: string[]
  wgslErrors: string[]
}

/**
 * Set up console collection BEFORE navigation
 */
function setupConsoleCollection(page: Page): ConsoleCollector {
  const collector: ConsoleCollector = {
    errors: [],
    warnings: [],
    debugLogs: [],
    wgslErrors: [],
  }

  page.on('pageerror', (err) => {
    collector.errors.push(`[PAGE_ERROR] ${err.message}`)
  })

  page.on('console', (msg: ConsoleMessage) => {
    const text = msg.text()
    const type = msg.type()

    // Collect all debug logs with specific markers
    if (
      text.includes('[DEBUG]') ||
      text.includes('[Schroedinger') ||
      text.includes('[composeSchroedinger') ||
      text.includes('[TSL]') ||
      text.includes('[WebGPU]') ||
      text.includes('[TemporalCloud') ||
      text.includes('[MainObject') ||
      text.includes('[Scene') ||
      text.includes('WGSL') ||
      text.includes('mrt') ||
      text.includes('MRT') ||
      text.includes('Material created') ||
      text.includes('colorNode') ||
      text.includes('mrtNode') ||
      text.includes('Mesh mounted') ||
      text.includes('layersMask') ||
      text.includes('materialType') ||
      text.includes('- ') // Capture the individual field logs
    ) {
      collector.debugLogs.push(`[${type.toUpperCase()}] ${text}`)
    }

    if (type === 'error') {
      collector.errors.push(text)

      // Check for WGSL/WebGPU-specific errors
      if (
        text.includes('WGSL') ||
        text.includes('WebGPU') ||
        text.includes('Invalid') ||
        text.includes('PipelineLayout') ||
        text.includes('struct member') ||
        text.includes('not found') ||
        text.includes('CreateRenderPipeline')
      ) {
        collector.wgslErrors.push(text)
      }
    }

    if (type === 'warning') {
      collector.warnings.push(text)

      // Also check warnings for WGSL issues
      if (text.includes('WGSL') || text.includes('TSL')) {
        collector.debugLogs.push(`[WARNING] ${text}`)
      }
    }
  })

  return collector
}

/**
 * Analyze canvas pixels to check if scene is rendering
 * Returns brightness metrics
 */
async function analyzeCanvasBrightness(
  page: Page
): Promise<{ nonBlackPixels: number; totalPixels: number; avgBrightness: number; maxBrightness: number }> {
  return await page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    if (!canvas) {
      return { nonBlackPixels: 0, totalPixels: 0, avgBrightness: 0, maxBrightness: 0 }
    }

    // Create off-screen canvas to read pixels
    const offscreen = document.createElement('canvas')
    offscreen.width = canvas.width
    offscreen.height = canvas.height
    const ctx = offscreen.getContext('2d')
    if (!ctx) {
      return { nonBlackPixels: 0, totalPixels: 0, avgBrightness: 0, maxBrightness: 0 }
    }

    ctx.drawImage(canvas, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data

    let nonBlackPixels = 0
    let totalBrightness = 0
    let maxBrightness = 0
    const totalPixels = data.length / 4

    // Sample every 10th pixel for performance
    for (let i = 0; i < data.length; i += 40) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]

      // Calculate brightness (simple average)
      const brightness = (r + g + b) / 3

      if (brightness > maxBrightness) {
        maxBrightness = brightness
      }

      totalBrightness += brightness

      // Consider non-black if any channel > 5 (accounting for noise)
      if (r > 5 || g > 5 || b > 5) {
        nonBlackPixels++
      }
    }

    const sampledPixels = data.length / 40
    const avgBrightness = totalBrightness / sampledPixels

    return {
      nonBlackPixels: nonBlackPixels * 10, // Scale back up
      totalPixels,
      avgBrightness,
      maxBrightness,
    }
  })
}

test.describe('Schroedinger WebGPU Rendering', () => {
  test('Schroedinger object renders (scene not all black)', async ({ page }) => {
    // Set up console collection BEFORE navigation
    const collector = setupConsoleCollection(page)

    // Navigate to schroedinger (use HTTPS as dev server runs on HTTPS)
    // Using scene= param loads a named preset from scenes.json
    await page.goto('https://localhost:3004/?scene=Schroedinger%20Bloom', { ignoreHTTPSErrors: true })

    // Wait for canvas to be visible
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30000 })

    // Wait for render to stabilize (5 seconds as per spec)
    await page.waitForTimeout(5000)

    // Analyze canvas brightness
    const metrics = await analyzeCanvasBrightness(page)

    // Log debug info
    console.log('\n=== Schroedinger WebGPU Rendering Metrics ===')
    console.log(`Total pixels: ${metrics.totalPixels}`)
    console.log(`Non-black pixels: ${metrics.nonBlackPixels}`)
    console.log(`Average brightness: ${metrics.avgBrightness.toFixed(2)}`)
    console.log(`Max brightness: ${metrics.maxBrightness}`)

    // Log collected console output
    console.log('\n=== Debug Logs ===')
    collector.debugLogs.forEach((log) => console.log(log))

    if (collector.wgslErrors.length > 0) {
      console.log('\n=== WGSL/WebGPU Errors ===')
      collector.wgslErrors.forEach((err) => console.log(err))
    }

    if (collector.errors.length > 0) {
      console.log('\n=== All Errors ===')
      collector.errors.forEach((err) => console.log(err))
    }

    // GATE: Scene must have some non-black pixels
    // At minimum, skybox should render even if object fails
    // For actual object rendering, we need more non-black pixels and brightness
    const hasRendering = metrics.nonBlackPixels > 1000 && metrics.avgBrightness > 5

    expect(
      hasRendering,
      `Scene appears to be mostly black.\n` +
        `Non-black pixels: ${metrics.nonBlackPixels}\n` +
        `Avg brightness: ${metrics.avgBrightness.toFixed(2)}\n` +
        `WGSL Errors: ${collector.wgslErrors.join('\n')}`
    ).toBe(true)

    // Also check that there are no critical WGSL errors
    const criticalErrors = collector.wgslErrors.filter(
      (e) => e.includes('struct member') || e.includes('Invalid PipelineLayout') || e.includes('CreateRenderPipeline')
    )

    expect(
      criticalErrors.length,
      `Critical WGSL/WebGPU errors detected:\n${criticalErrors.join('\n')}`
    ).toBe(0)
  })
})
