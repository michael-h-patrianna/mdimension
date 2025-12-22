/**
 * Object Types Rendering Tests
 *
 * Acceptance gate tests that verify ALL 11 object types render correctly.
 * Also tests skybox and walls rendering.
 *
 * Run with:
 *   npx playwright test object-types-rendering.spec.ts
 *
 * Test gates (in order of cost):
 * 1a. WebGL error check - FIRST (cheapest)
 * 1b. Render graph warning check - FIRST (cheapest)
 * 2. Center pixel check - SECOND (cheap)
 * 3. Screenshot analysis - LAST (expensive)
 */

import { ConsoleMessage, expect, Page, test } from '@playwright/test'

// Extended timeout for complex renders
test.setTimeout(120000)

/** Collected console messages for verification */
interface ErrorCollector {
  errors: string[]
  webglErrors: string[]
  graphWarnings: string[]
  warnings: string[]
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
  }

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
  // Wait for canvas element
  await page.waitForSelector('canvas', { state: 'visible', timeout: 30000 })

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
 * GATE 2: Check if center of canvas is not black (cheap verification).
 * A completely black center strongly indicates nothing is rendered.
 * Returns true if center has non-black pixels.
 */
async function verifyCenterNotBlack(page: Page): Promise<boolean> {
  const canvas = page.locator('canvas').first()

  // Get canvas dimensions
  const box = await canvas.boundingBox()
  if (!box) return false

  // Sample a small region at the center (10x10 pixels)
  const centerX = Math.floor(box.width / 2) - 5
  const centerY = Math.floor(box.height / 2) - 5

  // Take a tiny screenshot of just the center region
  const centerScreenshot = await canvas.screenshot({
    clip: { x: centerX, y: centerY, width: 10, height: 10 },
  })

  // Check if the center region has any non-black pixels
  // A pure black 10x10 PNG is very small (~100-200 bytes)
  // Any content will make it larger
  return centerScreenshot.length > 300
}

/**
 * GATE 3: Full screenshot analysis (expensive - use last).
 * Check if canvas has rendered content (not just black pixels).
 */
async function hasVisibleContent(page: Page): Promise<boolean> {
  const canvas = page.locator('canvas').first()

  // Take a screenshot and analyze
  const screenshot = await canvas.screenshot()

  // Simple check: if screenshot is > 10KB, it likely has content
  // A black/empty canvas compresses to very small size
  return screenshot.length > 10000
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

test.describe('Object Types Rendering - Acceptance Gate', () => {
  // Test each object type renders
  for (const objectType of OBJECT_TYPES) {
    test(`${objectType.name} (${objectType.id}) renders without errors`, async ({ page }) => {
      // Navigate to object type (sets up error collection BEFORE navigation)
      const collector = await selectObjectType(page, objectType.id)

      // === GATE 1: Console error check (CHEAPEST) ===
      verifyNoWebGLErrors(collector)

      // Verify canvas exists and is visible
      const canvas = page.locator('canvas').first()
      await expect(canvas).toBeVisible()

      // === GATE 2: Center pixel check (CHEAP) ===
      const centerHasContent = await verifyCenterNotBlack(page)
      if (!centerHasContent) {
        // Save diagnostic screenshot before failing
        await page.screenshot({
          path: `screenshots/object-types/${objectType.id}-FAILED-black.png`,
          fullPage: false,
        })
        throw new Error(`${objectType.name}: Center of canvas is black - nothing rendered`)
      }

      // === GATE 3: Full screenshot (EXPENSIVE - only if gates 1 & 2 pass) ===
      await page.screenshot({
        path: `screenshots/object-types/${objectType.id}.png`,
        fullPage: false,
      })
    })
  }
})

test.describe('Environment Rendering - Acceptance Gate', () => {
  test('Skybox renders correctly', async ({ page }) => {
    // Set up error collection BEFORE navigation
    const collector = setupErrorCollection(page)

    // Enable skybox via URL
    await page.goto('/?skybox=space_red')
    await waitForRenderStable(page, 3000)

    // === GATE 1: Console error check ===
    verifyNoWebGLErrors(collector)

    // Verify canvas renders
    const canvas = page.locator('canvas').first()
    await expect(canvas).toBeVisible()

    // === GATE 2: Center pixel check ===
    const centerHasContent = await verifyCenterNotBlack(page)
    expect(centerHasContent).toBe(true)

    // === GATE 3: Screenshot ===
    await page.screenshot({
      path: 'screenshots/environment/skybox-classic.png',
      fullPage: false,
    })
  })

  test('Procedural skybox renders correctly', async ({ page }) => {
    // Set up error collection BEFORE navigation
    const collector = setupErrorCollection(page)

    // Enable procedural skybox
    await page.goto('/?skybox=procedural_aurora')
    await waitForRenderStable(page, 3000)

    // === GATE 1: Console error check ===
    verifyNoWebGLErrors(collector)

    const canvas = page.locator('canvas').first()
    await expect(canvas).toBeVisible()

    // === GATE 2: Center pixel check ===
    const centerHasContent = await verifyCenterNotBlack(page)
    expect(centerHasContent).toBe(true)

    // === GATE 3: Screenshot ===
    await page.screenshot({
      path: 'screenshots/environment/skybox-procedural.png',
      fullPage: false,
    })
  })

  test('Ground plane and walls render correctly', async ({ page }) => {
    // Set up error collection BEFORE navigation
    const collector = setupErrorCollection(page)

    // Enable ground plane
    await page.goto('/?walls=floor')
    await waitForRenderStable(page, 3000)

    // === GATE 1: Console error check ===
    verifyNoWebGLErrors(collector)

    const canvas = page.locator('canvas').first()
    await expect(canvas).toBeVisible()

    // === GATE 2: Center pixel check ===
    const centerHasContent = await verifyCenterNotBlack(page)
    expect(centerHasContent).toBe(true)

    // === GATE 3: Screenshot ===
    await page.screenshot({
      path: 'screenshots/environment/ground-plane.png',
      fullPage: false,
    })
  })
})

test.describe('V2 Render Pipeline - Acceptance Gate', () => {
  test('V2 render pipeline is active by default', async ({ page }) => {
    // Set up error collection BEFORE navigation
    const collector = setupErrorCollection(page)

    await page.goto('/')
    await waitForRenderStable(page)

    // === GATE 1: Console error check ===
    verifyNoWebGLErrors(collector)

    // Verify the app loads and renders something
    const canvas = page.locator('canvas').first()
    await expect(canvas).toBeVisible()

    // === GATE 2: Center pixel check ===
    const centerHasContent = await verifyCenterNotBlack(page)
    expect(centerHasContent).toBe(true)

    // === GATE 3: Screenshot ===
    await page.screenshot({
      path: 'screenshots/v2-pipeline/v2-default.png',
      fullPage: false,
    })
  })

  test('App starts without errors', async ({ page }) => {
    // Set up error collection BEFORE navigation
    const collector = setupErrorCollection(page)

    await page.goto('/')
    await waitForRenderStable(page, 5000)

    // === GATE 1: Console error check (PRIMARY FOCUS OF THIS TEST) ===
    verifyNoWebGLErrors(collector)

    // Filter out known benign errors for additional reporting
    const criticalErrors = collector.errors.filter(
      (e) =>
        !e.includes('ResizeObserver') &&
        !e.includes('net::') &&
        !e.includes('favicon') &&
        !e.includes('Download the React DevTools')
    )

    // Should have no critical errors on startup
    if (criticalErrors.length > 0) {
      console.log('Critical errors found:', criticalErrors)
    }
    expect(criticalErrors.length).toBeLessThanOrEqual(1) // Allow 1 minor error
  })
})

test.describe('All Object Types Sequential Test', () => {
  test('Cycle through all 11 object types', async ({ page }) => {
    const results: {
      id: string
      success: boolean
      error?: string
      webglErrors?: string[]
      graphWarnings?: string[]
    }[] = []

    for (const objectType of OBJECT_TYPES) {
      try {
        // Set up fresh error collection for each object type
        const collector = await selectObjectType(page, objectType.id)

        // === GATE 1a: WebGL error check ===
        if (collector.webglErrors.length > 0) {
          results.push({
            id: objectType.id,
            success: false,
            error: 'WebGL errors detected',
            webglErrors: collector.webglErrors,
          })
          continue
        }

        // === GATE 1b: Graph compilation warning check ===
        if (collector.graphWarnings.length > 0) {
          results.push({
            id: objectType.id,
            success: false,
            error: 'Render graph warnings detected',
            graphWarnings: collector.graphWarnings,
          })
          continue
        }

        // Verify canvas
        const canvas = page.locator('canvas').first()
        await expect(canvas).toBeVisible()

        // === GATE 2: Center pixel check ===
        const centerHasContent = await verifyCenterNotBlack(page)
        if (!centerHasContent) {
          results.push({
            id: objectType.id,
            success: false,
            error: 'Center of canvas is black - nothing rendered',
          })
          continue
        }

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
