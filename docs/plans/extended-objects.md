# Implementation Plan: Extended N-Dimensional Objects

**PRD**: `docs/prd/extended-objects.md`
**Math Guide**: `docs/research/nd-extended-objects-guide.md`
**Scope**: 15 user stories, 4 object families, 118 acceptance criteria

---

## Overview

Add four new object families to the N-Dimensional Visualizer:
1. **Hypersphere** - Point cloud (surface/solid) with optional k-NN wireframe
2. **Root System** - A_{n-1}, D_n (n≥4), E8 (n=8) root polytopes
3. **Product Manifold** - Polytope products (Cube×Simplex) or Torus products ((S¹)^k)
4. **Clifford Torus** - Flat torus on S³ (requires n≥4)

---

## Phase 1: Type System & Store Foundation

### 1.1 Extend Type Definitions
**File**: `src/lib/geometry/types.ts`

```typescript
// Add to existing types
export type ExtendedObjectType = 'hypersphere' | 'root-system' | 'product-manifold' | 'clifford-torus';
export type ObjectType = PolytopeType | ExtendedObjectType;

export interface NdGeometry {
  dimension: number;
  type: ObjectType;
  vertices: VectorND[];
  edges: [number, number][];
  isPointCloud?: boolean;
  metadata?: GeometryMetadata;
}

// Type guards
export function isPolytopeType(type: ObjectType): type is PolytopeType;
export function isExtendedObjectType(type: ObjectType): type is ExtendedObjectType;
```

### 1.2 Create Extended Object Store
**File**: `src/stores/extendedObjectStore.ts` (NEW)

State shape:
- `hypersphere`: { mode, sampleCount, radius, wireframeEnabled, neighborCount }
- `rootSystem`: { rootType, scale, edgeMode }
- `productManifold`: { mode, shapeA, dimA, shapeB, torusCount, stepsPerTorus, radius }
- `cliffordTorus`: { radius, resolutionU, resolutionV, edgeMode }

### 1.3 Update Geometry Store
**File**: `src/stores/geometryStore.ts`

- Change `objectType: PolytopeType` → `objectType: ObjectType`
- Add dimension constraint validation on `setObjectType` and `setDimension`

---

## Phase 2: Geometry Generators

### 2.1 Directory Structure
```
src/lib/geometry/extended/          (NEW FOLDER)
├── index.ts                        # Re-exports
├── types.ts                        # Config interfaces
├── hypersphere.ts                  # Surface/solid sampling
├── root-system.ts                  # A, D, E8 generators
├── e8-roots.ts                     # E8 runtime algorithm
├── product-manifold.ts             # Polytope & torus products
├── clifford-torus.ts               # Clifford torus generator
└── utils/
    ├── knn-edges.ts                # k-nearest neighbor edges
    └── short-edges.ts              # Minimum distance edges
```

### 2.2 Hypersphere Generator
**File**: `src/lib/geometry/extended/hypersphere.ts`

```typescript
export function generateHypersphere(config: HypersphereConfig): NdGeometry;
// - Surface: Gaussian normalization (sample N(0,1), normalize to radius)
// - Solid: Surface × r where r = R × t^(1/n), t ~ U(0,1)
// - Optional: k-NN edges via buildKnnEdges()
```

### 2.3 Root System Generators
**File**: `src/lib/geometry/extended/root-system.ts`

```typescript
export function generateRootSystem(config: RootSystemConfig): NdGeometry;
export function generateARoots(dimension: number, scale: number): VectorND[];
// A_{n-1}: e_i - e_j for i ≠ j → n(n-1) roots

export function generateDRoots(dimension: number, scale: number): VectorND[];
// D_n: ±e_i ± e_j for i < j → 2n(n-1) roots (requires n≥4)

export function generateE8Roots(scale: number): VectorND[];
// 240 roots computed at runtime (see 2.4)
```

### 2.4 E8 Runtime Generation Algorithm
**File**: `src/lib/geometry/extended/e8-roots.ts`

E8 has exactly 240 roots:
1. **D8-style roots (112)**: ±e_i ± e_j for i < j (28 pairs × 4 signs)
2. **Half-integer roots (128)**: (±½)^8 with even number of minus signs

```typescript
export function generateE8Roots(scale: number = 1.0): VectorND[] {
  // Part 1: D8 roots (112 vectors)
  for (i < j): generate all 4 sign combinations of ±e_i ± e_j

  // Part 2: Half-integer roots (128 vectors)
  for (mask = 0..255): if popcount(mask) % 2 === 0: add (±½)^8 based on mask

  return roots; // 240 total
}
```

### 2.5 Product Manifold Generators
**File**: `src/lib/geometry/extended/product-manifold.ts`

```typescript
export function generateProductManifold(config: ProductManifoldConfig): NdGeometry;

// Polytope Product (P × Q):
// - Vertices: Cartesian product (p_i, q_j)
// - Edges: From P replicated across Q, and from Q replicated across P

// Torus Product ((S¹)^k):
// - x_{2j} = R_j cos(θ_j), x_{2j+1} = R_j sin(θ_j)
// - Grid sampling: stepsPerTorus^k points
```

### 2.6 Clifford Torus Generator
**File**: `src/lib/geometry/extended/clifford-torus.ts`

```typescript
export function generateCliffordTorus(config: CliffordTorusConfig): NdGeometry;
// x₁ = (R/√2)cos(u), x₂ = (R/√2)sin(u)
// x₃ = (R/√2)cos(v), x₄ = (R/√2)sin(v)
// Grid edges with wrap-around connectivity
```

### 2.7 Unified Dispatcher
**File**: `src/lib/geometry/index.ts` (MODIFY)

```typescript
export function generateGeometry(
  type: ObjectType,
  dimension: number,
  extendedParams?: ExtendedObjectParams
): NdGeometry;
```

---

## Phase 3: Rendering

### 3.1 Point Cloud Renderer
**File**: `src/components/canvas/PointCloudRenderer.tsx` (NEW)

```typescript
interface PointCloudRendererProps {
  points: Vector3D[];
  edges?: [number, number][];  // Optional wireframe
  color?: string;
  pointSize?: number;
  opacity?: number;
}
// Use THREE.Points with PointsMaterial (efficient for 10k+ points)
// Follow NativeWireframe.tsx pattern for buffer reuse
```

### 3.2 Scene Integration
**File**: `src/components/canvas/Scene.tsx` (MODIFY)

Add conditional rendering:
```typescript
{geometry.isPointCloud ? (
  <PointCloudRenderer points={projectedVertices} edges={edges} ... />
) : (
  <PolytopeRenderer vertices={projectedVertices} edges={edges} ... />
)}
```

### 3.3 Visual Store Extension
**File**: `src/stores/visualStore.ts` (MODIFY)

Add: `pointSize: number` (1-10, default: 3)

---

## Phase 4: UI Controls

### 4.1 Object Settings Section
**File**: `src/components/controls/ObjectSettingsSection.tsx` (NEW)

Conditionally renders based on objectType:
- hypersphere → HypersphereControls
- root-system → RootSystemControls
- product-manifold → ProductManifoldControls
- clifford-torus → CliffordTorusControls

### 4.2 Control Components (NEW FILES)
```
src/components/controls/
├── HypersphereControls.tsx      # mode, sampleCount, radius, wireframe, neighborCount
├── RootSystemControls.tsx       # rootType (with D/E8 dimension disabling), scale, edgeMode
├── ProductManifoldControls.tsx  # mode toggle, polytope config OR torus config
├── CliffordTorusControls.tsx    # radius, resolutionU, resolutionV, edgeMode
└── ObjectPropertiesPanel.tsx    # Display computed properties (vertex count, formulas)
```

### 4.3 Performance Warnings
Include in controls:
- Hypersphere: sampleCount > 5000 → "High sample counts may affect performance"
- Hypersphere wireframe: enabled + samples > 2000 → "Wireframe computation may take several seconds"
- Torus product: k ≥ 3 && steps > 16 → "Large point cloud warning"
- Clifford torus: resU × resV > 4096 → "High resolution warning"

### 4.4 Layout Integration
**File**: `src/components/Layout.tsx` (MODIFY)

Add after Object Geometry section:
```tsx
<ObjectSettingsSection />
<ObjectPropertiesPanel />
```

### 4.5 Object Type Selector Update
**File**: `src/components/controls/ObjectTypeSelector.tsx` (MODIFY)

- Add new object types to dropdown
- Add dimension-based disabling with tooltips:
  - Clifford Torus: disabled if dimension < 4

---

## Phase 5: Integration & Wiring

### 5.1 App.tsx Integration
**File**: `src/App.tsx` (MODIFY)

```typescript
// Get extended params from store
const extendedParams = useExtendedObjectStore(...);

// Use unified generator
const geometry = useMemo(() => {
  return generateGeometry(objectType, dimension, extendedParams);
}, [objectType, dimension, extendedParams]);

// Existing rotation/projection pipeline works unchanged
```

### 5.2 URL State Serialization
**File**: `src/lib/url/state-serializer.ts` (MODIFY)

New URL parameters (only serialize non-defaults):
| Object | Params |
|--------|--------|
| Hypersphere | `hs_m`, `hs_n`, `hs_r`, `hs_w`, `hs_k` |
| Root System | `rs_t`, `rs_s`, `rs_e` |
| Product Manifold | `pm_m`, `pm_sa`, `pm_da`, `pm_sb`, `pm_st`, `pm_k` |
| Clifford Torus | `ct_r`, `ct_u`, `ct_v`, `ct_e` |

### 5.3 Dimension Constraint Handling
**File**: `src/lib/geometry/validation.ts` (NEW)

```typescript
export function validateObjectTypeForDimension(
  type: ObjectType,
  dimension: number,
  rootType?: RootSystemType
): { valid: boolean; fallbackType?: ObjectType; message?: string };
```

Constraints:
- Clifford Torus: n < 4 → switch to Hypercube with notification
- Root System E8: n ≠ 8 → switch to Type A with notification
- Root System D: n < 4 → switch to Type A with notification

### 5.4 Share Button Update
**File**: `src/components/ShareButton.tsx` (MODIFY)

Include extended object params in generateShareUrl() call.

---

## Phase 6: Testing

### 6.1 Unit Tests
```
src/tests/lib/geometry/extended/
├── hypersphere.test.ts
├── root-system.test.ts
├── e8-roots.test.ts
├── product-manifold.test.ts
└── clifford-torus.test.ts
```

Key test cases:
- Hypersphere: Correct point count, points on sphere (norm = R)
- E8: Exactly 240 roots generated
- Root counts: A_{n-1} = n(n-1), D_n = 2n(n-1)
- Clifford torus: Points satisfy x₁² + x₂² + x₃² + x₄² = R²

### 6.2 Integration Tests
- URL serialization round-trip
- Dimension constraint auto-switching
- Object type switching preserves rotation state

### 6.3 Playwright E2E Tests
```
scripts/playwright/extended-objects/
├── hypersphere.spec.ts
├── root-system.spec.ts
├── product-manifold.spec.ts
└── clifford-torus.spec.ts
```

---

## Implementation Order

| Order | Story | Description | Dependencies |
|-------|-------|-------------|--------------|
| 1 | - | Type system & store foundation | None |
| 2 | 1 | Hypersphere selection + basic generation | Phase 1 |
| 3 | 2-3 | Hypersphere config + wireframe | Story 1 |
| 4 | 4 | Root system selection | Phase 1 |
| 5 | 5-6 | Root system type config + edges | Story 4 |
| 6 | 7 | Product manifold selection | Phase 1 |
| 7 | 8-9 | Polytope product + torus product | Story 7 |
| 8 | 10 | Clifford torus selection | Phase 1 |
| 9 | 11 | Clifford torus config | Story 10 |
| 10 | 12 | Visual settings for point clouds | Stories 1,4,7,10 |
| 11 | 13 | Rotation for extended objects | Stories 1,4,7,10 |
| 12 | 14 | Properties panel | Stories 1,4,7,10 |
| 13 | 15 | Export/share URL | All above |

---

## Critical Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/geometry/types.ts` | MODIFY | Add ObjectType, NdGeometry, type guards |
| `src/stores/geometryStore.ts` | MODIFY | Accept ObjectType, add constraint validation |
| `src/stores/extendedObjectStore.ts` | NEW | All extended object parameters |
| `src/lib/geometry/extended/*.ts` | NEW | All generators |
| `src/components/canvas/PointCloudRenderer.tsx` | NEW | Point cloud rendering |
| `src/components/canvas/Scene.tsx` | MODIFY | Conditional point cloud rendering |
| `src/components/controls/*Controls.tsx` | NEW | Object-specific UI controls |
| `src/components/Layout.tsx` | MODIFY | Add ObjectSettingsSection |
| `src/lib/url/state-serializer.ts` | MODIFY | Extended param serialization |
| `src/App.tsx` | MODIFY | Wire unified generator |

---

## Estimated Complexity

- **New files**: ~15
- **Modified files**: ~10
- **New components**: 6 (PointCloudRenderer + 5 control components)
- **New store**: 1 (extendedObjectStore)
- **Generator functions**: ~12
