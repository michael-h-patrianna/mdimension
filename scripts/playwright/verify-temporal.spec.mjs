import { test, expect } from 'playwright/test';

test('verify schroedinger temporal depth buffer', async ({ page }) => {
  // 1. Navigate to app
  console.log('Navigating...');
  await page.goto('http://localhost:3000');
  
  // 2. Wait for initial load
  console.log('Waiting for load...');
  await page.waitForTimeout(3000);

  // 3. Open Performance Monitor
  console.log('Opening Performance Monitor...');
  const perfBtn = page.locator('[data-testid="control-performance-monitor"]');
  await perfBtn.click();
  await page.waitForTimeout(500);

  // 4. Switch to Buffers tab
  console.log('Switching to Buffers tab...');
  // Tabs are often implemented as buttons. Let's find by text if possible or role.
  await page.getByRole('button', { name: 'Buffers' }).click();
  await page.waitForTimeout(500);

  // 5. Enable Temporal Depth preview
  console.log('Enabling Temporal Depth preview...');
  await page.getByRole('button', { name: 'Temporal' }).click();
  await page.waitForTimeout(2000); // Give it frames to populate

  // 6. Analyze Canvas
  console.log('Analyzing Canvas...');
  const result = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { error: 'No canvas found' };
    
    const gl = canvas.getContext('webgl2');
    if (!gl) return { error: 'No WebGL2 context' };
    
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    
    let nonBlackCount = 0;
    let maxVal = 0;
    
    // Stride 4 (RGBA)
    for (let i = 0; i < pixels.length; i += 4) {
      // Check R, G, or B > 10 (allow some noise/darkness)
      if (pixels[i] > 10 || pixels[i+1] > 10 || pixels[i+2] > 10) {
        nonBlackCount++;
        maxVal = Math.max(maxVal, pixels[i]);
      }
    }
    
    return { 
      width, 
      height, 
      nonBlackCount, 
      maxVal,
      ratio: nonBlackCount / (width * height)
    };
  });

  console.log('Buffer Analysis Result:', JSON.stringify(result, null, 2));

  // Success Criteria: At least 2 pixels are non-black
  expect(result.error).toBeUndefined();
  expect(result.nonBlackCount).toBeGreaterThan(2);
});
