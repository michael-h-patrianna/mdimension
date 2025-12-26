/**
 * Wythoff Truncated 3D Bug Fix Verification Test
 *
 * Tests that the Wythoff polytope with B symmetry and truncated preset
 * in 3D renders without the "Matrix slicing out of bounds" error.
 *
 * Bug: The convex hull algorithm in WASM used SVD to compute normals,
 * but for 3D, the thin SVD didn't have enough rows, causing an out-of-bounds
 * matrix access. Fixed by using cross product for 3D case.
 *
 * Run with:
 *   npx playwright test wythoff-truncated-3d.spec.ts
 */

import { ConsoleMessage, expect, Page, test } from '@playwright/test'
import { installWebGLShaderCompileLinkGuard } from './webglShaderCompileLinkGuard'

// Extended timeout for complex renders
test.setTimeout(120000)

/** Collected console messages for verification */
interface ErrorCollector {
  errors: string[]
  wasmErrors: string[]
  pageErrors: string[]
}

/**
 * Set up console error collection BEFORE navigation.
 */
function setupErrorCollection(page: Page): ErrorCollector {
  const collector: ErrorCollector = {
    errors: [],
    wasmErrors: [],
    pageErrors: [],
  }

  page.on('pageerror', (err) => {
    collector.pageErrors.push(err.message)
  })

  page.on('console', (msg: ConsoleMessage) => {
    const text = msg.text()
    const type = msg.type()

    if (type === 'error') {
      collector.errors.push(text)

      // Check for WASM-specific errors (the bug we're fixing)
      if (
        text.includes('panicked') ||
        text.includes('Matrix slicing') ||
        text.includes('unreachable') ||
        text.includes('wasm') ||
        text.includes('nalgebra')
      ) {
        collector.wasmErrors.push(text)
      }
    }
  })

  return collector
}

/**
 * Wait for WebGL canvas to render and stabilize.
 */
async function waitForRenderStable(page: Page, waitMs = 2000): Promise<void> {
  await page.waitForLoadState('domcontentloaded')

  // Wait for a visible canvas element
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30000 })

  // Wait for any loading overlays to disappear
  try {
    const loadingOverlay = page.locator('[data-testid="loading-overlay"]')
    await loadingOverlay.waitFor({ state: 'hidden', timeout: 10000 })
  } catch {
    // Overlay may not exist
  }

  // Additional wait for render stabilization
  await page.waitForTimeout(waitMs)
}

test.describe('Wythoff Truncated 3D Bug Fix', () => {
  test('B symmetry truncated preset in 3D should render without WASM errors', async ({
    page,
  }) => {
    await installWebGLShaderCompileLinkGuard(page)

    // Set up error collection BEFORE navigation
    const collector = setupErrorCollection(page)

    // Navigate to wythoff polytope with dimension 3
    await page.goto('/?t=wythoff-polytope&d=3')
    await waitForRenderStable(page, 2000)

    // Set B symmetry and truncated preset via JavaScript
    // This triggers the WASM convex hull face generation that was crashing
    await page.evaluate(() => {
      // Access Zustand stores via window for testing (exposed in main.tsx for DEV mode)
      const extendedStore = (window as unknown as { __EXTENDED_OBJECT_STORE__?: {
        getState: () => {
          setWythoffSymmetryGroup: (group: string) => void
          setWythoffPreset: (preset: string) => void
        }
      } }).__EXTENDED_OBJECT_STORE__

      if (extendedStore) {
        const state = extendedStore.getState()
        state.setWythoffSymmetryGroup('B')
        state.setWythoffPreset('truncated')
      }
    })

    // Wait for geometry generation to complete (this is where the bug would crash)
    await page.waitForTimeout(3000)

    // Verify no WASM errors occurred
    if (collector.wasmErrors.length > 0) {
      throw new Error(`WASM errors detected:\n${collector.wasmErrors.join('\n')}`)
    }

    if (collector.pageErrors.length > 0) {
      // Filter for the specific matrix slicing error
      const matrixErrors = collector.pageErrors.filter(
        (e) => e.includes('Matrix slicing') || e.includes('unreachable')
      )
      if (matrixErrors.length > 0) {
        throw new Error(`Matrix slicing errors detected:\n${matrixErrors.join('\n')}`)
      }
    }

    // Verify canvas is still visible (app didn't crash)
    await expect(page.locator('canvas').first()).toBeVisible()

    console.log('✓ Wythoff B3 truncated rendered successfully without WASM errors')
  })

  test('All truncated presets in 3D should work (B, A symmetry)', async ({ page }) => {
    await installWebGLShaderCompileLinkGuard(page)

    const collector = setupErrorCollection(page)

    // Navigate to wythoff polytope with dimension 3
    await page.goto('/?t=wythoff-polytope&d=3')
    await waitForRenderStable(page, 2000)

    // Test configurations that use convex hull (truncated presets)
    const testConfigs = [
      { symmetry: 'B', preset: 'truncated', name: 'B3 Truncated' },
      { symmetry: 'B', preset: 'rectified', name: 'B3 Rectified' },
      { symmetry: 'A', preset: 'regular', name: 'A3 Regular (Simplex)' },
    ]

    for (const config of testConfigs) {
      // Clear errors between configs
      collector.errors.length = 0
      collector.wasmErrors.length = 0
      collector.pageErrors.length = 0

      console.log(`Testing ${config.name}...`)

      // Set configuration via JavaScript (stores exposed in main.tsx for DEV mode)
      await page.evaluate(
        ({ symmetry, preset }) => {
          const extendedStore = (window as unknown as { __EXTENDED_OBJECT_STORE__?: {
            getState: () => {
              setWythoffSymmetryGroup: (group: string) => void
              setWythoffPreset: (preset: string) => void
            }
          } }).__EXTENDED_OBJECT_STORE__

          if (extendedStore) {
            const state = extendedStore.getState()
            state.setWythoffSymmetryGroup(symmetry)
            state.setWythoffPreset(preset)
          }
        },
        { symmetry: config.symmetry, preset: config.preset }
      )

      // Wait for geometry generation
      await page.waitForTimeout(2000)

      // Check for errors
      if (collector.wasmErrors.length > 0) {
        throw new Error(
          `WASM errors for ${config.name}:\n${collector.wasmErrors.join('\n')}`
        )
      }

      const matrixErrors = collector.pageErrors.filter(
        (e) => e.includes('Matrix slicing') || e.includes('unreachable')
      )
      if (matrixErrors.length > 0) {
        throw new Error(
          `Matrix slicing errors for ${config.name}:\n${matrixErrors.join('\n')}`
        )
      }

      console.log(`✓ ${config.name} rendered successfully`)
    }

    // Verify canvas is still visible
    await expect(page.locator('canvas').first()).toBeVisible()
  })
})

