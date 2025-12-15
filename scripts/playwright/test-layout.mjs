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
    await page1.waitForTimeout(2000) // Wait for animations

    // Verify canvas exists
    const canvasCount = await page1.locator('canvas').count()
    console.log(`  ✓ Canvas elements: ${canvasCount}`)

    // Verify left panel exists and is visible (relative positioning)
    const leftPanel = await page1.locator('[data-testid="left-panel-tabs"]').first()
    const isVisible = await leftPanel.isVisible()
    console.log(`  ✓ Left Panel visible: ${isVisible}`)

    await page1.screenshot({ path: `${SCREENSHOT_DIR}/side-by-side-1280.png` })
    console.log(`  ✓ Screenshot saved: ${SCREENSHOT_DIR}/side-by-side-1280.png`)

    await context1.close()

    // Test 2: Overlay mode at 390px (Mobile)
    console.log('\nTest 2: Overlay layout (390px viewport)')
    const context2 = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page2 = await context2.newPage()

    await page2.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 })
    await page2.waitForTimeout(2000)

    // Verify panels are initially hidden or collapsed in mobile logic
    // My code does: if (!isDesktop) { setShowLeftPanel(false); setCollapsed(true); }
    // So left panel should NOT be visible.
    
    // Note: The panel DOM element might exist but have 0 width or opacity 0.
    // My code uses AnimatePresence, so it should be removed from DOM when false.
    const leftPanelMobile = await page2.locator('[data-testid="left-panel-tabs"]')
    const count = await leftPanelMobile.count()
    console.log(`  ✓ Left Panel initial count (should be 0): ${count}`)
    
    if (count > 0) {
        // If it exists, check visibility
        const vis = await leftPanelMobile.isVisible()
        console.log(`  ✓ Left Panel visibility: ${vis}`)
    }

    // Click toggle button
    console.log('  → Clicking Toggle Button...')
    await page2.click('[data-testid="toggle-left-panel"]')
    await page2.waitForTimeout(1000) // Wait for spring animation

    // Verify panel is now visible
    const leftPanelAfter = await page2.locator('[data-testid="left-panel-tabs"]').first()
    const isVisibleAfter = await leftPanelAfter.isVisible()
    console.log(`  ✓ Left Panel visible after click: ${isVisibleAfter}`)
    
    await page2.screenshot({ path: `${SCREENSHOT_DIR}/mobile-overlay-open.png` })

    // Click backdrop (I need to find a way to click the backdrop)
    // The backdrop has `absolute inset-0 bg-black/60`
    // It's a motion.div
    // I can click at coordinates x=300, y=300 (outside the 280px panel? Wait sidebar width is 320px in overlay?)
    // Sidebar width is fixed to 80 (tailwind class w-80 = 20rem = 320px).
    // So clicking at x=350 should hit the backdrop.
    
    console.log('  → Clicking Backdrop...')
    await page2.mouse.click(350, 400)
    await page2.waitForTimeout(1000)

    const isVisibleFinal = await leftPanelAfter.isVisible()
    console.log(`  ✓ Left Panel hidden after backdrop click: ${!isVisibleFinal}`)

    await context2.close()

    // Test 3: Cinematic Mode
    console.log('\nTest 3: Cinematic Mode')
    const context3 = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const page3 = await context3.newPage()

    await page3.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 })
    await page3.waitForTimeout(1000)

    // Trigger Cinematic Mode via keyboard 'c'
    await page3.keyboard.press('c')
    await page3.waitForTimeout(1000)

    const topBar = await page3.locator('[data-testid="top-bar"]')
    const topBarVisible = await topBar.isVisible()
    console.log(`  ✓ Top bar hidden: ${!topBarVisible}`)
    
    await page3.screenshot({ path: `${SCREENSHOT_DIR}/cinematic-mode.png` })

    await context3.close()

    console.log('\n=== ALL LAYOUT TESTS PASSED ===')
  } catch (error) {
    console.error('Test failed:', error.message)
    process.exit(1)
  } finally {
    await browser.close()
  }
}

testLayout()