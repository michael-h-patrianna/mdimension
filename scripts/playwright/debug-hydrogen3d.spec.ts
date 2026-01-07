import { test, expect } from '@playwright/test'

test('hydrogenND 3D debug', async ({ page }) => {
  test.setTimeout(120000)
  page.setDefaultTimeout(60000)

  const logs: string[] = []
  const errors: string[] = []

  page.on('console', (msg) => {
    const text = msg.text()
    const type = msg.type()
    logs.push(`[${type}] ${text}`)
    console.log(`[${type}] ${text.slice(0, 200)}`)
  })

  page.on('pageerror', (err) => {
    errors.push(err.message)
    console.log(`PAGE ERROR: ${err.message}`)
  })

  page.on('crash', () => {
    console.log('PAGE CRASHED!')
  })

  console.log('Navigating...')
  try {
    await page.goto('https://localhost:3004/?scene=3D%20Iso%20Hydrogen%20Orbitals', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })
  } catch (e) {
    console.log('Navigation error:', e)
  }

  console.log('Waiting 5 seconds...')
  await page.waitForTimeout(5000)

  console.log('Trying to check canvas...')
  try {
    const hasCanvas = await page.evaluate(() => !!document.querySelector('canvas'))
    console.log(`Canvas found: ${hasCanvas}`)
  } catch (e) {
    console.log('Canvas check failed:', e)
  }

  expect(errors.length).toBe(0)
})
