import { chromium } from 'playwright';

async function captureGLErrors() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const errors = [];
  const warnings = [];
  const logs = [];

  // Capture console messages
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('GL_INVALID_OPERATION') || text.includes('GL ERROR')) {
      errors.push({ type: msg.type(), text });
    }
    if (text.includes('GL_') || text.includes('WebGL')) {
      warnings.push({ type: msg.type(), text });
    }
    // Capture our debug logs
    if (text.includes('[PostProcessingV2]') || text.includes('[MainObjectMRTPass]') || text.includes('Materials on layer') || text.includes('[RenderGraph]') || text.includes('[ProceduralSkyboxCapture]') || text.includes('[FpsController]') || text.includes('[ScenePass]') || text.includes('GL error') || text.includes('BEFORE graph')) {
      logs.push(text);
    }
  });

  // Capture page errors
  page.on('pageerror', (error) => {
    errors.push({ type: 'pageerror', text: error.message });
  });

  console.log('Navigating to http://localhost:3000/?t=hypercube');
  // Use cache-busting to ensure fresh load
  await page.goto('http://localhost:3000/?t=hypercube&_cb=' + Date.now(), {
    waitUntil: 'networkidle'
  });

  console.log('Waiting 5 seconds for rendering...');

  // Track error timing
  const errorTimes = [];
  const startTime = Date.now();
  const errorListener = (msg) => {
    const text = msg.text();
    if (text.includes('GL_INVALID_OPERATION')) {
      errorTimes.push(Date.now() - startTime);
    }
  };
  page.on('console', errorListener);

  await page.waitForTimeout(5000);

  console.log('\n=== DEBUG LOGS ===');
  if (logs.length === 0) {
    console.log('⚠️ No PostProcessingV2 logs found - code may not be reloaded!');
  } else {
    logs.forEach(log => console.log(`  ${log}`));
  }

  console.log('\n=== ERROR TIMING ===');
  if (errorTimes.length > 0) {
    console.log(`Errors occurred at (ms from start): ${errorTimes.slice(0, 10).join(', ')}${errorTimes.length > 10 ? '...' : ''}`);
    console.log(`First error at: ${errorTimes[0]}ms`);
    console.log(`Last error at: ${errorTimes[errorTimes.length - 1]}ms`);
  }

  console.log('\n=== GL ERRORS ===');
  if (errors.length === 0) {
    console.log('✅ No GL_INVALID_OPERATION errors found!');
  } else {
    console.log(`❌ Found ${errors.length} GL errors:`);
    errors.forEach((e, i) => {
      console.log(`  ${i + 1}. [${e.type}] ${e.text}`);
    });
  }

  console.log('\n=== ALL GL/WebGL WARNINGS ===');
  if (warnings.length === 0) {
    console.log('No GL/WebGL warnings found.');
  } else {
    warnings.forEach((w, i) => {
      console.log(`  ${i + 1}. [${w.type}] ${w.text}`);
    });
  }

  await browser.close();

  return errors.length === 0;
}

captureGLErrors()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
