
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Define the scenarios we want to test
const SCENARIOS = [
  { name: 'BlackHole', type: 'blackhole', dimension: 3 },
  { name: 'Mandelbulb', type: 'mandelbulb', dimension: 3 },
  { name: 'Julia', type: 'quaternion-julia', dimension: 4 },
  { name: 'Hypercube', type: 'hypercube', dimension: 4 },
  { name: 'Simplex', type: 'simplex', dimension: 4 },
  { name: 'Schroedinger', type: 'schroedinger', dimension: 3 }
];

test('Rendering Performance Profiling', async ({ page, browser }) => {
  // Increase timeout for long profiling
  test.setTimeout(180000);

  console.log('Starting Performance Profiling...');

  await page.goto('/');
  
  // Wait for initial load
  await page.waitForTimeout(5000);
  
  const results: any[] = [];

  for (const scenario of SCENARIOS) {
    console.log(`Profiling scenario: ${scenario.name}`);

    // Switch scene using the exposed store
    await page.evaluate((s) => {
      // @ts-ignore
      const geoStore = window.__GEOMETRY_STORE__.getState();
      geoStore.setDimension(s.dimension);
      geoStore.setObjectType(s.type);
    }, scenario);

    // Wait for stability (shaders compilation, progressive refinement)
    // 5 seconds should be enough for "settling"
    await page.waitForTimeout(5000);

    // Collect metrics for 5 seconds
    const metricsLog: any[] = [];
    const startTime = Date.now();
    
    // Poll metrics every 500ms
    while (Date.now() - startTime < 5000) {
      const metric = await page.evaluate(() => {
        // @ts-ignore
        const store = window.__PERF_STORE__;
        if (!store) return null;
        const state = store.getState();
        return {
          fps: state.fps,
          frameTime: state.frameTime,
          cpuTime: state.cpuTime,
          gpu: state.gpu,
          memory: state.memory,
          vram: state.vram,
          timestamp: Date.now()
        };
      });
      
      if (metric) metricsLog.push(metric);
      await page.waitForTimeout(500);
    }

    // Calculate averages
    if (metricsLog.length > 0) {
        const avgFps = metricsLog.reduce((sum, m) => sum + m.fps, 0) / metricsLog.length;
        const avgCpu = metricsLog.reduce((sum, m) => sum + m.cpuTime, 0) / metricsLog.length;
        const avgGpuCalls = metricsLog.reduce((sum, m) => sum + m.gpu.calls, 0) / metricsLog.length;
        const avgTriangles = metricsLog.reduce((sum, m) => sum + m.gpu.triangles, 0) / metricsLog.length;
        const lastVram = metricsLog[metricsLog.length - 1].vram;

        results.push({
            scenario: scenario.name,
            avgFps,
            avgCpuTimeMs: avgCpu,
            avgDrawCalls: avgGpuCalls,
            avgTriangles,
            vramGeom: lastVram.geometries,
            vramTex: lastVram.textures,
            samples: metricsLog.length
        });
    }
  }

  // Save results
  const reportPath = path.join(process.cwd(), 'docs', 'performance-data.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`Performance data saved to ${reportPath}`);

  // Assert that we have results
  expect(results.length).toBe(SCENARIOS.length);
});
