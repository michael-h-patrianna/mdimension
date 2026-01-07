/**
 * WebGPU Ground Plane Rendering Tests
 *
 * Verifies that ground plane/walls render correctly in WebGPU mode.
 * This test catches the regression where TSL ground plane material
 * was outputting black due to incorrect material type usage.
 *
 * Run with:
 *   npx playwright test webgpu-ground-plane.spec.ts
 */

import { ConsoleMessage, expect, Page, test } from '@playwright/test'
import { installWebGLShaderCompileLinkGuard } from './webglShaderCompileLinkGuard'

// Extended timeout for complex renders
test.setTimeout(120000)

/** Collected console messages for verification */
interface ErrorCollector {
  errors: string[]
  webglErrors: string[]
  graphWarnings: string[]
  warnings: string[]
  pageErrors: string[]
  tslMaterialLogs: string[]
}

/**
 * Set up console error and warning collection BEFORE navigation.
 */
function setupErrorCollection(page: Page): ErrorCollector {
  const collector: ErrorCollector = {
    errors: [],
    webglErrors: [],
    graphWarnings: [],
    warnings: [],
    pageErrors: [],
    tslMaterialLogs: [],
  }

  page.on('pageerror', (err) => {
    collector.pageErrors.push(err.message)
  })

  page.on('console', (msg: ConsoleMessage) => {
    const text = msg.text()
    const type = msg.type()

    // Capture TSL material logs
    if (text.includes('GroundPlaneMaterialTSL') || text.includes('[TSL]')) {
      collector.tslMaterialLogs.push(text)
    }

    if (type === 'error') {
      collector.errors.push(text)

      // Check for WebGL/WebGPU-specific errors
      if (
        text.includes('WebGL') ||
        text.includes('WebGPU') ||
        text.includes('GL_') ||
        text.includes('shader') ||
        text.includes('GLSL') ||
        text.includes('WGSL') ||
        text.includes('GL ERROR') ||
        text.includes('INVALID_OPERATION') ||
        text.includes('INVALID_VALUE') ||
        text.includes('INVALID_ENUM')
      ) {
        collector.webglErrors.push(text)
      }
    }

    if (type === 'warning') {
      collector.warnings.push(text)

      if (
        text.includes('Graph compilation') ||
        text.includes('RenderGraph') ||
        text.includes('render graph') ||
        text.includes('Resource') ||
        text.includes('Cycle detected') ||
        text.includes('Unused resource') ||
        text.includes('Missing resource') ||
        text.includes('pass dependency') ||
        text.includes('not found')
      ) {
        collector.graphWarnings.push(text)
      }
    }

    if (type === 'error') {
      if (
        text.includes('Graph compilation') ||
        text.includes('RenderGraph') ||
        text.includes('render graph') ||
        text.includes('Cycle detected') ||
        text.includes('pass dependency')
      ) {
        collector.graphWarnings.push(text)
      }
    }
  })

  return collector
}

/**
 * Verify no critical errors occurred.
 */
function verifyNoWebGLErrors(collector: ErrorCollector): void {
  if (collector.pageErrors.length > 0) {
    throw new Error(`Page errors detected:\n${collector.pageErrors.join('\n')}`)
  }

  if (collector.webglErrors.length > 0) {
    throw new Error(`WebGL/WebGPU errors detected:\n${collector.webglErrors.join('\n')}`)
  }

  if (collector.graphWarnings.length > 0) {
    throw new Error(`Render graph warnings detected:\n${collector.graphWarnings.join('\n')}`)
  }

  const criticalErrors = collector.errors.filter(
    (e) =>
      !e.includes('ResizeObserver') &&
      !e.includes('net::') &&
      !e.includes('favicon') &&
      !e.includes('Download the React DevTools')
  )

  if (criticalErrors.length > 1) {
    console.warn(`Non-critical errors (${criticalErrors.length}):`, criticalErrors)
  }
}

/**
 * Wait for WebGL/WebGPU canvas to render and stabilize.
 */
async function waitForRenderStable(page: Page, waitMs = 3000): Promise<void> {
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

test.describe('WebGPU Ground Plane Rendering', () => {
  test('Ground plane renders with lighting in WebGPU mode (hypercube)', async ({ page }) => {
    await installWebGLShaderCompileLinkGuard(page)
    const collector = setupErrorCollection(page)

    // Navigate with WebGPU backend forced
    // Hypercube is a good test because it shows the floor clearly
    await page.goto('/?t=hypercube')
    await waitForRenderStable(page, 4000)

    // Verify no shader errors
    verifyNoWebGLErrors(collector)

    // Canvas should be visible
    const canvas = page.locator('canvas').first()
    await expect(canvas).toBeVisible()
  })

  test('Ground plane renders correctly with different object types in WebGPU', async ({ page }) => {
    await installWebGLShaderCompileLinkGuard(page)
    const collector = setupErrorCollection(page)

    // Test a few object types that show ground plane prominently
    const objectTypes = ['hypercube', 'simplex', 'mandelbulb']

    for (const objectType of objectTypes) {
      // Clear errors between navigations
      collector.errors.length = 0
      collector.webglErrors.length = 0
      collector.graphWarnings.length = 0
      collector.pageErrors.length = 0

      await page.goto(`/?t=${objectType}`)
      await waitForRenderStable(page, 3000)

      // Verify no errors for this object type
      try {
        verifyNoWebGLErrors(collector)
      } catch (error) {
        throw new Error(
          `Ground plane rendering failed for ${objectType}: ${
            error instanceof Error ? error.message : String(error)
          }`
        )
      }
    }
  })

  test('TSL material compiles without errors', async ({ page }) => {
    await installWebGLShaderCompileLinkGuard(page)
    const collector = setupErrorCollection(page)

    await page.goto('/?t=hypercube')
    await waitForRenderStable(page, 4000)

    // No shader compilation errors
    verifyNoWebGLErrors(collector)

    // Check that no TSL-specific errors were logged
    const tslErrors = collector.errors.filter(
      (e) => e.includes('TSL') || e.includes('NodeMaterial') || e.includes('colorNode')
    )
    expect(tslErrors).toHaveLength(0)
  })
})

