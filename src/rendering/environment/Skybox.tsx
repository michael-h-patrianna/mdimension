import { useAnimationStore } from '@/stores/animationStore';
import { useEnvironmentStore } from '@/stores/environmentStore';
import { Environment, shaderMaterial } from '@react-three/drei';
import { extend, Object3DNode, useFrame, useThree } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader';

// ============================================================================
// PMREM Cache - Module-level cache to avoid regenerating PMREM for same textures
// ============================================================================

interface PMREMCacheEntry {
  pmremTexture: THREE.Texture;
  /** Track usage count to know when to dispose */
  refCount: number;
}

/**
 * Module-level cache for PMREM textures.
 * Keyed by the source texture UUID to avoid regenerating when switching skyboxes.
 */
const pmremCache = new Map<string, PMREMCacheEntry>();

/** Shared PMREMGenerator instance - reused across all conversions */
let sharedPMREMGenerator: THREE.PMREMGenerator | null = null;

/**
 * Get or create the shared PMREMGenerator.
 * Lazily initialized and compiled on first use.
 */
function getSharedPMREMGenerator(gl: THREE.WebGLRenderer): THREE.PMREMGenerator {
  if (!sharedPMREMGenerator) {
    sharedPMREMGenerator = new THREE.PMREMGenerator(gl);
    // Pre-compile shader to avoid stutter on first conversion
    sharedPMREMGenerator.compileEquirectangularShader();
  }
  return sharedPMREMGenerator;
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
      // Increment ref count and use cached texture
      cached.refCount++;
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

          // Store in cache
          pmremCache.set(textureUuid, {
            pmremTexture: envMap,
            refCount: 1,
          });

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

// Standard cubemap order for Three.js
const ORDER = ['right', 'left', 'top', 'bottom', 'front', 'back'];


// --- Shader Definition ---

const SkyboxMaterial = shaderMaterial(
  {
    uTex: null,
    uRotation: new THREE.Matrix3(),
    uBlur: 0,
    uIntensity: 1,
    uHue: 0,
    uSaturation: 1,
    uDistortion: 0,
    uTime: 0,
    uAberration: 0,
  },
  // Vertex Shader
  `
    varying vec3 vWorldDirection;
    uniform mat3 uRotation;

    void main() {
      // Rotate the direction based on the matrix calculated in JS
      vec3 worldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
      vWorldDirection = uRotation * normalize(worldPosition);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // Fragment Shader
  `
    uniform samplerCube uTex;
    uniform float uBlur;
    uniform float uIntensity;
    uniform float uHue;
    uniform float uSaturation;
    uniform float uDistortion;
    uniform float uAberration;
    uniform float uTime;

    varying vec3 vWorldDirection;

    // HSV Helper
    vec3 rgb2hsv(vec3 c) {
        vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
        vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
        vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
        float d = q.x - min(q.w, q.y);
        float e = 1.0e-10;
        return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
    }

    vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }

    void main() {
        vec3 dir = normalize(vWorldDirection);

        // Distortion (Heatwave effect)
        if (uDistortion > 0.0) {
            float noise = sin(dir.y * 20.0 + uTime * 2.0) * 0.01 * uDistortion;
            dir.x += noise;
            dir.z += noise;
            dir = normalize(dir);
        }

        vec4 color;

        // Chromatic Aberration
        if (uAberration > 0.0) {
            vec3 dirR = dir;
            vec3 dirG = dir;
            vec3 dirB = dir;

            float spread = uAberration * 0.02;
            dirR.x += spread;
            dirB.x -= spread;

            // Standard texture lookup (manual LOD approximation usually requires extension,
            // but standard linear interpolation works for basic blur)
            // Note: textureCubeLod requires GLSL3 or extension. We rely on bias for now if available.
            float r = textureCube(uTex, dirR).r;
            float g = textureCube(uTex, dirG).g;
            float b = textureCube(uTex, dirB).b;
            color = vec4(r, g, b, 1.0);
        } else {
            color = textureCube(uTex, dir);
        }

        // Apply Intensity
        color.rgb *= uIntensity;

        // Apply Hue/Saturation
        if (uHue != 0.0 || uSaturation != 1.0) {
            vec3 hsv = rgb2hsv(color.rgb);
            hsv.x += uHue;
            hsv.y *= uSaturation;
            color.rgb = hsv2rgb(hsv);
        }

        gl_FragColor = color;
    }
  `
);

extend({ SkyboxMaterial });

// Add type definition for JSX
declare module '@react-three/fiber' {
  interface ThreeElements {
    skyboxMaterial: Object3DNode<THREE.ShaderMaterial, typeof SkyboxMaterial>
  }
}

// --- Helpers ---

const organicNoise = (t: number, seed: number = 0) => {
  return Math.sin(t) * 0.5 + Math.sin(t * 2.13 + seed) * 0.25 + Math.sin(t * 0.87 + seed + 2) * 0.15;
};

// --- Main Component ---

const SkyboxMesh: React.FC<{ texture: THREE.CubeTexture }> = ({ texture }) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const timeRef = useRef(0);

  const {
    skyboxIntensity,
    skyboxBlur,
    skyboxRotation,
    skyboxAnimationMode,
    skyboxAnimationSpeed
  } = useEnvironmentStore();
  const isPlaying = useAnimationStore((state) => state.isPlaying);

  const baseRotY = skyboxRotation * (Math.PI / 180);

  useFrame((state, delta) => {
    if (!materialRef.current) return;

    // --- Animation Logic (Hybrid JS/Shader) ---

    // ... logic remains ...
    if (isPlaying && skyboxAnimationMode !== 'none') {
        const TIME_SCALE = 0.01;
        timeRef.current += delta * skyboxAnimationSpeed * TIME_SCALE;
    }
    const t = timeRef.current; // Use accumulated time

    // Re-calculate values for animation frame
    let finalRotX = 0;
    let finalRotY = baseRotY;
    let finalRotZ = 0;
    let finalIntensity = skyboxIntensity;
    let finalBlur = skyboxBlur;
    let finalHue = 0;
    let finalSaturation = 1;
    let finalDistortion = 0;
    let finalAberration = 0;

    if (isPlaying && skyboxAnimationMode !== 'none') {
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

    const euler = new THREE.Euler(finalRotX, finalRotY, finalRotZ);
    const rotationMatrix = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromEuler(euler));

    // Direct uniform updates for performance
    materialRef.current.uniforms.uTex.value = texture;
    materialRef.current.uniforms.uRotation.value = rotationMatrix;
    materialRef.current.uniforms.uBlur.value = finalBlur;
    materialRef.current.uniforms.uIntensity.value = finalIntensity;
    materialRef.current.uniforms.uHue.value = finalHue;
    materialRef.current.uniforms.uSaturation.value = finalSaturation;
    materialRef.current.uniforms.uDistortion.value = finalDistortion;
    materialRef.current.uniforms.uAberration.value = finalAberration;
    materialRef.current.uniforms.uTime.value = t;
  });

  // Calculate Initial State for Props (Critical for Environment capture before first frame)
  const initialRotation = useMemo(() => {
      const euler = new THREE.Euler(0, baseRotY, 0);
      return new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromEuler(euler));
  }, [baseRotY]);

  // Fade-in animation state
  const [opacity, setOpacity] = useState(0);
  const fadeStartTime = useRef<number | null>(null);
  const FADE_DURATION = 0.5; // seconds

  useFrame((state) => {
    // Handle fade-in animation
    if (fadeStartTime.current === null) {
      fadeStartTime.current = state.clock.elapsedTime;
    }
    const elapsed = state.clock.elapsedTime - fadeStartTime.current;
    const newOpacity = Math.min(1, elapsed / FADE_DURATION);
    if (newOpacity !== opacity) {
      setOpacity(newOpacity);
    }
  });

  // Don't render until we start fading in
  if (opacity === 0 && fadeStartTime.current === null) {
    return null;
  }

  return (
    <mesh>
        <boxGeometry args={[1000, 1000, 1000]} />
        <skyboxMaterial
            ref={materialRef}
            side={THREE.BackSide}
            transparent={opacity < 1}
            opacity={opacity}
            depthWrite={false}
            // Declarative props for initialization
            uTex={texture}
            uRotation={initialRotation}
            uBlur={skyboxBlur}
            uIntensity={skyboxIntensity * opacity}
            uHue={0}
            uSaturation={1}
            uDistortion={0}
            uAberration={0}
            uTime={0}
        />
    </mesh>
  );
};

/**
 * Inner component that handles async texture loading.
 * Uses manual async loading instead of useLoader to avoid blocking the scene.
 * Signals loading state to pause animation and trigger low-quality rendering.
 */
const SkyboxLoader: React.FC = () => {
  const {
    skyboxEnabled,
    skyboxTexture,
    skyboxHighQuality,
    setSkyboxLoading
  } = useEnvironmentStore();

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
          setTexture(loadedTexture as THREE.CubeTexture);
          // Signal loading complete - resume animation and quality refinement
          setSkyboxLoading(false);
        }
      },
      undefined, // onProgress
      (error) => {
        if (!cancelled) {
          console.error('Failed to load skybox texture:', error);
          setSkyboxLoading(false);
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

  // Check if we should render the custom skybox mesh
  const shouldRenderSkybox = Boolean(skyboxEnabled && ktx2Path && texture);

  return (
    <>
        {/* Environment for Lighting/Reflections (IBL) */}
        {/*
         * Use PMREM-processed texture for scene.environment so that
         * meshStandardMaterial works correctly with roughness/metalness.
         * Raw CubeTextures don't have the prefiltered mipmaps needed for PBR.
         * Fall back to studio preset while PMREM is generating.
         */}
        {shouldRenderSkybox && pmremTexture && !isPMREMGenerating ? (
            <Environment
                key={pmremTexture.uuid}
                map={pmremTexture}
                background={false}
            />
        ) : null}

        {/* Visible Skybox Mesh with Custom Shader (animations, effects, etc.) */}
        {/* Uses the original texture for custom shader effects */}
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
 */
export const Skybox: React.FC = () => {
  const { skyboxEnabled, skyboxTexture } = useEnvironmentStore();

  // Check if skybox should be loaded
  const shouldLoadSkybox = skyboxEnabled && skyboxTexture && skyboxTexture !== 'none';

  return (
    <>
      {/* Async skybox loader - renders immediately, loads texture in background */}
      {/* No fallback environment needed - scene has its own lighting system */}
      {shouldLoadSkybox && <SkyboxLoader />}
    </>
  );
};
