/**
 * Canvas components for Three.js scene rendering
 *
 * Architecture:
 * - Scene: Entry point with lighting, camera, effects, ground plane
 * - UnifiedRenderer: Routes to appropriate high-performance renderer
 * - scenes/: PolytopeScene, PointCloudScene (useFrame-based)
 * - renderers/: Lower-level render components
 * - environment/: Lighting, post-processing, ground plane
 *
 * All renderers use useFrame for transformations, bypassing React re-renders.
 */

// Main scene components
export { Scene } from './Scene'
export type { SceneProps } from './Scene'

// Unified rendering architecture
export { UnifiedRenderer, determineRenderMode } from './renderers/UnifiedRenderer'
export type { UnifiedRendererProps, RenderMode } from './renderers/UnifiedRenderer'

// High-performance useFrame-based scene renderers
export { PolytopeScene } from './scenes/PolytopeScene'
export type { PolytopeSceneProps } from './scenes/PolytopeScene'

export { PointCloudScene } from './scenes/PointCloudScene'
export type { PointCloudSceneProps } from './scenes/PointCloudScene'

// Environment components
export { GroundPlane } from './environment/GroundPlane'
export type { GroundPlaneProps } from './environment/GroundPlane'

export { PostProcessing } from './environment/PostProcessing'

export { SceneLighting } from './environment/SceneLighting'

// Camera control
export { CameraController } from './CameraController'
export type { CameraControllerProps } from './CameraController'
export { useCameraReset } from '@/hooks/useCameraReset'

// Renderers (lower-level components)
export { PolytopeRenderer } from './renderers/PolytopeRenderer'
export type { PolytopeRendererProps } from './renderers/PolytopeRenderer'

export { FaceRenderer } from './renderers/FaceRenderer'
export type { FaceRendererProps } from './renderers/FaceRenderer'

export { NativeWireframe } from './renderers/NativeWireframe'
export type { NativeWireframeProps } from './renderers/NativeWireframe'

export { FatWireframe } from './renderers/FatWireframe'
export type { FatWireframeProps } from './renderers/FatWireframe'

export { PointCloudRenderer } from './renderers/PointCloudRenderer'
export type { PointCloudRendererProps } from './renderers/PointCloudRenderer'

// Raymarched renderers
export { default as MandelbulbMesh } from './renderers/Mandelbulb/MandelbulbMesh'
export { default as HyperbulbMesh } from './renderers/Hyperbulb/HyperbulbMesh'
