# Dependency Upgrade Plan: React, Vite, Tailwind CSS, Three.js

## Current vs Target Versions

| Package | Current | Target | Breaking Changes |
|---------|---------|--------|------------------|
| react | ^18.3.1 | ^19.0.0 | Yes - Major |
| react-dom | ^18.3.1 | ^19.0.0 | Yes - Major |
| vite | ^6.0.1 | ^7.0.0 | Yes - Major |
| tailwindcss | ^3.4.15 | ^4.1.x | Yes - Major |
| three | ^0.170.0 | ^0.182.0 | Minor |
| @react-three/fiber | ^8.17.10 | ^9.x | Yes - Major |
| @react-three/drei | ^9.117.3 | Latest | Minor |
| @types/react | ^18.3.12 | ^19.0.0 | Yes |
| @types/react-dom | ^18.3.1 | ^19.0.0 | Yes |
| @types/three | ^0.170.0 | ^0.182.0 | Minor |

---

## Phase 1: React 18 → React 19

### Breaking Changes to Address

1. **Already using `createRoot`** - No migration needed (verified in codebase)

2. **`act` import migration**
   ```diff
   - import { act } from 'react-dom/test-utils'
   + import { act } from 'react'
   ```
   Run codemod: `npx codemod@latest react/19/replace-act-import`

3. **TypeScript type changes**
   - `useRef` and `createContext` now require arguments
   - `ReactElement["props"]` defaults to `unknown` instead of `any`
   - JSX namespace moved to `React.JSX`

   Run codemod: `npx types-react-codemod@latest preset-19 ./src`

4. **Ref callbacks can return cleanup functions**
   - Implicit returns in ref callbacks will error
   ```diff
   - <div ref={current => (instance = current)} />
   + <div ref={current => {instance = current}} />
   ```

5. **Context Provider syntax** (optional improvement)
   ```jsx
   // New syntax available
   <ThemeContext value="dark">{children}</ThemeContext>
   ```

### Commands
```bash
npm install --save-exact react@^19.0.0 react-dom@^19.0.0
npm install --save-exact @types/react@^19.0.0 @types/react-dom@^19.0.0

# Run codemods
npx codemod@latest react/19/migration-recipe
npx types-react-codemod@latest preset-19 ./src
```

---

## Phase 2: Vite 6 → Vite 7

### Breaking Changes to Address

1. **Environment API changes**
   - `options.ssr` replaced with `this.environment.config.consumer === 'server'` in plugins

2. **HMR hook changes**
   - `handleHotUpdate` deprecated → use `hotUpdate` hook
   - `server.ws.send` → `this.environment.hot.send`

3. **Check plugin compatibility**
   - `@vitejs/plugin-react` should be updated

### Commands
```bash
npm install vite@^7.0.0 @vitejs/plugin-react@latest
```

### Config Updates
Review `vite.config.ts` for any deprecated options.

---

## Phase 3: Tailwind CSS 3 → Tailwind CSS 4

### Major Architecture Changes

Tailwind v4 is a complete rewrite with CSS-first configuration.

### Breaking Changes to Address

1. **Import syntax change**
   ```diff
   - @tailwind base;
   - @tailwind components;
   - @tailwind utilities;
   + @import "tailwindcss";
   ```

2. **Vite plugin change**
   ```diff
   // vite.config.ts
   + import tailwindcss from "@tailwindcss/vite";

   export default defineConfig({
     plugins: [
   +   tailwindcss(),
       // other plugins
     ],
   });
   ```

3. **PostCSS config removal**
   - Remove `tailwindcss` and `autoprefixer` from `postcss.config.js`
   - They're now handled automatically

4. **Utility renames**
   - `shadow-sm` → `shadow-xs`
   - `shadow` → `shadow-sm`
   - `ring` default width: 3px → 1px (use `ring-3` for old behavior)
   - `outline-none` → `outline-hidden`

5. **CSS variable syntax in arbitrary values**
   ```diff
   - <div class="bg-[--brand-color]">
   + <div class="bg-(--brand-color)">
   ```

6. **Important modifier position**
   ```diff
   - <div class="!bg-red-500">
   + <div class="bg-red-500!">
   ```

7. **Default border color**
   - Changed from `gray-200` to `currentColor`
   - Add explicit colors to `border-*` and `divide-*` utilities

8. **Stacked variants order**
   - Now apply left-to-right instead of right-to-left

9. **`theme()` function replacement**
   ```diff
   - background-color: theme(colors.red.500);
   + background-color: var(--color-red-500);
   ```

10. **Config migration**
    - `tailwind.config.js` → CSS `@theme` directive
    - Or use `@config "../../tailwind.config.js"` for legacy support

### Commands
```bash
# Run the official upgrade tool
npx @tailwindcss/upgrade

# Or manual installation
npm uninstall tailwindcss autoprefixer postcss
npm install tailwindcss@^4.1.0 @tailwindcss/vite
```

### PostCSS Config (if keeping)
```js
// postcss.config.mjs
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

---

## Phase 4: Three.js 0.170 → 0.182

### Changes to Address

1. **Check for deprecated APIs** in custom shaders
2. **Update imports** if using addons:
   ```diff
   - import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
   + import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
   ```

3. **Material/geometry updates** - Review migration guide for specific changes

### Commands
```bash
npm install three@^0.182.0 @types/three@^0.182.0
```

---

## Phase 5: React Three Fiber 8 → 9

### Breaking Changes to Address

1. **Canvas props renamed**
   ```diff
   - function Canvas(props: Props)
   + function Canvas(props: CanvasProps)
   ```

2. **ThreeElements type for extending**
   ```typescript
   import { type ThreeElement } from '@react-three/fiber'

   declare module '@react-three/fiber' {
     interface ThreeElements {
       customElement: ThreeElement<typeof CustomElement>
     }
   }
   ```

3. **Async `gl` prop for WebGPU support**
   ```tsx
   <Canvas
     gl={async (props) => {
       const renderer = new THREE.WebGPURenderer(props)
       await renderer.init()
       return renderer
     }}
   >
   ```

4. **`act` import change**
   ```diff
   - import { act } from '@react-three/fiber'
   + import { act } from 'react'
   ```

5. **StrictMode inheritance** - Now correctly inherited from parent

6. **Factory extend pattern** (new feature)
   ```tsx
   const Controls = extend(OrbitControls)
   <Controls args={[camera, gl.domElement]} />
   ```

### Commands
```bash
npm install @react-three/fiber@latest @react-three/drei@latest @react-three/postprocessing@latest
```

---

## Recommended Upgrade Order

1. **Three.js** (0.170 → 0.182) - Lowest risk, minimal breaking changes
2. **React** (18 → 19) - Run codemods, test thoroughly
3. **React Three Fiber** (8 → 9) - Depends on React 19 compatibility
4. **Vite** (6 → 7) - Should be straightforward
5. **Tailwind CSS** (3 → 4) - Most invasive, do last

---

## Pre-Upgrade Checklist

- [ ] Ensure all tests pass on current versions
- [ ] Create a new git branch for upgrades
- [ ] Back up `package-lock.json`
- [ ] Review each library's full changelog
- [ ] Update one dependency at a time
- [ ] Run tests after each upgrade
- [ ] Check browser console for deprecation warnings

---

## Post-Upgrade Tasks

- [ ] Run full test suite: `npm test`
- [ ] Visual regression testing
- [ ] Performance benchmarking
- [ ] Update CI/CD if needed
- [ ] Update documentation

---

## Rollback Plan

If issues arise:
```bash
git checkout main -- package.json package-lock.json
npm install
```

---

## Risk Assessment

| Upgrade | Risk Level | Complexity | Estimated Impact |
|---------|------------|------------|------------------|
| Three.js | Low | Low | Minimal code changes |
| React 19 | Medium | Medium | TypeScript fixes, test updates |
| R3F v9 | Medium | Medium | Type definitions, extend usage |
| Vite 7 | Low | Low | Config review |
| Tailwind v4 | High | High | CSS rewrites, class renames |

---

## References

- [React 19 Upgrade Guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide)
- [Vite 7 Releases](https://vite.dev/releases)
- [Tailwind CSS v4 Upgrade Guide](https://tailwindcss.com/docs/upgrade-guide)
- [Three.js Migration Guide](https://github.com/mrdoob/three.js/wiki/Migration-Guide)
- [React Three Fiber v9 Migration](https://docs.pmnd.rs/react-three-fiber/tutorials/v9-migration-guide)
