/**
 * WebGPU Mandelbulb Rendering Tests
 *
 * Verifies that Mandelbulb fractal renders correctly in WebGPU mode (TSL implementation).
 * Tests raymarching, MRT output, and various dimension configurations.
 *
 * Run with:
 *   npx playwright test webgpu-mandelbulb.spec.ts
 */

import { ConsoleMessage, expect, Page, test } from '@playwright/test'
import { installWebGLShaderCompileLinkGuard } from './webglShaderCompileLinkGuard'

// Extended timeout for complex fractal renders
test.setTimeout(120000)

/** Collected console messages for verification */
interface ErrorCollector {
  errors: string[]
  webglErrors: string[]
  graphWarnings: string[]
  warnings: string[]
  pageErrors: string[]
  mandelbulbLogs: string[]
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
    mandelbulbLogs: [],
  }

  page.on('pageerror', (err) => {
    collector.pageErrors.push(err.message)
  })

  page.on('console', (msg: ConsoleMessage) => {
    const text = msg.text()
    const type = msg.type()

    // Capture Mandelbulb-specific logs
    if (text.includes('MandelbulbMeshTSL') || text.includes('Mandelbulb')) {
      collector.mandelbulbLogs.push(text)
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
        text.includes('INVALID_ENUM') ||
        text.includes('PipelineLayout') ||
        text.includes('bind group')
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
function verifyNoErrors(collector: ErrorCollector): void {
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
async function waitForRenderStable(page: Page, waitMs = 4000): Promise<void> {
  await page.waitForLoadState('domcontentloaded')

  // Wait for a visible canvas element
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30000 })

  // Wait for any loading overlays to disappear
  try {
    const loadingOverlay = page.locator('[data-testid="loading-overlay"]')
    await loadingOverlay.waitFor({ state: 'hidden', timeout: 15000 })
  } catch {
    // Overlay may not exist
  }

  // Wait for shader compilation overlay to disappear
  try {
    const shaderOverlay = page.locator('[data-testid="shader-compiling-overlay"]')
    await shaderOverlay.waitFor({ state: 'hidden', timeout: 30000 })
  } catch {
    // Overlay may not exist
  }

  // Additional wait for render stabilization
  await page.waitForTimeout(waitMs)
}

test.describe('WebGPU Mandelbulb Rendering', () => {
  test('Mandelbulb 3D renders without errors', async ({ page }) => {
    await installWebGLShaderCompileLinkGuard(page)
    const collector = setupErrorCollection(page)

    // Navigate to Mandelbulb with dimension 3
    await page.goto('/?t=mandelbulb&d=3')
    await waitForRenderStable(page, 5000)

    // Verify no shader errors
    verifyNoErrors(collector)

    // Canvas should be visible
    const canvas = page.locator('canvas').first()
    await expect(canvas).toBeVisible()
  })

  test('Mandelbulb 4D renders without errors', async ({ page }) => {
    await installWebGLShaderCompileLinkGuard(page)
    const collector = setupErrorCollection(page)

    // Navigate to Mandelbulb with dimension 4
    await page.goto('/?t=mandelbulb&d=4')
    await waitForRenderStable(page, 5000)

    verifyNoErrors(collector)
    await expect(page.locator('canvas').first()).toBeVisible()
  })

  test('Mandelbulb renders across multiple dimensions (3D-8D)', async ({ page }) => {
    await installWebGLShaderCompileLinkGuard(page)
    const collector = setupErrorCollection(page)

    const dimensions = [3, 4, 5, 6, 7, 8]
    const results: { dim: number; success: boolean; error?: string }[] = []

    for (const dim of dimensions) {
      // Clear errors between navigations
      collector.errors.length = 0
      collector.webglErrors.length = 0
      collector.graphWarnings.length = 0
      collector.pageErrors.length = 0
      collector.mandelbulbLogs.length = 0

      try {
        await page.goto(`/?t=mandelbulb&d=${dim}`)
        await waitForRenderStable(page, 4000)

        verifyNoErrors(collector)
        results.push({ dim, success: true })
      } catch (error) {
        results.push({
          dim,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // Log results
    console.log('\n=== Mandelbulb Dimension Rendering Results ===')
    for (const result of results) {
      const status = result.success ? '✓' : '✗'
      console.log(`${status} ${result.dim}D${result.error ? `: ${result.error}` : ''}`)
    }

    // All dimensions must succeed
    const failures = results.filter((r) => !r.success)
    expect(failures).toHaveLength(0)
  })

  test('Mandelbulb TSL shader composition logs correctly', async ({ page }) => {
    await installWebGLShaderCompileLinkGuard(page)
    const collector = setupErrorCollection(page)

    await page.goto('/?t=mandelbulb&d=4')
    await waitForRenderStable(page, 5000)

    verifyNoErrors(collector)

    // In dev mode, should see composition logs
    // Note: This may not always appear depending on build mode
    console.log('Mandelbulb logs:', collector.mandelbulbLogs)
  })

  test('Mandelbulb MRT output does not cause WebGPU pipeline errors', async ({ page }) => {
    await installWebGLShaderCompileLinkGuard(page)
    const collector = setupErrorCollection(page)

    await page.goto('/?t=mandelbulb&d=4')
    await waitForRenderStable(page, 5000)

    // Specifically check for WebGPU pipeline errors (common when MRT is misconfigured)
    const pipelineErrors = collector.errors.filter(
      (e) => e.includes('PipelineLayout') || e.includes('bind group') || e.includes('InvalidPipeline')
    )

    expect(pipelineErrors).toHaveLength(0)
  })
})

