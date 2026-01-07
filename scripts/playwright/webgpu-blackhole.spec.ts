/**
 * WebGPU BlackHole Rendering Tests
 *
 * Verifies that the Black Hole raymarcher renders without WebGPU pipeline errors in WebGPU mode (TSL implementation).
 *
 * Run with:
 *   npx playwright test webgpu-blackhole.spec.ts
 */

import { ConsoleMessage, expect, Page, test } from '@playwright/test'
import { installWebGLShaderCompileLinkGuard } from './webglShaderCompileLinkGuard'

test.setTimeout(120000)

interface ErrorCollector {
  errors: string[]
  webglErrors: string[]
  graphWarnings: string[]
  warnings: string[]
  pageErrors: string[]
  blackHoleLogs: string[]
}

function setupErrorCollection(page: Page): ErrorCollector {
  const collector: ErrorCollector = {
    errors: [],
    webglErrors: [],
    graphWarnings: [],
    warnings: [],
    pageErrors: [],
    blackHoleLogs: [],
  }

  page.on('pageerror', (err) => {
    collector.pageErrors.push(err.message)
  })

  page.on('console', (msg: ConsoleMessage) => {
    const text = msg.text()
    const type = msg.type()

    if (text.includes('BlackHoleMeshTSL') || text.includes('Black Hole')) {
      collector.blackHoleLogs.push(text)
    }

    if (type === 'error') {
      collector.errors.push(text)

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
  })

  return collector
}

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

async function waitForRenderStable(page: Page, waitMs = 5000): Promise<void> {
  await page.waitForLoadState('domcontentloaded')

  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30000 })

  try {
    const loadingOverlay = page.locator('[data-testid="loading-overlay"]')
    await loadingOverlay.waitFor({ state: 'hidden', timeout: 15000 })
  } catch {
    // optional
  }

  try {
    const shaderOverlay = page.locator('[data-testid="shader-compiling-overlay"]')
    await shaderOverlay.waitFor({ state: 'hidden', timeout: 30000 })
  } catch {
    // optional
  }

  await page.waitForTimeout(waitMs)
}

test.describe('WebGPU BlackHole Rendering', () => {
  test('BlackHole 4D renders without WebGPU pipeline errors', async ({ page }) => {
    await installWebGLShaderCompileLinkGuard(page)
    const collector = setupErrorCollection(page)

    await page.goto('/?t=blackhole&d=4')
    await waitForRenderStable(page, 7000)

    verifyNoErrors(collector)
    await expect(page.locator('canvas').first()).toBeVisible()
  })

  test('BlackHole renders across multiple dimensions (3D-8D)', async ({ page }) => {
    await installWebGLShaderCompileLinkGuard(page)
    const collector = setupErrorCollection(page)

    const dimensions = [3, 4, 5, 6, 7, 8]
    const results: { dim: number; success: boolean; error?: string }[] = []

    for (const dim of dimensions) {
      collector.errors.length = 0
      collector.webglErrors.length = 0
      collector.graphWarnings.length = 0
      collector.pageErrors.length = 0
      collector.blackHoleLogs.length = 0

      try {
        await page.goto(`/?t=blackhole&d=${dim}`)
        await waitForRenderStable(page, 5000)

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

    console.log('\n=== BlackHole Dimension Rendering Results ===')
    for (const result of results) {
      const status = result.success ? '✓' : '✗'
      console.log(`${status} ${result.dim}D${result.error ? `: ${result.error}` : ''}`)
    }

    const failures = results.filter((r) => !r.success)
    expect(failures).toHaveLength(0)
  })
})


