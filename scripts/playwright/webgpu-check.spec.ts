/**
 * WebGPU Support Check
 */
import { test, expect } from '@playwright/test'

test('Check WebGPU support', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const info: Record<string, unknown> = {}

    // Check if navigator.gpu exists
    info.hasNavigatorGpu = 'gpu' in navigator

    if ('gpu' in navigator) {
      try {
        const adapter = await (navigator as any).gpu.requestAdapter()
        info.hasAdapter = !!adapter

        if (adapter) {
          info.adapterName = adapter.name ?? 'unknown'
          info.adapterVendor = adapter.vendor ?? 'unknown'
          info.adapterArchitecture = adapter.architecture ?? 'unknown'
          info.adapterFeatures = Array.from(adapter.features)

          const device = await adapter.requestDevice()
          info.hasDevice = !!device
          info.deviceLabel = device.label ?? 'no label'
        }
      } catch (e) {
        info.adapterError = (e as Error).message
      }
    }

    return info
  })

  console.log('WebGPU support check:')
  console.log(JSON.stringify(result, null, 2))

  // Just log, don't fail
  expect(result.hasNavigatorGpu).toBeDefined()
})
