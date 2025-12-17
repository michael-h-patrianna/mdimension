import { test, expect } from '@playwright/test';

test.describe('UI Comprehensive E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for canvas to be ready (canvas element exists)
    await page.waitForSelector('canvas');
  });

  test('should load application and display key components', async ({ page }) => {
    await expect(page).toHaveTitle(/MDIMENSION/i);
    await expect(page.getByTestId('top-bar')).toBeVisible();
    await expect(page.getByTestId('left-panel-tabs')).toBeVisible();
    await expect(page.getByTestId('view-control-show-sidebar')).toBeVisible(); // Or "hide-sidebar"
  });

  test('should toggle sidebars', async ({ page }) => {
    // Left Panel
    const leftPanelButton = page.getByTestId('toggle-left-panel');
    await expect(leftPanelButton).toBeVisible();
    
    // Initially visible (check width or visibility of content)
    await expect(page.getByTestId('left-panel-tabs')).toBeVisible();
    
    // Toggle Off
    await leftPanelButton.click();
    // Animation delay
    await page.waitForTimeout(600); 
    // Content should be hidden or width 0. 
    // Note: The implementation sets width 0 and opacity 0.
    // Playwright's toBeVisible() checks for opacity > 0, display!=none, visibility!=hidden.
    await expect(page.getByTestId('left-panel-tabs')).not.toBeVisible();

    // Toggle On
    await leftPanelButton.click();
    await page.waitForTimeout(600);
    await expect(page.getByTestId('left-panel-tabs')).toBeVisible();
  });

  test('should switch dimensions', async ({ page }) => {
    const dimSelector = page.getByTestId('dimension-selector');
    await expect(dimSelector).toBeVisible();

    // Switch to 3D
    await page.getByTestId('dimension-selector-3').click();
    // Verify it's selected (aria-checked)
    await expect(page.getByTestId('dimension-selector-3')).toHaveAttribute('aria-checked', 'true');
    
    // Switch to 4D
    await page.getByTestId('dimension-selector-4').click();
    await expect(page.getByTestId('dimension-selector-4')).toHaveAttribute('aria-checked', 'true');
  });

  test('should open faces section and interact with controls', async ({ page }) => {
    // Open Geometry Tab first (if needed, but Faces is likely in Right Panel or separate)
    // Actually FacesSection is likely in Right Panel (EditorRightPanel).
    // Let's ensure Right Panel is open.
    const rightPanelToggle = page.getByTestId('toggle-right-panel');
    // If we assume it starts open.
    
    // Look for Faces Section
    const facesSection = page.getByTestId('section-faces');
    // It might be inside an accordion/details.
    // If it's a <Section>, it has a button to toggle.
    await expect(facesSection).toBeVisible();
    
    // Check Tabs inside Faces Section
    await expect(page.getByTestId('faces-tabs')).toBeVisible();
    
    // Check Slider Interaction (Face Opacity)
    // Note: Face Opacity slider is only visible if NOT raymarching. 
    // Default object is Hypercube (Polytope), so it should be visible.
    const opacitySlider = page.getByTestId('slider-face-opacity-slider');
    if (await opacitySlider.isVisible()) {
        // Change value
        await opacitySlider.fill('0.5'); // If it was an input, but this is a slider with hidden input
        // Using force click on the track or manipulating the input
        // My Slider component has a number input next to it! data-testid="{id}-input"
        const opacityInput = page.getByTestId('slider-face-opacity-input');
        await expect(opacityInput).toBeVisible();
        await opacityInput.fill('0.5');
        await opacityInput.press('Enter');
        await expect(opacityInput).toHaveValue('0.5');
    }
  });

  test('should toggle performance monitor', async ({ page }) => {
    const perfButton = page.getByTestId('view-control-performance-monitor');
    await perfButton.click();
    
    // Expect .perf-monitor to appear
    await expect(page.locator('.perf-monitor')).toBeVisible();
    
    // Toggle off
    await perfButton.click();
    await expect(page.locator('.perf-monitor')).not.toBeVisible();
  });

  test('should open shortcuts overlay', async ({ page }) => {
    const shortcutsButton = page.getByTestId('view-control-keyboard-shortcuts');
    await shortcutsButton.click();
    
    await expect(page.getByTestId('shortcuts-overlay')).toBeVisible();
    
    // Close
    await page.getByTestId('shortcuts-close').click();
    await expect(page.getByTestId('shortcuts-overlay')).not.toBeVisible();
  });

  test('should change themes', async ({ page }) => {
    // Open View Menu
    await page.getByTestId('menu-view').click();
    
    // Click a theme (e.g., Green)
    const themeButton = page.getByTestId('theme-green');
    await expect(themeButton).toBeVisible();
    await themeButton.click();
    
    // Reopen menu to verify checkmark
    await page.getByTestId('menu-view').click();
    await expect(page.getByTestId('theme-green')).toContainText('✓ Green');
  });
});
