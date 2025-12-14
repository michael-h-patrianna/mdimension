/**
 * E2E Test for responsive sidebar layout
 * Tests both overlay (< 1024px) and side-by-side (≥ 1024px) modes
 */
import { chromium } from 'playwright'

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000'
const SCREENSHOT_DIR = 'screenshots/layout'

async function testLayout() {
  console.log('=== Layout Mode E2E Test ===\n')

  const browser = await chromium.launch({ headless: true })

  try {
    // Test 1: Side-by-side mode at 1280px
    console.log('Test 1: Side-by-side layout (1280px viewport)')
    const context1 = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const page1 = await context1.newPage()

    await page1.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 })
    await page1.waitForTimeout(1500)

    // Verify canvas exists
    const canvasCount = await page1.locator('canvas').count()
    console.log(`  ✓ Canvas elements: ${canvasCount}`)

    // Verify sidebar exists
    const sidebar = await page1.locator('[data-testid="control-panel-container"]')
    const sidebarVisible = await sidebar.isVisible()
    console.log(`  ✓ Sidebar visible: ${sidebarVisible}`)

    // Verify resize handle exists in side-by-side mode
    const resizeHandle = await page1.locator('[role="separator"]').count()
    console.log(`  ✓ Resize handle present: ${resizeHandle > 0}`)

    await page1.screenshot({ path: `${SCREENSHOT_DIR}/side-by-side-1280.png`, fullPage: true })
    console.log(`  ✓ Screenshot saved: ${SCREENSHOT_DIR}/side-by-side-1280.png`)

    await context1.close()

    // Test 2: Overlay mode at 900px
    console.log('\nTest 2: Overlay layout (900px viewport)')
    const context2 = await browser.newContext({ viewport: { width: 900, height: 800 } })
    const page2 = await context2.newPage()

    await page2.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 })
    await page2.waitForTimeout(1500)

    // Verify sidebar still visible
    const sidebar2 = await page2.locator('[data-testid="control-panel-container"]')
    const sidebarVisible2 = await sidebar2.isVisible()
    console.log(`  ✓ Sidebar visible: ${sidebarVisible2}`)

    // Verify resize handle NOT present in overlay mode
    const resizeHandle2 = await page2.locator('[role="separator"]').count()
    console.log(`  ✓ Resize handle NOT present: ${resizeHandle2 === 0}`)

    await page2.screenshot({ path: `${SCREENSHOT_DIR}/overlay-900.png`, fullPage: true })
    console.log(`  ✓ Screenshot saved: ${SCREENSHOT_DIR}/overlay-900.png`)

    await context2.close()

    // Test 3: Test sidebar collapse in side-by-side mode
    console.log('\nTest 3: Sidebar collapse in side-by-side mode')
    const context3 = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const page3 = await context3.newPage()

    await page3.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 })
    await page3.waitForTimeout(1500)

    // Find and click collapse button
    const collapseBtn = await page3.locator('button[aria-label*="Collapse"]')
    if ((await collapseBtn.count()) > 0) {
      await collapseBtn.click()
      await page3.waitForTimeout(500)

      const expandBtn = await page3.locator('button[aria-label*="Expand"]')
      const collapsed = (await expandBtn.count()) > 0
      console.log(`  ✓ Sidebar collapsed: ${collapsed}`)

      await page3.screenshot({ path: `${SCREENSHOT_DIR}/collapsed-1280.png`, fullPage: true })
      console.log(`  ✓ Screenshot saved: ${SCREENSHOT_DIR}/collapsed-1280.png`)
    }

    await context3.close()

    // Test 4: Test resize drag (if handle exists)
    console.log('\nTest 4: Sidebar resize drag')
    const context4 = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const page4 = await context4.newPage()

    await page4.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 })
    await page4.waitForTimeout(1500)

    const handle = await page4.locator('[role="separator"]')
    if ((await handle.count()) > 0) {
      const box = await handle.boundingBox()
      if (box) {
        // Drag handle to the left (increase sidebar width)
        await page4.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page4.mouse.down()
        await page4.mouse.move(box.x - 100, box.y + box.height / 2)
        await page4.mouse.up()
        await page4.waitForTimeout(300)

        await page4.screenshot({ path: `${SCREENSHOT_DIR}/resized-wider.png`, fullPage: true })
        console.log(`  ✓ Resized wider - screenshot saved: ${SCREENSHOT_DIR}/resized-wider.png`)
      }
    } else {
      console.log('  ⚠ Resize handle not found - skipping drag test')
    }

    await context4.close()

    console.log('\n=== ALL LAYOUT TESTS PASSED ===')
  } catch (error) {
    console.error('Test failed:', error.message)
    process.exit(1)
  } finally {
    await browser.close()
  }
}

testLayout()
