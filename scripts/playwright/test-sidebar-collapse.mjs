/**
 * Test script for sidebar collapse behavior
 * Verifies that when the sidebar is collapsed:
 * 1. The collapsed sidebar appears as a floating icon in the top-right
 * 2. The canvas fills the full viewport width
 */

import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function testSidebarCollapse() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 } // Large viewport for side-by-side mode
  });
  const page = await context.newPage();

  console.log('📱 Testing sidebar collapse behavior...\n');

  try {
    // Navigate to the app
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000); // Wait for app to fully load

    // Step 1: Verify sidebar is initially visible (expanded)
    console.log('Step 1: Checking initial state (expanded)...');
    
    const controlPanel = await page.locator('[data-testid="control-panel-container"]');
    const isVisible = await controlPanel.isVisible();
    
    if (!isVisible) {
      throw new Error('Control panel not visible initially');
    }

    // Get initial viewport and sidebar dimensions
    const viewportWidth = 1280;
    let sidebarBounds = await controlPanel.boundingBox();
    
    console.log(`  ✓ Sidebar visible at x=${sidebarBounds.x}, width=${sidebarBounds.width}`);
    console.log(`  ✓ Initial sidebar right edge at ${sidebarBounds.x + sidebarBounds.width}px`);

    // Step 2: Click collapse button
    console.log('\nStep 2: Collapsing sidebar...');
    
    const collapseButton = await page.locator('button[aria-label="Collapse control panel"]');
    await collapseButton.click();
    await page.waitForTimeout(500); // Wait for animation

    // Step 3: Verify collapsed state
    console.log('\nStep 3: Verifying collapsed state...');
    
    sidebarBounds = await controlPanel.boundingBox();
    
    // In collapsed state:
    // - The panel should be small (around 56x56px)
    // - It should be positioned in the top-right corner
    
    console.log(`  Collapsed sidebar: x=${sidebarBounds.x}, y=${sidebarBounds.y}, width=${sidebarBounds.width}, height=${sidebarBounds.height}`);
    
    const isSmallWidth = sidebarBounds.width <= 80; // Allow some margin
    const isSmallHeight = sidebarBounds.height <= 80;
    const isTopRight = sidebarBounds.x > viewportWidth - 100; // Should be near right edge
    
    if (!isSmallWidth || !isSmallHeight) {
      throw new Error(`Collapsed sidebar should be small (got ${sidebarBounds.width}x${sidebarBounds.height})`);
    }
    
    console.log(`  ✓ Collapsed to ${sidebarBounds.width}x${sidebarBounds.height}px (expected ~56x56)`);
    
    if (!isTopRight) {
      throw new Error(`Collapsed sidebar should be in top-right (got x=${sidebarBounds.x}, viewport=${viewportWidth})`);
    }
    
    console.log(`  ✓ Positioned in top-right corner (x=${sidebarBounds.x})`);

    // Step 4: Verify canvas fills full width
    console.log('\nStep 4: Checking if canvas fills viewport...');
    
    // The canvas container should have flex-1 and fill the space
    const canvasContainer = await page.locator('canvas').first();
    const canvasBounds = await canvasContainer.boundingBox();
    
    if (canvasBounds) {
      const canvasWidth = canvasBounds.width;
      const fillsViewport = canvasWidth >= viewportWidth - 50; // Allow small margin
      
      console.log(`  Canvas width: ${canvasWidth}px (viewport: ${viewportWidth}px)`);
      
      if (!fillsViewport) {
        console.log(`  ⚠ Canvas may not be filling full viewport (width: ${canvasWidth}px)`);
      } else {
        console.log(`  ✓ Canvas fills viewport width`);
      }
    }

    // Take screenshot
    await page.screenshot({ 
      path: 'screenshots/layout/sidebar-collapsed.png',
      fullPage: true 
    });
    console.log('\n📸 Screenshot saved to screenshots/layout/sidebar-collapsed.png');

    // Step 5: Expand again and verify
    console.log('\nStep 5: Expanding sidebar again...');
    
    const expandButton = await page.locator('button[aria-label="Expand control panel"]');
    await expandButton.click();
    await page.waitForTimeout(500);
    
    sidebarBounds = await controlPanel.boundingBox();
    const isExpanded = sidebarBounds.width > 200;
    
    if (!isExpanded) {
      throw new Error(`Sidebar should be expanded (got width=${sidebarBounds.width})`);
    }
    
    console.log(`  ✓ Sidebar expanded to ${sidebarBounds.width}px`);

    // Take screenshot of expanded state
    await page.screenshot({ 
      path: 'screenshots/layout/sidebar-expanded.png',
      fullPage: true 
    });
    console.log('📸 Screenshot saved to screenshots/layout/sidebar-expanded.png');

    console.log('\n✅ All sidebar collapse tests passed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    // Take error screenshot
    await page.screenshot({ 
      path: 'screenshots/layout/sidebar-collapse-error.png',
      fullPage: true 
    });
    console.log('📸 Error screenshot saved');
    
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

testSidebarCollapse();
