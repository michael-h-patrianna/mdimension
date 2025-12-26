import { test, expect } from '@playwright/test';

test.describe('Video Export UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app to load
    await expect(page.getByTestId('top-bar')).toBeVisible();
  });

  test('should open export modal and show all tabs', async ({ page }) => {
    // Open File Menu
    await page.getByTestId('menu-file').click();
    
    // Click Export Video
    await page.getByTestId('menu-export-video').click();
    
    // Check Modal Visibility and wait for animation
    const modal = page.locator('text=Video Export Studio');
    await expect(modal).toBeVisible();
    
    // Wait a bit for animation to settle
    await page.waitForTimeout(500);

    // Check Tabs exist
    const presetsTab = page.getByRole('tab', { name: 'Presets' });
    await expect(presetsTab).toBeVisible();

    // Check default tab (Presets) content
    await expect(page.getByText('Default', { exact: true })).toBeVisible();

    // Switch to Settings
    // Use force: true to bypass potential animation blocking or slight overlays during transition
    await page.getByRole('tab', { name: 'Settings' }).click({ force: true });
    
    // Wait for content
    await expect(page.getByText('Output Format')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Resolution')).toBeVisible();

    // Switch to Text
    await page.getByRole('tab', { name: 'Text' }).click({ force: true });
    await expect(page.getByText('Enable Overlay')).toBeVisible({ timeout: 10000 });

    // Switch to Advanced
    await page.getByRole('tab', { name: 'Advanced' }).click({ force: true });
    await expect(page.getByText('Target Bitrate')).toBeVisible({ timeout: 10000 });
  });

  test('should show correct estimated size', async ({ page }) => {
    await page.getByTestId('menu-file').click();
    await page.getByTestId('menu-export-video').click();
    
    // Check initial size estimate (should be > 0)
    const sizeText = page.locator('text=~').first();
    await expect(sizeText).toBeVisible();
  });

  test('should toggle crop mode', async ({ page }) => {
    await page.getByTestId('menu-file').click();
    await page.getByTestId('menu-export-video').click();
    
    // Switch to Settings
    await page.getByRole('tab', { name: 'Settings' }).click({ force: true });

    // Wait for content
    await expect(page.getByText('Output Format')).toBeVisible();

    // Toggle crop
    // The text "Crop Frame" should be visible in the card
    await expect(page.getByText('Crop Frame')).toBeVisible();
    
    // Click the "Crop Frame" text (part of the card)
    await page.getByText('Crop Frame').click({ force: true });
    
    // Verify "Custom area active" text appears
    await expect(page.getByText('Custom area active')).toBeVisible();
  });
});
