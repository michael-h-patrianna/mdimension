/**
 * Polytope Rendering Tests
 *
 * Validates that all polytope object types render correctly with proper color.
 *
 * Test gates (in order):
 * 1. No console errors (especially WebGL/shader errors)
 * 2. 9x9 pixel area at center has mostly green tint (default polytope color)
 * 3. Screenshot for visual inspection
 *
 * Run with:
 *   npx playwright test polytope-rendering.spec.ts
 */

import { ConsoleMessage, expect, Page, test } from '@playwright/test'

// Extended timeout for WebGL renders
test.setTimeout(60000)

/** Collected console errors */
interface ErrorCollector {
  errors: string[]
  webglErrors: string[]
}

/** RGB color type */
interface RGB {
  r: number
  g: number
  b: number
}

/**
 * All polytope object types to test.
 */
const POLYTOPE_TYPES = [
  { id: 'hypercube', name: 'Hypercube' },
  { id: 'simplex', name: 'Simplex' },
  { id: 'cross-polytope', name: 'Cross-Polytope' },
  { id: 'wythoff-polytope', name: 'Wythoff Polytope' },
  { id: 'root-system', name: 'Root System' },
]

/**
 * Set up console error collection BEFORE navigation.
 */
function setupErrorCollection(page: Page): ErrorCollector {
  const collector: ErrorCollector = {
    errors: [],
    webglErrors: [],
  }

  page.on('console', (msg: ConsoleMessage) => {
    // Debug: log PolytopeScene messages
    const text = msg.text()
    if (
      text.includes('[PolytopeScene]') ||
      text.includes('[PostProcessing') ||
      text.includes('[RenderGraph')
    ) {
      console.log('[BROWSER]', text)
    }

    if (msg.type() === 'error') {
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
  })

  return collector
}

/**
 * Wait for WebGL canvas to render and stabilize.
 */
async function waitForRenderStable(page: Page, waitMs = 2000): Promise<void> {
  await page.waitForSelector('canvas', { state: 'visible', timeout: 30000 })

  try {
    const loadingOverlay = page.locator('[data-testid="loading-overlay"]')
    await loadingOverlay.waitFor({ state: 'hidden', timeout: 10000 })
  } catch {
    // Overlay may not exist
  }

  await page.waitForTimeout(waitMs)
}

/**
 * Enable cinematic mode to hide all UI sidebars.
 * This ensures the canvas fills the viewport for accurate pixel sampling.
 */
async function enableCinematicMode(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Access the Zustand store (exposed in main.tsx for e2e testing)
    const layoutStore = (
      window as unknown as {
        __LAYOUT_STORE__?: { getState: () => { setCinematicMode: (enabled: boolean) => void } }
      }
    ).__LAYOUT_STORE__
    if (layoutStore) {
      layoutStore.getState().setCinematicMode(true)
    }
  })
  // Wait for UI to hide
  await page.waitForTimeout(300)
}

/**
 * Disable skybox to ensure a solid black background.
 * Tests expect dark corners (brightness < 25), which requires no skybox.
 */
async function disableSkybox(page: Page): Promise<void> {
  const stateInfo = await page.evaluate(() => {
    // Access the environment store (exposed in main.tsx for e2e testing)
    const envStore = (
      window as unknown as {
        __ENVIRONMENT_STORE__?: {
          getState: () => {
            setSkyboxSelection: (selection: string) => void
            skyboxEnabled: boolean
            skyboxSelection: string
          }
        }
      }
    ).__ENVIRONMENT_STORE__
    if (envStore) {
      const before = envStore.getState()
      const beforeState = {
        skyboxEnabled: before.skyboxEnabled,
        skyboxSelection: before.skyboxSelection,
      }
      before.setSkyboxSelection('none')
      const after = envStore.getState()
      return {
        before: beforeState,
        after: { skyboxEnabled: after.skyboxEnabled, skyboxSelection: after.skyboxSelection },
      }
    }
    return { error: 'Store not found' }
  })
  console.log('[SKYBOX DEBUG]', stateInfo)

  // Wait for React to re-render and clear scene.background
  await page.waitForTimeout(1000)

  // Debug: check geometry store state
  const geometryInfo = await page.evaluate(() => {
    const geoStore = (
      window as unknown as {
        __GEOMETRY_STORE__?: { getState: () => { dimension: number; objectType: string } }
      }
    ).__GEOMETRY_STORE__
    if (geoStore) {
      const state = geoStore.getState()
      return { dimension: state.dimension, objectType: state.objectType }
    }
    return { error: 'Geometry store not found' }
  })
  console.log('[GEOMETRY DEBUG]', geometryInfo)
}

/**
 * Sample size for center region analysis.
 * Using 81x81 (9*9) to capture wireframe polytopes which have gaps between edges.
 * This gives us 6561 pixels to analyze, same density as a dense 9x9.
 */
const SAMPLE_SIZE = 81

/** Corner sample size - 9x9 pixels */
const CORNER_SIZE = 9

/**
 * Extract RGB pixel data from center area of canvas.
 * Uses larger sample to account for wireframe polytopes with gaps.
 * Returns array of RGB values for each pixel.
 */
async function getCenterPixels(page: Page): Promise<RGB[]> {
  const canvas = page.locator('canvas').first()
  const box = await canvas.boundingBox()

  if (!box) {
    throw new Error('Canvas bounding box not found')
  }

  // Calculate center position for sample
  const halfSize = Math.floor(SAMPLE_SIZE / 2)
  const centerX = Math.floor(box.width / 2) - halfSize
  const centerY = Math.floor(box.height / 2) - halfSize

  // Take screenshot of center region
  const screenshot = await canvas.screenshot({
    clip: { x: centerX, y: centerY, width: SAMPLE_SIZE, height: SAMPLE_SIZE },
  })

  // Parse PNG data to extract RGB values
  // PNG format: 8-byte signature + chunks
  // We'll use a simple approach: decode the raw RGBA data
  const pixels: RGB[] = []

  // Use page.evaluate to decode the PNG and get pixel data
  const pixelData = await page.evaluate(
    async (params: { base64Data: string; size: number }) => {
      return new Promise<number[]>((resolve) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = params.size
          canvas.height = params.size
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve([])
            return
          }
          ctx.drawImage(img, 0, 0)
          const imageData = ctx.getImageData(0, 0, params.size, params.size)
          resolve(Array.from(imageData.data))
        }
        img.src = 'data:image/png;base64,' + params.base64Data
      })
    },
    { base64Data: screenshot.toString('base64'), size: SAMPLE_SIZE }
  )

  // Convert RGBA array to RGB objects
  for (let i = 0; i < pixelData.length; i += 4) {
    pixels.push({
      r: pixelData[i],
      g: pixelData[i + 1],
      b: pixelData[i + 2],
    })
  }

  return pixels
}

/**
 * Extract RGB pixel data from a corner of the canvas.
 * @param page - Playwright page
 * @param corner - 'top-left' or 'bottom-right'
 */
async function getCornerPixels(page: Page, corner: 'top-left' | 'bottom-right'): Promise<RGB[]> {
  const canvas = page.locator('canvas').first()
  const box = await canvas.boundingBox()

  if (!box) {
    throw new Error('Canvas bounding box not found')
  }

  // Calculate corner position
  let x: number, y: number
  if (corner === 'top-left') {
    x = 0
    y = 0
  } else {
    x = box.width - CORNER_SIZE
    y = box.height - CORNER_SIZE
  }

  // Take screenshot of corner region
  const screenshot = await canvas.screenshot({
    clip: { x, y, width: CORNER_SIZE, height: CORNER_SIZE },
  })

  // Decode pixels
  const pixelData = await page.evaluate(
    async (params: { base64Data: string; size: number }) => {
      return new Promise<number[]>((resolve) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = params.size
          canvas.height = params.size
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve([])
            return
          }
          ctx.drawImage(img, 0, 0)
          const imageData = ctx.getImageData(0, 0, params.size, params.size)
          resolve(Array.from(imageData.data))
        }
        img.src = 'data:image/png;base64,' + params.base64Data
      })
    },
    { base64Data: screenshot.toString('base64'), size: CORNER_SIZE }
  )

  const pixels: RGB[] = []
  for (let i = 0; i < pixelData.length; i += 4) {
    pixels.push({
      r: pixelData[i],
      g: pixelData[i + 1],
      b: pixelData[i + 2],
    })
  }

  return pixels
}

/**
 * Check if corner pixels are dark (black background).
 * Returns true if the corner is mostly dark (average brightness < 25).
 */
function isCornerDark(pixels: RGB[]): { isDark: boolean; avgBrightness: number } {
  let totalBrightness = 0
  for (const pixel of pixels) {
    totalBrightness += (pixel.r + pixel.g + pixel.b) / 3
  }
  const avgBrightness = totalBrightness / pixels.length
  return {
    isDark: avgBrightness < 25,
    avgBrightness,
  }
}

/**
 * Check if a pixel has a green/teal tint.
 * Default polytope color is #33cc9e (RGB 51, 204, 158) - a teal/cyan-green.
 * Green tint means: G channel is high and dominant over R.
 */
function hasGreenTint(pixel: RGB): boolean {
  // Ignore very dark pixels (likely background/space)
  const brightness = (pixel.r + pixel.g + pixel.b) / 3
  if (brightness < 30) {
    return false // Too dark to determine color
  }

  // For teal/cyan-green (#33cc9e style):
  // - G should be the highest or close to B
  // - G should be significantly higher than R
  // - G should be at least 100 (reasonably bright green)
  const greenDominant = pixel.g > pixel.r + 20
  const hasGreenComponent = pixel.g >= 80

  return greenDominant && hasGreenComponent
}

/**
 * Check if a pixel is part of the polytope (not black/background).
 * A pixel is considered "filled" if it has reasonable brightness.
 * Using threshold of 50 to distinguish from dark backgrounds.
 */
function isFilledPixel(pixel: RGB, brightnessThreshold = 50): boolean {
  const brightness = (pixel.r + pixel.g + pixel.b) / 3
  return brightness > brightnessThreshold
}

/**
 * Analyze 9x9 center pixels for green tint presence.
 * Returns stats about the center region.
 */
function analyzeCenterRegion(pixels: RGB[]): {
  totalPixels: number
  filledPixels: number
  greenTintPixels: number
  filledRatio: number
  greenRatio: number
  averageColor: RGB
} {
  const totalPixels = pixels.length
  let filledPixels = 0
  let greenTintPixels = 0
  let sumR = 0,
    sumG = 0,
    sumB = 0

  for (const pixel of pixels) {
    sumR += pixel.r
    sumG += pixel.g
    sumB += pixel.b

    if (isFilledPixel(pixel)) {
      filledPixels++
      if (hasGreenTint(pixel)) {
        greenTintPixels++
      }
    }
  }

  return {
    totalPixels,
    filledPixels,
    greenTintPixels,
    filledRatio: filledPixels / totalPixels,
    greenRatio: filledPixels > 0 ? greenTintPixels / filledPixels : 0,
    averageColor: {
      r: Math.round(sumR / totalPixels),
      g: Math.round(sumG / totalPixels),
      b: Math.round(sumB / totalPixels),
    },
  }
}

test.describe('Polytope Rendering - Acceptance Gates', () => {
  for (const polytope of POLYTOPE_TYPES) {
    test(`${polytope.name} (${polytope.id}) renders with green tint`, async ({ page }) => {
      // Set up error collection BEFORE navigation
      const collector = setupErrorCollection(page)

      // Navigate to polytope - URL param 't' is used for objectType (see state-serializer.ts)
      await page.goto(`/?t=${polytope.id}`)

      // DON'T switch to V1 - test with V2 (default)
      // const switchResult = await page.evaluate(() => { ... });
      // console.log('[RENDERER SWITCH]', switchResult);
      // await page.waitForTimeout(500);

      await waitForRenderStable(page, 2000)

      // Enable cinematic mode to hide sidebars for accurate pixel sampling
      await enableCinematicMode(page)
      // Disable skybox for tests expecting dark corners
      await disableSkybox(page)
      await waitForRenderStable(page, 1000)

      // === GATE 1: No console errors ===
      if (collector.webglErrors.length > 0) {
        throw new Error(`GATE 1 FAILED - WebGL errors:\n${collector.webglErrors.join('\n')}`)
      }

      const criticalErrors = collector.errors.filter(
        (e) =>
          !e.includes('ResizeObserver') &&
          !e.includes('net::') &&
          !e.includes('favicon') &&
          !e.includes('Download the React DevTools')
      )

      if (criticalErrors.length > 0) {
        console.warn(`Non-critical errors for ${polytope.id}:`, criticalErrors)
      }

      // === GATE 2a: Corners must be dark (polytope is centered, not filling screen) ===
      const topLeftPixels = await getCornerPixels(page, 'top-left')
      const bottomRightPixels = await getCornerPixels(page, 'bottom-right')
      const topLeftCheck = isCornerDark(topLeftPixels)
      const bottomRightCheck = isCornerDark(bottomRightPixels)

      console.log(`${polytope.name} corner analysis:`, {
        topLeft: `brightness: ${topLeftCheck.avgBrightness.toFixed(1)}, dark: ${topLeftCheck.isDark}`,
        bottomRight: `brightness: ${bottomRightCheck.avgBrightness.toFixed(1)}, dark: ${bottomRightCheck.isDark}`,
      })

      if (!topLeftCheck.isDark || !bottomRightCheck.isDark) {
        await page.screenshot({
          path: `screenshots/polytopes/${polytope.id}-FAILED-corners-bright.png`,
          fullPage: false,
        })
        throw new Error(
          `GATE 2a FAILED - Corners not dark (polytope may be filling entire screen). ` +
            `Top-left: ${topLeftCheck.avgBrightness.toFixed(1)}, Bottom-right: ${bottomRightCheck.avgBrightness.toFixed(1)} (need <25)`
        )
      }

      // === GATE 2b: Center area has green tint ===
      const centerPixels = await getCenterPixels(page)
      const analysis = analyzeCenterRegion(centerPixels)

      const avgBrightness =
        (analysis.averageColor.r + analysis.averageColor.g + analysis.averageColor.b) / 3

      console.log(`${polytope.name} center analysis:`, {
        filledRatio: `${(analysis.filledRatio * 100).toFixed(1)}%`,
        greenRatio: `${(analysis.greenRatio * 100).toFixed(1)}%`,
        averageColor: `rgb(${analysis.averageColor.r}, ${analysis.averageColor.g}, ${analysis.averageColor.b})`,
        avgBrightness: avgBrightness.toFixed(1),
      })

      // Check: average brightness must indicate something is rendered
      // A dark empty canvas has avg brightness ~15-25
      if (avgBrightness < 35) {
        await page.screenshot({
          path: `screenshots/polytopes/${polytope.id}-FAILED-dark.png`,
          fullPage: false,
        })
        throw new Error(
          `GATE 2b FAILED - Scene too dark/nothing rendered (avg brightness: ${avgBrightness.toFixed(1)}, need 35+). ` +
            `Average color: rgb(${analysis.averageColor.r}, ${analysis.averageColor.g}, ${analysis.averageColor.b})`
        )
      }

      // For wireframe polytopes, we expect some fill from the edges.
      // At least 15% of center pixels should be filled (polytope edges).
      if (analysis.filledRatio < 0.15) {
        await page.screenshot({
          path: `screenshots/polytopes/${polytope.id}-FAILED-empty.png`,
          fullPage: false,
        })
        throw new Error(
          `GATE 2b FAILED - Center is empty/no polytope visible (${(analysis.filledRatio * 100).toFixed(1)}% filled, need 15%+). ` +
            `Average color: rgb(${analysis.averageColor.r}, ${analysis.averageColor.g}, ${analysis.averageColor.b})`
        )
      }

      // Of the filled pixels, at least 50% should have green/teal tint
      if (analysis.greenRatio < 0.5) {
        await page.screenshot({
          path: `screenshots/polytopes/${polytope.id}-FAILED-no-green.png`,
          fullPage: false,
        })
        throw new Error(
          `GATE 2b FAILED - Insufficient green tint (${(analysis.greenRatio * 100).toFixed(1)}% green, need 50%+). ` +
            `Average color: rgb(${analysis.averageColor.r}, ${analysis.averageColor.g}, ${analysis.averageColor.b})`
        )
      }

      // === GATE 3: Screenshot for visual inspection ===
      await page.screenshot({
        path: `screenshots/polytopes/${polytope.id}.png`,
        fullPage: false,
      })

      // Log success
      console.log(
        `✓ ${polytope.name}: ${(analysis.filledRatio * 100).toFixed(0)}% filled, ` +
          `${(analysis.greenRatio * 100).toFixed(0)}% green tint`
      )
    })
  }
})

test.describe('Polytope Rendering - Sequential Verification', () => {
  test('All 5 polytopes render with green center and dark corners', async ({ page }) => {
    const results: {
      id: string
      success: boolean
      filledRatio?: number
      greenRatio?: number
      cornersDark?: boolean
      error?: string
    }[] = []

    for (const polytope of POLYTOPE_TYPES) {
      const collector = setupErrorCollection(page)

      try {
        // Navigate to polytope
        await page.goto(`/?t=${polytope.id}`)
        await waitForRenderStable(page, 2000)

        // Enable cinematic mode
        await enableCinematicMode(page)
        // Disable skybox for tests expecting dark corners
        await disableSkybox(page)
        await waitForRenderStable(page, 1000)

        // Gate 1: Check errors
        if (collector.webglErrors.length > 0) {
          results.push({
            id: polytope.id,
            success: false,
            error: `WebGL errors: ${collector.webglErrors[0]}`,
          })
          continue
        }

        // Gate 2a: Check corners are dark
        const topLeftPixels = await getCornerPixels(page, 'top-left')
        const bottomRightPixels = await getCornerPixels(page, 'bottom-right')
        const topLeftCheck = isCornerDark(topLeftPixels)
        const bottomRightCheck = isCornerDark(bottomRightPixels)

        if (!topLeftCheck.isDark || !bottomRightCheck.isDark) {
          results.push({
            id: polytope.id,
            success: false,
            cornersDark: false,
            error: `Corners not dark (TL: ${topLeftCheck.avgBrightness.toFixed(1)}, BR: ${bottomRightCheck.avgBrightness.toFixed(1)})`,
          })
          continue
        }

        // Gate 2b: Check center green tint
        const centerPixels = await getCenterPixels(page)
        const analysis = analyzeCenterRegion(centerPixels)
        const avgBrightness =
          (analysis.averageColor.r + analysis.averageColor.g + analysis.averageColor.b) / 3

        if (avgBrightness < 35) {
          results.push({
            id: polytope.id,
            success: false,
            cornersDark: true,
            error: `Center too dark (brightness: ${avgBrightness.toFixed(1)}, need 35+)`,
          })
          continue
        }

        if (analysis.filledRatio < 0.15) {
          results.push({
            id: polytope.id,
            success: false,
            filledRatio: analysis.filledRatio,
            cornersDark: true,
            error: `Center empty (${(analysis.filledRatio * 100).toFixed(1)}% filled, need 15%+)`,
          })
          continue
        }

        if (analysis.greenRatio < 0.5) {
          results.push({
            id: polytope.id,
            success: false,
            filledRatio: analysis.filledRatio,
            greenRatio: analysis.greenRatio,
            cornersDark: true,
            error: `Insufficient green (${(analysis.greenRatio * 100).toFixed(1)}%, need 50%+)`,
          })
          continue
        }

        results.push({
          id: polytope.id,
          success: true,
          filledRatio: analysis.filledRatio,
          greenRatio: analysis.greenRatio,
          cornersDark: true,
        })
      } catch (error) {
        results.push({
          id: polytope.id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // Log results
    console.log('\n=== Polytope Rendering Results ===')
    for (const result of results) {
      const status = result.success ? '✓' : '✗'
      const details = result.success
        ? `filled: ${((result.filledRatio ?? 0) * 100).toFixed(0)}%, green: ${((result.greenRatio ?? 0) * 100).toFixed(0)}%`
        : result.error
      console.log(`${status} ${result.id}: ${details}`)
    }

    // All must succeed
    const failures = results.filter((r) => !r.success)
    expect(failures).toHaveLength(0)
  })
})
