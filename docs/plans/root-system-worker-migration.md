# Plan: Migrate Root-System Generation to Web Worker

**Status**: Completed  
**Created**: 2024-12-25  
**Objective**: Move root-system geometry generation to Web Worker for consistency with Wythoff polytopes

## Problem Statement

Currently, root-system geometry is generated synchronously on the main thread, while Wythoff polytopes use the Web Worker. This inconsistency:
- Creates cognitive overhead for maintainers
- May cause UI jank for high-dimensional root systems (E8 has 240 vertices)
- Breaks the pattern that "complex geometry = worker"

## Current Architecture

```
Wythoff:     useGeometryGenerator → Worker → generateWythoffPolytope → TransferablePolytopeGeometry
Root-System: useGeometryGenerator → generateRootSystem (sync) → metadata faces read (sync)
```

## Target Architecture

```
Wythoff:     useGeometryGenerator → Worker → generateWythoffPolytope → TransferableGeometry
Root-System: useGeometryGenerator → Worker → generateRootSystem      → TransferableGeometry
```

## Implementation Plan

### Task 1: Update Worker Types

**File**: `src/workers/types.ts`

1.1. Create `GenerateRootSystemRequest`:
```typescript
export interface GenerateRootSystemRequest {
  type: 'generate-root-system'
  id: string
  dimension: number
  config: RootSystemConfig
}
```

1.2. Update `WorkerRequest` union to include `GenerateRootSystemRequest`

1.3. Add type guard `isGenerateRootSystemRequest`

1.4. Update `TransferablePolytopeGeometry.type` from `PolytopeType` to `ObjectType`:
```typescript
// Before
type: PolytopeType

// After  
type: ObjectType
```

1.5. Add optional `faces` field for pre-computed faces:
```typescript
/** Pre-computed face indices [f0_v0, f0_v1, f0_v2, f1_v0, ...] (optional) */
faces?: Uint32Array
```

### Task 2: Update Transfer Utilities

**File**: `src/lib/geometry/transfer.ts`

2.1. Import `ObjectType` instead of just `PolytopeType`

2.2. Update `TransferablePolytopeGeometry.type` to use `ObjectType`

2.3. Add faces flattening in `flattenGeometry`:
```typescript
// Extract pre-computed faces from metadata
const analyticalFaces = metadata?.properties?.analyticalFaces as number[][] | undefined
if (analyticalFaces && analyticalFaces.length > 0) {
  const flatFaces = new Uint32Array(analyticalFaces.length * 3)
  for (let i = 0; i < analyticalFaces.length; i++) {
    flatFaces[i * 3] = analyticalFaces[i][0]
    flatFaces[i * 3 + 1] = analyticalFaces[i][1]
    flatFaces[i * 3 + 2] = analyticalFaces[i][2]
  }
  transferable.faces = flatFaces
  buffers.push(flatFaces.buffer)
}
```

2.4. Add faces inflation in `inflateGeometry`:
```typescript
// Reconstruct faces if present
if (flatFaces && flatFaces.length > 0) {
  const faceCount = flatFaces.length / 3
  const analyticalFaces = new Array(faceCount)
  for (let i = 0; i < faceCount; i++) {
    analyticalFaces[i] = [flatFaces[i * 3], flatFaces[i * 3 + 1], flatFaces[i * 3 + 2]]
  }
  // Store in metadata.properties.analyticalFaces
}
```

### Task 3: Add Worker Handler

**File**: `src/workers/geometry.worker.ts`

3.1. Import `generateRootSystem` function

3.2. Add `handleRootSystemGeneration` function:
```typescript
function handleRootSystemGeneration(request: GenerateRootSystemRequest): void {
  const { id, dimension, config } = request
  
  activeRequests.add(id)
  
  try {
    sendProgress(id, 0, 'initializing')
    
    if (!activeRequests.has(id)) return
    
    sendProgress(id, 10, 'vertices')
    
    // Generate root system with faces
    const geometry = generateRootSystem(dimension, config.rootType, config.scale)
    
    if (!activeRequests.has(id)) return
    
    sendProgress(id, 60, 'edges')
    
    // Flatten for transfer
    const { transferable, buffers } = flattenGeometry({
      ...geometry,
      type: 'root-system' as any // Cast needed during transition
    })
    
    if (!activeRequests.has(id)) return
    
    sendProgress(id, 100, 'complete')
    
    const response: ResultResponse = {
      type: 'result',
      id,
      geometry: transferable,
    }
    
    activeRequests.delete(id)
    self.postMessage(response, { transfer: buffers })
  } catch (error) {
    activeRequests.delete(id)
    sendError(id, error instanceof Error ? error.message : String(error))
  }
}
```

3.3. Update message handler switch to dispatch to new handler:
```typescript
case 'generate-root-system':
  handleRootSystemGeneration(request)
  break
```

### Task 4: Update useGeometryGenerator Hook

**File**: `src/hooks/useGeometryGenerator.ts`

4.1. Import `RootSystemConfig` type

4.2. Add `rootSystemConfig` to hook dependencies (from store)

4.3. Create `generateRootSystemAsync` function following `generateWythoffAsync` pattern:
```typescript
const generateRootSystemAsync = useCallback(async () => {
  if (currentRequestId.current) {
    cancelRequest(currentRequestId.current)
  }

  const requestId = generateRequestId('root-system')
  currentRequestId.current = requestId

  setIsLoading(true)
  setProgress(0)
  setStage('initializing')
  setWarnings([])

  try {
    const response = await sendRequest(
      {
        type: 'generate-root-system',
        id: requestId,
        dimension,
        config: rootSystemConfig,
      },
      (prog, stg) => {
        if (currentRequestId.current === requestId) {
          setProgress(prog)
          setStage(stg)
        }
      }
    )

    if (currentRequestId.current !== requestId) {
      setIsLoading(false)
      return
    }

    if (response.type === 'cancelled') {
      setIsLoading(false)
      return
    }

    if (response.type === 'result' && response.geometry) {
      const inflated = inflateGeometry(response.geometry)
      setAsyncGeometry({
        ...inflated,
        type: 'root-system',
      } as NdGeometry)
      setIsLoading(false)
    }
  } catch (err) {
    setIsLoading(false)
    // Fallback to sync generation
    if (currentRequestId.current === requestId) {
      try {
        const geometry = generateRootSystem(
          dimension,
          rootSystemConfig.rootType,
          rootSystemConfig.scale
        )
        setAsyncGeometry(geometry as NdGeometry)
      } catch (syncErr) {
        console.error('[useGeometryGenerator] Sync fallback error:', syncErr)
        setAsyncGeometry(null)
      }
    }
  } finally {
    if (currentRequestId.current === requestId) {
      currentRequestId.current = null
    }
  }
}, [dimension, rootSystemConfig, sendRequest, cancelRequest])
```

4.4. Update the effect that triggers generation:
```typescript
useEffect(() => {
  if (objectType === 'wythoff-polytope') {
    generateWythoffAsync()
  } else if (objectType === 'root-system') {
    generateRootSystemAsync()
  }
}, [objectType, dimension, wythoffPolytopeConfig, rootSystemConfig, ...])
```

4.5. Update the reset effect to also handle root-system:
```typescript
useEffect(() => {
  if (objectType !== 'wythoff-polytope' && objectType !== 'root-system') {
    setAsyncGeometry(null)
    setIsLoading(false)
    // ...
  }
}, [objectType])
```

4.6. Update return value to use `asyncGeometry` for root-system:
```typescript
if (objectType === 'wythoff-polytope' || objectType === 'root-system') {
  return { geometry: asyncGeometry, isLoading, progress, stage, warnings }
}
```

### Task 5: Update Registry

**File**: `src/lib/geometry/registry/registry.ts`

Since faces are now pre-computed and transferred with geometry, the face detection method can remain `'metadata'` - no change needed. The faces will already be in `metadata.properties.analyticalFaces` after worker inflates the geometry.

### Task 6: Tests

6.1. **Worker request/response types** (`src/tests/workers/types.test.ts`):
- Test `GenerateRootSystemRequest` serialization
- Test `isGenerateRootSystemRequest` type guard

6.2. **Transfer utilities** (`src/tests/lib/geometry/transfer.test.ts`):
- Test faces flattening/inflation
- Test extended type handling

6.3. **Worker handler** (`src/tests/workers/geometry.worker.test.ts`):
- Test root-system generation request/response
- Test cancellation handling
- Test error handling

6.4. **Hook integration** (`src/tests/hooks/useGeometryGenerator.test.tsx`):
- Test root-system async generation
- Test fallback behavior
- Test loading states

6.5. **E2E Playwright test** (`scripts/playwright/root-system-worker.mjs`):
- Navigate to app, select root-system
- Verify geometry renders correctly
- Verify no main thread blocking

## Testing Strategy

1. **Unit tests first** - Validate types, transfer, and worker handler in isolation
2. **Integration tests** - Validate hook behavior with mocked worker
3. **E2E tests** - Validate full user flow with Playwright

## Rollback Plan

If issues arise, revert to sync generation by:
1. Keeping the worker code in place but disabled
2. Adding a feature flag `USE_WORKER_ROOT_SYSTEM` to toggle between paths

## Success Criteria

- [ ] All 5 tasks implemented
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Playwright E2E test passes
- [ ] No regressions in existing tests
- [ ] UI remains responsive during E8 root system generation

## Dependencies

None - all required infrastructure exists from Wythoff implementation.

## Estimated Effort

- Task 1: 20 minutes
- Task 2: 30 minutes  
- Task 3: 30 minutes
- Task 4: 45 minutes
- Task 5: N/A (no changes needed)
- Task 6: 60 minutes

**Total**: ~3 hours

