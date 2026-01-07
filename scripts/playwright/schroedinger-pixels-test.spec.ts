import { test, expect } from '@playwright/test'

test('Schroedinger Bloom pixels', async ({ page }) => {
  test.setTimeout(180000) // 3 minutes
  page.setDefaultTimeout(120000)

  const errors: string[] = []
  const logs: string[] = []

  page.on('console', (msg) => {
    const text = msg.text()
    logs.push(`[${msg.type()}] ${text}`)
    if (msg.type() === 'error') {
      errors.push(text)
    }
    // Log key events
    if (text.includes('Material created') || text.includes('Composed material')) {
      console.log(text)
    }
  })

  page.on('pageerror', (err) => {
    errors.push(`PAGE ERROR: ${err.message}`)
    console.log(`PAGE ERROR: ${err.message}`)
  })

  console.log('Navigating to Schroedinger Bloom...')
  await page.goto('https://localhost:3004/?scene=Schroedinger%20Bloom', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  })

  console.log('Waiting for canvas...')
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30000 })

  // Wait for shader compilation (can take 60+ seconds on WebGPU)
  console.log('Waiting 90 seconds for shader compilation...')
  await page.waitForTimeout(90000)

  console.log('Checking pixel content...')
  const pixelData = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    if (!canvas) return { error: 'no canvas' }

    try {
      const ctx = canvas.getContext('2d') || canvas.getContext('webgl') || canvas.getContext('webgl2') || canvas.getContext('webgpu')

      // For WebGL/WebGPU we need a different approach
      // Just report canvas dimensions for now
      return {
        width: canvas.width,
        height: canvas.height,
        clientWidth: canvas.clientWidth,
        clientHeight: canvas.clientHeight,
      }
    } catch (e) {
      return { error: String(e) }
    }
  })

  console.log('Canvas info:', pixelData)

  // Take a screenshot for manual inspection
  await page.screenshot({ path: 'screenshots/schroedinger-pixels-test.png', fullPage: true })
  console.log('Screenshot saved to screenshots/schroedinger-pixels-test.png')

  // Check for errors
  const criticalErrors = errors.filter(e =>
    e.includes('Invalid PipelineLayout') ||
    e.includes('CreateRenderPipeline') ||
    e.includes('WGSL')
  )

  console.log(`Total errors: ${errors.length}, Critical: ${criticalErrors.length}`)
  if (criticalErrors.length > 0) {
    console.log('Critical errors:', criticalErrors)
  }

  expect(criticalErrors.length).toBe(0)
})
