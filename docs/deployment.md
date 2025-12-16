# Local Development Guide

**Purpose**: This document teaches you how to run the application locally and build for production.

**Tech Stack**: Node.js, Vite

---

## Prerequisites
-   Node.js (v18+)
-   npm

---

## Commands

### 1. Start Development Server
**Command**: `npm run dev`
**Description**: Starts Vite dev server. Accessible at `http://localhost:3000`.
**Hot Reload**: Enabled. Edits to files will auto-update the browser.

### 2. Run Tests
**Command**: `npm test`
**Description**: Runs Vitest unit and component tests.

### 3. Build for Production
**Command**: `npm run build`
**Description**: Compiles TypeScript and bundles assets to `dist/`.

### 4. Preview Production Build
**Command**: `npm run preview`
**Description**: Serves the `dist/` folder to verify the production build locally.

---

## File Structure for Devs

-   `src/main.tsx`: Entry point.
-   `vite.config.ts`: Build configuration.
-   `vitest.config.ts`: Test configuration.
-   `tailwind.config.js`: Style configuration.

---

## Troubleshooting

### "Missing module" errors
**Solution**: Run `npm install` to ensure all dependencies are present.

### Canvas not rendering
**Solution**: Check browser console for WebGL errors. Ensure hardware acceleration is enabled.

### Typescript errors
**Solution**: Run `npx tsc -b` to run a full type check.
