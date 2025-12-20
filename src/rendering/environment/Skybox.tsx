import { RENDER_LAYERS } from '@/rendering/core/layers';
import { RECOVERY_PRIORITY, resourceRecovery } from '@/rendering/core/ResourceRecovery';
import { createSkyboxShaderDefaults } from '@/rendering/materials/skybox/SkyboxShader';
import { applyDistributionTS, getCosinePaletteColorTS } from '@/rendering/shaders/palette/cosine.glsl';
import type { ColorAlgorithm, CosineCoefficients, DistributionSettings } from '@/rendering/shaders/palette/types';
import { composeSkyboxFragmentShader, composeSkyboxVertexShader } from '@/rendering/shaders/skybox/compose';
import type { SkyboxMode, SkyboxShaderConfig } from '@/rendering/shaders/skybox/types';
import { useAnimationStore } from '@/stores/animationStore';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { useEnvironmentStore } from '@/stores/environmentStore';
import { usePerformanceStore } from '@/stores/performanceStore';
import { useMsgBoxStore } from '@/stores/msgBoxStore';
import { Environment } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { useShallow } from 'zustand/react/shallow';
import { ProceduralSkyboxWithEnvironment } from './ProceduralSkyboxWithEnvironment';

// ============================================================================
// PMREM Cache - Module-level cache to avoid regenerating PMREM for same textures
// ============================================================================

/** Maximum number of PMREM textures to keep in cache (LRU eviction) */
const PMREM_CACHE_MAX_SIZE = 6;

interface PMREMCacheEntry {
  pmremTexture: THREE.Texture;
  /** Track usage count to know when to dispose */
  refCount: number;
  /** Last access timestamp for LRU eviction */
  lastAccess: number;
}

/**
 * Module-level cache for PMREM textures.
 * Keyed by the source texture UUID to avoid regenerating when switching skyboxes.
 * Uses LRU eviction when cache exceeds PMREM_CACHE_MAX_SIZE.
 */
const pmremCache = new Map<string, PMREMCacheEntry>();

/**
 * Evict least recently used entries when cache exceeds max size.
 * Only evicts entries with refCount === 0 (not currently in use).
 */
function evictLRUCacheEntries(): void {
  if (pmremCache.size <= PMREM_CACHE_MAX_SIZE) return;

  // Collect entries eligible for eviction (refCount === 0)
  const evictable: Array<[string, PMREMCacheEntry]> = [];
  for (const [key, entry] of pmremCache) {
    if (entry.refCount === 0) {
      evictable.push([key, entry]);
    }
  }

  // Sort by lastAccess (oldest first)
  evictable.sort((a, b) => a[1].lastAccess - b[1].lastAccess);

  // Evict until we're at or below max size
  const numToEvict = pmremCache.size - PMREM_CACHE_MAX_SIZE;
  for (let i = 0; i < Math.min(numToEvict, evictable.length); i++) {
    const [key, entry] = evictable[i]!;
    entry.pmremTexture.dispose();
    pmremCache.delete(key);
  }
}

/** Shared PMREMGenerator instance - reused across all conversions */
let sharedPMREMGenerator: THREE.PMREMGenerator | null = null;

/**
 * Get or create the shared PMREMGenerator.
 * Lazily initialized and compiled on first use.
 * @param gl - The WebGL renderer
 * @returns The shared PMREMGenerator instance
 */
function getSharedPMREMGenerator(gl: THREE.WebGLRenderer): THREE.PMREMGenerator {
  if (!sharedPMREMGenerator) {
    sharedPMREMGenerator = new THREE.PMREMGenerator(gl);
    // Pre-compile shader to avoid stutter on first conversion
    sharedPMREMGenerator.compileEquirectangularShader();
  }
  return sharedPMREMGenerator;
}

/**
 * Clear all PMREM cache entries after WebGL context loss.
 *
 * IMPORTANT: This function nulls out resources WITHOUT disposing them.
 * After context loss, GPU resources are already gone - calling dispose()
 * would cause "object does not belong to this context" errors.
 */
function clearPMREMCacheForContextLoss(): void {
  // Clear cache without disposing - textures belong to the dead context
  pmremCache.clear();

  // Null out shared PMREM generator without disposing
  sharedPMREMGenerator = null;
}

// Register PMREM cache with resource recovery coordinator (only once)
if (!resourceRecovery.has('SkyboxPMREMCache')) {
  resourceRecovery.register({
    name: 'SkyboxPMREMCache',
    priority: RECOVERY_PRIORITY.SKYBOX_PMREM,
    invalidate: () => clearPMREMCacheForContextLoss(),
    reinitialize: () => Promise.resolve(), // Textures will be regenerated on demand
  });
}

// ============================================================================
// usePMREMTexture Hook
// ============================================================================

interface PMREMResult {
  /** The PMREM-processed texture, or null if not yet generated */
  texture: THREE.Texture | null;
  /** True while PMREM generation is in progress */
  isGenerating: boolean;
}

/**
 * Custom hook to convert a CubeTexture to PMREM format for PBR lighting.
 *
 * Optimizations:
 * - Caches PMREM textures by source texture UUID to avoid regeneration
 * - Uses async generation to avoid blocking the main thread
 * - Shares a single PMREMGenerator instance across all conversions
 * - Properly manages cache lifecycle with reference counting
 *
 * Three.js's meshStandardMaterial requires environment maps to be in PMREM
 * (Prefiltered Mipmap Radiance Environment Map) format for proper roughness-based
 * reflections. Raw CubeTextures from KTX2Loader don't work correctly with
 * scene.environment - they need PMREM processing first.
 *
 * @param texture - The source CubeTexture to convert
 * @returns Object with texture and loading state
 */
function usePMREMTexture(texture: THREE.CubeTexture | undefined): PMREMResult {
  const gl = useThree((state) => state.gl);
  const [pmremTexture, setPmremTexture] = useState<THREE.Texture | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const currentTextureUuid = useRef<string | null>(null);

  useEffect(() => {
    if (!texture) {
      setPmremTexture(null);
      setIsGenerating(false);
      return;
    }

    const textureUuid = texture.uuid;

    // Check cache first
    const cached = pmremCache.get(textureUuid);
    if (cached) {
      // Increment ref count, update access time, and use cached texture
      cached.refCount++;
      cached.lastAccess = Date.now();
      currentTextureUuid.current = textureUuid;
      setPmremTexture(cached.pmremTexture);
      setIsGenerating(false);
      return;
    }

    // Generate PMREM asynchronously
    setIsGenerating(true);
    let cancelled = false;

    // Use requestAnimationFrame to defer PMREM generation to next frame
    // This prevents blocking user interaction during texture switch
    const generatePMREM = () => {
      requestAnimationFrame(() => {
        if (cancelled) return;

        const pmremGenerator = getSharedPMREMGenerator(gl);

        try {
          const renderTarget = pmremGenerator.fromCubemap(texture);

          if (cancelled) {
            renderTarget.texture.dispose();
            return;
          }

          const envMap = renderTarget.texture;
          envMap.colorSpace = THREE.SRGBColorSpace;

          // Store in cache with LRU eviction
          pmremCache.set(textureUuid, {
            pmremTexture: envMap,
            refCount: 1,
            lastAccess: Date.now(),
          });

          // Evict old entries if cache is too large
          evictLRUCacheEntries();

          currentTextureUuid.current = textureUuid;
          setPmremTexture(envMap);
          setIsGenerating(false);
        } catch {
          // Generation failed - fall back to null
          setIsGenerating(false);
          setPmremTexture(null);
        }
      });
    };

    generatePMREM();

    return () => {
      cancelled = true;
      // Decrement ref count when texture changes or unmounts
      if (currentTextureUuid.current) {
        const entry = pmremCache.get(currentTextureUuid.current);
        if (entry) {
          entry.refCount--;
          // Keep in cache even if refCount is 0 - allows quick switching back
          // Cache will be cleared when sharedPMREMGenerator is disposed
        }
      }
    };
  }, [texture, gl]);

  // Cleanup shared resources on unmount
  useEffect(() => {
    return () => {
      // If this is the last Skybox unmounting, clean up everything
      // In practice, we keep the generator alive for the app lifetime
      // but dispose cached textures that are no longer used
      if (currentTextureUuid.current) {
        const entry = pmremCache.get(currentTextureUuid.current);
        if (entry && entry.refCount <= 0) {
          // Optional: Could dispose here, but keeping for quick switching
          // entry.pmremTexture.dispose();
          // pmremCache.delete(currentTextureUuid.current);
        }
      }
    };
  }, []);

  return { texture: pmremTexture, isGenerating };
}

// Import all skybox ktx2 files as URLs
const skyboxAssets = import.meta.glob('/src/assets/skyboxes/**/*.ktx2', { eager: true, import: 'default', query: '?url' }) as Record<string, string>;

// --- Main Component ---

interface SkyboxMeshProps {
    texture: THREE.CubeTexture | null;
}

export const SkyboxMesh: React.FC<SkyboxMeshProps> = ({ texture }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  // Reusable objects
  const eulerRef = useRef(new THREE.Euler());
  const matrix3Ref = useRef(new THREE.Matrix3());
  const matrix4Ref = useRef(new THREE.Matrix4());

  // Set skybox to its own layer so it's excluded from normal pass
  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.layers.set(RENDER_LAYERS.SKYBOX);
    }
  }, []);

  const {
    skyboxMode,
    skyboxIntensity,
    skyboxBlur,
    skyboxRotation,
    skyboxAnimationMode,
    skyboxAnimationSpeed,
    proceduralSettings
  } = useEnvironmentStore(useShallow((state) => ({
    skyboxMode: state.skyboxMode,
    skyboxIntensity: state.skyboxIntensity,
    skyboxBlur: state.skyboxBlur,
    skyboxRotation: state.skyboxRotation,
    skyboxAnimationMode: state.skyboxAnimationMode,
    skyboxAnimationSpeed: state.skyboxAnimationSpeed,
    proceduralSettings: state.proceduralSettings
  })));

  const { colorAlgorithm, cosineCoefficients, distribution, lchLightness, lchChroma, faceColor } = useAppearanceStore(useShallow((state) => ({
    colorAlgorithm: state.colorAlgorithm,
    cosineCoefficients: state.cosineCoefficients,
    distribution: state.distribution,
    lchLightness: state.lchLightness,
    lchChroma: state.lchChroma,
    faceColor: state.faceColor
  })));
  const isPlaying = useAnimationStore((state) => state.isPlaying);
  const setShaderDebugInfo = usePerformanceStore((state) => state.setShaderDebugInfo);

  const baseRotY = skyboxRotation * (Math.PI / 180);

  /**
   * Compute a color at position t (0-1) for any color algorithm.
   * Mirrors the logic in ColorPreview.tsx for consistent sync.
   * @param t
   * @param algorithm
   * @param coeffs
   * @param dist
   * @param baseColor
   * @param lchL
   * @param lchC
   * @returns THREE.Color computed for the given position and algorithm
   */
  const computeColorAtT = (t: number, algorithm: ColorAlgorithm, coeffs: CosineCoefficients, dist: DistributionSettings, baseColor: string, lchL: number, lchC: number): THREE.Color => {
    // Helper: Convert hex color to HSL
    const hexToHsl = (hex: string): [number, number, number] => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (!result) return [0, 0, 0.5];
      const r = parseInt(result[1]!, 16) / 255;
      const g = parseInt(result[2]!, 16) / 255;
      const b = parseInt(result[3]!, 16) / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const l = (max + min) / 2;
      if (max === min) return [0, 0, l];
      const d = max - min;
      const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      let h = 0;
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
      return [h, s, l];
    };

    // Helper: Convert HSL to RGB
    const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
      const c = (1 - Math.abs(2 * l - 1)) * s;
      const x = c * (1 - Math.abs((h * 6) % 2 - 1));
      const m = l - c / 2;
      let r = 0, g = 0, b = 0;
      if (h < 1/6) { r = c; g = x; }
      else if (h < 2/6) { r = x; g = c; }
      else if (h < 3/6) { g = c; b = x; }
      else if (h < 4/6) { g = x; b = c; }
      else if (h < 5/6) { r = x; b = c; }
      else { r = c; b = x; }
      return [r + m, g + m, b + m];
    };

    // Helper: Oklab to linear sRGB
    const oklabToLinearSrgb = (L: number, a: number, b_: number): [number, number, number] => {
      const l_ = L + 0.3963377774 * a + 0.2158037573 * b_;
      const m_ = L - 0.1055613458 * a - 0.0638541728 * b_;
      const s_ = L - 0.0894841775 * a - 1.2914855480 * b_;
      const l = l_ * l_ * l_;
      const m = m_ * m_ * m_;
      const s = s_ * s_ * s_;
      return [
        +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
      ];
    };

    let r: number, g: number, b: number;

    if (algorithm === 'monochromatic') {
      const [hue, sat] = hexToHsl(baseColor);
      const distributedT = applyDistributionTS(t, dist.power, dist.cycles, dist.offset);
      const litVar = 0.3 + distributedT * 0.4;
      [r, g, b] = hslToRgb(hue, sat, litVar);
    } else if (algorithm === 'analogous') {
      const [baseHue, sat, lit] = hexToHsl(baseColor);
      const distributedT = applyDistributionTS(t, dist.power, dist.cycles, dist.offset);
      const hueOffset = (distributedT - 0.5) * 0.167;
      const hue = (baseHue + hueOffset + 1) % 1;
      [r, g, b] = hslToRgb(hue, sat, lit);
    } else if (algorithm === 'lch') {
      const distributedT = applyDistributionTS(t, dist.power, dist.cycles, dist.offset);
      const hue = distributedT * 6.28318;
      const a_oklab = lchC * Math.cos(hue);
      const b_oklab = lchC * Math.sin(hue);
      [r, g, b] = oklabToLinearSrgb(lchL, a_oklab, b_oklab);
    } else {
      // cosine, normal, distance, multiSource, radial - all use cosine palette
      const color = getCosinePaletteColorTS(t, coeffs.a, coeffs.b, coeffs.c, coeffs.d, dist.power, dist.cycles, dist.offset);
      r = color.r;
      g = color.g;
      b = color.b;
    }

    // Clamp values
    r = Math.max(0, Math.min(1, r));
    g = Math.max(0, Math.min(1, g));
    b = Math.max(0, Math.min(1, b));

    return new THREE.Color(r, g, b);
  };

  const color1Vec = useMemo(() => {
    const shouldSyncWithObject = skyboxMode !== 'classic' && proceduralSettings.syncWithObject;
    if (shouldSyncWithObject) {
      return computeColorAtT(
        0.0,
        colorAlgorithm,
        cosineCoefficients,
        distribution,
        faceColor,
        lchLightness,
        lchChroma
      );
    }
    const skyboxCoeffs = proceduralSettings.cosineCoefficients;
    const skyboxDist = proceduralSettings.distribution;
    return computeColorAtT(
      0.0,
      'cosine',
      skyboxCoeffs,
      skyboxDist,
      '#ffffff',
      0.5,
      0.15
    );
  }, [
    skyboxMode,
    proceduralSettings.syncWithObject,
    proceduralSettings.cosineCoefficients,
    proceduralSettings.distribution,
    colorAlgorithm,
    cosineCoefficients,
    distribution,
    faceColor,
    lchLightness,
    lchChroma,
  ]);

  const color2Vec = useMemo(() => {
    const shouldSyncWithObject = skyboxMode !== 'classic' && proceduralSettings.syncWithObject;
    if (shouldSyncWithObject) {
      return computeColorAtT(
        1.0,
        colorAlgorithm,
        cosineCoefficients,
        distribution,
        faceColor,
        lchLightness,
        lchChroma
      );
    }
    const skyboxCoeffs = proceduralSettings.cosineCoefficients;
    const skyboxDist = proceduralSettings.distribution;
    return computeColorAtT(
      1.0,
      'cosine',
      skyboxCoeffs,
      skyboxDist,
      '#ffffff',
      0.5,
      0.15
    );
  }, [
    skyboxMode,
    proceduralSettings.syncWithObject,
    proceduralSettings.cosineCoefficients,
    proceduralSettings.distribution,
    colorAlgorithm,
    cosineCoefficients,
    distribution,
    faceColor,
    lchLightness,
    lchChroma,
  ]);

  const paletteVecs = useMemo(() => {
    const shouldSyncWithObject = skyboxMode !== 'classic' && proceduralSettings.syncWithObject;
    if (shouldSyncWithObject) {
      return {
        a: new THREE.Vector3(...cosineCoefficients.a),
        b: new THREE.Vector3(...cosineCoefficients.b),
        c: new THREE.Vector3(...cosineCoefficients.c),
        d: new THREE.Vector3(...cosineCoefficients.d),
      };
    } else {
      const skyboxCoeffs = proceduralSettings.cosineCoefficients;
      return {
        a: new THREE.Vector3(...skyboxCoeffs.a),
        b: new THREE.Vector3(...skyboxCoeffs.b),
        c: new THREE.Vector3(...skyboxCoeffs.c),
        d: new THREE.Vector3(...skyboxCoeffs.d),
      };
    }
  }, [skyboxMode, proceduralSettings.syncWithObject, proceduralSettings.cosineCoefficients, cosineCoefficients]);

  // Derive config for shader composition
  const config = useMemo<SkyboxShaderConfig>(() => {
      const modeStr = skyboxMode.startsWith('procedural_')
          ? skyboxMode.replace('procedural_', '') as SkyboxMode
          : 'classic';

      return {
          mode: modeStr,
          effects: {
              atmosphere: proceduralSettings.horizon > 0,
              sun: proceduralSettings.sunIntensity > 0,
              vignette: true,
              grain: proceduralSettings.noiseGrain > 0,
              aberration: proceduralSettings.chromaticAberration > 0
          },
          parallax: proceduralSettings.parallaxEnabled
      };
  }, [skyboxMode, proceduralSettings]);

  // Create Material
  const material = useMemo(() => {
      const { glsl } = composeSkyboxFragmentShader(config);
      const mat = new THREE.ShaderMaterial({
          glslVersion: THREE.GLSL3,
          vertexShader: composeSkyboxVertexShader(),
          fragmentShader: glsl,
          uniforms: createSkyboxShaderDefaults(),
          side: THREE.BackSide,
          transparent: true,
          depthWrite: false,
      });
      return mat;
  }, [config]);

  // Update Debug Info
  useEffect(() => {
      const { modules, features } = composeSkyboxFragmentShader(config);
      setShaderDebugInfo('skybox', {
          name: 'Skybox Shader',
          vertexShaderLength: material.vertexShader.length,
          fragmentShaderLength: material.fragmentShader.length,
          activeModules: modules,
          features,
      });
      return () => setShaderDebugInfo('skybox', null);
  }, [config, material, setShaderDebugInfo]);

  // Fade-in animation state
  const [opacity, setOpacity] = useState(0);
  const fadeStartTime = useRef<number | null>(null);
  const FADE_DURATION = 0.5; // seconds

  useFrame((state, delta) => {
    // Handle fade-in animation
    if (fadeStartTime.current === null) {
      fadeStartTime.current = state.clock.elapsedTime;
    }
    const elapsed = state.clock.elapsedTime - fadeStartTime.current;
    const newOpacity = Math.min(1, elapsed / FADE_DURATION);
    if (newOpacity !== opacity) {
      setOpacity(newOpacity);
    }

    if (!material) return;

    // --- Animation Logic (Hybrid JS/Shader) ---

    if (isPlaying) {
        // Use animation speed for classic modes, or procedural time scale for procedural modes
        const speed = (skyboxMode === 'classic' && skyboxAnimationMode !== 'none')
            ? skyboxAnimationSpeed
            : 1.0;

        const TIME_SCALE = 0.01;
        timeRef.current += delta * speed * TIME_SCALE;
    }
    const t = timeRef.current; // Use accumulated time

    // Re-calculate values for animation frame
    let finalRotX = 0;
    let finalRotY = baseRotY;
    let finalRotZ = 0;
    let finalIntensity = skyboxIntensity;
    let finalBlur = skyboxBlur;
    let finalHue = proceduralSettings.hue ?? 0;
    let finalSaturation = proceduralSettings.saturation ?? 1;
    let finalDistortion = 0;
    let finalAberration = 0;

    // Classic Animations
    if (skyboxMode === 'classic' && isPlaying && skyboxAnimationMode !== 'none') {
        switch (skyboxAnimationMode) {
            case 'cinematic':
                finalRotY += t * 0.1;
                finalRotX += Math.sin(t * 0.5) * 0.005;
                finalRotZ += Math.cos(t * 0.3) * 0.003;
                break;
            case 'heatwave':
                finalDistortion = 1.0 + Math.sin(t * 0.5) * 0.5;
                finalRotY += t * 0.02;
                break;
            case 'tumble':
                finalRotX += t * 0.05;
                finalRotY += t * 0.07;
                finalRotZ += t * 0.03;
                break;
            case 'ethereal':
                finalRotY += t * 0.05;
                finalHue = Math.sin(t * 0.1) * 0.1;
                finalIntensity = skyboxIntensity * (1.0 + Math.sin(t * 10) * 0.02);
                break;
            case 'nebula':
                finalHue = (t * 0.05) % 1.0;
                finalRotY += t * 0.03;
                finalIntensity = skyboxIntensity * 1.1;
                break;
        }
    }

    // Reuse objects to avoid per-frame allocations
    eulerRef.current.set(finalRotX, finalRotY, finalRotZ);
    const rotationMatrix = matrix3Ref.current.setFromMatrix4(
      matrix4Ref.current.makeRotationFromEuler(eulerRef.current)
    );

    // Determine numeric mode (must match shader constants)
    // 0=Classic, 1=Aurora, 2=Nebula, 3=Void, 4=Crystalline, 5=Horizon, 6=Ocean, 7=Twilight, 8=Starfield
    let modeInt = 0;
    switch (skyboxMode) {
      case 'procedural_aurora': modeInt = 1; break;
      case 'procedural_nebula': modeInt = 2; break;
      case 'procedural_void': modeInt = 3; break;
      case 'procedural_crystalline': modeInt = 4; break;
      case 'procedural_horizon': modeInt = 5; break;
      case 'procedural_ocean': modeInt = 6; break;
      case 'procedural_twilight': modeInt = 7; break;
      case 'procedural_starfield': modeInt = 8; break;
      default: modeInt = 0; // classic
    }

    // Direct uniform updates for performance
    const uniforms = material.uniforms;

    if (uniforms.uTex) uniforms.uTex.value = texture;

    if (uniforms.uTex) uniforms.uTex.value = texture;
    if (uniforms.uRotation) uniforms.uRotation.value = rotationMatrix;
    if (uniforms.uMode) uniforms.uMode.value = modeInt;
    if (uniforms.uTime) uniforms.uTime.value = t;

    if (uniforms.uBlur) uniforms.uBlur.value = finalBlur;
    if (uniforms.uIntensity) uniforms.uIntensity.value = finalIntensity * opacity;
    if (uniforms.uHue) uniforms.uHue.value = finalHue;
    if (uniforms.uSaturation) uniforms.uSaturation.value = finalSaturation;

    if (uniforms.uScale) uniforms.uScale.value = proceduralSettings.scale;
    if (uniforms.uComplexity) uniforms.uComplexity.value = proceduralSettings.complexity;
    if (uniforms.uTimeScale) uniforms.uTimeScale.value = proceduralSettings.timeScale;
    if (uniforms.uEvolution) uniforms.uEvolution.value = proceduralSettings.evolution;

    if (uniforms.uColor1) uniforms.uColor1.value = color1Vec;
    if (uniforms.uColor2) uniforms.uColor2.value = color2Vec;

    if (uniforms.uPalA) uniforms.uPalA.value = paletteVecs.a;
    if (uniforms.uPalB) uniforms.uPalB.value = paletteVecs.b;
    if (uniforms.uPalC) uniforms.uPalC.value = paletteVecs.c;
    if (uniforms.uPalD) uniforms.uPalD.value = paletteVecs.d;

    if (uniforms.uUsePalette) {
      const useSimpleInterpolation = proceduralSettings.syncWithObject &&
        (colorAlgorithm === 'monochromatic' || colorAlgorithm === 'analogous');
      uniforms.uUsePalette.value = useSimpleInterpolation ? 0.0 : 1.0;
    }

    if (uniforms.uDistortion) uniforms.uDistortion.value = finalDistortion || proceduralSettings.turbulence;
    if (uniforms.uAberration) uniforms.uAberration.value = finalAberration || proceduralSettings.chromaticAberration;
    if (uniforms.uVignette) uniforms.uVignette.value = 0.15;
    if (uniforms.uGrain) uniforms.uGrain.value = proceduralSettings.noiseGrain;
    if (uniforms.uAtmosphere) uniforms.uAtmosphere.value = proceduralSettings.horizon;
    if (uniforms.uTurbulence) uniforms.uTurbulence.value = proceduralSettings.turbulence;
    if (uniforms.uDualTone) uniforms.uDualTone.value = proceduralSettings.dualToneContrast;
    if (uniforms.uSunIntensity) uniforms.uSunIntensity.value = proceduralSettings.sunIntensity;
    if (uniforms.uSunPosition?.value && typeof (uniforms.uSunPosition.value as THREE.Vector3).set === 'function') {
      (uniforms.uSunPosition.value as THREE.Vector3).set(...proceduralSettings.sunPosition);
    }

    if (uniforms.uStarDensity) uniforms.uStarDensity.value = proceduralSettings.starfield.density;
    if (uniforms.uStarBrightness) uniforms.uStarBrightness.value = proceduralSettings.starfield.brightness;
    if (uniforms.uStarSize) uniforms.uStarSize.value = proceduralSettings.starfield.size;
    if (uniforms.uStarTwinkle) uniforms.uStarTwinkle.value = proceduralSettings.starfield.twinkle;
    if (uniforms.uStarGlow) uniforms.uStarGlow.value = proceduralSettings.starfield.glow;
    if (uniforms.uStarColorVariation) uniforms.uStarColorVariation.value = proceduralSettings.starfield.colorVariation;

    if (uniforms.uAuroraCurtainHeight) uniforms.uAuroraCurtainHeight.value = proceduralSettings.aurora?.curtainHeight ?? 0.5;
    if (uniforms.uAuroraWaveFrequency) uniforms.uAuroraWaveFrequency.value = proceduralSettings.aurora?.waveFrequency ?? 1.0;

    if (uniforms.uHorizonGradientContrast) uniforms.uHorizonGradientContrast.value = proceduralSettings.horizonGradient?.gradientContrast ?? 0.5;
    if (uniforms.uHorizonSpotlightFocus) uniforms.uHorizonSpotlightFocus.value = proceduralSettings.horizonGradient?.spotlightFocus ?? 0.5;

    if (uniforms.uOceanCausticIntensity) uniforms.uOceanCausticIntensity.value = proceduralSettings.ocean?.causticIntensity ?? 0.5;
    if (uniforms.uOceanDepthGradient) uniforms.uOceanDepthGradient.value = proceduralSettings.ocean?.depthGradient ?? 0.5;
    if (uniforms.uOceanBubbleDensity) uniforms.uOceanBubbleDensity.value = proceduralSettings.ocean?.bubbleDensity ?? 0.3;
    if (uniforms.uOceanSurfaceShimmer) uniforms.uOceanSurfaceShimmer.value = proceduralSettings.ocean?.surfaceShimmer ?? 0.4;

    if (uniforms.uParallaxEnabled) uniforms.uParallaxEnabled.value = proceduralSettings.parallaxEnabled ? 1.0 : 0.0;
    if (uniforms.uParallaxStrength) uniforms.uParallaxStrength.value = proceduralSettings.parallaxStrength ?? 0.5;
  });

  if (opacity === 0 && fadeStartTime.current === null) {
    return null;
  }

  return (
    <mesh ref={meshRef} data-testid="skybox-mesh">
        {/* Use sphere geometry instead of box - no visible seams at corners */}
        <sphereGeometry args={[500, 64, 32]} />
        <primitive object={material} attach="material" />
    </mesh>
  );
};

/**
 * Inner component that handles async texture loading.
 * Uses manual async loading instead of useLoader to avoid blocking the scene.
 * Signals loading state to pause animation and trigger low-quality rendering.
 * @returns React element handling async skybox texture loading
 */
const SkyboxLoader: React.FC = () => {
  const {
    skyboxEnabled,
    skyboxTexture,
    skyboxHighQuality,
    setSkyboxLoading
  } = useEnvironmentStore(useShallow((state) => ({
    skyboxEnabled: state.skyboxEnabled,
    skyboxTexture: state.skyboxTexture,
    skyboxHighQuality: state.skyboxHighQuality,
    setSkyboxLoading: state.setSkyboxLoading
  })));

  const gl = useThree((state) => state.gl);

  // Manual async texture loading state
  const [texture, setTexture] = useState<THREE.CubeTexture | null>(null);
  const loaderRef = useRef<KTX2Loader | null>(null);

  // Resolve file path
  const ktx2Path = useMemo(() => {
     if (!skyboxTexture || skyboxTexture === 'none') return null;
     const filename = skyboxHighQuality ? 'cubemap_hq.ktx2' : 'cubemap.ktx2';
     const searchStr = `${skyboxTexture}/${filename}`;
     const key = Object.keys(skyboxAssets).find(k => k.endsWith(searchStr));
     return key ? skyboxAssets[key] : null;
  }, [skyboxTexture, skyboxHighQuality]);

  // Manual async texture loading - doesn't block rendering
  useEffect(() => {
    if (!ktx2Path) {
      setTexture(null);
      setSkyboxLoading(false);
      return;
    }

    // Signal loading start - this pauses animation and sets low quality
    setSkyboxLoading(true);

    // Create or reuse loader
    if (!loaderRef.current) {
      loaderRef.current = new KTX2Loader();
      loaderRef.current.setTranscoderPath('/basis/');
      loaderRef.current.detectSupport(gl);
    }

    const loader = loaderRef.current;
    let cancelled = false;

    loader.load(
      ktx2Path,
      (loadedTexture) => {
        if (!cancelled) {
          const cubeTexture = loadedTexture as unknown as THREE.CubeTexture;
          // Configure texture for best quality
          // Note: KTX2 compressed textures cannot generate mipmaps at runtime -
          // they must be pre-baked into the .ktx2 file. Setting generateMipmaps=true
          // causes GL_INVALID_OPERATION on compressed formats.
          cubeTexture.minFilter = THREE.LinearMipmapLinearFilter;
          cubeTexture.magFilter = THREE.LinearFilter;
          cubeTexture.generateMipmaps = false;
          cubeTexture.needsUpdate = true;
          setTexture(cubeTexture);
          // Signal loading complete - resume animation and quality refinement
          setSkyboxLoading(false);
        }
      },
      undefined, // onProgress
      (error) => {
        if (!cancelled) {
          console.error('Failed to load skybox texture:', error);
          setSkyboxLoading(false);
          useMsgBoxStore.getState().showMsgBox(
            'Skybox Load Failed',
            'Could not load the environment texture. Falling back to default lighting.',
            'warning'
          );
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [ktx2Path, gl, setSkyboxLoading]);

  // Cleanup loader on unmount
  useEffect(() => {
    return () => {
      if (loaderRef.current) {
        loaderRef.current.dispose();
        loaderRef.current = null;
      }
    };
  }, []);

  // Convert to PMREM for proper IBL with meshStandardMaterial
  // Without PMREM, the cubemap won't work with roughness/metalness in PBR materials
  const { texture: pmremTexture, isGenerating: isPMREMGenerating } = usePMREMTexture(texture ?? undefined);

  // Set scene.background to the CubeTexture so black hole shader can access it
  // (scene.environment is PMREM which is 2D, but we need actual CubeTexture for samplerCube)
  const scene = useThree((state) => state.scene);
  useEffect(() => {
    if (texture && skyboxEnabled) {
      scene.background = texture;
    }
    return () => {
      // Clear background on unmount or when texture changes
      if (scene.background === texture) {
        scene.background = null;
      }
    };
  }, [texture, skyboxEnabled, scene]);

  // Check if we should render the custom skybox mesh
  const shouldRenderSkybox = Boolean(skyboxEnabled && ktx2Path && texture);

  return (
    <>
        {shouldRenderSkybox && pmremTexture && !isPMREMGenerating ? (
            <Environment
                key={pmremTexture.uuid}
                map={pmremTexture}
                background={false}
            />
        ) : null}

        {shouldRenderSkybox && texture && (
            <SkyboxMesh texture={texture} />
        )}
    </>
  );
};

/**
 * Main Skybox component with async loading support.
 * Uses manual async loading to prevent blocking scene rendering.
 * Falls back to studio environment lighting while skybox is loading.
 * @returns React element rendering the skybox with async texture loading
 */
export const Skybox: React.FC = () => {
  const { skyboxEnabled, skyboxMode } = useEnvironmentStore(useShallow((state) => ({
    skyboxEnabled: state.skyboxEnabled,
    skyboxMode: state.skyboxMode
  })));

  if (!skyboxEnabled) return null;

  // If procedural, use the component that handles environment map generation for wall reflections
  if (skyboxMode !== 'classic') {
    return <ProceduralSkyboxWithEnvironment />;
  }

  return <SkyboxLoader />;
};
