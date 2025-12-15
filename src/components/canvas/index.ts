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
export { Scene } from '@/rendering/Scene'
export type { SceneProps } from '@/rendering/Scene'

// Unified rendering architecture
export { determineRenderMode, UnifiedRenderer } from '@/rendering/renderers/UnifiedRenderer'
export type { RenderMode, UnifiedRendererProps } from '@/rendering/renderers/UnifiedRenderer'

// High-performance useFrame-based scene renderers
export { PolytopeScene } from '@/rendering/renderers/Polytope'
export type { PolytopeSceneProps } from '@/rendering/renderers/Polytope'

// Environment components
export { GroundPlane } from '@/rendering/environment/GroundPlane'
export type { GroundPlaneProps } from '@/rendering/environment/GroundPlane'

export { PostProcessing } from '@/rendering/environment/PostProcessing'

export { SceneLighting } from '@/rendering/environment/SceneLighting'

// Camera control
export { useCameraReset } from '@/hooks/useCameraReset'
export { CameraController } from './CameraController'
export type { CameraControllerProps } from './CameraController'

// Raymarched renderers
export { default as HyperbulbMesh } from '@/rendering/renderers/Hyperbulb/HyperbulbMesh'
