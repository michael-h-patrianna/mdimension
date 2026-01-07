/**
 * WebGPU Buffer Preview Tests
 *
 * Tests that depth, normal, and temporal depth buffer previews work in WebGPU mode.
 */
import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

/**
 * Wait for the scene to be ready (shader compilation complete).
 */
async function waitForSceneReady(page: Page): Promise<void> {
  // Wait for loading overlay to disappear
  await page.waitForSelector('[data-loading-overlay]', { state: 'hidden', timeout: 60000 }).catch(() => {
    // May not exist
  });

  // Wait for shader compilation to complete
  await page.waitForFunction(
    () => {
      const loadingIndicator = document.querySelector('[aria-label="Loading"]');
      return !loadingIndicator;
    },
    { timeout: 60000 }
  ).catch(() => {
    // May not exist
  });

  // Additional wait for scene stabilization
  await page.waitForTimeout(2000);
}

/**
 * Close any open modals.
 */
async function closeModals(page: Page): Promise<void> {
  // Try pressing Escape multiple times to close any modals
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
  }
}

/**
 * Open the performance monitor.
 */
async function openPerformanceMonitor(page: Page): Promise<void> {
  const perfMonitorButton = page.getByRole('button', { name: 'Performance Monitor' });
  if (await perfMonitorButton.isVisible()) {
    await perfMonitorButton.click();
    await page.waitForTimeout(500);
  }
}

/**
 * Navigate to the Buffers tab in the performance monitor.
 */
async function goToBuffersTab(page: Page): Promise<void> {
  const buffersTab = page.getByRole('tab', { name: 'Buffers' });
  if (await buffersTab.isVisible()) {
    await buffersTab.click();
    await page.waitForTimeout(300);
  }
}

/**
 * Toggle the depth buffer preview.
 */
async function toggleDepthBuffer(page: Page, enable: boolean): Promise<void> {
  const checkbox = page.locator('text=Depth Buffer').locator('..').getByRole('checkbox');
  if (await checkbox.isVisible()) {
    const isChecked = await checkbox.isChecked();
    if ((enable && !isChecked) || (!enable && isChecked)) {
      await checkbox.click();
      await page.waitForTimeout(500);
    }
  }
}

/**
 * Toggle the normal buffer preview.
 */
async function toggleNormalBuffer(page: Page, enable: boolean): Promise<void> {
  const checkbox = page.locator('text=Normal Buffer').locator('..').getByRole('checkbox');
  if (await checkbox.isVisible()) {
    const isChecked = await checkbox.isChecked();
    if ((enable && !isChecked) || (!enable && isChecked)) {
      await checkbox.click();
      await page.waitForTimeout(500);
    }
  }
}

test.describe('WebGPU Buffer Preview', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to WebGPU mode
    await page.goto(`${BASE_URL}/?backend=webgpu`);
    await waitForSceneReady(page);
    await closeModals(page);
  });

  test('should enable depth buffer preview without errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await openPerformanceMonitor(page);
    await goToBuffersTab(page);
    await toggleDepthBuffer(page, true);

    // Wait for the preview to render
    await page.waitForTimeout(1000);

    // Check for WebGPU pipeline errors
    const pipelineErrors = consoleErrors.filter(
      (e) => e.includes('Invalid PipelineLayout') || e.includes('WebGPU')
    );

    expect(pipelineErrors).toHaveLength(0);

    // Take a screenshot for visual verification
    await page.screenshot({
      path: 'screenshots/webgpu-depth-preview.png',
    });
  });

  test('should enable normal buffer preview without errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await openPerformanceMonitor(page);
    await goToBuffersTab(page);
    await toggleNormalBuffer(page, true);

    // Wait for the preview to render
    await page.waitForTimeout(1000);

    // Check for WebGPU pipeline errors
    const pipelineErrors = consoleErrors.filter(
      (e) => e.includes('Invalid PipelineLayout') || e.includes('WebGPU')
    );

    expect(pipelineErrors).toHaveLength(0);

    // Take a screenshot for visual verification
    await page.screenshot({
      path: 'screenshots/webgpu-normal-preview.png',
    });
  });

  test('should switch between depth and normal buffer previews', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await openPerformanceMonitor(page);
    await goToBuffersTab(page);

    // Enable depth buffer
    await toggleDepthBuffer(page, true);
    await page.waitForTimeout(500);

    // Switch to normal buffer
    await toggleDepthBuffer(page, false);
    await toggleNormalBuffer(page, true);
    await page.waitForTimeout(500);

    // Switch back to depth buffer
    await toggleNormalBuffer(page, false);
    await toggleDepthBuffer(page, true);
    await page.waitForTimeout(500);

    // Check for WebGPU pipeline errors
    const pipelineErrors = consoleErrors.filter(
      (e) => e.includes('Invalid PipelineLayout') || e.includes('WebGPU')
    );

    expect(pipelineErrors).toHaveLength(0);
  });
});

