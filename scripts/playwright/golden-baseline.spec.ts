/**
 * Golden Baseline Screenshot Tests
 *
 * Captures baseline screenshots for all renderer types and effect combinations.
 * These serve as visual regression reference points during the rendering pipeline refactor.
 *
 * Run with:
 *   npx playwright test golden-baseline.spec.ts
 *
 * Update golden screenshots:
 *   npx playwright test golden-baseline.spec.ts --update-snapshots
 *
 * @see /Users/Spare/.claude/plans/happy-swinging-moon.md Phase 0.1
 */

import { test, expect, Page } from '@playwright/test';

// Increased timeout for shader compilation and rendering stabilization
test.setTimeout(60000);

/**
 * Wait for WebGL canvas to render and stabilize.
 * Uses a combination of waiting for the canvas and additional time for GPU work.
 */
async function waitForRenderStable(page: Page, waitMs = 2000): Promise<void> {
  // Wait for canvas element
  await page.waitForSelector('canvas', { state: 'visible' });

  // Wait for any shader compilation overlays to disappear
  const compilingOverlay = page.locator('[data-testid="shader-compiling-overlay"]');
  try {
    await compilingOverlay.waitFor({ state: 'hidden', timeout: 30000 });
  } catch {
    // Overlay may not exist, continue
  }

  // Additional wait for render stabilization
  await page.waitForTimeout(waitMs);
}

/**
 * Select an object type via the UI.
 */
async function selectObjectType(page: Page, objectType: string): Promise<void> {
  const button = page.getByTestId(`object-type-${objectType}`);

  // If button not visible, the left panel might be collapsed
  if (!(await button.isVisible())) {
    // Try to open left panel
    const leftPanelToggle = page.getByTestId('toggle-left-panel');
    if (await leftPanelToggle.isVisible()) {
      await leftPanelToggle.click();
      await page.waitForTimeout(600); // Animation delay
    }
  }

  await button.click();
  await waitForRenderStable(page);
}

/**
 * Set dimension via the dimension selector.
 */
async function setDimension(page: Page, dimension: number): Promise<void> {
  const dimButton = page.getByTestId(`dimension-selector-${dimension}`);
  if (await dimButton.isVisible()) {
    await dimButton.click();
    await waitForRenderStable(page);
  }
}

test.describe('Golden Baseline Screenshots', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForRenderStable(page);
  });

  // ============================================================================
  // Fractal Renderers (Raymarched)
  // ============================================================================

  test('mandelbulb default - fractal baseline', async ({ page }) => {
    await selectObjectType(page, 'mandelbulb');
    await expect(page).toHaveScreenshot('golden-mandelbulb-default.png', {
      maxDiffPixelRatio: 0.01,
    });
  });

  test('quaternion-julia default - julia baseline', async ({ page }) => {
    await selectObjectType(page, 'quaternion-julia');
    await expect(page).toHaveScreenshot('golden-quaternion-julia-default.png', {
      maxDiffPixelRatio: 0.01,
    });
  });

  test('schroedinger default - quantum cloud baseline', async ({ page }) => {
    await selectObjectType(page, 'schroedinger');
    // Extra wait for temporal accumulation to stabilize
    await waitForRenderStable(page, 3000);
    await expect(page).toHaveScreenshot('golden-schroedinger-default.png', {
      maxDiffPixelRatio: 0.02, // Slightly higher tolerance for temporal effects
    });
  });

  test('blackhole default - lensing baseline', async ({ page }) => {
    await selectObjectType(page, 'blackhole');
    await expect(page).toHaveScreenshot('golden-blackhole-default.png', {
      maxDiffPixelRatio: 0.01,
    });
  });

  // ============================================================================
  // Polytope Renderers (Mesh-based)
  // ============================================================================

  test('hypercube 4D - polytope baseline', async ({ page }) => {
    await setDimension(page, 4);
    await selectObjectType(page, 'hypercube');
    await expect(page).toHaveScreenshot('golden-hypercube-4d.png', {
      maxDiffPixelRatio: 0.01,
    });
  });

  test('simplex 4D - simplex baseline', async ({ page }) => {
    await setDimension(page, 4);
    await selectObjectType(page, 'simplex');
    await expect(page).toHaveScreenshot('golden-simplex-4d.png', {
      maxDiffPixelRatio: 0.01,
    });
  });

  // ============================================================================
  // Extended Objects
  // ============================================================================

  test('clifford-torus default - torus baseline', async ({ page }) => {
    await selectObjectType(page, 'clifford-torus');
    await expect(page).toHaveScreenshot('golden-clifford-torus.png', {
      maxDiffPixelRatio: 0.01,
    });
  });

  // ============================================================================
  // Effect Combinations (for specific renderer + effect pairings)
  // ============================================================================

  // Note: These tests verify that specific effects render correctly.
  // Effect toggles would need to be added based on UI test IDs.
  // For now, we capture with default effects enabled.
});
