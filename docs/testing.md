# Testing Guide for LLM Coding Agents

**Purpose**: Instructions for writing and running tests.
**Test Stack**: Vitest + Testing Library + Happy-DOM/JSDOM + Playwright (E2E)

## Test File Organization

```
src/tests/
├── setup.ts              # Global test setup
├── components/           # Component tests (mirror src/components/)
│   ├── canvas/           # Three.js component tests
│   ├── controls/         # Control component tests
│   └── ui/               # UI primitive tests
├── hooks/                # Hook tests
├── stores/               # Store tests
├── lib/                  # Pure library tests
│   ├── geometry/
│   ├── math/
│   └── url/
└── integration/          # Integration tests

scripts/playwright/       # E2E tests (separate from Vitest)
```

**Location rules**:
- Test mirrors source: `src/components/ui/Button.tsx` → `src/tests/components/ui/Button.test.tsx`
- Use `.test.tsx` for component tests (needs JSX)
- Use `.test.ts` for pure logic tests (no JSDOM overhead)

## Running Tests

```bash
# Run all tests (default)
npm test

# Watch mode (interactive)
npm run test:watch

# Run specific file
npx vitest run src/tests/lib/geometry/hypercube.test.ts

# Run tests matching pattern
npx vitest run --testNamePattern="should have 8 vertices"

# Run with coverage
npx vitest run --coverage

# Run Playwright E2E (separate)
npx playwright test
```

**CRITICAL**: Never use `vitest` in watch mode for automation. Always use `npm test` which runs `vitest run`.

## How to Write a Component Test

**Template**:
```tsx
/**
 * Tests for {ComponentName} component
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { {ComponentName} } from '@/components/{path}/{ComponentName}';
import { use{Domain}Store } from '@/stores/{domain}Store';

describe('{ComponentName}', () => {
  beforeEach(() => {
    // Reset store before each test
    use{Domain}Store.getState().reset();
  });

  it('should render correctly', () => {
    render(<{ComponentName} />);

    expect(screen.getByRole('button', { name: /label/i })).toBeInTheDocument();
  });

  it('should handle user interaction', () => {
    render(<{ComponentName} />);

    fireEvent.click(screen.getByRole('button', { name: /action/i }));

    expect(use{Domain}Store.getState().value).toBe(expectedValue);
  });

  it('should update when store changes', () => {
    use{Domain}Store.getState().setValue(newValue);
    render(<{ComponentName} />);

    expect(screen.getByText(newValue)).toBeInTheDocument();
  });

  it('should handle disabled state', () => {
    render(<{ComponentName} disabled />);

    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

## How to Write a Store Test

**Template**:
```typescript
/**
 * Tests for {domain}Store
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { use{Domain}Store, DEFAULT_VALUE } from '@/stores/{domain}Store';

describe('{domain}Store', () => {
  beforeEach(() => {
    use{Domain}Store.getState().reset();
  });

  describe('initial state', () => {
    it('should have correct default values', () => {
      const state = use{Domain}Store.getState();

      expect(state.value).toBe(DEFAULT_VALUE);
    });
  });

  describe('setValue', () => {
    it('should update value', () => {
      use{Domain}Store.getState().setValue(newValue);

      expect(use{Domain}Store.getState().value).toBe(newValue);
    });

    it('should validate input', () => {
      use{Domain}Store.getState().setValue(invalidValue);

      // Should clamp/reject invalid values
      expect(use{Domain}Store.getState().value).toBe(clampedValue);
    });
  });

  describe('reset', () => {
    it('should restore default values', () => {
      use{Domain}Store.getState().setValue(changedValue);
      use{Domain}Store.getState().reset();

      expect(use{Domain}Store.getState().value).toBe(DEFAULT_VALUE);
    });
  });
});
```

## How to Write a Hook Test

**Template**:
```typescript
/**
 * Tests for use{Name} hook
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { use{Name} } from '@/hooks/use{Name}';
import { use{Domain}Store } from '@/stores/{domain}Store';

describe('use{Name}', () => {
  beforeEach(() => {
    use{Domain}Store.getState().reset();
  });

  it('should return transformed value', () => {
    const input = [/* test data */];

    const { result } = renderHook(() => use{Name}(input));

    expect(result.current).toEqual(expectedOutput);
  });

  it('should update when store changes', () => {
    const input = [/* test data */];
    const { result, rerender } = renderHook(() => use{Name}(input));

    use{Domain}Store.getState().setValue(newValue);
    rerender();

    expect(result.current).toEqual(newExpectedOutput);
  });

  it('should memoize result', () => {
    const input = [/* test data */];
    const { result, rerender } = renderHook(() => use{Name}(input));

    const firstResult = result.current;
    rerender();

    expect(result.current).toBe(firstResult); // Same reference
  });
});
```

## How to Write a Pure Library Test

**Template**:
```typescript
/**
 * Tests for {moduleName}
 */

import { describe, it, expect } from 'vitest';
import { myFunction } from '@/lib/{domain}/{module}';

describe('{functionName}', () => {
  describe('input validation', () => {
    it('should throw for invalid input', () => {
      expect(() => myFunction(invalidInput)).toThrow('Expected error message');
    });

    it('should accept valid input', () => {
      expect(() => myFunction(validInput)).not.toThrow();
    });
  });

  describe('basic functionality', () => {
    it('should handle typical case', () => {
      const result = myFunction(typicalInput);

      expect(result).toEqual(expectedOutput);
    });

    it('should handle edge case', () => {
      const result = myFunction(edgeCaseInput);

      expect(result).toEqual(edgeCaseOutput);
    });
  });

  describe('mathematical properties', () => {
    it('should satisfy property X', () => {
      const result = myFunction(input);

      expect(result.length).toBe(expectedLength);
      expect(result.every(v => Math.abs(v) <= 1)).toBe(true);
    });
  });
});
```

## Testing Three.js Components

Three.js components require special handling:

```tsx
/**
 * Tests for {Renderer} component
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { Canvas } from '@react-three/fiber';
import { {Renderer} } from '@/components/canvas/{Renderer}';
import { useVisualStore } from '@/stores/visualStore';

// Wrapper for R3F components
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Canvas>{children}</Canvas>
);

describe('{Renderer}', () => {
  beforeEach(() => {
    useVisualStore.getState().reset();
  });

  it('should render without crashing', () => {
    const vertices = [[0, 0, 0], [1, 0, 0], [0, 1, 0]];
    const edges: [number, number][] = [[0, 1], [1, 2], [2, 0]];

    expect(() => {
      render(
        <TestWrapper>
          <{Renderer} vertices={vertices} edges={edges} />
        </TestWrapper>
      );
    }).not.toThrow();
  });

  it('should handle empty geometry', () => {
    expect(() => {
      render(
        <TestWrapper>
          <{Renderer} vertices={[]} edges={[]} />
        </TestWrapper>
      );
    }).not.toThrow();
  });
});
```

## Test Data Patterns

```typescript
// Geometry test data
const cubeVertices = [
  [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
  [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
];
const cubeEdges: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 0], // front
  [4, 5], [5, 6], [6, 7], [7, 4], // back
  [0, 4], [1, 5], [2, 6], [3, 7], // connecting
];

// Rotation test data
const rotationAngles = new Map<string, number>([
  ['XY', Math.PI / 4],
  ['XZ', Math.PI / 6],
]);

// Visual settings test data
const testColors = {
  edge: '#00FF00',
  vertex: '#FF0000',
  background: '#000000',
};
```

## Assertions Reference

```typescript
// Existence
expect(element).toBeInTheDocument();
expect(element).not.toBeInTheDocument();

// Values
expect(value).toBe(expected);           // Strict equality
expect(value).toEqual(expected);        // Deep equality
expect(value).toBeCloseTo(3.14, 2);    // Float comparison

// Arrays
expect(array).toHaveLength(5);
expect(array).toContain(item);
expect(array).toEqual(expect.arrayContaining([1, 2]));

// Errors
expect(() => fn()).toThrow();
expect(() => fn()).toThrow('message');

// DOM
expect(element).toBeDisabled();
expect(element).toHaveAttribute('aria-checked', 'true');
expect(element).toHaveClass('active');

// Store state
expect(useStore.getState().value).toBe(expected);
```

## Memory Safety Rules

**CRITICAL**: These rules prevent OOM during tests.

1. **Max workers**: Keep `maxWorkers: 4` in vitest.config.ts
2. **Use threads**: Keep `pool: 'threads'` (not forks)
3. **Batch large data**: Process in chunks of 100, clear between
4. **Cleanup**: Call `cleanup()` in afterEach for component tests
5. **Avoid JSDOM for logic**: Use `.test.ts` for pure logic tests

```typescript
// BAD: Generates too much data at once
const bigArray = Array.from({ length: 10000 }, () => Math.random());

// GOOD: Process in batches
for (let i = 0; i < 10000; i += 100) {
  const batch = Array.from({ length: 100 }, () => Math.random());
  processBatch(batch);
  batch.length = 0; // Clear
}
```

## Common Mistakes

**Don't**: Use `vitest` in watch mode for CI/automation
**Do**: Use `npm test` which runs `vitest run`

**Don't**: Skip store reset in beforeEach
**Do**: Always call `store.getState().reset()` before each test

**Don't**: Test implementation details
**Do**: Test behavior and user interactions

**Don't**: Create 1000+ data points without batching
**Do**: Process large datasets in batches of 100

**Don't**: Put tests in `src/components/` alongside code
**Do**: Put tests in `src/tests/` mirroring the source structure

**Don't**: Skip wrapper for R3F components
**Do**: Wrap Three.js components in `<Canvas>` for tests

**Don't**: Use `.test.tsx` for pure logic tests
**Do**: Use `.test.ts` to avoid unnecessary JSDOM overhead

**Don't**: Hardcode magic numbers in tests
**Do**: Use named constants for test data
