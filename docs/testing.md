# Testing Guide for LLM Coding Agents

**Purpose**: This teaches you HOW to write, place, and run tests in this repo (Vitest + Playwright) while staying memory-safe and WebGL-aware.

**Non-negotiable**:
- Maintain **100% test coverage** for new functionality.
- Do **not** "fix" failing tests by weakening assertions. Fix the code.
- Do **not** use fetch-based debugging. For runtime debugging use **Playwright + console logs**.

## Test Stack

- **Unit + integration + component tests**: Vitest (`npm test`) with `happy-dom`
- **E2E/acceptance**: Playwright (`@playwright/test`) in `scripts/playwright/`
- **React assertions**: Testing Library (`@testing-library/react`, `@testing-library/user-event`)

## Where Tests Live (Placement Rules)

- Vitest tests: `src/tests/**`
- Playwright tests: `scripts/playwright/**/*.spec.ts`
- Test-only mocks: `src/tests/__mocks__/`

### Decision tree: where does this test go?

| If you changed… | Put tests in… |
|---|---|
| Pure math/geometry `src/lib/...` | `src/tests/lib/...` |
| Zustand store `src/stores/...` | `src/tests/stores/...` |
| Hook `src/hooks/...` | `src/tests/hooks/...` |
| UI primitive `src/components/ui/...` | `src/tests/components/ui/...` |
| Rendering pipeline `src/rendering/...` | `src/tests/rendering/...` and/or `src/tests/integration/...` |
| Visual correctness / WebGL errors / render graph issues | `scripts/playwright/*.spec.ts` |
| Store slice `src/stores/slices/...` | `src/tests/stores/slices/...` |
| Shader compilation | `scripts/playwright/` (needs real WebGL context) |

## What the Test Environment Already Provides (Do not re-implement)

Vitest is configured with `src/tests/setup.ts` which already:
- Calls `cleanup()` after each test.
- Mocks `ResizeObserver` and `matchMedia`.
- Provides in-memory `localStorage`/`sessionStorage` (for Zustand persist).
- Provides a **comprehensive WebGL2 mock** for Three.js (400+ lines).
- Suppresses known benign R3F warnings (so tests fail on real problems).
- Mocks the WASM module via alias:
  - `mdimension-core` is aliased to `src/tests/__mocks__/mdimension-core.ts`
- Mocks `AudioContext` for sound manager tests.
- Mocks Popover API (`showPopover`, `hidePopover`, `togglePopover`).
- Mocks `HTMLDialogElement` (`showModal`, `close`).

## How to Run Tests (Commands)

```bash
# All Vitest tests (CI-safe)
npm test

# Single Vitest file
npx vitest run src/tests/path/to/test.test.ts

# Tests matching a name/pattern
npx vitest run -t "Render graph"

# Playwright E2E (auto-starts dev server via playwright.config.ts)
npx playwright test

# Single Playwright spec file
npx playwright test scripts/playwright/object-types-rendering.spec.ts

# Playwright with headed browser (for debugging)
npx playwright test --headed

# Playwright with UI mode (interactive debugging)
npx playwright test --ui
```

### Watch mode rule

- **Never** run watch mode in automation.
- For local interactive debugging only: `npm run test:watch` (human-authorized).

## Templates (Copy/Paste)

### Template: unit test (pure logic)

Create: `src/tests/lib/<area>/<thing>.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { <FUNCTION> } from '@/lib/<area>/<module>'

describe('<FUNCTION>', () => {
  it('returns expected output for a simple case', () => {
    expect(<FUNCTION>(/* input */)).toEqual(/* expected */)
  })

  it('throws on invalid input', () => {
    expect(() => <FUNCTION>(/* invalid */)).toThrow()
  })
})
```

### Template: Zustand store test

Create: `src/tests/stores/<store>.test.ts`

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { use<Domain>Store } from '@/stores'

describe('use<Domain>Store', () => {
  beforeEach(() => {
    // Prefer store-provided reset; otherwise setState to initial values.
    use<Domain>Store.getState().reset?.()
  })

  it('has stable initial state', () => {
    const s = use<Domain>Store.getState()
    expect(s).toBeDefined()
  })

  it('updates state via an action', () => {
    const { setValue } = use<Domain>Store.getState()
    setValue(123)
    expect(use<Domain>Store.getState().value).toBe(123)
  })
})
```

### Template: UI component test (Testing Library)

Create: `src/tests/components/ui/<Component>.test.tsx`

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { <Component> } from '@/components/ui/<Component>'

describe('<Component>', () => {
  it('renders', () => {
    render(<<Component> />)
    // Prefer role-based queries
    expect(screen.getByTestId('<test-id>')).toBeInTheDocument()
  })

  it('fires callbacks', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()

    render(<<Component> onClick={onClick} data-testid="<test-id>" />)
    await user.click(screen.getByTestId('<test-id>'))

    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
```

### Template: hook test

Create: `src/tests/hooks/<hook>.test.ts(x)`

```ts
import { describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { use<Hook> } from '@/hooks/use<Hook>'

describe('use<Hook>', () => {
  it('returns a stable shape', () => {
    const { result } = renderHook(() => use<Hook>())
    expect(result.current).toBeDefined()
  })

  it('updates state correctly', () => {
    const { result } = renderHook(() => use<Hook>())

    act(() => {
      result.current.someAction()
    })

    expect(result.current.someValue).toBe(/* expected */)
  })
})
```

### Template: render graph pass test

Create: `src/tests/rendering/graph/<PassName>.test.ts`

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { <PassName> } from '@/rendering/graph/passes/<PassName>'

describe('<PassName>', () => {
  let pass: <PassName>

  beforeEach(() => {
    pass = new <PassName>()
  })

  it('has correct config', () => {
    expect(pass.id).toBe('<pass-id>')
    expect(pass.config.inputs).toHaveLength(/* expected */)
    expect(pass.config.outputs).toHaveLength(/* expected */)
  })

  it('declares correct resource dependencies', () => {
    const inputIds = pass.config.inputs.map(i => i.resourceId)
    expect(inputIds).toContain('<expected-input>')
  })
})
```

## Playwright Patterns (This project's way)

### When to use Playwright (decision tree)

- If the change can cause **WebGL errors**, **shader compile issues**, **render graph warnings**, or "canvas is black" → write/extend a Playwright test.
- If you need to debug runtime behavior: use **Playwright + page console collection**, not fetch.
- If testing UI interactions that require real browser APIs (popover, dialog, canvas).

### Template: Playwright acceptance test with console collection

Create: `scripts/playwright/<feature>.spec.ts`

```ts
import { ConsoleMessage, expect, test } from '@playwright/test'

test('<feature> does not emit WebGL or render graph errors', async ({ page }) => {
  const errors: string[] = []
  const warnings: string[] = []

  page.on('pageerror', (err) => errors.push(err.message))
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') errors.push(msg.text())
    if (msg.type() === 'warning') warnings.push(msg.text())
  })

  // IMPORTANT: set listeners BEFORE navigation to catch early errors
  await page.goto('/')

  await page.waitForSelector('canvas', { state: 'visible' })
  await page.waitForTimeout(1500)

  // Fast "gate": fail on hard errors
  expect(errors.join('\n')).not.toMatch(/WebGL|GLSL|shader|RenderGraph|Graph compilation/i)
})
```

### Template: Playwright with WebGL shader guard

```ts
import { expect, test } from '@playwright/test'
import { installWebGLShaderCompileLinkGuard } from './webglShaderCompileLinkGuard'

test('Shader compilation succeeds', async ({ page }) => {
  // Install guard BEFORE navigation
  await installWebGLShaderCompileLinkGuard(page)

  await page.goto('/')
  await page.waitForSelector('canvas', { state: 'visible' })
  await page.waitForTimeout(2000)

  // Guard throws on compile/link failures
})
```

### Template: Playwright with object type cycling

```ts
import { ConsoleMessage, expect, test } from '@playwright/test'
import { installWebGLShaderCompileLinkGuard } from './webglShaderCompileLinkGuard'

const OBJECT_TYPES = [
  'hypercube', 'simplex', 'cross-polytope', 'wythoff-polytope', 'root-system',
  'clifford-torus', 'nested-torus', 'mandelbulb', 'quaternion-julia',
  'schroedinger', 'blackhole'
]

test.describe('Object type rendering', () => {
  test('All object types render without errors', async ({ page }) => {
    await installWebGLShaderCompileLinkGuard(page)

    const errors: string[] = []
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    for (const objectType of OBJECT_TYPES) {
      errors.length = 0  // Clear between types

      // Use URL parameter for reliable selection
      await page.goto(`/?t=${objectType}`)
      await page.waitForSelector('canvas', { state: 'visible' })
      await page.waitForTimeout(2000)

      const webglErrors = errors.filter(e =>
        /WebGL|GLSL|shader|compile|link/i.test(e)
      )
      expect(webglErrors, `${objectType} failed`).toHaveLength(0)
    }
  })
})
```

### Template: Visual regression with screenshot

```ts
import { expect, test } from '@playwright/test'

test('Visual appearance is correct', async ({ page }) => {
  await page.goto('/?t=hypercube')
  await page.waitForSelector('canvas', { state: 'visible' })
  await page.waitForTimeout(3000)  // Wait for render stabilization

  // Screenshot the canvas
  const canvas = page.locator('canvas').first()
  await expect(canvas).toHaveScreenshot('hypercube-default.png', {
    maxDiffPixels: 100  // Allow minor differences
  })
})
```

### Template: Console log debugging

```ts
import { expect, test } from '@playwright/test'

test('Debug shader uniforms', async ({ page }) => {
  const logs: string[] = []

  page.on('console', (msg) => {
    if (msg.text().includes('[DEBUG]')) {
      logs.push(msg.text())
    }
  })

  await page.goto('/')
  await page.waitForTimeout(2000)

  // Log captured debug messages
  console.log('Captured logs:', logs)

  // Assert on specific log patterns
  expect(logs.some(l => l.includes('uQualityMultiplier'))).toBe(true)
})
```

### Recommended "gates" (order by cost)

1. **Console gate**: fail fast on WebGL/shader/render-graph errors.
2. **Center pixel gate**: sample a small canvas region to detect "all black" renders.
3. **Full screenshot analysis**: only when necessary (most expensive).

### Playwright Configuration

The project uses `playwright.config.ts`:

```ts
{
  testDir: './scripts/playwright',
  baseURL: 'http://localhost:3000',
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }]
}
```

## Memory-Safe Testing Rules (Do not break these)

### Configuration Safeguards (DO NOT MODIFY without review)

- `maxWorkers: 4` in `vitest.config.ts` - Prevents excessive process spawning
- `pool: 'threads'` - Uses memory-efficient threading instead of forks
- `environment: 'happy-dom'` - Fast DOM implementation for all tests

### Writing Memory-Safe Tests

- **DON'T**: Generate 1000+ data points in a single test without batching
- **DO**: Process in batches of 100 and clear arrays between batches
- **DON'T**: Rely on DOM for pure logic tests if not needed
- **DO**: Use component tests (`.test.tsx`) only for UI components
- **DON'T**: Forget to cleanup timers/listeners in afterEach
- **DO**: Call `cleanup()` from @testing-library/react in test teardown (already done in setup.ts)

### Emergency Response

If system becomes unresponsive during tests:

```bash
killall -9 node  # Force kill all Node processes
node scripts/cleanup-vitest.mjs  # Clean up lingering workers
```

## Testing Specific Domains

### Testing Stores with Cross-Store Dependencies

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { useGeometryStore } from '@/stores/geometryStore'
import { useAnimationStore } from '@/stores/animationStore'
import { useRotationStore } from '@/stores/rotationStore'

describe('GeometryStore cross-store effects', () => {
  beforeEach(() => {
    useGeometryStore.getState().reset?.()
    useAnimationStore.getState().reset?.()
    useRotationStore.getState().reset?.()
  })

  it('updates animation store when dimension changes', () => {
    const { setDimension } = useGeometryStore.getState()

    setDimension(5)

    // Check that dependent stores were updated
    const animState = useAnimationStore.getState()
    expect(animState.animatingPlanes.size).toBeLessThanOrEqual(10)  // 5D has 10 planes
  })
})
```

### Testing Geometry Generation

```ts
import { describe, expect, it } from 'vitest'
import { generateHypercube } from '@/lib/geometry/hypercube'

describe('Hypercube geometry', () => {
  it('generates correct vertex count for 4D', () => {
    const result = generateHypercube(4)
    expect(result.vertices).toHaveLength(16)  // 2^4
  })

  it('generates valid edges', () => {
    const result = generateHypercube(4)
    for (const [a, b] of result.edges) {
      expect(a).toBeGreaterThanOrEqual(0)
      expect(b).toBeLessThan(result.vertices.length)
      expect(a).not.toBe(b)
    }
  })

  // Batch test for memory safety
  it('handles high dimensions in batches', () => {
    for (let dim = 3; dim <= 8; dim++) {
      const result = generateHypercube(dim)
      expect(result.vertices).toHaveLength(Math.pow(2, dim))
      // Clear references to help GC
    }
  })
})
```

### Testing Hooks with R3F

For hooks that use R3F's `useFrame`, create a test wrapper:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { ReactNode } from 'react'

// Mock useFrame for testing
vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn((callback) => {
    // Optionally call immediately for testing
  }),
}))

import { useAnimationLoop } from '@/hooks/useAnimationLoop'

describe('useAnimationLoop', () => {
  it('registers with useFrame', () => {
    const { useFrame } = require('@react-three/fiber')

    renderHook(() => useAnimationLoop())

    expect(useFrame).toHaveBeenCalled()
  })
})
```

### Testing Shaders (Unit Level)

Test shader string generation without WebGL:

```ts
import { describe, expect, it } from 'vitest'
import { generateMandelbulbFragment } from '@/rendering/shaders/mandelbulb/fragment'

describe('Mandelbulb shader', () => {
  it('generates valid GLSL 3.00 output declaration', () => {
    const shader = generateMandelbulbFragment({ power: 8 })
    expect(shader).toContain('layout(location = 0) out vec4')
    expect(shader).not.toContain('gl_FragColor')
  })

  it('includes required uniforms', () => {
    const shader = generateMandelbulbFragment({ power: 8 })
    expect(shader).toContain('uniform float uPower')
    expect(shader).toContain('uniform float uTime')
  })
})
```

## Common Mistakes

❌ **Don't**: Write tests outside `src/tests/` or Playwright specs outside `scripts/playwright/`.
✅ **Do**: Follow the placement rules and mirror source structure.

❌ **Don't**: Add ad-hoc WebGL mocks inside individual tests.
✅ **Do**: Use the shared environment in `src/tests/setup.ts` and only mock narrowly when needed.

❌ **Don't**: Use fetch-based debugging or remote logging in tests.
✅ **Do**: Use Playwright console capture (`page.on('console')`) and assert on collected logs.

❌ **Don't**: Run Vitest watch mode in automation.
✅ **Do**: Use `npm test` (`vitest run`) for CI-safe execution.

❌ **Don't**: Test Three.js internals (exact matrices, internal renderer state) in Vitest.
✅ **Do**: Test your own inputs/outputs and use Playwright for visual/WebGL validation.

❌ **Don't**: Forget store resets (test pollution).
✅ **Do**: Reset stores in `beforeEach` (or `setState` to initial state).

❌ **Don't**: Change `maxWorkers`/pool config to "make tests faster".
✅ **Do**: Keep worker limits stable to prevent memory exhaustion.

❌ **Don't**: Write Playwright tests that depend on exact timing.
✅ **Do**: Use `waitForSelector`, `waitForTimeout`, and robust element queries.

❌ **Don't**: Create massive test data in a single test.
✅ **Do**: Use small representative samples and batch processing.

❌ **Don't**: Skip cleanup in afterEach for timers, listeners, or resources.
✅ **Do**: Always clean up subscriptions, intervals, and event listeners.
