# Development Guide for LLM Coding Agents

**Purpose**: Instructions for setup, running, building, and development workflow.

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev

# 3. Open in browser
# Default: http://localhost:5173
```

No additional configuration needed. The app runs client-side only.

## Key Commands

| Task | Command | Description |
|------|---------|-------------|
| Dev server | `npm run dev` | Start Vite dev server with HMR |
| Run tests | `npm test` | Run all Vitest tests once |
| Watch tests | `npm run test:watch` | Interactive test watch mode |
| Build | `npm run build` | TypeScript check + Vite production build |
| Preview | `npm run preview` | Preview production build locally |
| Lint | `npm run lint` | ESLint check |
| Format | `npm run format` | Prettier formatting |
| Type check | `npx tsc --noEmit` | TypeScript check without emit |

## Development Workflow

### 1. Before Starting Work

```bash
# Ensure clean state
npm test              # All tests pass
npx tsc --noEmit      # No type errors
```

### 2. During Development

```bash
# Terminal 1: Dev server
npm run dev

# Terminal 2: Test watch (optional)
npm run test:watch
```

### 3. Before Committing

```bash
# Required checks
npm test              # All tests pass
npx tsc --noEmit      # No type errors
npm run lint          # No lint errors
npm run build         # Build succeeds
```

## Project Scripts Explained

```json
{
  "dev": "vite",                    // HMR dev server
  "build": "tsc -b && vite build",  // Type check + production build
  "preview": "vite preview",        // Serve built files
  "test": "vitest run",             // Run tests once (CI mode)
  "test:watch": "vitest",           // Interactive watch mode
  "lint": "eslint ...",             // Code quality check
  "format": "prettier --write ..."  // Auto-format code
}
```

## Environment

- **Node**: 18+ recommended
- **Package Manager**: npm (lockfile committed)
- **No backend**: Client-side only React app
- **No env vars required**: All configuration in code

## Vite Configuration

Dev server runs on port 5173 by default. Key features:
- Hot Module Replacement (HMR)
- Path aliases (`@/` → `src/`)
- TypeScript support
- React Fast Refresh

## TypeScript Configuration

Strict mode enabled. Key settings:
- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`

Path aliases configured:
```typescript
import { X } from '@/components/...'
import { Y } from '@/lib/...'
import { Z } from '@/stores/...'
import { W } from '@/hooks/...'
```

## Test Configuration

Vitest with React Testing Library. Key settings:
- `maxWorkers: 4` (memory safety)
- `pool: 'threads'` (not forks)
- `environment: 'jsdom'`

Playwright tests are separate in `scripts/playwright/`.

## Adding New Dependencies

```bash
# Production dependency
npm install package-name

# Dev dependency (testing, build tools)
npm install -D package-name
```

**Check before adding**:
1. Is it tree-shakeable?
2. Bundle size impact?
3. Actively maintained?

## Debugging

### Browser DevTools
- React DevTools extension for component inspection
- Three.js debugging: Use `scene.children` in console

### Test Debugging
```bash
# Run single test file with output
npx vitest run src/tests/path/to/test.test.ts

# Run with debugging
node --inspect-brk ./node_modules/vitest/vitest.mjs run
```

### Memory Issues
If tests crash with OOM:
```bash
# Kill stuck processes
killall -9 node

# Run with limited workers
npx vitest run --maxWorkers=2
```

## Build Output

```bash
npm run build
```

Creates `dist/` folder:
- `dist/index.html` - Entry point
- `dist/assets/*.js` - Bundled JavaScript
- `dist/assets/*.css` - Bundled styles

Serve with any static file server.

## Common Tasks

### Check Everything Before PR
```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
```

### Fresh Install
```bash
rm -rf node_modules package-lock.json
npm install
```

### Update Dependencies
```bash
npm outdated          # Check for updates
npm update            # Update within semver range
npm install pkg@latest # Update specific package
```

## Troubleshooting

**Problem**: Dev server not starting
**Solution**: Check port 5173 is free, try `npm run dev -- --port 3000`

**Problem**: Type errors after install
**Solution**: `npx tsc --noEmit` to see all errors, may need `npm install`

**Problem**: Tests hanging/OOM
**Solution**: `killall -9 node`, check `maxWorkers: 4` in vitest.config.ts

**Problem**: HMR not working
**Solution**: Hard refresh browser, restart dev server

**Problem**: Import path errors
**Solution**: Check `@/` alias maps to `src/`, may need IDE restart

## IDE Setup (VS Code)

Recommended extensions:
- ESLint
- Prettier
- TypeScript + JavaScript
- Tailwind CSS IntelliSense
- Vitest Runner

Settings sync with project:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode"
}
```
