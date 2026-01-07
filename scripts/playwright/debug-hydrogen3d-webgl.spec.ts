import { test, expect } from '@playwright/test'

test('hydrogenND 3D WebGL', async ({ page }) => {
  test.setTimeout(120000)
  page.setDefaultTimeout(60000)

  const errors: string[] = []

  page.on('console', (msg) => {
    const text = msg.text()
    if (msg.type() === 'error') {
      console.log(`ERROR: ${text}`)
      errors.push(text)
    }
  })

  page.on('pageerror', (err) => {
    errors.push(err.message)
    console.log(`PAGE ERROR: ${err.message}`)
  })

  // Force WebGL backend
  console.log('Navigating with WebGL...')
  await page.goto('https://localhost:3004/?scene=3D%20Iso%20Hydrogen%20Orbitals&renderer=webgl', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  })

  console.log('Waiting 10 seconds...')
  await page.waitForTimeout(10000)

  console.log('Checking canvas...')
  const hasCanvas = await page.evaluate(() => !!document.querySelector('canvas'))
  console.log(`Canvas found: ${hasCanvas}`)

  expect(hasCanvas).toBe(true)
  expect(errors.length).toBe(0)
})
