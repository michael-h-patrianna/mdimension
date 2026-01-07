import { test, expect } from '@playwright/test'
test('Mandelbulb WebGPU baseline', async ({ page }) => {
  page.on('console', msg => console.log('[' + msg.type() + '] ' + msg.text()))
  await page.goto('https://localhost:3000/?t=mandelbulb', { ignoreHTTPSErrors: true })
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30000 })
  await page.waitForTimeout(5000)
  const metrics = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    if (!canvas) return { nonBlack: 0, avgBright: 0 }
    const offscreen = document.createElement('canvas')
    offscreen.width = canvas.width; offscreen.height = canvas.height
    const ctx = offscreen.getContext('2d')
    if (!ctx) return { nonBlack: 0, avgBright: 0 }
    ctx.drawImage(canvas, 0, 0)
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    let nonBlack = 0, totalBright = 0
    for (let i = 0; i < data.length; i += 40) {
      if (data[i] > 5 || data[i+1] > 5 || data[i+2] > 5) nonBlack++
      totalBright += (data[i] + data[i+1] + data[i+2]) / 3
    }
    return { nonBlack: nonBlack * 10, avgBright: totalBright / (data.length / 40) }
  })
  console.log('Mandelbulb metrics:', metrics)
  expect(metrics.nonBlack).toBeGreaterThan(1000)
})
