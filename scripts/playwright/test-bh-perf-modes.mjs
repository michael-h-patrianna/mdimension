/**
 * Black Hole Performance Modes Test (OPT-BH-1/2/3/5)
 *
 * Tests the GPU performance optimizations:
 * - OPT-BH-1: Noise Texture LUT
 * - OPT-BH-2: FBM Octave Reduction
 * - OPT-BH-3: Ultra-Fast Mode (velocity-based)
 * - OPT-BH-5: Shell Uniform Optimization
 *
 * Verifies that:
 * 1. Black hole renders correctly in normal mode
 * 2. Black hole renders during camera movement (ultra-fast mode triggers)
 * 3. No GL errors occur during mode transitions
 */
import { chromium } from 'playwright'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

/**
 * Analyze canvas pixels for black hole presence
 * @param {import('playwright').Page} page
 * @returns {Promise<Object>} Analysis results
 */
async function analyzeBlackHoleRendering(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    if (!canvas) return { error: 'No canvas found' }

    const gl = canvas.getContext('webgl2')
    if (!gl) return { error: 'No WebGL2 context' }

    const w = canvas.width
    const h = canvas.height
    const pixels = new Uint8Array(w * h * 4)
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels)

    let blackPixels = 0
    let coloredPixels = 0
    let orangePixels = 0

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i]
      const g = pixels[i + 1]
      const b = pixels[i + 2]

      if (r < 5 && g < 5 && b < 5) {
        blackPixels++
      } else {
        coloredPixels++
        // Accretion disk typically has warm colors
        if (r > 100 && g > 30 && b < 150) {
          orangePixels++
        }
      }
    }

    const totalPixels = w * h
    return {
      canvasWidth: w,
      canvasHeight: h,
      totalPixels,
      blackPixels,
      coloredPixels,
      orangePixels,
      blackPercent: ((blackPixels / totalPixels) * 100).toFixed(1),
      coloredPercent: ((coloredPixels / totalPixels) * 100).toFixed(1),
    }
  })
}

/**
 * Simulate camera movement by triggering mouse drag
 * @param {import('playwright').Page} page
 */
async function simulateCameraMovement(page) {
  const canvas = await page.$('canvas')
  if (!canvas) return

  const box = await canvas.boundingBox()
  if (!box) return

  const centerX = box.x + box.width / 2
  const centerY = box.y + box.height / 2

  // Perform rapid drag movements to trigger ultra-fast mode
  for (let i = 0; i < 5; i++) {
    await page.mouse.move(centerX, centerY)
    await page.mouse.down()
    // Rapid movement across screen
    await page.mouse.move(centerX + 200, centerY, { steps: 3 })
    await page.mouse.move(centerX - 200, centerY, { steps: 3 })
    await page.mouse.up()
    await page.waitForTimeout(50)
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })

  const errors = []
  const consoleMessages = []

  page.on('console', (msg) => {
    const text = msg.text()
    consoleMessages.push(`[${msg.type()}] ${text}`)
    if (msg.type() === 'error' || text.includes('GL_INVALID')) {
      errors.push(text)
    }
  })

  try {
    console.log('=== Black Hole Performance Modes Test ===\n')

    // Navigate to black hole
    console.log(`1. Navigating to ${BASE_URL}/?t=blackhole ...`)
    await page.goto(`${BASE_URL}/?t=blackhole`, { waitUntil: 'networkidle' })

    // Wait for shader compilation and initial render
    console.log('2. Waiting for shader compilation (4s)...')
    await page.waitForTimeout(4000)

    // Test 1: Normal mode rendering
    console.log('\n=== TEST 1: Normal Mode Rendering ===')
    const normalResult = await analyzeBlackHoleRendering(page)

    if (normalResult.error) {
      console.error(`ERROR: ${normalResult.error}`)
      process.exit(1)
    }

    console.log(`Canvas: ${normalResult.canvasWidth}x${normalResult.canvasHeight}`)
    console.log(`Colored pixels: ${normalResult.coloredPixels} (${normalResult.coloredPercent}%)`)
    console.log(`Orange pixels (disk): ${normalResult.orangePixels}`)

    const normalModePass = normalResult.coloredPixels > 1000
    console.log(`Normal mode renders: ${normalModePass ? 'PASS' : 'FAIL'}`)

    // Take screenshot in normal mode
    await page.screenshot({ path: 'screenshots/bh-perf-normal.png' })

    // Test 2: Ultra-fast mode (camera movement)
    console.log('\n=== TEST 2: Ultra-Fast Mode (Camera Movement) ===')
    console.log('Simulating rapid camera movement...')

    await simulateCameraMovement(page)
    await page.waitForTimeout(100) // Allow frame to render

    const ultraFastResult = await analyzeBlackHoleRendering(page)

    if (ultraFastResult.error) {
      console.error(`ERROR: ${ultraFastResult.error}`)
      process.exit(1)
    }

    console.log(`Colored pixels during movement: ${ultraFastResult.coloredPixels} (${ultraFastResult.coloredPercent}%)`)

    // Ultra-fast mode should still render something (smooth disk without noise)
    const ultraFastModePass = ultraFastResult.coloredPixels > 500
    console.log(`Ultra-fast mode renders: ${ultraFastModePass ? 'PASS' : 'FAIL'}`)

    // Take screenshot during movement
    await page.screenshot({ path: 'screenshots/bh-perf-ultrafast.png' })

    // Test 3: Recovery after movement stops
    console.log('\n=== TEST 3: Quality Recovery After Movement ===')
    console.log('Waiting for quality recovery (2s)...')
    await page.waitForTimeout(2000)

    const recoveryResult = await analyzeBlackHoleRendering(page)
    console.log(`Colored pixels after recovery: ${recoveryResult.coloredPixels} (${recoveryResult.coloredPercent}%)`)

    const recoveryPass = recoveryResult.coloredPixels > 1000
    console.log(`Quality recovery: ${recoveryPass ? 'PASS' : 'FAIL'}`)

    await page.screenshot({ path: 'screenshots/bh-perf-recovery.png' })

    // Test 4: Check for GL errors
    console.log('\n=== TEST 4: GL Error Check ===')
    const glErrors = errors.filter((e) => e.includes('GL_INVALID') || e.includes('WebGL'))
    console.log(`GL errors found: ${glErrors.length}`)
    if (glErrors.length > 0) {
      glErrors.slice(0, 5).forEach((e) => console.log(`  - ${e}`))
    }

    const noGLErrors = glErrors.length === 0
    console.log(`No GL errors: ${noGLErrors ? 'PASS' : 'FAIL'}`)

    // Summary
    console.log('\n=== SUMMARY ===')
    const allTests = [
      { name: 'Normal mode renders', pass: normalModePass },
      { name: 'Ultra-fast mode renders', pass: ultraFastModePass },
      { name: 'Quality recovery', pass: recoveryPass },
      { name: 'No GL errors', pass: noGLErrors },
    ]

    allTests.forEach((t) => console.log(`  ${t.pass ? '✓' : '✗'} ${t.name}`))

    const allPassed = allTests.every((t) => t.pass)
    console.log(`\n=== RESULT: ${allPassed ? 'PASS' : 'FAIL'} ===`)

    process.exit(allPassed ? 0 : 1)
  } finally {
    await browser.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

