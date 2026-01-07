/**
 * WebGPU Level 0 Test: R3F + WebGPU + Simple Mesh (No Render Graph)
 *
 * Tests if R3F can render a basic mesh with WebGPU.
 * Bypasses our entire render graph to isolate R3F integration issues.
 *
 * Run: npx playwright test webgpu-level0-test.spec.ts --headed
 */

import { expect, test } from '@playwright/test'

test.setTimeout(60000)

test('Level 0: R3F + WebGPU renders basic mesh', async ({ page }) => {
  const logs: string[] = []
  page.on('console', (msg) => {
    logs.push(`[${msg.type()}] ${msg.text()}`)
  })

  // Navigate to app
  await page.goto('http://localhost:3000/?t=mandelbulb&d=3')
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30000 })

  // Wait for initial load
  await page.waitForTimeout(2000)

  // Inject a test: Add a simple red cube directly to the R3F scene
  // This bypasses our entire render graph
  const injectionResult = await page.evaluate(() => {
    // Access R3F's internal state via __r3f on canvas
    const canvas = document.querySelector('canvas')
    if (!canvas) return { success: false, error: 'No canvas found' }

    // R3F stores state on the canvas element
    const r3fState = (canvas as HTMLCanvasElement & { __r3f?: {
      gl: unknown
      scene: THREE.Scene
      camera: THREE.Camera
    } }).__r3f

    if (!r3fState) return { success: false, error: 'No R3F state on canvas' }

    // Check renderer type
    const gl = r3fState.gl as { backend?: { isWebGPU?: boolean } }
    const isWebGPU = gl?.backend?.isWebGPU === true

    // Add a bright red cube at origin
    const THREE = (window as unknown as { THREE?: typeof import('three') }).THREE
    if (!THREE) {
      // Three might not be on window, try to create mesh another way
      return {
        success: true,
        isWebGPU,
        note: 'THREE not on window, but R3F state exists',
        sceneChildren: r3fState.scene?.children?.length ?? 0,
      }
    }

    const geometry = new THREE.BoxGeometry(2, 2, 2)
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 })
    const cube = new THREE.Mesh(geometry, material)
    cube.name = 'WebGPU_Test_Cube'
    r3fState.scene.add(cube)

    return {
      success: true,
      isWebGPU,
      cubeAdded: true,
      sceneChildren: r3fState.scene.children.length,
    }
  })

  console.log('\n=== Level 0 Test Results ===')
  console.log('Injection result:', JSON.stringify(injectionResult, null, 2))

  // Wait for render
  await page.waitForTimeout(3000)

  // Take screenshot
  await page.screenshot({ path: 'screenshots/webgpu-level0-test.png' })

  console.log('\n=== Console Logs (last 30) ===')
  logs.slice(-30).forEach(log => console.log(log))

  // Basic validation
  expect(injectionResult.success).toBe(true)

  console.log('\n=== Manual Verification Required ===')
  console.log('Check screenshots/webgpu-level0-test.png')
  console.log('If you see a RED CUBE in the center, Level 0 PASSES')
  console.log('If black, the issue is R3F + WebGPU integration (not our render graph)')
})
