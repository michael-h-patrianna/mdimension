/**
 * Canvas Debug Test
 * Tests if we can read canvas content in WebGPU mode
 */
import { test, expect, Page } from '@playwright/test'

async function getCanvasInfo(page: Page) {
  return await page.evaluate(() => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement
    if (!canvas) return { error: 'No canvas found' }

    // Try to get a 2D context from the WebGPU canvas
    const offscreen = document.createElement('canvas')
    offscreen.width = Math.min(canvas.width, 100) // Small sample
    offscreen.height = Math.min(canvas.height, 100)
    const ctx = offscreen.getContext('2d')
    if (!ctx) return { error: 'Cannot get 2D context' }

    // Draw the canvas content
    try {
      ctx.drawImage(canvas, 0, 0, offscreen.width, offscreen.height)
    } catch (e) {
      return { error: 'drawImage failed: ' + (e as Error).message }
    }

    // Get pixel data
    let imageData
    try {
      imageData = ctx.getImageData(0, 0, offscreen.width, offscreen.height)
    } catch (e) {
      return { error: 'getImageData failed: ' + (e as Error).message }
    }

    const data = imageData.data
    let nonBlack = 0
    let totalR = 0, totalG = 0, totalB = 0, totalA = 0

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
      if (r > 5 || g > 5 || b > 5) nonBlack++
      totalR += r
      totalG += g
      totalB += b
      totalA += a
    }

    const pixelCount = data.length / 4
    return {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      sampleWidth: offscreen.width,
      sampleHeight: offscreen.height,
      pixelCount,
      nonBlackPixels: nonBlack,
      avgR: totalR / pixelCount,
      avgG: totalG / pixelCount,
      avgB: totalB / pixelCount,
      avgA: totalA / pixelCount,
      contextType: (canvas as any).getContext?.('webgpu') ? 'webgpu' : 'unknown',
    }
  })
}

test('Canvas content debug', async ({ page }) => {
  // Collect console logs
  page.on('console', msg => {
    const text = msg.text()
    if (text.includes('WebGPU') || text.includes('Renderer') || text.includes('error') || text.includes('Error')) {
      console.log('[' + msg.type() + '] ' + text)
    }
  })

  page.on('pageerror', err => {
    console.log('[PAGE_ERROR] ' + err.message)
  })

  // Go to mandelbulb
  await page.goto('https://localhost:3000/?t=mandelbulb', { ignoreHTTPSErrors: true })
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30000 })

  // Wait for render
  await page.waitForTimeout(3000)

  // Get canvas info
  const info = await getCanvasInfo(page)
  console.log('Canvas info:', JSON.stringify(info, null, 2))

  // Take a screenshot for visual inspection
  await page.screenshot({ path: 'screenshots/canvas-debug.png' })

  // The test passes if we get canvas info without errors
  expect(info).not.toHaveProperty('error')
})
