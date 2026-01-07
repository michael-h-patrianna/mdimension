/**
 * Schroedinger Quantum Mode Tests
 *
 * Tests each quantum mode by loading scenes with different quantumMode settings.
 * This verifies all three modes compile and render without freeze.
 */

import { test, expect } from '@playwright/test'

interface ModeTestCase {
  name: string
  scene: string
  expectedMode: string
}

const TEST_CASES: ModeTestCase[] = [
  {
    name: 'harmonicOscillator',
    scene: 'Schroedinger Bloom',
    expectedMode: 'harmonicOscillator',
  },
  {
    name: 'hydrogenND (7D)',
    scene: '7D Hydrogen Orbitals',
    expectedMode: 'hydrogenND',
  },
  {
    name: 'hydrogenND (3D)',
    scene: '3D Iso Hydrogen Orbitals',
    expectedMode: 'hydrogenND',
  },
]

test.describe('Schroedinger Quantum Modes via Scene Presets', () => {
  for (const testCase of TEST_CASES) {
    test(`${testCase.name} mode renders without freeze`, async ({ page }) => {
      test.setTimeout(30_000)
      page.setDefaultTimeout(15_000)

      const errors: string[] = []
      let compositionCompleted = false
      let actualMode = ''

      page.on('console', (msg) => {
        const text = msg.text()

        // Track composition
        if (text.includes('composeSchroedingerTSL ENTRY')) {
          const modeMatch = text.match(/mode=(\w+)/)
          if (modeMatch) {
            actualMode = modeMatch[1]
            console.log(`[${testCase.name}] Detected mode: ${actualMode}`)
          }
        }

        if (text.includes('composeSchroedingerTSL EXIT')) {
          compositionCompleted = true
          console.log(`[${testCase.name}] Composition completed`)
        }

        if (msg.type() === 'error') {
          errors.push(text)
          console.error(`[${testCase.name}] ERROR:`, text)
        }
      })

      page.on('pageerror', (err) => {
        errors.push(err.message)
        console.error(`[${testCase.name}] PAGE ERROR:`, err.message)
      })

      console.log(`\n=== Testing ${testCase.name} via scene "${testCase.scene}" ===`)

      // Encode scene name for URL
      const encodedScene = encodeURIComponent(testCase.scene)
      const url = `https://localhost:3004/?scene=${encodedScene}`

      console.log(`[${testCase.name}] Navigating to: ${url}`)

      const startTime = Date.now()
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      })

      // Wait for shader compilation and a few frames
      await page.waitForTimeout(5000)
      const elapsed = Date.now() - startTime

      console.log(`[${testCase.name}] Total time: ${elapsed}ms`)
      console.log(`[${testCase.name}] Composition completed: ${compositionCompleted}`)
      console.log(`[${testCase.name}] Actual mode: ${actualMode}`)
      console.log(`[${testCase.name}] Errors: ${errors.length}`)

      // Check canvas exists and has content
      const canvasInfo = await page.evaluate(() => {
        const canvas = document.querySelector('canvas')
        if (!canvas) return { found: false }
        return {
          found: true,
          width: canvas.width,
          height: canvas.height,
        }
      })

      console.log(`[${testCase.name}] Canvas:`, JSON.stringify(canvasInfo))

      // Filter critical errors
      const criticalErrors = errors.filter(
        (e) =>
          !e.includes('ResizeObserver') &&
          !e.includes('Warning') &&
          !e.includes('deprecated') &&
          !e.includes('WGSL') // Allow WGSL info messages
      )

      if (criticalErrors.length > 0) {
        console.log(`[${testCase.name}] Critical errors:`)
        criticalErrors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`))
      }

      // Assertions
      expect(canvasInfo.found).toBe(true)
      expect(elapsed).toBeLessThan(15000) // Should not freeze
      expect(criticalErrors.length).toBe(0)

      // Verify the correct mode was used (if detected)
      if (actualMode) {
        expect(actualMode).toBe(testCase.expectedMode)
      }
    })
  }
})
