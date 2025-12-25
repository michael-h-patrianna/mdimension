import { computeDriftedOrigin, type OriginDriftConfig } from '@/lib/animation/originDrift';
import { createColorCache, updateLinearColorUniform } from '@/rendering/colors/linearCache';
import { FRAME_PRIORITY } from '@/rendering/core/framePriorities';
import { useTemporalDepth } from '@/rendering/core/temporalDepth';
import { TrackedShaderMaterial } from '@/rendering/materials/TrackedShaderMaterial';
import {
    MAX_DIMENSION,
    useLayerAssignment,
    useQualityTracking,
    useRotationUpdates,
} from '@/rendering/renderers/base';
import { composeMandelbulbShader } from '@/rendering/shaders/mandelbulb/compose';
import { SHADOW_QUALITY_TO_INT } from '@/rendering/shadows/types';
import { UniformManager } from '@/rendering/uniforms/UniformManager';
import { useAnimationStore } from '@/stores/animationStore';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { useEnvironmentStore } from '@/stores/environmentStore';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useGeometryStore } from '@/stores/geometryStore';
import { useLightingStore } from '@/stores/lightingStore';
import { useMsgBoxStore } from '@/stores/msgBoxStore';
import {
    getEffectiveShadowQuality,
    usePerformanceStore,
} from '@/stores/performanceStore';
import { usePostProcessingStore } from '@/stores/postProcessingStore';
import { useUIStore } from '@/stores/uiStore';
import { useWebGLContextStore } from '@/stores/webglContextStore';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import vertexShader from './mandelbulb.vert?raw';

/**
 * MandelbulbMesh - Renders 4D-11D Mandelbulb fractals using GPU raymarching
 *
 * Supports full D-dimensional rotation through all rotation planes (XY, XZ, YZ, XW, YW, ZW, etc.)
 * The 3D slice plane is rotated through D-dimensional space using rotated basis vectors.
 * @returns Three.js mesh with raymarching shader
 */
const MandelbulbMesh = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { size, camera } = useThree();

  // Get temporal depth state from context for temporal reprojection
  const temporalDepth = useTemporalDepth();

  // Use shared quality tracking hook (replaces manual fast mode management)
  const { qualityMultiplier, rotationsChanged } = useQualityTracking();

  // Cached linear colors - avoid per-frame sRGB->linear conversion
  // Note: Light color caching now handled by LightingSource via UniformManager
  const colorCacheRef = useRef(createColorCache());

  // Assign main object layer for depth-based effects (SSR, refraction, bokeh)
  useLayerAssignment(meshRef);

  // Get dimension from geometry store
  const dimension = useGeometryStore((state) => state.dimension);

  // Context restore counter - forces material recreation when context is restored
  const restoreCount = useWebGLContextStore((state) => state.restoreCount);

  // Get Mandelbulb/Mandelbulb config from store
  const mandelbulbPower = useExtendedObjectStore((state) => state.mandelbulb.mandelbulbPower);
  const maxIterations = useExtendedObjectStore((state) => state.mandelbulb.maxIterations);
  const escapeRadius = useExtendedObjectStore((state) => state.mandelbulb.escapeRadius);
  const scale = useExtendedObjectStore((state) => state.mandelbulb.scale);
  const parameterValues = useExtendedObjectStore((state) => state.mandelbulb.parameterValues);

  // Use shared rotation hook for basis vector computation with caching
  const rotationUpdates = useRotationUpdates({ dimension, parameterValues });

  // Power animation parameters (organic multi-frequency motion)
  const powerAnimationEnabled = useExtendedObjectStore((state) => state.mandelbulb.powerAnimationEnabled);
  const powerMin = useExtendedObjectStore((state) => state.mandelbulb.powerMin);
  const powerMax = useExtendedObjectStore((state) => state.mandelbulb.powerMax);
  const powerSpeed = useExtendedObjectStore((state) => state.mandelbulb.powerSpeed);

  // Alternate power parameters (Technique B - blend between two powers)
  const alternatePowerEnabled = useExtendedObjectStore((state) => state.mandelbulb.alternatePowerEnabled);
  const alternatePowerValue = useExtendedObjectStore((state) => state.mandelbulb.alternatePowerValue);
  const alternatePowerBlend = useExtendedObjectStore((state) => state.mandelbulb.alternatePowerBlend);

  // Origin drift parameters (Technique C - animate slice origin in extra dims)
  const originDriftEnabled = useExtendedObjectStore((state) => state.mandelbulb.originDriftEnabled);
  const driftAmplitude = useExtendedObjectStore((state) => state.mandelbulb.driftAmplitude);
  const driftBaseFrequency = useExtendedObjectStore((state) => state.mandelbulb.driftBaseFrequency);
  const driftFrequencySpread = useExtendedObjectStore((state) => state.mandelbulb.driftFrequencySpread);

  // Dimension mixing parameters (Technique A - shear matrix inside iteration)
  const dimensionMixEnabled = useExtendedObjectStore((state) => state.mandelbulb.dimensionMixEnabled);
  const mixIntensity = useExtendedObjectStore((state) => state.mandelbulb.mixIntensity);
  const mixFrequency = useExtendedObjectStore((state) => state.mandelbulb.mixFrequency);

  // Slice Animation parameters (4D+ only - fly through higher-dimensional cross-sections)
  const sliceAnimationEnabled = useExtendedObjectStore((state) => state.mandelbulb.sliceAnimationEnabled);
  const sliceSpeed = useExtendedObjectStore((state) => state.mandelbulb.sliceSpeed);
  const sliceAmplitude = useExtendedObjectStore((state) => state.mandelbulb.sliceAmplitude);

  // Phase Shift parameters (angular twisting)
  const phaseShiftEnabled = useExtendedObjectStore((state) => state.mandelbulb.phaseShiftEnabled);
  const phaseSpeed = useExtendedObjectStore((state) => state.mandelbulb.phaseSpeed);
  const phaseAmplitude = useExtendedObjectStore((state) => state.mandelbulb.phaseAmplitude);

  // Animation bias for per-dimension variation
  const animationBias = useUIStore((state) => state.animationBias);

  // Get color state from visual store
  const faceColor = useAppearanceStore((state) => state.faceColor);

  // NOTE: Multi-light system and global lighting settings are now managed by
  // LightingSource via UniformManager. The following selectors were removed:
  // - lights, ambientIntensity, ambientColor, specularIntensity, shininess
  // - specularColor, diffuseIntensity
  // LightingSource accesses useLightingStore.getState() directly with version tracking.

  // Edges render mode controls fresnel rim lighting for Mandelbulb
  const edgesVisible = useAppearanceStore((state) => state.edgesVisible);
  const fresnelIntensity = useAppearanceStore((state) => state.fresnelIntensity);
  const edgeColor = useAppearanceStore((state) => state.edgeColor);

  // Shadow settings
  const shadowEnabled = useLightingStore((state) => state.shadowEnabled);
  const shadowQuality = useLightingStore((state) => state.shadowQuality);
  const shadowSoftness = useLightingStore((state) => state.shadowSoftness);

  const uniforms = useMemo(
    () => ({
      // Time and resolution
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2() },
      uCameraPosition: { value: new THREE.Vector3() },

      // Mandelbulb parameters
      uDimension: { value: 4 },
      uPower: { value: 8.0 },
      uIterations: { value: 48.0 },
      uEscapeRadius: { value: 8.0 },

      // Power Animation uniforms (Technique B - power oscillation)
      uPowerAnimationEnabled: { value: false },
      uAnimatedPower: { value: 8.0 },  // Computed power = center + amplitude * sin(time * speed)

      // Alternate Power uniforms (Technique B variant - blend two powers)
      uAlternatePowerEnabled: { value: false },
      uAlternatePowerValue: { value: 4.0 },
      uAlternatePowerBlend: { value: 0.5 },

      // Dimension Mixing uniforms (Technique A - shear matrix)
      uDimensionMixEnabled: { value: false },
      uMixIntensity: { value: 0.1 },
      uMixTime: { value: 0 },  // Animated mix time = animTime * mixFrequency

      // Phase Shift uniforms (angular twisting)
      uPhaseEnabled: { value: false },
      uPhaseTheta: { value: 0.0 },  // Phase offset for theta angle
      uPhasePhi: { value: 0.0 },    // Phase offset for phi angle

      // D-dimensional rotated coordinate system
      // c = uOrigin + pos.x * uBasisX + pos.y * uBasisY + pos.z * uBasisZ
      uBasisX: { value: new Float32Array(11) },
      uBasisY: { value: new Float32Array(11) },
      uBasisZ: { value: new Float32Array(11) },
      uOrigin: { value: new Float32Array(11) },

      // Color and palette (converted to linear for physically correct lighting)
      uColor: { value: new THREE.Color().convertSRGBToLinear() },

      // 3D transformation matrices (for camera/view only)
      uModelMatrix: { value: new THREE.Matrix4() },
      uInverseModelMatrix: { value: new THREE.Matrix4() },
      uProjectionMatrix: { value: new THREE.Matrix4() },
      uViewMatrix: { value: new THREE.Matrix4() },

      // Centralized Uniform Sources:
      // - Lighting: Ambient, Diffuse, Specular, Multi-lights
      // - Temporal: Matrices, Enabled state (matrices updated via source)
      // - Quality: FastMode, QualityMultiplier
      // - Color: Algorithm, Cosine coeffs, Distribution, LCH
      ...UniformManager.getCombinedUniforms(['lighting', 'temporal', 'quality', 'color']),

      // Material property for G-buffer (reflectivity for SSR)
      uMetallic: { value: 0.0 },

      // Advanced Rendering
      uRoughness: { value: 0.3 },
      uSssEnabled: { value: false },
      uSssIntensity: { value: 1.0 },
      uSssColor: { value: new THREE.Color('#ff8844') },
      uSssThickness: { value: 1.0 },
      uSssJitter: { value: 0.2 },

      // Fresnel rim lighting uniforms (color converted to linear)
      uFresnelEnabled: { value: true },
      uFresnelIntensity: { value: 0.5 },
      uRimColor: { value: new THREE.Color('#FFFFFF').convertSRGBToLinear() },

      // Shadow System uniforms
      uShadowEnabled: { value: false },
      uShadowQuality: { value: 1 },
      uShadowSoftness: { value: 1.0 },

      // Ambient Occlusion uniforms
      uAoEnabled: { value: true },

      // Temporal Reprojection - Texture must be manually handled as it comes from context
      uPrevDepthTexture: { value: null },

      // IBL (Image-Based Lighting) uniforms - PMREM texture (sampler2D)
      uEnvMap: { value: null },
      uEnvMapSize: { value: 256.0 },
      uIBLIntensity: { value: 1.0 },
      uIBLQuality: { value: 0 }, // 0=off, 1=low, 2=high
    }),
    []
  );

  // Get temporal settings
  const temporalEnabled = usePerformanceStore((state) => state.temporalReprojectionEnabled);
  const setShaderDebugInfo = usePerformanceStore((state) => state.setShaderDebugInfo);
  const shaderOverrides = usePerformanceStore((state) => state.shaderOverrides);
  const resetShaderOverrides = usePerformanceStore((state) => state.resetShaderOverrides);

  // Conditionally compiled feature toggles (affect shader compilation)
  const sssEnabled = useAppearanceStore((state) => state.sssEnabled);
  // Note: edgesVisible (line 268) controls fresnel and is already subscribed

  // Reset overrides when base configuration changes
  useEffect(() => {
    resetShaderOverrides();
  }, [dimension, shadowEnabled, temporalEnabled, sssEnabled, edgesVisible, resetShaderOverrides]);

  // Error tracking to prevent loop spam
  const hasErroredRef = useRef(false);

  // Compile shader only when configuration changes
  const { glsl: shaderString, modules, features } = useMemo(() => {
    return composeMandelbulbShader({
      dimension,
      shadows: shadowEnabled,
      temporal: temporalEnabled,
      ambientOcclusion: true, // Always included unless explicit toggle added
      overrides: shaderOverrides,
      sss: sssEnabled,
      fresnel: edgesVisible,
      fog: false, // Physical fog handled by post-process
    });
  }, [dimension, shadowEnabled, temporalEnabled, shaderOverrides, sssEnabled, edgesVisible]);

  // Update debug info store
  useEffect(() => {
    setShaderDebugInfo('object', {
      name: 'Mandelbulb Raymarcher',
      vertexShaderLength: vertexShader.length,
      fragmentShaderLength: shaderString.length,
      activeModules: modules,
      features: features,
    });
    return () => setShaderDebugInfo('object', null);
  }, [shaderString, modules, features, setShaderDebugInfo]);

  useFrame((state) => {
    if (hasErroredRef.current) return;

    try {
    const isPlaying = useAnimationStore.getState().isPlaying;
    const accumulatedTime = useAnimationStore.getState().accumulatedTime;

    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;

      // Skip uniform updates if material has no uniforms (placeholder material during shader compilation)
      if (!material.uniforms) return;

      // Update time and resolution
      // Use accumulatedTime which respects pause state and is synced globally
      if (material.uniforms.uTime) material.uniforms.uTime.value = accumulatedTime;
      if (material.uniforms.uResolution) material.uniforms.uResolution.value.set(size.width, size.height);
      if (material.uniforms.uCameraPosition) material.uniforms.uCameraPosition.value.copy(camera.position);

      // Update dimension
      if (material.uniforms.uDimension) material.uniforms.uDimension.value = dimension;

      // Update Mandelbulb parameters
      // Always set these uniforms unconditionally to ensure they're updated after
      // TrackedShaderMaterial transitions from placeholder to actual shader material.
      // The prev ref optimization was causing uniforms to not update when material changed.
      if (material.uniforms.uIterations) {
        material.uniforms.uIterations.value = maxIterations;
      }
      if (material.uniforms.uEscapeRadius) {
        material.uniforms.uEscapeRadius.value = escapeRadius;
      }

      // Power: either animated or static
      // When animated, directly set uPower (same as manually moving the slider)
      if (material.uniforms.uPower) {
        if (powerAnimationEnabled) {
          // Use global accumulatedTime
          // powerSpeed 0.03 = one full cycle (back and forth) every ~33 seconds
          const t = accumulatedTime * powerSpeed * 2 * Math.PI;
          const normalized = (Math.sin(t) + 1) / 2; // Maps [-1, 1] to [0, 1]

          const targetPower = powerMin + normalized * (powerMax - powerMin);
          material.uniforms.uPower.value = targetPower;
        } else {
          // Always set power unconditionally to handle material transitions
          material.uniforms.uPower.value = mandelbulbPower;
        }
      }

      // Disable the separate animation uniform system (not needed anymore)
      if (material.uniforms.uPowerAnimationEnabled) {
        material.uniforms.uPowerAnimationEnabled.value = false;
      }

      // Alternate Power (Technique B): blend between primary and alternate powers
      if (material.uniforms.uAlternatePowerEnabled) {
        material.uniforms.uAlternatePowerEnabled.value = alternatePowerEnabled;
      }
      if (material.uniforms.uAlternatePowerValue) {
        material.uniforms.uAlternatePowerValue.value = alternatePowerValue;
      }
      if (material.uniforms.uAlternatePowerBlend) {
        material.uniforms.uAlternatePowerBlend.value = alternatePowerBlend;
      }

      // Dimension Mixing (Technique A): update uniforms for shader-side mixing matrix
      if (material.uniforms.uDimensionMixEnabled) {
        material.uniforms.uDimensionMixEnabled.value = dimensionMixEnabled;
      }
      if (material.uniforms.uMixIntensity) {
        material.uniforms.uMixIntensity.value = mixIntensity;
      }
      if (material.uniforms.uMixTime) {
        // Mix time advances based on animation time and frequency
        // The shader will use this to compute sin/cos values for the mixing matrix
        material.uniforms.uMixTime.value = accumulatedTime * mixFrequency * 2 * Math.PI;
      }

      // Update color and palette (cached linear conversion - only converts when color changes)
      const cache = colorCacheRef.current;
      if (material.uniforms.uColor) {
        updateLinearColorUniform(cache.faceColor, material.uniforms.uColor.value as THREE.Color, faceColor);
      }

      // Update camera matrices
      if (material.uniforms.uModelMatrix) material.uniforms.uModelMatrix.value.copy(meshRef.current.matrixWorld);
      if (material.uniforms.uInverseModelMatrix) material.uniforms.uInverseModelMatrix.value.copy(meshRef.current.matrixWorld).invert();
      if (material.uniforms.uProjectionMatrix) material.uniforms.uProjectionMatrix.value.copy(camera.projectionMatrix);
      if (material.uniforms.uViewMatrix) material.uniforms.uViewMatrix.value.copy(camera.matrixWorldInverse);

      // Update temporal reprojection uniforms
      // uPrevDepthTexture comes from context and must be set manually
      // Matrices and enabled state are handled by UniformManager (TemporalSource)
      const temporalUniforms = temporalDepth.getUniforms();
      if (material.uniforms.uPrevDepthTexture) {
        material.uniforms.uPrevDepthTexture.value = temporalUniforms.uPrevDepthTexture;
      }

      // Apply centralized uniform sources (Lighting, Temporal, Quality, Color, PBR)
      // These sources auto-update from stores in UniformLifecycleController
      UniformManager.applyToMaterial(material, ['lighting', 'temporal', 'quality', 'color', 'pbr-face']);

      // SSS (Subsurface Scattering) properties
      const visuals = useAppearanceStore.getState();
      if (material.uniforms.uSssEnabled) material.uniforms.uSssEnabled.value = visuals.sssEnabled;
      if (material.uniforms.uSssIntensity) material.uniforms.uSssIntensity.value = visuals.sssIntensity;
      if (material.uniforms.uSssColor) {
          updateLinearColorUniform(cache.faceColor /* reuse helper */, material.uniforms.uSssColor.value as THREE.Color, visuals.sssColor || '#ff8844');
      }
      if (material.uniforms.uSssThickness) material.uniforms.uSssThickness.value = visuals.sssThickness;
      if (material.uniforms.uSssJitter) material.uniforms.uSssJitter.value = visuals.sssJitter;

      // Fresnel rim lighting (controlled by Edges render mode, cached linear conversion)
      if (material.uniforms.uFresnelEnabled) material.uniforms.uFresnelEnabled.value = edgesVisible;
      if (material.uniforms.uFresnelIntensity) material.uniforms.uFresnelIntensity.value = fresnelIntensity;
      if (material.uniforms.uRimColor) {
        updateLinearColorUniform(cache.rimColor, material.uniforms.uRimColor.value as THREE.Color, edgeColor);
      }

      // Shadow System uniforms
      if (material.uniforms.uShadowEnabled) {
        material.uniforms.uShadowEnabled.value = shadowEnabled;
      }
      if (material.uniforms.uShadowQuality) {
        // Progressive refinement: scale shadow quality from low → user's target
        const effectiveShadowQuality = getEffectiveShadowQuality(
          shadowQuality,
          qualityMultiplier
        );
        material.uniforms.uShadowQuality.value = SHADOW_QUALITY_TO_INT[effectiveShadowQuality];
      }
      if (material.uniforms.uShadowSoftness) {
        material.uniforms.uShadowSoftness.value = shadowSoftness;
      }

      // Ambient Occlusion uniform (controlled by global SSAO toggle)
      if (material.uniforms.uAoEnabled) {
        const ssaoEnabled = usePostProcessingStore.getState().ssaoEnabled;
        material.uniforms.uAoEnabled.value = ssaoEnabled;
      }

      // IBL (Image-Based Lighting) uniforms
      const iblState = useEnvironmentStore.getState();
      if (material.uniforms.uIBLQuality) {
        const qualityMap = { off: 0, low: 1, high: 2 } as const;
        material.uniforms.uIBLQuality.value = qualityMap[iblState.iblQuality];
      }
      if (material.uniforms.uIBLIntensity) {
        material.uniforms.uIBLIntensity.value = iblState.iblIntensity;
      }
      if (material.uniforms.uEnvMap) {
        // Use scene.environment (PMREM texture) for IBL
        const env = state.scene.environment;
        const isPMREM = env && env.mapping === THREE.CubeUVReflectionMapping;
        material.uniforms.uEnvMap.value = isPMREM ? env : null;
      }

      // Mandelbulb is always fully opaque (solid mode)
      if (material.transparent !== false) {
        material.transparent = false;
        material.depthWrite = true;
        material.needsUpdate = true;
      }


      // ============================================
      // D-dimensional Rotation & Basis Vectors (via shared hook)
      // Only recomputes when rotations, dimension, or params change
      // ============================================
      const D = dimension;
      const { basisX, basisY, basisZ, changed: basisChanged } = rotationUpdates.getBasisVectors(rotationsChanged);

      if (basisChanged) {
        // Update basis vector uniforms
        if (material.uniforms.uBasisX) {
          (material.uniforms.uBasisX.value as Float32Array).set(basisX);
        }
        if (material.uniforms.uBasisY) {
          (material.uniforms.uBasisY.value as Float32Array).set(basisY);
        }
        if (material.uniforms.uBasisZ) {
          (material.uniforms.uBasisZ.value as Float32Array).set(basisZ);
        }
      }

      // ============================================
      // Origin Update (separate from basis vectors)
      // Must update every frame when origin drift or slice animation is enabled
      // ============================================
      const needsOriginUpdate = basisChanged || originDriftEnabled || sliceAnimationEnabled;
      const { rotationMatrix: cachedRotationMatrix } = rotationUpdates;

      if (needsOriginUpdate && cachedRotationMatrix) {
        // Build origin values array for rotation
        const originValues = new Array(MAX_DIMENSION).fill(0);

        // Apply origin drift if enabled (Technique C)
        if (originDriftEnabled && D > 3) {
          const driftConfig: OriginDriftConfig = {
            enabled: true,
            amplitude: driftAmplitude,
            baseFrequency: driftBaseFrequency,
            frequencySpread: driftFrequencySpread,
          };
          // Get animation speed from store for consistent drift timing
          const animationSpeed = useAnimationStore.getState().speed;
          const driftedOrigin = computeDriftedOrigin(
            parameterValues,
            accumulatedTime,
            driftConfig,
            animationSpeed,
            animationBias
          );
          // Set drifted values for extra dimensions
          for (let i = 3; i < D; i++) {
            originValues[i] = driftedOrigin[i - 3] ?? 0;
          }
        } else if (sliceAnimationEnabled && D > 3) {
          // Slice Animation: animate through higher-dimensional cross-sections
          // Use sine waves with golden ratio phase offsets for organic motion
          const PHI = 1.618033988749895; // Golden ratio

          for (let i = 3; i < D; i++) {
            const extraDimIndex = i - 3;
            // Each dimension gets a unique phase offset based on golden ratio
            const phase = extraDimIndex * PHI;
            // Multi-frequency sine for more interesting motion
            const t1 = accumulatedTime * sliceSpeed * 2 * Math.PI + phase;
            const t2 = accumulatedTime * sliceSpeed * 1.3 * 2 * Math.PI + phase * 1.5;
            // Blend two frequencies for non-repetitive motion
            const offset = sliceAmplitude * (0.7 * Math.sin(t1) + 0.3 * Math.sin(t2));
            originValues[i] = (parameterValues[extraDimIndex] ?? 0) + offset;
          }
        } else {
          // No drift or slice animation - use static parameter values
          for (let i = 3; i < D; i++) {
            originValues[i] = parameterValues[i - 3] ?? 0;
          }
        }

        // Get rotated origin from hook
        const { origin } = rotationUpdates.getOrigin(originValues);

        // Update origin uniform
        if (material.uniforms.uOrigin) {
          (material.uniforms.uOrigin.value as Float32Array).set(origin);
        }
      }

      // ============================================
      // Phase Shift Animation
      // Add time-varying phase offsets to spherical angles
      // ============================================
      if (material.uniforms.uPhaseEnabled) {
        material.uniforms.uPhaseEnabled.value = phaseShiftEnabled;
      }
      if (phaseShiftEnabled) {
        const t = accumulatedTime * phaseSpeed * 2 * Math.PI;
        // Theta and phi use different frequencies for more organic twisting
        if (material.uniforms.uPhaseTheta) {
          material.uniforms.uPhaseTheta.value = phaseAmplitude * Math.sin(t);
        }
        if (material.uniforms.uPhasePhi) {
          material.uniforms.uPhasePhi.value = phaseAmplitude * Math.sin(t * 1.618); // Golden ratio frequency offset
        }
      } else {
        if (material.uniforms.uPhaseTheta) material.uniforms.uPhaseTheta.value = 0;
        if (material.uniforms.uPhasePhi) material.uniforms.uPhasePhi.value = 0;
      }

      // Model matrices are always identity for Mandelbulb - no need to set every frame
      // (they are already identity from useMemo initialization)
    }
    } catch (error) {
        if (hasErroredRef.current) return;
        hasErroredRef.current = true;

        console.error('Mandelbulb Render Loop Error:', error)

        // Use getState to avoid hook rules in callback
        const showMsgBox = useMsgBoxStore.getState().showMsgBox

        // Show error message
        showMsgBox(
          'Rendering Error',
          `The Mandelbulb renderer encountered an error.\n\n${error instanceof Error ? error.message : 'Unknown error'}`,
          'error',
          [
            {
              label: 'Reload Page',
              onClick: () => window.location.reload(),
              variant: 'danger'
            },
            {
              label: 'Close',
              onClick: () => useMsgBoxStore.getState().closeMsgBox(),
              variant: 'secondary'
            }
          ]
        )
    }
  }, FRAME_PRIORITY.RENDERER_UNIFORMS);

  // Generate unique key to force material recreation when shader changes or context is restored
  const materialKey = `mandelbulb-material-${shaderString.length}-${features.join(',')}-${restoreCount}`;

  return (
    <mesh ref={meshRef} scale={[scale ?? 1.0, scale ?? 1.0, scale ?? 1.0]} frustumCulled={true}>
      <boxGeometry args={[4, 4, 4]} />
      <TrackedShaderMaterial
        shaderName="Mandelbulb Raymarcher"
        materialKey={materialKey}
        glslVersion={THREE.GLSL3}
        vertexShader={vertexShader}
        fragmentShader={shaderString}
        uniforms={uniforms}
        side={THREE.BackSide}
      />
    </mesh>
  );
};

export default MandelbulbMesh;
