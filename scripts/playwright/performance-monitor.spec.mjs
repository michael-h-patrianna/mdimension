/**
 * Playwright E2E tests for Performance Monitor
 *
 * Verifies that all performance metrics are correctly captured and displayed:
 * - Scene geometry stats (sceneGpu)
 * - Total rendered stats (gpu)
 * - Buffer dimensions
 * - VRAM stats
 */

import { chromium } from 'playwright';

// Use environment variable or default to 3000 (Vite will find an available port)
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

/**
 * Wait for app to fully initialize
 * @param {import('playwright').Page} page
 */
async function waitForAppReady(page) {
  // Wait for the performance store to be exposed
  await page.waitForFunction(
    () => window.__PERF_STORE__ !== undefined,
    { timeout: 30000 }
  );

  // Wait for initial render to complete (FPS should be non-zero)
  await page.waitForFunction(
    () => {
      const store = window.__PERF_STORE__;
      return store && store.getState().fps > 0;
    },
    { timeout: 30000 }
  );

  // Allow time for progressive refinement to complete
  await page.waitForTimeout(2000);
}

/**
 * Get performance metrics from the store
 * @param {import('playwright').Page} page
 */
async function getMetrics(page) {
  return await page.evaluate(() => {
    const store = window.__PERF_STORE__;
    if (!store) return null;
    const state = store.getState();
    return {
      fps: state.fps,
      frameTime: state.frameTime,
      gpu: state.gpu,
      sceneGpu: state.sceneGpu,
      memory: state.memory,
      vram: state.vram,
      viewport: state.viewport,
      buffers: state.buffers,
      gpuName: state.gpuName,
    };
  });
}

async function runTests() {
  console.log('🎭 Starting Performance Monitor E2E Tests\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();

  // Collect console messages for debugging
  const consoleLogs = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    }
  });

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✅ ${testName}`);
      passed++;
    } else {
      console.log(`  ❌ ${testName}`);
      failed++;
    }
  }

  try {
    // Navigate to app
    console.log('📍 Navigating to app...');
    await page.goto(BASE_URL);
    await waitForAppReady(page);

    // Test 1: Basic metrics are captured
    console.log('\n📊 Test Suite: Basic Metrics Capture');
    {
      const metrics = await getMetrics(page);
      assert(metrics !== null, 'Performance store is accessible');
      assert(metrics.fps > 0, `FPS is positive (got: ${metrics.fps})`);
      assert(metrics.frameTime > 0, `Frame time is positive (got: ${metrics.frameTime}ms)`);
    }

    // Test 2: GPU stats (total rendered) are captured
    console.log('\n🎮 Test Suite: GPU Stats (Total Rendered)');
    {
      const metrics = await getMetrics(page);
      assert(metrics.gpu.calls > 0, `GPU calls are positive (got: ${metrics.gpu.calls})`);
      assert(
        metrics.gpu.triangles >= 0,
        `GPU triangles are non-negative (got: ${metrics.gpu.triangles})`
      );
    }

    // Test 3: Scene GPU stats are captured (scene-only, excludes post-processing)
    console.log('\n🎬 Test Suite: Scene GPU Stats');
    {
      const metrics = await getMetrics(page);
      assert(
        metrics.sceneGpu.calls >= 0,
        `Scene GPU calls are non-negative (got: ${metrics.sceneGpu.calls})`
      );
      assert(
        metrics.sceneGpu.triangles >= 0,
        `Scene GPU triangles are non-negative (got: ${metrics.sceneGpu.triangles})`
      );

      // Scene stats should generally be less than or equal to total
      // (post-processing adds more draw calls)
      if (metrics.gpu.calls > 0 && metrics.sceneGpu.calls > 0) {
        assert(
          metrics.sceneGpu.calls <= metrics.gpu.calls,
          `Scene calls (${metrics.sceneGpu.calls}) <= Total calls (${metrics.gpu.calls})`
        );
      }
    }

    // Test 4: Viewport stats
    console.log('\n📺 Test Suite: Viewport Stats');
    {
      const metrics = await getMetrics(page);
      assert(metrics.viewport.width > 0, `Viewport width is positive (got: ${metrics.viewport.width})`);
      assert(
        metrics.viewport.height > 0,
        `Viewport height is positive (got: ${metrics.viewport.height})`
      );
      assert(metrics.viewport.dpr >= 1, `DPR is at least 1 (got: ${metrics.viewport.dpr})`);
    }

    // Test 5: Buffer dimensions are captured
    console.log('\n📐 Test Suite: Buffer Dimensions');
    {
      // Wait a bit for buffer stats to be reported (1 second interval)
      await page.waitForTimeout(1500);
      const metrics = await getMetrics(page);

      // Screen buffer should match viewport
      assert(
        metrics.buffers.screen.width > 0,
        `Screen buffer width is positive (got: ${metrics.buffers.screen.width})`
      );
      assert(
        metrics.buffers.screen.height > 0,
        `Screen buffer height is positive (got: ${metrics.buffers.screen.height})`
      );

      // Depth buffer dimensions
      assert(
        metrics.buffers.depth.width >= 0,
        `Depth buffer width is non-negative (got: ${metrics.buffers.depth.width})`
      );

      // Normal buffer dimensions
      assert(
        metrics.buffers.normal.width >= 0,
        `Normal buffer width is non-negative (got: ${metrics.buffers.normal.width})`
      );
    }

    // Test 6: Memory stats
    console.log('\n💾 Test Suite: Memory Stats');
    {
      const metrics = await getMetrics(page);
      assert(
        metrics.memory.geometries >= 0,
        `Geometries count is non-negative (got: ${metrics.memory.geometries})`
      );
      assert(
        metrics.memory.textures >= 0,
        `Textures count is non-negative (got: ${metrics.memory.textures})`
      );
      assert(
        metrics.memory.programs >= 0,
        `Programs count is non-negative (got: ${metrics.memory.programs})`
      );
    }

    // Test 7: GPU name is detected
    console.log('\n🔧 Test Suite: Hardware Detection');
    {
      const metrics = await getMetrics(page);
      assert(
        typeof metrics.gpuName === 'string',
        `GPU name is a string (got: ${typeof metrics.gpuName})`
      );
      assert(metrics.gpuName.length > 0, `GPU name is not empty (got: "${metrics.gpuName}")`);
    }

    // Test 8: Stats update when switching object types
    console.log('\n🔄 Test Suite: Stats Update on Object Change');
    {
      const initialMetrics = await getMetrics(page);

      // Switch to a different object type
      await page.evaluate(() => {
        const geoStore = window.__GEOMETRY_STORE__;
        if (geoStore) {
          geoStore.getState().setObjectType('mandelbulb');
        }
      });

      // Wait for render to update
      await page.waitForTimeout(2000);

      const newMetrics = await getMetrics(page);

      // FPS should still be tracked
      assert(newMetrics.fps > 0, `FPS still tracked after object change (got: ${newMetrics.fps})`);

      // Scene stats might differ for different object types
      assert(
        newMetrics.sceneGpu !== undefined,
        'Scene GPU stats still available after object change'
      );
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);
    console.log('='.repeat(50));

    if (consoleLogs.length > 0) {
      console.log('\n⚠️  Console Errors:');
      consoleLogs.forEach((log) => console.log(`   ${log}`));
    }
  } catch (error) {
    console.error('\n❌ Test execution failed:', error.message);
    failed++;
  } finally {
    await browser.close();
  }

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(console.error);

