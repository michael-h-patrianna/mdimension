/**
 * Debug test to verify WebGPU polytope rendering
 */
import { test, expect } from '@playwright/test'

test('WebGPU polytope renders visible object', async ({ page }) => {
  // Capture console messages
  const consoleLogs: string[] = []
  page.on('console', (msg) => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`)
  })

  // Navigate to the app
  await page.goto('http://localhost:3000/')
  
  // Wait for the app to load and render
  await page.waitForTimeout(5000)
  
  // Take a screenshot
  await page.screenshot({ 
    path: 'screenshots/debug-webgpu-render.png',
    fullPage: false 
  })
  
  console.log('Screenshot saved to screenshots/debug-webgpu-render.png')
  console.log('Console logs:', consoleLogs.slice(-30).join('\n'))
  
  // Check for any WebGPU errors in console
  const errors = consoleLogs.filter(log => log.includes('error') || log.includes('Error'))
  console.log('Errors found:', errors.join('\n'))
})


