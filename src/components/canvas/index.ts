/**
 * Canvas components for Three.js scene rendering
 *
 * Architecture:
 * - Scene: Entry point with lighting, camera, effects, ground plane
 * - UnifiedRenderer: Routes to appropriate high-performance renderer
 * - scenes/: PolytopeScene
 * - renderers/: Lower-level render components
 * - environment/: Lighting, post-processing, ground plane
 *
 * All renderers use useFrame for transformations, bypassing React re-renders.
 */

// Main scene components
export { Scene } from './Scene'
export type { SceneProps } from './Scene'

// Unified rendering architecture
export { determineRenderMode, UnifiedRenderer } from './renderers/UnifiedRenderer'
export type { RenderMode, UnifiedRendererProps } from './renderers/UnifiedRenderer'

// High-performance useFrame-based scene renderers
export { PolytopeScene } from './renderers/Polytope'
export type { PolytopeSceneProps } from './renderers/Polytope'

// Environment components
export { GroundPlane } from './environment/GroundPlane'
export type { GroundPlaneProps } from './environment/GroundPlane'

export { PostProcessing } from './environment/PostProcessing'

export { SceneLighting } from './environment/SceneLighting'

// Camera control
export { useCameraReset } from '@/hooks/useCameraReset'
export { CameraController } from './CameraController'
export type { CameraControllerProps } from './CameraController'

// Raymarched renderers
export { default as HyperbulbMesh } from './renderers/Hyperbulb/HyperbulbMesh'
