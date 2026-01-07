# API Reference for LLM Coding Agents

**Purpose**: Quick reference for Zustand stores and React hooks available in this codebase.

**When to Use**: When you need to interact with application state or use existing hooks.

## Zustand Stores Reference

All stores are exported from `@/stores` (or `@/stores/index.ts`).

### useGeometryStore

Manages dimension and object type for the visualizer.

```typescript
import { useGeometryStore } from '@/stores'

interface GeometryState {
  dimension: number              // 3-11
  objectType: ObjectType         // 'hypercube' | 'simplex' | 'mandelbulb' | ...
  setDimension: (dim: number) => void
  setObjectType: (type: ObjectType) => void
  loadGeometry: (dim: number, type: ObjectType) => void  // For scene loading
  reset: () => void
}

// Constants
MIN_DIMENSION = 3
MAX_DIMENSION = 11
DEFAULT_DIMENSION = 3
DEFAULT_OBJECT_TYPE = 'hypercube'
```

**Object Types**:
- Polytopes: `hypercube`, `simplex`, `cross-polytope`, `wythoff-polytope`, `root-system`
- Extended: `clifford-torus`, `nested-torus`
- Fractals: `mandelbulb`, `quaternion-julia`, `schroedinger`, `blackhole`

---

### useAnimationStore

Controls rotation animation playback.

```typescript
import { useAnimationStore } from '@/stores'

interface AnimationState {
  isPlaying: boolean
  speed: number                           // 0.1-10
  animatingPlanes: Set<string>           // e.g., 'XY', 'XZ', 'XW'
  accumulatedTime: number                 // For fractals
  play: () => void
  pause: () => void
  toggle: () => void
  setSpeed: (speed: number) => void
  togglePlane: (plane: string) => void
  setDimension: (dim: number) => void     // Filters invalid planes
  getRotationDelta: (deltaMs: number) => number
  updateAccumulatedTime: (delta: number) => void
  reset: () => void
}

// Constants
MIN_SPEED = 0.1
MAX_SPEED = 10
DEFAULT_SPEED = 1
BASE_ROTATION_RATE = 0.001
```

---

### useRotationStore

Stores rotation angles for each plane.

```typescript
import { useRotationStore } from '@/stores'

interface RotationState {
  rotations: Map<string, number>         // plane -> angle in radians
  setRotation: (plane: string, angle: number) => void
  updateRotations: (updates: Map<string, number>) => void
  setDimension: (dim: number) => void
  reset: () => void
}
```

---

### useTransformStore

Manages scale and translation.

```typescript
import { useTransformStore } from '@/stores'

interface TransformState {
  scale: number
  translation: { x: number; y: number; z: number }
  setScale: (scale: number) => void
  setTranslation: (t: { x: number; y: number; z: number }) => void
  setDimension: (dim: number) => void
  reset: () => void
}

// Constants
MIN_SCALE = 0.1
MAX_SCALE = 10
DEFAULT_SCALE = 1
SCALE_WARNING_LOW = 0.3
SCALE_WARNING_HIGH = 5
```

---

### useAppearanceStore

Controls visual appearance (faces, edges, colors).

```typescript
import { useAppearanceStore } from '@/stores'

interface AppearanceState {
  facesVisible: boolean
  edgesVisible: boolean
  verticesVisible: boolean
  facesOpacity: number                   // 0-1
  edgeThickness: number
  colorAlgorithm: ColorAlgorithm
  setFacesVisible: (v: boolean) => void
  setEdgesVisible: (v: boolean) => void
  setVerticesVisible: (v: boolean) => void
  setFacesOpacity: (o: number) => void
  setEdgeThickness: (t: number) => void
  setColorAlgorithm: (a: ColorAlgorithm) => void
  reset: () => void
}
```

---

### useLightingStore

Manages light configuration and shadows.

```typescript
import { useLightingStore } from '@/stores'

interface Light {
  id: string
  type: 'point' | 'directional' | 'spot'
  position: [number, number, number]
  color: string
  intensity: number
  enabled: boolean
  castShadow: boolean
}

interface LightingState {
  lights: Light[]
  ambientIntensity: number
  shadowsEnabled: boolean
  shadowQuality: 'low' | 'medium' | 'high' | 'ultra'
  addLight: (light: Omit<Light, 'id'>) => void
  removeLight: (id: string) => void
  updateLight: (id: string, updates: Partial<Light>) => void
  setShadowsEnabled: (enabled: boolean) => void
  setShadowQuality: (q: string) => void
  reset: () => void
}
```

---

### usePostProcessingStore

Controls post-processing effects.

```typescript
import { usePostProcessingStore } from '@/stores'

interface PostProcessingState {
  // Bloom
  bloomEnabled: boolean
  bloomIntensity: number
  bloomThreshold: number
  
  // SSAO
  ssaoEnabled: boolean
  ssaoIntensity: number
  ssaoRadius: number
  
  // SSR
  ssrEnabled: boolean
  ssrQuality: 'low' | 'medium' | 'high'
  
  // Gravity (black hole lensing)
  gravityEnabled: boolean
  
  // Tone mapping
  toneMappingMode: 'none' | 'aces' | 'reinhard' | 'cinematic'
  exposure: number
  
  // FXAA
  fxaaEnabled: boolean
  
  // Setters for each...
  setBloomEnabled: (enabled: boolean) => void
  setBloomIntensity: (i: number) => void
  // ... etc
  reset: () => void
}
```

---

### useEnvironmentStore

Manages environment settings (skybox, ground).

```typescript
import { useEnvironmentStore } from '@/stores'

interface EnvironmentState {
  skyboxPreset: string
  skyboxLoading: boolean
  groundVisible: boolean
  groundColor: string
  groundOpacity: number
  setSkyboxPreset: (preset: string) => void
  setSkyboxLoading: (loading: boolean) => void
  setGroundVisible: (v: boolean) => void
  setGroundColor: (c: string) => void
  setGroundOpacity: (o: number) => void
  reset: () => void
}
```

---

### usePerformanceStore

Controls quality and performance settings.

```typescript
import { usePerformanceStore } from '@/stores'

interface PerformanceState {
  qualityLevel: 'low' | 'medium' | 'high' | 'ultra'
  sceneTransitioning: boolean
  cameraTeleported: boolean
  refinementStage: RefinementStage
  setQualityLevel: (q: string) => void
  setSceneTransitioning: (t: boolean) => void
  setCameraTeleported: (t: boolean) => void
  reset: () => void
}

// Selectors
selectProgressiveRefinement(state)  // Returns current quality multiplier
selectTemporalReprojection(state)   // Returns temporal settings

// Quality helpers
getEffectiveSampleQuality(level)
getEffectiveShadowQuality(level)
getEffectiveSSRQuality(level)
```

---

### useCameraStore

Stores camera state.

```typescript
import { useCameraStore } from '@/stores'

interface CameraState {
  position: [number, number, number]
  target: [number, number, number]
  fov: number
  setPosition: (p: [number, number, number]) => void
  setTarget: (t: [number, number, number]) => void
  setFov: (fov: number) => void
  reset: () => void
}
```

---

### useLayoutStore

Manages UI layout state.

```typescript
import { useLayoutStore } from '@/stores'

interface LayoutState {
  sidebarWidth: number
  layoutMode: LayoutMode          // 'side-by-side' | 'stacked' | 'mobile'
  setSidebarWidth: (w: number) => void
  reset: () => void
}

// Constants
MIN_SIDEBAR_WIDTH = 280
MAX_SIDEBAR_WIDTH = 500
MIN_CANVAS_WIDTH = 400
SIDE_BY_SIDE_BREAKPOINT = 1024

// Helpers
getLayoutMode()
getDefaultSidebarWidth()
getMaxSidebarWidth()
```

---

### useUIStore

General UI state.

```typescript
import { useUIStore } from '@/stores'

interface UIState {
  sidebarOpen: boolean
  animationBias: number           // 0-1, affects plane animation speed distribution
  setSidebarOpen: (open: boolean) => void
  setAnimationBias: (bias: number) => void
  reset: () => void
}
```

---

### useExportStore

Manages export state.

```typescript
import { useExportStore } from '@/stores'

interface ExportState {
  isExporting: boolean
  exportProgress: number
  format: 'png' | 'jpg' | 'webp' | 'mp4' | 'webm'
  quality: number
  setExporting: (e: boolean) => void
  setExportProgress: (p: number) => void
  setFormat: (f: string) => void
  setQuality: (q: number) => void
  reset: () => void
}
```

---

### useThemeStore

Theme settings (light/dark, accent color).

```typescript
import { useThemeStore } from '@/stores'

type ThemeMode = 'light' | 'dark' | 'system'
type ThemeAccent = 'cyan' | 'purple' | 'green' | 'orange' | 'pink'

interface ThemeState {
  mode: ThemeMode
  accent: ThemeAccent
  setMode: (mode: ThemeMode) => void
  setAccent: (accent: ThemeAccent) => void
}
```

---

### useExtendedObjectStore

Parameters for extended objects (fractals, tori).

```typescript
import { useExtendedObjectStore } from '@/stores'

interface ExtendedObjectState {
  // Mandelbulb
  mandelbulbPower: number
  mandelbulbIterations: number
  
  // Quaternion Julia
  juliaC: [number, number, number, number]
  juliaIterations: number
  
  // Schroedinger
  schroedingerN: number
  schroedingerL: number
  schroedingerM: number
  
  // Black Hole
  blackholeSpinParameter: number
  blackholeMass: number
  
  // Clifford Torus
  cliffordMajorRadius: number
  cliffordMinorRadius: number
  
  // Nested Torus
  nestedTorusLayers: number
  
  // Setters...
  setMandelbulbPower: (p: number) => void
  // ... etc
  reset: () => void
}
```

---

### usePBRStore

PBR material settings.

```typescript
import { usePBRStore } from '@/stores'

interface PBRState {
  roughness: number              // 0-1
  metalness: number              // 0-1
  clearcoat: number              // 0-1
  clearcoatRoughness: number     // 0-1
  setRoughness: (r: number) => void
  setMetalness: (m: number) => void
  setClearcoat: (c: number) => void
  setClearcoatRoughness: (cr: number) => void
  reset: () => void
}
```

---

### useMsgBoxStore

Modal dialog management.

```typescript
import { useMsgBoxStore } from '@/stores'

interface MsgBoxButton {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'danger'
}

interface MsgBoxState {
  isOpen: boolean
  title: string
  message: string
  type: 'info' | 'warning' | 'error' | 'success'
  buttons: MsgBoxButton[]
  showMsgBox: (title: string, message: string, type?: string, buttons?: MsgBoxButton[]) => void
  closeMsgBox: () => void
}
```

---

### useRendererStore

Renderer backend selection.

```typescript
import { useRendererStore } from '@/stores'

type RendererBackendType = 'webgl' | 'webgpu'

interface RendererState {
  backend: RendererBackendType
  setBackend: (b: RendererBackendType) => void
}
```

---

### useDismissedDialogsStore

Tracks dismissed "don't show again" dialogs.

```typescript
import { useDismissedDialogsStore, DIALOG_IDS } from '@/stores'

interface DismissedDialogsState {
  dismissedDialogs: Set<string>
  dismiss: (id: string) => void
  isDismissed: (id: string) => boolean
  reset: () => void
}

// Available dialog IDs
DIALOG_IDS.WEBGPU_EXPERIMENTAL
DIALOG_IDS.FIRST_TIME_HELP
// ... etc
```

---

## React Hooks Reference

All hooks are in `src/hooks/`.

### useAnimationLoop

Integrates rotation animation with R3F's frame system.

```typescript
import { useAnimationLoop } from '@/hooks/useAnimationLoop'

// In a component inside R3F Canvas
function AnimationController() {
  useAnimationLoop()  // Registers with useFrame at ANIMATION priority
  return null
}
```

---

### useGeometryGenerator

Generates geometry based on current object type and dimension.

```typescript
import { useGeometryGenerator } from '@/hooks/useGeometryGenerator'

function MyComponent() {
  const { vertices, edges, faces, loading, error } = useGeometryGenerator()
  
  if (loading) return <LoadingSpinner />
  if (error) return <ErrorMessage error={error} />
  
  return <Renderer vertices={vertices} edges={edges} />
}
```

---

### useGeometryWorker

Offloads geometry computation to a Web Worker.

```typescript
import { useGeometryWorker } from '@/hooks/useGeometryWorker'

function MyComponent() {
  const { result, loading, compute } = useGeometryWorker()
  
  useEffect(() => {
    compute({ dimension: 5, objectType: 'hypercube' })
  }, [compute])
  
  return result ? <Renderer data={result} /> : <Loading />
}
```

---

### useTransformedVertices

Transforms ND vertices to 3D with current rotation and projection.

```typescript
import { useTransformedVertices } from '@/hooks/useTransformedVertices'

function MyComponent() {
  const transformed = useTransformedVertices(vertices4D)
  // transformed is Float32Array of 3D positions
}
```

---

### useCameraMovement

Camera orbit/pan/zoom controls.

```typescript
import { useCameraMovement } from '@/hooks/useCameraMovement'

function CameraController() {
  useCameraMovement()  // Registers mouse/touch handlers
  return null
}
```

---

### useCameraReset

Provides camera reset functionality.

```typescript
import { useCameraReset } from '@/hooks/useCameraReset'

function MyComponent() {
  const { resetCamera, isResetting } = useCameraReset()
  
  return (
    <Button onClick={resetCamera} disabled={isResetting}>
      Reset Camera
    </Button>
  )
}
```

---

### useKeyboardShortcuts

Registers global keyboard shortcuts.

```typescript
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

function App() {
  useKeyboardShortcuts()  // Registers Space, R, +/-, etc.
  return <Layout />
}
```

---

### useMediaQuery

Responsive breakpoint detection.

```typescript
import { useMediaQuery } from '@/hooks/useMediaQuery'

function MyComponent() {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  
  return isMobile ? <MobileLayout /> : <DesktopLayout />
}
```

---

### useDeviceCapabilities

Detects GPU and device capabilities.

```typescript
import { useDeviceCapabilities } from '@/hooks/useDeviceCapabilities'

function MyComponent() {
  const { tier, isMobile, fps, gpu } = useDeviceCapabilities()
  
  // tier: 1 (low), 2 (medium), 3 (high)
  // Adjust quality based on tier
}
```

---

### useInteractionState

Tracks user interaction for progressive refinement.

```typescript
import { useInteractionState } from '@/hooks/useInteractionState'

function MyComponent() {
  const { isInteracting, lastInteractionTime } = useInteractionState()
  
  // Reduce quality while isInteracting is true
}
```

---

### useSmoothResizing

Handles canvas resize with debouncing.

```typescript
import { useSmoothResizing } from '@/hooks/useSmoothResizing'

function Canvas() {
  const { width, height, isResizing } = useSmoothResizing()
  
  return <canvas width={width} height={height} />
}
```

---

### useRendererBackend

Manages WebGL/WebGPU backend selection.

```typescript
import { useRendererBackend } from '@/hooks/useRendererBackend'

function MyComponent() {
  const { backend, setBackend, isWebGPUAvailable } = useRendererBackend()
  
  return (
    <Select
      value={backend}
      onChange={setBackend}
      options={[
        { value: 'webgl', label: 'WebGL' },
        { value: 'webgpu', label: 'WebGPU', disabled: !isWebGPUAvailable },
      ]}
    />
  )
}
```

---

### useProgressiveRefinement

Implements progressive quality refinement after interaction.

```typescript
import { useProgressiveRefinement } from '@/hooks/useProgressiveRefinement'

function RenderController() {
  useProgressiveRefinement()  // Manages refinement stages
  return null
}
```

---

### useToast

Shows toast notifications.

```typescript
import { useToast } from '@/hooks/useToast'

function MyComponent() {
  const { showToast } = useToast()
  
  const handleSave = () => {
    // ... save logic
    showToast('Saved successfully!', 'success')
  }
}
```

---

### useSyncedDimension

Syncs dimension across stores when it changes.

```typescript
import { useSyncedDimension } from '@/hooks/useSyncedDimension'

function App() {
  useSyncedDimension()  // Keeps animation, rotation, transform stores in sync
  return <Layout />
}
```

---

### useFaceDetection

Detects visible faces for rendering.

```typescript
import { useFaceDetection } from '@/hooks/useFaceDetection'

function Renderer() {
  const { visibleFaces, faceCount } = useFaceDetection(faces, cameraPosition)
  
  return <FaceRenderer faces={visibleFaces} />
}
```

---

### useFaceDepths

Computes face depths for sorting.

```typescript
import { useFaceDepths } from '@/hooks/useFaceDepths'

function Renderer() {
  const depths = useFaceDepths(faces, cameraPosition)
  const sortedFaces = useMemo(() => 
    [...faces].sort((a, b) => depths[b.id] - depths[a.id]),
    [faces, depths]
  )
}
```

---

### useUrlState

Syncs state with URL parameters.

```typescript
import { useUrlState } from '@/hooks/useUrlState'

function App() {
  useUrlState()  // Syncs dimension, objectType, etc. with URL
  return <Layout />
}
```

---

### useWebGLCleanup

Handles WebGL context cleanup on unmount.

```typescript
import { useWebGLCleanup } from '@/hooks/useWebGLCleanup'

function Canvas() {
  useWebGLCleanup()  // Disposes resources on unmount
  return <canvas />
}
```

---

### useConditionalMsgBox

Shows message boxes with "don't show again" option.

```typescript
import { useConditionalMsgBox } from '@/hooks/useConditionalMsgBox'

function MyComponent() {
  const { showConditionalMsgBox } = useConditionalMsgBox()
  
  const handleWarning = () => {
    showConditionalMsgBox(
      'warning-dialog-id',
      'Warning',
      'This action cannot be undone.',
      'warning'
    )
  }
}
```

---

### useViewportOffset

Calculates viewport offset for UI elements.

```typescript
import { useViewportOffset } from '@/hooks/useViewportOffset'

function Overlay() {
  const { offsetX, offsetY } = useViewportOffset()
  
  return (
    <div style={{ transform: `translate(${offsetX}px, ${offsetY}px)` }}>
      Overlay content
    </div>
  )
}
```

---

### usePanelCollision

Detects panel overlaps for layout adjustments.

```typescript
import { usePanelCollision } from '@/hooks/usePanelCollision'

function Layout() {
  const { hasCollision, adjustedWidth } = usePanelCollision(panelRef)
  
  return <Panel width={hasCollision ? adjustedWidth : defaultWidth} />
}
```

---

### useDynamicFavicon

Updates favicon based on current object type.

```typescript
import { useDynamicFavicon } from '@/hooks/useDynamicFavicon'

function App() {
  useDynamicFavicon()  // Changes favicon when objectType changes
  return <Layout />
}
```

---

### useKonamiCode

Easter egg: detects Konami code input.

```typescript
import { useKonamiCode } from '@/hooks/useKonamiCode'

function App() {
  const konamiActivated = useKonamiCode()
  
  return konamiActivated ? <SecretFeature /> : <NormalApp />
}
```

---

## Frame Priorities

When using `useFrame`, use these priorities from `@/rendering/core/framePriorities`:

```typescript
import { FRAME_PRIORITY } from '@/rendering/core/framePriorities'

FRAME_PRIORITY.ANIMATION  // 100 - Animation updates
FRAME_PRIORITY.CAMERA     // 200 - Camera controls
FRAME_PRIORITY.RENDER     // 300 - Render updates
```

Higher numbers run earlier in the frame.

---

## Utility Functions

### Geometry Registry

```typescript
import { 
  isValidObjectType,
  isAvailableForDimension,
  getRecommendedDimension,
  getUnavailabilityReason,
  isRaymarchingFractal
} from '@/lib/geometry/registry'

// Check if type is valid
isValidObjectType('hypercube')  // true

// Check if type works for dimension
isAvailableForDimension('mandelbulb', 3)  // true

// Get recommended dimension for type
getRecommendedDimension('mandelbulb')  // 3

// Check if type uses raymarching
isRaymarchingFractal('mandelbulb', 3)  // true
```

### Math Utilities

```typescript
import { 
  createRotationMatrix,
  projectToLowerDimension,
  normalizeVector,
  dotProduct
} from '@/lib/math'
```

### Color Utilities

```typescript
import { 
  hexToRgb,
  rgbToHex,
  oklchToRgb,
  generatePalette
} from '@/lib/colors/colorUtils'
```
