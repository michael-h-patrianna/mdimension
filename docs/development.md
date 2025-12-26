# Development Guide for LLM Coding Agents

**Purpose**: This teaches you HOW to set up, run, build, and debug this project with the exact commands and conventions used here.

**Read this first**:
- `docs/architecture.md` for file placement rules.
- `docs/testing.md` for test patterns and Playwright debugging.
- `docs/meta/styleguide.md` for mandatory engineering + WebGL2 shader rules.

## Setup (One-time)

```bash
# Install dependencies (npm is the expected package manager)
npm install
```

## Run Locally (Dev Server)

```bash
# Starts Vite dev server on port 3000
npm run dev
```

- Dev URL: `http://localhost:3000`
- Port is fixed by the script (`vite --port 3000`). If you must change it, pass a different port:

```bash
npm run dev -- --port 3001
```

## Key Commands (Use these; do not invent new ones)

| Task | Command |
|---|---|
| Dev server | `npm run dev` |
| Unit/integration/component tests | `npm test` |
| Build | `npm run build` |
| Preview production build | `npm run preview` |
| Lint | `npm run lint` |
| Format | `npm run format` |
| E2E / acceptance tests | `npx playwright test` |

## Standard Workflow (What to do when changing code)

### Before you start (fast sanity)

```bash
npm test
```

### While developing

- Keep `npm run dev` running for manual iteration.
- When debugging runtime issues, prefer **Playwright + console logs** (see `docs/testing.md`).

### Before you claim work is done (required)

```bash
npm test
npm run lint
npm run build
```

## Decision Tree: “What command should I run?”

- If you changed TypeScript/React logic and want confidence → `npm test`
- If you changed rendering/shaders and need WebGL validation → `npx playwright test`
- If you changed dependencies, config, or build pipeline → `npm run build`
- If you touched formatting/style → `npm run lint` and `npm run format`

## Debugging Rules (Project-specific)

- **Never use fetch-based debugging**. Do not add “reporting endpoints” or send logs over HTTP.
- For runtime bugs:
  - Add `console.log` (temporarily) in the browser code.
  - Capture and assert logs via Playwright (`page.on('console', ...)`).
  - Remove noisy logs after resolving.

## Adding Dependencies (Do this exactly)

```bash
# Runtime dependency
npm install <pkg>

# Dev dependency
npm install -D <pkg>
```

Rules:
- Prefer small, tree-shakeable, maintained packages.
- Do not add “UI component libraries” — this repo already has `src/components/ui`.

## Build Output

```bash
npm run build
```

Build artifacts go to `dist/`. Treat `dist/` as output only (do not edit it by hand).

## Troubleshooting

### Dev server won’t start

- Check if port 3000 is already in use.
- Try a different port:

```bash
npm run dev -- --port 3001
```

### Tests hang or the system gets sluggish

- Stop running node processes:

```bash
killall -9 node
```

- Re-run a single test file to isolate:

```bash
npx vitest run src/tests/path/to/test.test.ts
```

### Playwright fails to launch the app

- Playwright expects `http://localhost:3000` and auto-starts the dev server via `playwright.config.ts`.
- If you already have a server running, Playwright will reuse it (local mode).

## Directory Rules (Keep the repo root clean)

| Activity | Required directory |
|---|---|
| Playwright tests | `scripts/playwright/` |
| Utility scripts | `scripts/tools/` |
| Screenshots/visual artifacts | `screenshots/` |
| Docs | `docs/` |
| Temporary experiments | `src/dev-tools/` |

## Common Mistakes

❌ **Don't**: Run `vitest` watch mode in automation or scripts.
✅ **Do**: Use `npm test` (`vitest run`) for CI-safe runs.

❌ **Don't**: Debug with fetch calls, remote log collectors, or “debug endpoints”.
✅ **Do**: Use Playwright and inspect/capture console logs.

❌ **Don't**: Put scripts, scratch docs, or screenshots in the repo root.
✅ **Do**: Use `scripts/tools/`, `docs/`, and `screenshots/`.

❌ **Don't**: Add raw HTML controls or a new UI library.
✅ **Do**: Use/extend `src/components/ui` primitives.

❌ **Don't**: Skip `npm run build` after pipeline-level changes.
✅ **Do**: Always run `npm run build` before claiming the change is complete.
