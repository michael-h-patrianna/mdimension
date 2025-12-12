/**
 * PostProcessing Component
 *
 * Manages post-processing effects for the Three.js scene, including Bloom.
 * Uses @react-three/postprocessing for declarative effect composition.
 *
 * Implements a Dual Filter Bloom effect matching the original MultiScoper implementation:
 * - Multi-pass mipmap-based blur (Jimenez 2014 dual filter approach)
 * - Configurable mip levels for blur chain
 * - Soft knee threshold for smooth transitions
 * - Energy-conserving blur accumulation
 *
 * @returns EffectComposer with Bloom effect or null if bloom is disabled
 *
 * @example
 * ```tsx
 * <Canvas>
 *   <Scene>
 *     <PolytopeRenderer />
 *   </Scene>
 *   <PostProcessing />
 * </Canvas>
 * ```
 *
 * @remarks
 * - The component returns null when bloom is disabled to avoid overhead
 * - Uses mipmapBlur for shape-preserving blur (matches original dual filter)
 * - 6 mip levels by default (matches original kMaxMipLevels)
 * - All bloom parameters are clamped in the store to valid ranges
 *
 * @see {@link BloomControls} for UI controls to adjust bloom settings
 * @see {@link useVisualStore} for bloom state management
 * @see MultiScoper/src/rendering/effects/BloomEffect.cpp for original implementation
 */

import { memo } from 'react';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useVisualStore } from '@/stores/visualStore';

/**
 * PostProcessing component that applies visual effects to the rendered scene.
 * Implements Dual Filter Bloom matching the original C++ implementation.
 */
export const PostProcessing = memo(function PostProcessing() {
  const bloomEnabled = useVisualStore((state) => state.bloomEnabled);
  const bloomIntensity = useVisualStore((state) => state.bloomIntensity);
  const bloomThreshold = useVisualStore((state) => state.bloomThreshold);
  const bloomRadius = useVisualStore((state) => state.bloomRadius);
  const bloomSoftKnee = useVisualStore((state) => state.bloomSoftKnee);
  const bloomLevels = useVisualStore((state) => state.bloomLevels);

  // Don't render effect composer if bloom is disabled
  if (!bloomEnabled) return null;

  return (
    <EffectComposer>
      <Bloom
        intensity={bloomIntensity}
        luminanceThreshold={bloomThreshold}
        luminanceSmoothing={bloomSoftKnee}
        radius={bloomRadius}
        levels={bloomLevels}
        mipmapBlur={true}  // Enable dual filter mipmap blur (matches original)
      />
    </EffectComposer>
  );
});
