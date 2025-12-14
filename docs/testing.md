# Testing Guide for LLM Coding Agents

**Purpose**: Instructions for writing and running tests in this project.

**Read This When**: Writing tests, running test suites, or debugging test failures.

**Tech Stack**: Vitest (Unit/Component), Playwright (E2E), Testing Library

**CRITICAL**: Maintain 100% test coverage. Every new feature needs tests.

---

## Testing Principles

### 1. Layered Testing
-   **Unit Tests (`*.test.ts`)**: For pure math/logic in `src/lib/`.
-   **Component Tests (`*.test.tsx`)**: For UI components and Hook behavior.
-   **E2E Tests (`scripts/playwright/`)**: For critical user flows and 3D visualization correctness.

### 2. Mocking 3D
**Rule**: Deeply testing Three.js canvas in unit tests is hard.
**Strategy**: Mock `ResizeObserver` and Canvas context for component tests. Use E2E for visual verification.

---

## How to Write Tests

### 1. Unit Tests (Logic)
**Location**: `src/tests/lib/` or alongside source.
**Template**:
```typescript
import { describe, it, expect } from 'vitest';
import { myMathFunction } from '@/lib/math/myMath';

describe('myMathFunction', () => {
  it('calculates correctly', () => {
    const result = myMathFunction(2, 2);
    expect(result).toBe(4);
  });
});
```

### 2. Component/Hook Tests
**Location**: `src/tests/components/`
**Template**:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { MyComponent } from '@/components/ui/MyComponent';

describe('MyComponent', () => {
  it('renders button and handles click', () => {
    render(<MyComponent />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(screen.getByText('Clicked')).toBeInTheDocument();
  });
});
```

### 3. E2E Tests (Playwright)
**Location**: `scripts/playwright/`
**Template**:
```javascript
import { test, expect } from '@playwright/test';

test('feature works correctly', async ({ page }) => {
  await page.goto('/');
  
  // Interact with UI
  await page.getByTestId('my-button').click();
  
  // Verify Result
  await expect(page.getByTestId('result-area')).toContainText('Success');
});
```

---

## Running Tests

### Unit & Component Tests
```bash
npm test          # Run all Vitest tests
npm test -- ui    # Run only UI related tests
```

### E2E Tests
```bash
npx playwright test
```

---

## Common Mistakes
❌ **Don't**: Test `three.js` internals (e.g., checking if a mesh has a specific matrix).
✅ **Do**: Test the *inputs* (Store state) and *outputs* (Logic functions). Leave visual verification to E2E.

❌ **Don't**: Forget `await` in Playwright tests.

---

## Test File Location Decision Tree

| Creating tests for... | Put test file at... |
|----------------------|---------------------|
| `src/lib/math/vector.ts` | `src/tests/lib/math/vector.test.ts` |
| `src/stores/geometryStore.ts` | `src/tests/stores/geometryStore.test.ts` |
| `src/hooks/useAnimationLoop.ts` | `src/tests/hooks/useAnimationLoop.test.ts` |
| `src/components/ui/Button.tsx` | `src/tests/components/ui/Button.test.tsx` |
| `src/components/canvas/Scene.tsx` | `src/tests/components/canvas/Scene.test.tsx` |
| Full user flow | `scripts/playwright/*.mjs` |

---

## How to Write a Store Test

**Template** (`src/tests/stores/{name}Store.test.ts`):
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { use{Name}Store } from '@/stores/{name}Store';

describe('{name}Store', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    use{Name}Store.getState().reset();
  });

  it('has correct initial state', () => {
    const state = use{Name}Store.getState();
    expect(state.value).toBe(DEFAULT_VALUE);
  });

  it('setValue updates value', () => {
    const { setValue } = use{Name}Store.getState();
    setValue(5);
    expect(use{Name}Store.getState().value).toBe(5);
  });

  it('setValue clamps to valid range', () => {
    const { setValue } = use{Name}Store.getState();
    setValue(100); // Exceeds MAX
    expect(use{Name}Store.getState().value).toBe(MAX_VALUE);
  });

  it('reset returns to initial state', () => {
    const { setValue, reset } = use{Name}Store.getState();
    setValue(5);
    reset();
    expect(use{Name}Store.getState().value).toBe(DEFAULT_VALUE);
  });
});
```

---

## How to Write a Hook Test

**Template** (`src/tests/hooks/use{Name}.test.ts`):
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { use{Name} } from '@/hooks/use{Name}';

// Mock dependencies
vi.mock('@react-three/fiber', () => ({
  useThree: () => ({ camera: mockCamera }),
  useFrame: (callback: Function) => mockUseFrame(callback),
}));

describe('use{Name}', () => {
  beforeEach(() => {
    // Setup mocks
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns expected value', () => {
    const { result } = renderHook(() => use{Name}());
    expect(result.current).toBeDefined();
  });

  it('updates on dependency change', () => {
    const { result, rerender } = renderHook(
      ({ prop }) => use{Name}(prop),
      { initialProps: { prop: 1 } }
    );

    expect(result.current).toBe(expectedValue1);

    rerender({ prop: 2 });

    expect(result.current).toBe(expectedValue2);
  });
});
```

---

## How to Write a Component Test

**Template** (`src/tests/components/ui/{Name}.test.tsx`):
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { {Name} } from '@/components/ui/{Name}';

describe('{Name}', () => {
  it('renders correctly', () => {
    render(<{Name}>Content</{Name}>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<{Name} onClick={handleClick}>Click me</{Name}>);
    await user.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is true', () => {
    render(<{Name} disabled>Disabled</{Name}>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('applies custom className', () => {
    render(<{Name} className="custom">Styled</{Name}>);
    expect(screen.getByRole('button')).toHaveClass('custom');
  });
});
```

---

## How to Write a Math/Geometry Test

**Template** (`src/tests/lib/geometry/{name}.test.ts`):
```typescript
import { describe, it, expect } from 'vitest';
import { generate{Name} } from '@/lib/geometry/{name}';

describe('generate{Name}', () => {
  it('throws if dimension < 2', () => {
    expect(() => generate{Name}(1)).toThrow();
  });

  it('generates correct vertex count for 3D', () => {
    const result = generate{Name}(3);
    expect(result.vertices.length).toBe(EXPECTED_COUNT_3D);
  });

  it('generates correct edge count for 4D', () => {
    const result = generate{Name}(4);
    expect(result.edges.length).toBe(EXPECTED_COUNT_4D);
  });

  it('scales vertices correctly', () => {
    const scale = 2.0;
    const result = generate{Name}(3, scale);

    // Check vertices are within expected bounds
    result.vertices.forEach(v => {
      v.forEach(coord => {
        expect(Math.abs(coord)).toBeLessThanOrEqual(scale);
      });
    });
  });

  it('edges reference valid vertex indices', () => {
    const result = generate{Name}(4);
    const maxIndex = result.vertices.length - 1;

    result.edges.forEach(([a, b]) => {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(maxIndex);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(maxIndex);
    });
  });
});
```

---

## How to Write an E2E Test (Playwright)

**Location**: `scripts/playwright/`
**Template** (`scripts/playwright/test-{feature}.mjs`):
```javascript
/**
 * E2E Test: {Feature Description}
 */
import { chromium } from 'playwright';
import { strict as assert } from 'assert';

const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = 'screenshots/{feature}';

async function runTests() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Testing {feature}...');

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Test 1: Element exists
  const element = await page.locator('[data-testid="my-element"]').count();
  assert(element > 0, 'Expected element to exist');

  // Test 2: Interaction works
  await page.locator('[data-testid="my-button"]').click();
  await page.waitForTimeout(500);

  // Test 3: Visual verification
  await page.screenshot({ path: `${SCREENSHOT_DIR}/result.png` });

  console.log('All tests passed!');
  await browser.close();
}

// Create screenshot directory
import { mkdirSync } from 'fs';
try { mkdirSync(SCREENSHOT_DIR, { recursive: true }); } catch {}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
```

**Run with**: `node scripts/playwright/test-{feature}.mjs`

---

## Memory-Safe Test Practices

**CRITICAL**: Tests previously caused OOM. Follow these rules:

1. **Worker limit**: Never modify `maxWorkers: 4` in vitest.config.ts
2. **Thread pool**: Keep `pool: 'threads'` (not forks)
3. **Batch large data**: Process arrays in chunks of 100
4. **Clean up**: Always call `cleanup()` in afterEach

```typescript
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
```

**If tests hang**:
```bash
killall -9 node
node scripts/cleanup-vitest.mjs
```

---

## Running Tests

```bash
# Run all unit/component tests (required before commit)
npm test

# Run single test file
npx vitest run src/tests/path/to/file.test.ts

# Run tests matching pattern
npx vitest run -t "pattern"

# E2E tests (start dev server first!)
npm run dev &
node scripts/playwright/e2e.test.mjs
```

---

## More Common Mistakes

❌ **Don't**: Use `vitest --watch` in CI/automation
✅ **Do**: Use `npm test` (runs `vitest run`)

❌ **Don't**: Generate 1000+ data points in a single test
✅ **Do**: Process in batches, clear arrays between batches

❌ **Don't**: Load JSDOM for pure logic tests
✅ **Do**: Use `.test.ts` for logic, `.test.tsx` only for components

❌ **Don't**: Test implementation details (internal state)
✅ **Do**: Test behavior and outputs

❌ **Don't**: Skip store reset in beforeEach
✅ **Do**: Always reset stores to prevent test pollution

❌ **Don't**: Hardcode expected vertex/edge counts
✅ **Do**: Calculate expected values from formulas (e.g., `2^n` for hypercube vertices)