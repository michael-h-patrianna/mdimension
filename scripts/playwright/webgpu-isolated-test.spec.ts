/**
 * WebGPU Isolated Test
 *
 * Runs the standalone webgpu-test.html page to systematically test
 * each rendering step in isolation.
 *
 * Run with: npx playwright test webgpu-isolated-test.spec.ts --headed
 */

import { expect, test } from '@playwright/test'

test.setTimeout(120000)

test('WebGPU isolated rendering tests', async ({ page }) => {
  const consoleLogs: string[] = []
  page.on('console', (msg) => {
    const text = msg.text()
    consoleLogs.push(`[${msg.type()}] ${text}`)
    // Print in real-time for headed mode visibility
    console.log(`[${msg.type()}] ${text}`)
  })

  // Navigate to the isolated test page
  await page.goto('http://localhost:3000/webgpu-test.html')

  // Wait for all tests to complete (look for completion message)
  await page.waitForFunction(
    () => document.body.innerText.includes('ALL TESTS COMPLETE'),
    { timeout: 60000 }
  )

  // Take final screenshot
  await page.screenshot({ path: 'screenshots/webgpu-isolated-test-final.png' })

  // Analyze final canvas state
  const analysis = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    if (!canvas) return { error: 'No canvas found' }

    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = canvas.width
    tempCanvas.height = canvas.height
    const ctx = tempCanvas.getContext('2d')
    if (!ctx) return { error: 'No context' }

    ctx.drawImage(canvas, 0, 0)
    const imageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height)
    const data = imageData.data

    // Sample center pixel
    const cx = Math.floor(tempCanvas.width / 2)
    const cy = Math.floor(tempCanvas.height / 2)
    const idx = (cy * tempCanvas.width + cx) * 4
    const centerR = data[idx]
    const centerG = data[idx + 1]
    const centerB = data[idx + 2]

    let nonBlack = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i]! + data[i+1]! + data[i+2]! > 15) nonBlack++
    }

    return {
      width: tempCanvas.width,
      height: tempCanvas.height,
      centerColor: { r: centerR, g: centerG, b: centerB },
      nonBlackPixels: nonBlack,
      nonBlackPercent: (nonBlack / (tempCanvas.width * tempCanvas.height)) * 100,
    }
  })

  console.log('\n=== Final Canvas Analysis ===')
  console.log(JSON.stringify(analysis, null, 2))

  console.log('\n=== Console Logs ===')
  consoleLogs.forEach(log => console.log(log))

  // The final test (TEST 6) should show yellow if screenUV works
  // If black, screenUV sampling is broken
  if ('nonBlackPercent' in analysis) {
    expect(analysis.nonBlackPercent).toBeGreaterThan(50)
  }
})
