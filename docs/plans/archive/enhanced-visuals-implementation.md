# Enhanced Visuals & Rendering Pipeline - Implementation Plan

## Overview

This plan covers the implementation of 8 user stories from `docs/prd/enhanced-visuals-rendering-pipeline.md`, adapting techniques from the MultiScoper C++ OpenGL rendering pipeline to Three.js/React Three Fiber.

**Reference Codebase Insights:**
- `BloomEffect.cpp`: Jimenez dual-filter bloom with 6 mip levels, Karis average, 13-tap downsample, 9-tap tent upsample
- `NeonGlowShader.cpp`: Additive blending (GL_ONE, GL_ONE), geometry expansion for glow tail
- `WireframeMeshShader.cpp`: Depth-based fade with `depthFade = 1.0 - vDepth * 0.4`
- `EffectChain.cpp`: Ping-pong framebuffer architecture for post-processing

---

## Phase 1: Foundation (Stories 1, 5, 6)

### 1.1 Extend Visual Store

**File:** `src/stores/visualStore.ts`

Add new state fields:

```typescript
// Shader System
shaderType: ShaderType; // 'wireframe' | 'neonGlow' | 'gradientFill' | 'dualOutline' | 'surface'

// Bloom Post-Processing
bloomEnabled: boolean;
bloomIntensity: number; // 0-2, default 1.0
bloomThreshold: number; // 0-1, default 0.8
bloomRadius: number; // 0-1, default 0.4

// Lighting
lightEnabled: boolean;
lightColor: string; // hex
lightHorizontalAngle: number; // 0-360
lightVerticalAngle: number; // -90 to 90
ambientIntensity: number; // 0-1
specularIntensity: number; // 0-2
specularPower: number; // 1-128

// Face Rendering
faceColor: string; // hex
faceOpacity: number; // 0-1 (already exists)

// Depth Effects
depthAttenuationEnabled: boolean;
depthAttenuationStrength: number; // 0-0.5
fresnelEnabled: boolean;
fresnelIntensity: number; // 0-1
perDimensionColorEnabled: boolean;

// Per-Shader Settings
shaderSettings: {
  wireframe: WireframeSettings;
  neonGlow: NeonGlowSettings;
  gradientFill: GradientFillSettings;
  dualOutline: DualOutlineSettings;
  surface: SurfaceSettings;
};
```

### 1.2 Create Shader Type System

**File:** `src/lib/shaders/types.ts`

```typescript
export type ShaderType = 'wireframe' | 'neonGlow' | 'gradientFill' | 'dualOutline' | 'surface';

export interface WireframeSettings {
  lineThickness: number; // 1-5 pixels
}

export interface NeonGlowSettings {
  glowIntensity: number; // 0-200%
  glowColor: string; // hex, separate from edge color
}

export interface GradientFillSettings {
  startColor: string;
  endColor: string;
  direction: 'alongEdge' | 'radialFromCenter';
}

export interface DualOutlineSettings {
  innerColor: string;
  outerColor: string;
  gap: number; // 1-5 pixels
}

export interface SurfaceSettings {
  faceOpacity: number; // 0-100%
  specularIntensity: number; // 0-200%
  specularPower: number; // 1-128
  fresnelEnabled: boolean;
}

export const SHADER_DEFAULTS: Record<ShaderType, object> = {
  wireframe: { lineThickness: 2 },
  neonGlow: { glowIntensity: 1.0, glowColor: '#00FFFF' },
  gradientFill: { startColor: '#00FFFF', endColor: '#FF00FF', direction: 'alongEdge' },
  dualOutline: { innerColor: '#FFFFFF', outerColor: '#00FFFF', gap: 2 },
  surface: { faceOpacity: 0.8, specularIntensity: 1.0, specularPower: 32, fresnelEnabled: true }
};
```

### 1.3 Create Shader Selector UI

**File:** `src/components/controls/ShaderSelector.tsx`

- Dropdown with shader options: Wireframe, Neon Glow, Gradient Fill, Dual Outline, Surface
- Icons/previews for each option
- Connects to visualStore.setShaderType

### 1.4 Update Color Palettes

**File:** `src/stores/visualStore.ts` - Extend VISUAL_PRESETS

Add `synthwave` preset:
```typescript
synthwave: {
  edgeColor: '#FF00FF',
  edgeThickness: 2,
  vertexColor: '#00FFFF',
  vertexSize: 4,
  backgroundColor: '#1A0A2E',
  faceColor: '#8800FF',
}
```

---

## Phase 2: Surface Shader & Faces (Story 2, 7)

### 2.1 Face Detection Algorithm

**File:** `src/lib/geometry/faces.ts`

Algorithm to detect 2D faces from edge list:
1. Build adjacency graph from edges
2. For each edge, find cycles of length 3-4 that form closed polygons
3. Return face definitions as vertex index arrays

```typescript
export interface Face {
  vertices: number[]; // vertex indices (3 for triangle, 4 for quad)
  normal?: Vector3D; // computed normal
}

export function detectFaces(
  vertices: Vector3D[],
  edges: [number, number][],
  objectType: 'hypercube' | 'simplex' | 'crossPolytope'
): Face[];
```

**Special cases:**
- Hypercube: All faces are quads (4 vertices)
- Simplex: All faces are triangles (3 vertices)
- Cross-polytope: All faces are triangles

### 2.2 Face Renderer Component

**File:** `src/components/canvas/FaceRenderer.tsx`

```typescript
interface FaceRendererProps {
  vertices: Vector3D[];
  faces: Face[];
  color: string;
  opacity: number;
  lighting: LightingConfig;
}
```

- Uses BufferGeometry with indexed triangles
- Triangulates quads into 2 triangles
- Computes normals per-face for lighting
- MeshPhongMaterial or custom ShaderMaterial
- `side: THREE.DoubleSide` for n-dimensional objects

### 2.3 Surface Material Implementation

**File:** `src/lib/shaders/materials/SurfaceMaterial.ts`

Three.js approach:
```typescript
import { MeshPhongMaterial, DoubleSide } from 'three';

export function createSurfaceMaterial(config: SurfaceSettings & { color: string }) {
  return new MeshPhongMaterial({
    color: config.color,
    transparent: true,
    opacity: config.faceOpacity,
    side: DoubleSide,
    shininess: config.specularPower,
    specular: new Color(0xffffff).multiplyScalar(config.specularIntensity),
  });
}
```

For Fresnel, use custom ShaderMaterial with:
```glsl
// Fragment shader
float fresnel = pow(1.0 - abs(dot(vNormal, vViewDir)), 3.0);
vec3 fresnelColor = mix(baseColor, rimColor, fresnel * fresnelIntensity);
```

### 2.4 Per-Shader Settings UI

**File:** `src/components/controls/ShaderSettings.tsx`

Conditionally renders controls based on selected shader:
- Shows relevant sliders/pickers for current shader type
- Collapsible subsection in Visuals panel

---

## Phase 3: Bloom Post-Processing (Story 3)

### 3.1 Add Dependencies

```bash
npm install @react-three/postprocessing postprocessing
```

### 3.2 PostProcessing Component

**File:** `src/components/canvas/PostProcessing.tsx`

```typescript
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useVisualStore } from '@/stores/visualStore';

export function PostProcessing() {
  const { bloomEnabled, bloomIntensity, bloomThreshold, bloomRadius } = useVisualStore();

  if (!bloomEnabled) return null;

  return (
    <EffectComposer>
      <Bloom
        intensity={bloomIntensity}
        luminanceThreshold={bloomThreshold}
        luminanceSmoothing={0.9}
        radius={bloomRadius}
      />
    </EffectComposer>
  );
}
```

### 3.3 Bloom Controls UI

**File:** `src/components/controls/BloomControls.tsx`

- Toggle: Enable/Disable Bloom
- Slider: Intensity (0% - 200%)
- Slider: Threshold (0.0 - 1.0)
- Slider: Radius/Spread (0.0 - 1.0)

### 3.4 Integration with App.tsx

Add PostProcessing inside Canvas, after Scene component.

---

## Phase 4: Lighting System (Story 4)

### 4.1 Scene Lighting Component

**File:** `src/components/canvas/SceneLighting.tsx`

```typescript
export function SceneLighting() {
  const {
    lightEnabled,
    lightColor,
    lightHorizontalAngle,
    lightVerticalAngle,
    ambientIntensity,
  } = useVisualStore();

  // Convert spherical to cartesian
  const lightPosition = useMemo(() => {
    const h = (lightHorizontalAngle * Math.PI) / 180;
    const v = (lightVerticalAngle * Math.PI) / 180;
    const distance = 10;
    return [
      Math.cos(v) * Math.cos(h) * distance,
      Math.sin(v) * distance,
      Math.cos(v) * Math.sin(h) * distance,
    ] as [number, number, number];
  }, [lightHorizontalAngle, lightVerticalAngle]);

  return (
    <>
      <ambientLight intensity={ambientIntensity} />
      {lightEnabled && (
        <directionalLight
          position={lightPosition}
          color={lightColor}
          intensity={1.0}
        />
      )}
    </>
  );
}
```

### 4.2 Lighting Controls UI

**File:** `src/components/controls/LightingControls.tsx`

- Toggle: Light On/Off
- Color Picker: Light Color
- Slider: Horizontal Angle (0° - 360°)
- Slider: Vertical Angle (-90° - 90°)
- Slider: Ambient Intensity (0% - 100%)
- Slider: Specular Intensity (0% - 200%)
- Slider: Specular Power (1 - 128)
- Toggle: Show Light Indicator

**Visibility:** Only shown when Surface shader is selected.

### 4.3 Light Direction Indicator

Optional small arrow/sphere in scene showing light direction.

---

## Phase 5: Advanced Shaders (Story 7 continued)

### 5.1 Neon Glow Material

**File:** `src/lib/shaders/materials/NeonGlowMaterial.ts`

Inspired by C++ `NeonGlowShader.cpp`:

```typescript
// Custom ShaderMaterial with:
// - Additive blending: blending: THREE.AdditiveBlending
// - Geometry expansion in vertex shader for glow halo
// - Distance-based falloff in fragment shader

const vertexShader = `
  attribute float distFromCenter;
  varying float vDistFromCenter;

  void main() {
    vDistFromCenter = distFromCenter;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform vec3 baseColor;
  uniform vec3 glowColor;
  uniform float glowIntensity;
  uniform float opacity;

  varying float vDistFromCenter;

  void main() {
    float glow = exp(-vDistFromCenter * 3.0) * glowIntensity;
    vec3 color = mix(glowColor, baseColor, vDistFromCenter);
    gl_FragColor = vec4(color * (1.0 + glow), opacity);
  }
`;
```

### 5.2 Gradient Fill Material

**File:** `src/lib/shaders/materials/GradientFillMaterial.ts`

- Pass `vParam` (0-1) along edge length
- Lerp between startColor and endColor in fragment shader
- Support radial mode using distance from centroid

### 5.3 Dual Outline Material

**File:** `src/lib/shaders/materials/DualOutlineMaterial.ts`

- Render edges twice with offset
- First pass: outer color, thicker line
- Second pass: inner color, thinner line

---

## Phase 6: Depth-Based Effects (Story 8)

### 6.1 Depth Attenuation

**File:** `src/lib/shaders/glsl/depth-attenuation.glsl`

Shared GLSL logic (adapted from C++ `WireframeMeshShader`):

```glsl
// Vertex shader: compute depth
varying float vDepth;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mvPosition.z / 10.0; // Normalize to 0-1 range
  vDepth = clamp(vDepth, 0.0, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}

// Fragment shader: apply fade
float depthFade = 1.0 - vDepth * depthAttenuationStrength;
depthFade = max(depthFade, 0.5); // Minimum visibility
float finalAlpha = baseAlpha * depthFade;
```

### 6.2 Fresnel Rim Lighting

**File:** `src/lib/shaders/glsl/fresnel.glsl`

```glsl
// For edges: approximate using edge tangent vs view direction
varying vec3 vViewDir;
varying vec3 vTangent;

// Fragment shader
float fresnel = pow(1.0 - abs(dot(normalize(vViewDir), normalize(vTangent))), 2.0);
vec3 rimColor = vec3(1.0); // White rim
vec3 finalColor = mix(baseColor, rimColor, fresnel * fresnelIntensity);
```

### 6.3 Per-Dimension Color Coding

**File:** `src/lib/shaders/dimensionColors.ts`

```typescript
// Map dimension index to hue
export function getDimensionColor(dimIndex: number, totalDims: number): string {
  const hue = (dimIndex / totalDims) * 360;
  return `hsl(${hue}, 80%, 60%)`;
}

// Edge belongs to dimensions based on which coordinates differ
export function getEdgeDimensions(
  v1: number[],
  v2: number[]
): number[] {
  return v1.map((val, i) => val !== v2[i] ? i : -1).filter(i => i >= 0);
}
```

---

## Phase 7: Integration & Polish

### 7.1 Update PolytopeRenderer

Modify to use shader-based rendering:

```typescript
export function PolytopeRenderer({ vertices, edges, faces }: Props) {
  const { shaderType, shaderSettings } = useVisualStore();

  return (
    <group>
      {/* Render based on shader type */}
      {shaderType === 'wireframe' && (
        <WireframeEdges vertices={vertices} edges={edges} />
      )}
      {shaderType === 'neonGlow' && (
        <NeonGlowEdges vertices={vertices} edges={edges} />
      )}
      {shaderType === 'surface' && (
        <>
          <SurfaceFaces vertices={vertices} faces={faces} />
          <WireframeEdges vertices={vertices} edges={edges} opacity={0.5} />
        </>
      )}
      {/* ... other shaders */}

      {showVertices && <VertexSpheres vertices={vertices} />}
    </group>
  );
}
```

### 7.2 URL State Serialization

**File:** `src/lib/url/state-serializer.ts`

Extend to include:
- `shader`: ShaderType
- `bloom`: "1" or "0" + encoded settings
- `light`: encoded lighting settings
- `depth`: depth/fresnel settings
- `ss`: shader-specific settings (compact encoding)

### 7.3 Update Scene Component

```typescript
export function Scene(props: SceneProps) {
  return (
    <>
      <SceneLighting />
      <CameraController autoRotate={props.autoRotate} />
      {props.showGrid && <Grid ... />}
      <PolytopeRenderer ... />
      <PostProcessing />
    </>
  );
}
```

---

## File Structure Summary

```
src/
├── lib/
│   ├── shaders/
│   │   ├── types.ts
│   │   ├── index.ts
│   │   ├── dimensionColors.ts
│   │   ├── materials/
│   │   │   ├── WireframeMaterial.ts
│   │   │   ├── NeonGlowMaterial.ts
│   │   │   ├── GradientFillMaterial.ts
│   │   │   ├── DualOutlineMaterial.ts
│   │   │   └── SurfaceMaterial.ts
│   │   └── glsl/
│   │       ├── depth-attenuation.glsl
│   │       └── fresnel.glsl
│   └── geometry/
│       └── faces.ts
├── components/
│   ├── canvas/
│   │   ├── PostProcessing.tsx
│   │   ├── SceneLighting.tsx
│   │   ├── FaceRenderer.tsx
│   │   └── shaders/
│   │       ├── WireframeEdges.tsx
│   │       ├── NeonGlowEdges.tsx
│   │       ├── GradientFillEdges.tsx
│   │       ├── DualOutlineEdges.tsx
│   │       └── SurfaceFaces.tsx
│   └── controls/
│       ├── ShaderSelector.tsx
│       ├── ShaderSettings.tsx
│       ├── LightingControls.tsx
│       ├── BloomControls.tsx
│       └── ColorPicker.tsx
├── stores/
│   └── visualStore.ts (extended)
└── tests/
    ├── lib/
    │   ├── shaders/
    │   │   └── materials.test.ts
    │   └── geometry/
    │       └── faces.test.ts
    └── components/
        └── canvas/
            └── shaders.test.tsx
```

---

## Testing Strategy

### Unit Tests
- `faces.test.ts`: Face detection for hypercube, simplex, cross-polytope
- `materials.test.ts`: Material creation with various settings
- `dimensionColors.test.ts`: Color mapping correctness

### Component Tests
- Shader switching behavior
- Settings persistence
- Lighting controls reactivity

### Playwright Visual Tests
- Screenshot comparison for each shader type
- Bloom effect visual verification
- Depth attenuation visual verification

---

## Dependencies to Add

```json
{
  "@react-three/postprocessing": "^2.16.0",
  "postprocessing": "^6.35.0",
  "react-colorful": "^5.6.1"
}
```

---

## Implementation Order

1. **Phase 1**: Store extension, shader types, selector UI
2. **Phase 2**: Face detection, FaceRenderer, SurfaceMaterial
3. **Phase 3**: PostProcessing with Bloom
4. **Phase 4**: SceneLighting, LightingControls
5. **Phase 5**: NeonGlow, GradientFill, DualOutline materials
6. **Phase 6**: Depth attenuation, Fresnel, per-dimension colors
7. **Phase 7**: Integration, URL serialization, testing

---

## Risk Mitigation

1. **Performance**: Bloom uses render-to-texture; test on mobile
2. **Face Detection**: Complex for higher dimensions; start with known polytope formulas
3. **Shader Compatibility**: WebGL 2.0 required; add feature detection
4. **State Complexity**: Many new settings; use structured approach with defaults
