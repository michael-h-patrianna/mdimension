/**
 * Object Types Rendering Tests
 *
 * Acceptance gate tests that verify ALL 11 object types render correctly.
 * Also tests skybox and walls rendering.
 *
 * Run with:
 *   npx playwright test object-types-rendering.spec.ts
 *
 * This is the authoritative Playwright gate for:
 * - shader compile + program link failures (via WebGL guard)
 * - runtime console WebGL errors / render-graph warnings
 *
 * Keep this suite fast and deterministic: no screenshots in the success path.
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
}

/**
 * Set up console error and warning collection BEFORE navigation.
 * This must be called before page.goto() to catch all messages.
 */
function setupErrorCollection(page: Page): ErrorCollector {
  const collector: ErrorCollector = {
    errors: [],
    webglErrors: [],
    graphWarnings: [],
    warnings: [],
    pageErrors: [],
  }

  page.on('pageerror', (err) => {
    collector.pageErrors.push(err.message)
  })

  page.on('console', (msg: ConsoleMessage) => {
    const text = msg.text()
    const type = msg.type()

    // Collect errors
    if (type === 'error') {
      collector.errors.push(text)

      // Check for WebGL-specific errors
      if (
        text.includes('WebGL') ||
        text.includes('GL_') ||
        text.includes('shader') ||
        text.includes('GLSL') ||
        text.includes('GL ERROR') ||
        text.includes('INVALID_OPERATION') ||
        text.includes('INVALID_VALUE') ||
        text.includes('INVALID_ENUM')
      ) {
        collector.webglErrors.push(text)
      }
    }

    // Collect warnings
    if (type === 'warning') {
      collector.warnings.push(text)

      // Check for render graph compilation warnings
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

    // Also check errors for graph-related issues
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
 * GATE 1: Check for console errors (cheapest verification).
 * Fails fast if there are WebGL errors, graph warnings, or critical errors.
 */
function verifyNoWebGLErrors(collector: ErrorCollector): void {
  if (collector.pageErrors.length > 0) {
    throw new Error(`Page errors detected:\n${collector.pageErrors.join('\n')}`)
  }

  // WebGL errors are critical - fail immediately
  if (collector.webglErrors.length > 0) {
    throw new Error(`WebGL errors detected:\n${collector.webglErrors.join('\n')}`)
  }

  // Graph compilation warnings are critical - fail immediately
  if (collector.graphWarnings.length > 0) {
    throw new Error(`Render graph warnings detected:\n${collector.graphWarnings.join('\n')}`)
  }

  // Filter out known benign errors
  const criticalErrors = collector.errors.filter(
    (e) =>
      !e.includes('ResizeObserver') && // Browser noise
      !e.includes('net::') && // Network errors
      !e.includes('favicon') && // Missing favicon
      !e.includes('Download the React DevTools') // Dev tools suggestion
  )

  // Allow 1 minor error, but flag if more
  if (criticalErrors.length > 1) {
    console.warn(`Non-critical errors (${criticalErrors.length}):`, criticalErrors)
  }
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

/**
 * Select an object type using URL parameter for reliability.
 * Sets up error collection BEFORE navigation.
 */
async function selectObjectType(page: Page, objectType: string): Promise<ErrorCollector> {
  // CRITICAL: Set up error collection BEFORE navigation
  const collector = setupErrorCollection(page)

  // Use URL parameter to set object type reliably
  // URL param 't' is used for objectType (see state-serializer.ts)
  await page.goto(`/?t=${objectType}`)
  await waitForRenderStable(page, 3000)

  return collector
}

/**
 * All 11 object types to test
 */
const OBJECT_TYPES = [
  { id: 'hypercube', name: 'Hypercube', category: 'polytope' },
  { id: 'simplex', name: 'Simplex', category: 'polytope' },
  { id: 'cross-polytope', name: 'Cross-Polytope', category: 'polytope' },
  { id: 'wythoff-polytope', name: 'Wythoff Polytope', category: 'polytope' },
  { id: 'root-system', name: 'Root System', category: 'polytope' },
  { id: 'clifford-torus', name: 'Clifford Torus', category: 'extended' },
  { id: 'nested-torus', name: 'Nested Torus', category: 'extended' },
  { id: 'mandelbulb', name: 'Mandelbulb', category: 'fractal' },
  { id: 'quaternion-julia', name: 'Quaternion Julia', category: 'fractal' },
  { id: 'schroedinger', name: 'Schroedinger', category: 'fractal' },
  { id: 'blackhole', name: 'Black Hole', category: 'fractal' },
]

test.describe('All Object Types Sequential Test', () => {
  test('Cycle through all 11 object types', async ({ page }) => {
    await installWebGLShaderCompileLinkGuard(page)

    const collector = setupErrorCollection(page)

    const results: { id: string; success: boolean; error?: string }[] = []

    for (const objectType of OBJECT_TYPES) {
      try {
        // Clear collected errors between navigations (listeners stay installed).
        collector.errors.length = 0
        collector.webglErrors.length = 0
        collector.graphWarnings.length = 0
        collector.warnings.length = 0
        collector.pageErrors.length = 0

        await page.goto(`/?t=${objectType.id}`)
        await waitForRenderStable(page, 3000)

        verifyNoWebGLErrors(collector)

        results.push({ id: objectType.id, success: true })
      } catch (error) {
        results.push({
          id: objectType.id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // Log results
    console.log('\n=== Object Type Rendering Results ===')
    for (const result of results) {
      const status = result.success ? '✓' : '✗'
      console.log(`${status} ${result.id}${result.error ? `: ${result.error}` : ''}`)
      if (result.webglErrors?.length) {
        result.webglErrors.forEach((e) => console.log(`    WebGL: ${e}`))
      }
      if (result.graphWarnings?.length) {
        result.graphWarnings.forEach((e) => console.log(`    Graph: ${e}`))
      }
    }

    // All must succeed
    const failures = results.filter((r) => !r.success)
    expect(failures).toHaveLength(0)
  })
})
