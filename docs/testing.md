# Testing Guide

**Purpose**: This document teaches you how to write and run tests.

**Tech Stack**: Vitest (Unit/Component), Playwright (E2E), Testing Library

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