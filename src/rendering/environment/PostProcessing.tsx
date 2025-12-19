/**
 * PostProcessing Component
 *
 * Manages post-processing effects for the Three.js scene including:
 * - UnrealBloomPass for glow effects
 * - Custom depth-based bokeh for depth of field
 * - OutputPass for tone mapping
 *
 * Resources are created lazily and disposed when effects are disabled,
 * minimizing GPU memory usage when effects are not in use.
 *
 * We capture depth by rendering to a WebGLRenderTarget with DepthTexture attached,
 * which correctly captures gl_FragDepth from all custom shaders.
 */

import { CinematicShader } from '@/rendering/shaders/postprocessing/CinematicShader';
import { RENDER_LAYERS, needsObjectOnlyDepth, needsVolumetricSeparation } from '@/rendering/core/layers';
import { TemporalCloudManager } from '@/rendering/core/TemporalCloudManager';
import { TemporalDepthManager } from '@/rendering/core/TemporalDepthManager';
import { CloudTemporalPass } from '@/rendering/passes/CloudTemporalPass';
import { BokehShader, type BokehUniforms } from '@/rendering/shaders/postprocessing/BokehShader';
import { BufferPreviewShader } from '@/rendering/shaders/postprocessing/BufferPreviewShader';
import { RefractionShader, type RefractionUniforms } from '@/rendering/shaders/postprocessing/RefractionShader';
import { SSRShader, type SSRUniforms } from '@/rendering/shaders/postprocessing/SSRShader';
import { TONE_MAPPING_TO_THREE } from '@/rendering/shaders/types';
import { getEffectiveSSRQuality, usePerformanceStore } from '@/stores';
import { SSR_QUALITY_STEPS, type SSRQuality } from '@/stores/defaults/visualDefaults';
import { useGeometryStore } from '@/stores/geometryStore';
import { useLightingStore } from '@/stores/lightingStore';
import { usePerformanceMetricsStore, type BufferStats } from '@/stores/performanceMetricsStore';
import { usePostProcessingStore } from '@/stores/postProcessingStore';
import { useUIStore } from '@/stores/uiStore';
import { useRotationStore } from '@/stores/rotationStore';
import { useWebGLContextStore } from '@/stores/webglContextStore';
import { useFrame, useThree } from '@react-three/fiber';
import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
// SMAAShader imports not needed - we modify SMAAPass internals directly
import { TexturePass } from 'three/examples/jsm/postprocessing/TexturePass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { useShallow } from 'zustand/react/shallow';
import { isPolytopeCategory } from '@/lib/geometry/registry/helpers';

/**
 * Update uResolution uniform on all meshes in the VOLUMETRIC layer.
 * This is critical for Schroedinger with temporal accumulation, which needs to know
 * whether it's rendering at quarter-res (cloudTarget) or full-res (objectDepthTarget).
 */
const volumetricLayerMask = new THREE.Layers();
volumetricLayerMask.set(RENDER_LAYERS.VOLUMETRIC);

/**
 * P2 Optimization: Cached version that stores volumetric mesh references.
 * Only traverses scene when cache is invalid, then updates uniforms directly.
 *
 * CRITICAL FIX: Only marks cache as valid if meshes were found.
 * This fixes a race condition when switching object types:
 * 1. Object type changes → cache invalidated
 * 2. useFrame runs before React re-renders
 * 3. Cache rebuild finds nothing (new mesh not mounted yet)
 * 4. If we mark valid here, subsequent frames skip rebuild
 * 5. New volumetric mesh never gets uResolution updated
 * 6. Bug: "enlarged, top-right" rendering due to coordinate mismatch
 */
function updateVolumetricResolutionCached(
  scene: THREE.Scene,
  width: number,
  height: number,
  cachedMeshes: Set<THREE.Mesh>,
  isValid: { current: boolean }
): void {
  // Rebuild cache if invalid
  if (!isValid.current) {
    cachedMeshes.clear();
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh && obj.layers.test(volumetricLayerMask)) {
        cachedMeshes.add(obj as THREE.Mesh);
      }
    });
    // Only mark valid if we found meshes - if empty, keep invalid
    // so we rebuild next frame (when new mesh might have mounted)
    isValid.current = cachedMeshes.size > 0;
  }

  // Update uniforms on cached meshes
  for (const mesh of cachedMeshes) {
    const material = mesh.material as THREE.ShaderMaterial;
    if (material.uniforms?.uResolution) {
      material.uniforms.uResolution.value.set(width, height);
    }
  }
}

/**
 * Normal material for G-buffer rendering.
 * MeshNormalMaterial outputs view-space normals encoded as RGB.
 * Used by SSR for accurate reflection direction calculation.
 * Created once and reused across frames for performance.
 */
const normalMaterial = new THREE.MeshNormalMaterial({
  blending: THREE.NoBlending,
});

/** Raycaster for auto-focus depth detection - only targets main object layer */
const autoFocusRaycaster = new THREE.Raycaster();
autoFocusRaycaster.layers.set(RENDER_LAYERS.MAIN_OBJECT);
const screenCenter = new THREE.Vector2(0, 0);
/** Reusable Color object for getClearColor (avoid per-frame allocation) */
const tempClearColor = new THREE.Color();

// ============================================================================
// Shader Constants
// ============================================================================
/**
 * Depth threshold for far plane detection.
 * Values >= this are considered background/sky and should be discarded.
 * Using 0.9999 instead of 1.0 to handle floating point precision.
 */
const FAR_PLANE_DEPTH_THRESHOLD = 0.9999;

/**
 * Minimum normal magnitude to consider a pixel valid.
 * Encoded normals map [-1,1] to [0,1], so valid normals have magnitude ~0.5.
 * Clear/empty pixels have [0,0,0,0], so anything below this threshold is discarded.
 */
const NORMAL_MAGNITUDE_EPSILON = 0.01;

export const PostProcessing = memo(function PostProcessing() {
  const { gl, scene, camera, size } = useThree();
  const originalToneMapping = useRef<THREE.ToneMapping>(gl.toneMapping);
  const originalExposure = useRef<number>(gl.toneMappingExposure);
  const currentFocusRef = useRef<number>(15);
  const autoFocusDistanceRef = useRef<number>(15);

  // Context restore counter - forces useMemo recreation when context is restored
  // This ensures all render targets and passes are recreated with fresh GPU resources
  const restoreCount = useWebGLContextStore((s) => s.restoreCount);

  // Track the restoreCount when resources were created
  // Used to detect context recovery and skip disposal of dead context resources
  const createdAtRestoreCountRef = useRef(restoreCount);

  const {
    bloomEnabled,
    bloomIntensity,
    bloomThreshold,
    bloomRadius,
    bokehEnabled,
    ssrEnabled,
    refractionEnabled,
    antiAliasingMethod,
    smaaThreshold,
  } = usePostProcessingStore(
    useShallow((state) => ({
      bloomEnabled: state.bloomEnabled,
      bloomIntensity: state.bloomIntensity,
      bloomThreshold: state.bloomThreshold,
      bloomRadius: state.bloomRadius,
      bokehEnabled: state.bokehEnabled,
      ssrEnabled: state.ssrEnabled,
      refractionEnabled: state.refractionEnabled,
      antiAliasingMethod: state.antiAliasingMethod,
      smaaThreshold: state.smaaThreshold,
      // Cinematic
      cinematicEnabled: state.cinematicEnabled,
      cinematicAberration: state.cinematicAberration,
      cinematicVignette: state.cinematicVignette,
      cinematicGrain: state.cinematicGrain,
    }))
  );

  const {
    toneMappingEnabled,
    toneMappingAlgorithm,
    exposure,
  } = useLightingStore(
    useShallow((state) => ({
      toneMappingEnabled: state.toneMappingEnabled,
      toneMappingAlgorithm: state.toneMappingAlgorithm,
      exposure: state.exposure,
    }))
  );

  const {
    showDepthBuffer,
    showNormalBuffer,
  } = useUIStore(
    useShallow((state) => ({
      showDepthBuffer: state.showDepthBuffer,
      showNormalBuffer: state.showNormalBuffer,
      showTemporalDepthBuffer: state.showTemporalDepthBuffer,
    }))
  );

  // Tone mapping setup
  useEffect(() => {
    originalToneMapping.current = gl.toneMapping;
    originalExposure.current = gl.toneMappingExposure;
    return () => {
      gl.toneMapping = originalToneMapping.current;
      gl.toneMappingExposure = originalExposure.current;
    };
  }, [gl]);

  useEffect(() => {
    if (toneMappingEnabled) {
      gl.toneMapping = TONE_MAPPING_TO_THREE[toneMappingAlgorithm] as THREE.ToneMapping;
      gl.toneMappingExposure = exposure;
    } else {
      gl.toneMapping = THREE.NoToneMapping;
      gl.toneMappingExposure = 1;
    }
  }, [gl, toneMappingEnabled, toneMappingAlgorithm, exposure]);

  // Create render target for scene with depth texture
  // Using a single render target instead of MRT for compatibility with Three.js built-in materials
  // SSR/refraction use depth-based normal reconstruction as fallback
  //
  // IMPORTANT: We create these once and resize them separately to avoid
  // recreating the entire pipeline on every resolution change (which causes black flashes)
  const { composer, bloomPass, bokehPass, ssrPass, refractionPass, bufferPreviewPass, cinematicPass, filmPass, fxaaPass, smaaPass, sceneTarget, objectDepthTarget, normalTarget, mainObjectMRT, normalCopyScene, normalCopyCamera, normalCopyMaterial, volumetricNormalCopyScene, volumetricNormalCopyMaterial, cloudCompositeScene, cloudCompositeCamera, cloudCompositeMaterial, texturePass, cloudTemporalPass } = useMemo(() => {
    // Track when these resources were created for cleanup logic
    createdAtRestoreCountRef.current = restoreCount;

    // Use a reasonable initial size - will be resized immediately in useEffect
    const initialWidth = Math.max(1, size.width);
    const initialHeight = Math.max(1, size.height);

    // Create single render target with depth texture (full scene)
    const renderTarget = new THREE.WebGLRenderTarget(initialWidth, initialHeight, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      type: THREE.HalfFloatType,
      depthBuffer: true,
      stencilBuffer: false,
    });

    renderTarget.texture.name = 'SceneColor';
    // Mark texture as containing linear color data (our shaders output linear values)
    // OutputPass will handle the linear-to-sRGB conversion for display
    renderTarget.texture.colorSpace = THREE.LinearSRGBColorSpace;
    // Add depth texture for full-scene depth (includes walls, gizmos, axes)
    // Used by SSR to allow object reflections on walls
    const sceneDepthTex = new THREE.DepthTexture(initialWidth, initialHeight);
    sceneDepthTex.format = THREE.DepthFormat;
    sceneDepthTex.type = THREE.UnsignedShortType;
    sceneDepthTex.minFilter = THREE.NearestFilter;
    sceneDepthTex.magFilter = THREE.NearestFilter;
    renderTarget.depthTexture = sceneDepthTex;

    // Create normal render target for G-buffer (SSR needs view-space normals)
    // This target receives environment normals (via MeshNormalMaterial) and
    // main object normals (via layer-based MRT compositing)
    const normalTarget = new THREE.WebGLRenderTarget(initialWidth, initialHeight, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      depthBuffer: true, // Need depth for compositing main object normals
      stencilBuffer: false,
    });
    normalTarget.texture.name = 'NormalBuffer';
    // Add depth texture for proper depth-based normal compositing
    const normalDepthTex = new THREE.DepthTexture(initialWidth, initialHeight);
    normalDepthTex.format = THREE.DepthFormat;
    normalDepthTex.type = THREE.UnsignedShortType;
    normalTarget.depthTexture = normalDepthTex;

    // Create MRT for main object normal capture
    // Main objects output gColor to texture[0] and gNormal to texture[1]
    // We only need texture[1] (normals), texture[0] is discarded
    // Using WebGLRenderTarget with count option (WebGLMultipleRenderTargets was deprecated)
    const mainObjectMRT = new THREE.WebGLRenderTarget(initialWidth, initialHeight, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      depthBuffer: true,
      stencilBuffer: false,
      count: 2, // Two color attachments for MRT
    });
    mainObjectMRT.textures[0]!.name = 'MainObjectColor_Discarded';
    mainObjectMRT.textures[1]!.name = 'MainObjectNormal';
    // Add depth texture for proper occlusion testing
    const mainObjectDepthTex = new THREE.DepthTexture(initialWidth, initialHeight);
    mainObjectDepthTex.format = THREE.DepthFormat;
    mainObjectDepthTex.type = THREE.UnsignedShortType;
    mainObjectMRT.depthTexture = mainObjectDepthTex;

    // Create copy material for transferring MRT normal texture to normalTarget
    // Uses depth testing for reliable compositing (alpha blending was unreliable)
    const normalCopyMaterial = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        tNormal: { value: null },
        tDepth: { value: null },
      },
      vertexShader: /* glsl */ `
        out vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D tNormal;
        uniform sampler2D tDepth;
        in vec2 vUv;
        out vec4 fragColor;

        #define FAR_PLANE_DEPTH_THRESHOLD ${FAR_PLANE_DEPTH_THRESHOLD}

        void main() {
          float depth = texture(tDepth, vUv).r;

          // Discard background pixels (depth at far plane)
          // This preserves environment normals via depth test
          if (depth >= FAR_PLANE_DEPTH_THRESHOLD) {
            discard;
          }

          fragColor = texture(tNormal, vUv);
          // Write object depth so depth test works correctly
          gl_FragDepth = depth;
        }
      `,
      depthTest: true,  // Enable depth test - only write where object is in front
      depthWrite: true, // Write depth for proper compositing
      transparent: false,
    });
    
    const normalCopyQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), normalCopyMaterial);
    const normalCopyScene = new THREE.Scene();
    normalCopyScene.add(normalCopyQuad);
    const normalCopyCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Create a separate material for volumetric normal copying (no depth check)
    // Volumetric normals are rendered at quarter resolution and need to be upsampled
    // Uses discard for pixels without volumetric data
    const volumetricNormalCopyMaterial = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        tNormal: { value: null },
      },
      vertexShader: /* glsl */ `
        out vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D tNormal;
        in vec2 vUv;
        out vec4 fragColor;

        #define NORMAL_MAGNITUDE_EPSILON ${NORMAL_MAGNITUDE_EPSILON}

        void main() {
          vec4 normal = texture(tNormal, vUv);
          // Check if this pixel has volumetric data
          // Valid encoded normals should be around 0.5 ([-1,1] mapped to [0,1])
          // Clear value is [0,0,0,0], so check for near-zero
          float normalMagnitude = length(normal.rgb);
          if (normalMagnitude < NORMAL_MAGNITUDE_EPSILON) {
            discard; // No volumetric data - preserve existing content
          }
          fragColor = normal;
        }
      `,
      depthTest: false,  // No depth test - volumetric has no depth buffer at this res
      depthWrite: false,
      transparent: false,
    });
    const volumetricNormalCopyQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), volumetricNormalCopyMaterial);
    const volumetricNormalCopyScene = new THREE.Scene();
    volumetricNormalCopyScene.add(volumetricNormalCopyQuad);

    // Create material for compositing volumetric clouds
    const cloudCompositeMaterial = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        tCloud: { value: null },
      },
      vertexShader: /* glsl */ `
        out vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D tCloud;
        in vec2 vUv;
        out vec4 fragColor;
        void main() {
          vec4 cloud = texture(tCloud, vUv);
          // Input color is already premultiplied by alpha from the volume accumulation
          // Output: rgb = src.rgb, alpha = src.a
          fragColor = cloud;
        }
      `,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      // Premultiplied alpha blending: result = src + dst * (1 - src.a)
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });

    const cloudCompositeQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), cloudCompositeMaterial);
    cloudCompositeQuad.frustumCulled = false;
    const cloudCompositeScene = new THREE.Scene();
    cloudCompositeScene.add(cloudCompositeQuad);
    const cloudCompositeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    cloudCompositeCamera.position.z = 0.5; // Ensure it's not clipped by near plane

    // Create object-only depth target for refraction/bokeh
    // SSR uses full-scene depth to allow reflections on walls
    // This excludes environment objects (walls, gizmos) from depth-based effects
    const objectDepth = new THREE.WebGLRenderTarget(initialWidth, initialHeight, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
      stencilBuffer: false,
    });
    objectDepth.texture.name = 'ObjectDepthColor';
    const objectDepthTex = new THREE.DepthTexture(initialWidth, initialHeight);
    objectDepthTex.format = THREE.DepthFormat;
    objectDepthTex.type = THREE.UnsignedShortType;
    objectDepthTex.minFilter = THREE.NearestFilter;
    objectDepthTex.magFilter = THREE.NearestFilter;
    objectDepth.depthTexture = objectDepthTex;

    // Create composer - we'll manually render scene to target, then use TexturePass
    const effectComposer = new EffectComposer(gl);

    // Ensure composer's internal render targets use LinearFilter for proper AA sampling
    effectComposer.renderTarget1.texture.minFilter = THREE.LinearFilter;
    effectComposer.renderTarget1.texture.magFilter = THREE.LinearFilter;
    effectComposer.renderTarget2.texture.minFilter = THREE.LinearFilter;
    effectComposer.renderTarget2.texture.magFilter = THREE.LinearFilter;

    // TexturePass to copy from our pre-rendered scene
    const texPass = new TexturePass(renderTarget.texture);
    effectComposer.addPass(texPass);

    // === ANTI-ALIASING PASSES (must come EARLY, before blur effects) ===
    // AA must run on clean rendered edges before bloom/bokeh blur them away.
    // See: https://discourse.threejs.org/t/how-to-solve-the-anlias-after-n8ao-pass-i-used-smaa-but-not-work-well/60104

    // FXAA - fast approximate anti-aliasing
    const fxaa = new ShaderPass(FXAAShader);
    fxaa.enabled = false;
    effectComposer.addPass(fxaa);

    // SMAA - subpixel morphological anti-aliasing (higher quality than FXAA)
    // Set initial threshold here, dynamic updates handled via useEffect
    const smaa = new SMAAPass();
    smaa.enabled = false;

    // Set initial threshold (lower = more aggressive edge detection)
    const smaaInternal = smaa as unknown as { _materialEdges: THREE.ShaderMaterial };
    if (smaaInternal._materialEdges?.defines) {
      smaaInternal._materialEdges.defines['SMAA_THRESHOLD'] = '0.05';
      smaaInternal._materialEdges.needsUpdate = true;
    }

    effectComposer.addPass(smaa);

    // === BLUR/DISTORTION EFFECTS (after AA) ===

    // Bloom - glow effect
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(initialWidth, initialHeight),
      bloomIntensity,
      bloomRadius,
      bloomThreshold
    );
    effectComposer.addPass(bloom);

    // Bokeh - depth of field blur
    const bokeh = new ShaderPass(BokehShader);
    bokeh.enabled = false;
    effectComposer.addPass(bokeh);

    // SSR - screen space reflections
    const ssr = new ShaderPass(SSRShader);
    ssr.enabled = false;
    effectComposer.addPass(ssr);

    // Refraction - glass/liquid distortion
    const refraction = new ShaderPass(RefractionShader);
    refraction.enabled = false;
    effectComposer.addPass(refraction);

    // Buffer Preview - Debug visualization (Depth, Normal, etc.)
    const bufferPreview = new ShaderPass(BufferPreviewShader);
    bufferPreview.enabled = false;
    effectComposer.addPass(bufferPreview);

    // Cinematic Pass - Chromatic Aberration, Vignette
    const cinematic = new ShaderPass(CinematicShader);
    effectComposer.addPass(cinematic);

    // Film Grain (Separate pass for proper noise)
    const film = new FilmPass(0.35, false);
    effectComposer.addPass(film);

    // Output - tone mapping and final output
    const outputPass = new OutputPass();
    effectComposer.addPass(outputPass);

    // Cloud Temporal Pass - Horizon-style temporal accumulation for volumetric
    // Note: This pass is NOT added to the composer because it renders to its own targets
    // The reconstruction result is composited manually in useFrame
    const cloudTemporal = new CloudTemporalPass({
      historyWeight: 0.85,
      disocclusionThreshold: 0.15,
    });

    return {
      composer: effectComposer,
      bloomPass: bloom,
      bokehPass: bokeh,
      ssrPass: ssr,
      refractionPass: refraction,
      bufferPreviewPass: bufferPreview,
      cinematicPass: cinematic,
      filmPass: film,
      fxaaPass: fxaa,
      smaaPass: smaa,
      sceneTarget: renderTarget,
      objectDepthTarget: objectDepth,
      normalTarget: normalTarget,
      mainObjectMRT: mainObjectMRT,
      normalCopyScene,
      normalCopyCamera,
      normalCopyMaterial,
      volumetricNormalCopyScene,
      volumetricNormalCopyMaterial,
      cloudCompositeScene,
      cloudCompositeMaterial,
      cloudCompositeCamera,
      texturePass: texPass,
      cloudTemporalPass: cloudTemporal,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, restoreCount]); // Recreate when gl changes or context is restored

  // GTAO Pass - created separately because it needs scene/camera references
  // Only used for mesh-based objects (polytopes) - SDF/volumetric objects have shader-based AO
  const gtaoPassRef = useRef<GTAOPass | null>(null);
  const gtaoComposerRef = useRef<EffectComposer | null>(null);
  const prevGtaoEnabledRef = useRef(false);

  // Initialize/recreate GTAO pass when context changes
  useEffect(() => {
    // Dispose old resources
    if (gtaoPassRef.current) {
      gtaoPassRef.current.dispose();
      gtaoPassRef.current = null;
    }
    if (gtaoComposerRef.current) {
      gtaoComposerRef.current.dispose();
      gtaoComposerRef.current = null;
    }

    // Create new GTAO pass and dedicated composer
    const width = Math.max(1, size.width);
    const height = Math.max(1, size.height);

    const gtaoPass = new GTAOPass(scene, camera, width, height);
    gtaoPass.output = GTAOPass.OUTPUT.Default; // Blend AO with scene
    gtaoPass.enabled = true; // Enable by default - we control whether to run the composer

    // Create a dedicated composer for GTAO
    // This allows us to render GTAO independently of the main post-processing chain
    const gtaoComposer = new EffectComposer(gl);
    gtaoComposer.setSize(width, height);

    // Add texture pass to read from sceneTarget
    const texPass = new TexturePass(sceneTarget.texture);
    gtaoComposer.addPass(texPass);
    gtaoComposer.addPass(gtaoPass);

    gtaoPassRef.current = gtaoPass;
    gtaoComposerRef.current = gtaoComposer;

    return () => {
      gtaoPass.dispose();
      gtaoComposer.dispose();
    };
  }, [gl, scene, camera, size.width, size.height, sceneTarget.texture, restoreCount]);

  // Update bloom pass enabled state and parameters
  useEffect(() => {
    bloomPass.enabled = bloomEnabled;
    if (bloomEnabled) {
      bloomPass.strength = bloomIntensity;
      bloomPass.threshold = bloomThreshold;
      bloomPass.radius = bloomRadius;
    }
  }, [bloomPass, bloomEnabled, bloomIntensity, bloomThreshold, bloomRadius]);

  // Update bokeh enabled state (also enabled when showing depth/normal buffer)
  useEffect(() => {
    bokehPass.enabled = bokehEnabled || showDepthBuffer || showNormalBuffer;
  }, [bokehPass, bokehEnabled, showDepthBuffer, showNormalBuffer]);

  // Update SSR enabled state
  useEffect(() => {
    ssrPass.enabled = ssrEnabled;
  }, [ssrPass, ssrEnabled]);

  // Update refraction enabled state
  useEffect(() => {
    refractionPass.enabled = refractionEnabled;
  }, [refractionPass, refractionEnabled]);

  // Update anti-aliasing enabled state and resolution
  useEffect(() => {
    // Disable both passes first, then enable the selected one
    fxaaPass.enabled = antiAliasingMethod === 'fxaa';
    smaaPass.enabled = antiAliasingMethod === 'smaa';

    // Update FXAA resolution when active
    if (antiAliasingMethod === 'fxaa') {
      const uniforms = fxaaPass.material.uniforms;
      if (uniforms['resolution']?.value) {
        uniforms['resolution'].value.set(1 / size.width, 1 / size.height);
      }
    }
    // Note: SMAA setSize is handled automatically by composer.setSize() in resize effect
  }, [fxaaPass, smaaPass, antiAliasingMethod, size.width, size.height]);

  const setShaderDebugInfo = usePerformanceStore((state) => state.setShaderDebugInfo);

  // Update Cinematic Shader Debug Info
  useEffect(() => {
    if (cinematicPass) {
        setShaderDebugInfo('cinematic', {
            name: 'Cinematic Post-Process',
            vertexShaderLength: cinematicPass.material.vertexShader.length,
            fragmentShaderLength: cinematicPass.material.fragmentShader.length,
            activeModules: ['Chromatic Aberration', 'Vignette', 'Film Grain'],
            features: ['Dynamic Distortion', 'Noise'],
        });
    }
    return () => setShaderDebugInfo('cinematic', null);
  }, [cinematicPass, setShaderDebugInfo]);

  // Update SMAA threshold when it changes
  // Note: Changing defines at runtime requires shader recompilation.
  // We force this by also updating the version to invalidate the shader program.
  useEffect(() => {
    const smaaInternal = smaaPass as unknown as { _materialEdges: THREE.ShaderMaterial };
    const edgesMaterial = smaaInternal._materialEdges;
    if (!edgesMaterial || !edgesMaterial.defines) return;

    // Update the threshold define
    edgesMaterial.defines['SMAA_THRESHOLD'] = smaaThreshold.toFixed(3);

    // Force shader recompilation by incrementing version and marking for update
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (edgesMaterial as any).version++;
    edgesMaterial.needsUpdate = true;
  }, [smaaPass, smaaThreshold]);

  // Resize - handles both window resize and resolution scaling changes
  useEffect(() => {
    const width = Math.max(1, size.width);
    const height = Math.max(1, size.height);

    // composer.setSize calls setSize on all passes (including SMAA)
    composer.setSize(width, height);
    bloomPass.resolution.set(width, height);
    sceneTarget.setSize(width, height);

    // Resize scene depth texture (for SSR with walls)
    if (sceneTarget.depthTexture) {
      sceneTarget.depthTexture.image.width = width;
      sceneTarget.depthTexture.image.height = height;
      sceneTarget.depthTexture.needsUpdate = true;
    }

    // Resize object depth target and its depth texture
    objectDepthTarget.setSize(width, height);
    // DepthTexture needs manual resize via image property
    if (objectDepthTarget.depthTexture) {
      objectDepthTarget.depthTexture.image.width = width;
      objectDepthTarget.depthTexture.image.height = height;
      objectDepthTarget.depthTexture.needsUpdate = true;
    }

    // Resize normal render target (for SSR G-buffer)
    normalTarget.setSize(width, height);
    if (normalTarget.depthTexture) {
      normalTarget.depthTexture.image.width = width;
      normalTarget.depthTexture.image.height = height;
      normalTarget.depthTexture.needsUpdate = true;
    }

    // Resize main object MRT (for capturing main object normals)
    mainObjectMRT.setSize(width, height);
    if (mainObjectMRT.depthTexture) {
      mainObjectMRT.depthTexture.image.width = width;
      mainObjectMRT.depthTexture.image.height = height;
      mainObjectMRT.depthTexture.needsUpdate = true;
    }

    // Update texture pass with new texture reference after resize (color buffer)
    texturePass.map = sceneTarget.texture;

    const bokehUniforms = bokehPass.uniforms as unknown as BokehUniforms;
    bokehUniforms.aspect.value = height / width;

    // Update SSR uniforms
    const ssrUniforms = ssrPass.uniforms as unknown as SSRUniforms;
    ssrUniforms.resolution.value.set(width, height);

    // Update refraction uniforms
    const refractionUniforms = refractionPass.uniforms as unknown as RefractionUniforms;
    refractionUniforms.resolution.value.set(width, height);
  }, [composer, bloomPass, bokehPass, ssrPass, refractionPass, bufferPreviewPass, sceneTarget, objectDepthTarget, normalTarget, mainObjectMRT, normalCopyScene, normalCopyCamera, texturePass, size.width, size.height]);

  // Initialize temporal depth manager on mount, resize, and context restore
  // CRITICAL: Use useLayoutEffect to ensure initialization happens BEFORE first render
  // This ensures uniforms have valid dimensions before SchroedingerMesh renders
  useLayoutEffect(() => {
    TemporalDepthManager.initialize(size.width, size.height, gl);
  }, [gl, size.width, size.height, restoreCount]);

  // Initialize temporal cloud manager and pass on mount, resize, and context restore
  // CRITICAL: Use useLayoutEffect to ensure initialization happens BEFORE first render
  useLayoutEffect(() => {
    TemporalCloudManager.initialize(size.width, size.height, gl);
    cloudTemporalPass.setSize(size.width, size.height);
  }, [cloudTemporalPass, size.width, size.height, gl, restoreCount]);

  // Update buffer stats for debugging (on demand, not every frame)
  useEffect(() => {
    const temporalDims = TemporalDepthManager.getDimensions();
    const bufferStats: BufferStats = {
      screen: { width: size.width, height: size.height },
      depth: {
        width: objectDepthTarget.width,
        height: objectDepthTarget.height
      },
      normal: {
        width: normalTarget.width,
        height: normalTarget.height
      },
      temporal: temporalDims,
    };
    usePerformanceMetricsStore.getState().updateBufferStats(bufferStats);
  }, [size.width, size.height, objectDepthTarget, normalTarget]);

  // Cleanup on unmount only
  // NOTE: Skip disposal if context was restored - old resources belong to dead context
  // and disposing them causes "object does not belong to this context" errors
  useEffect(() => {
    // Capture the restoreCount at the time these resources were created
    const createdAt = createdAtRestoreCountRef.current;

    return () => {
      // Get current restoreCount to detect if context was restored
      const currentRestoreCount = useWebGLContextStore.getState().restoreCount;

      // If restoreCount increased, context was restored and these resources are from a dead context
      // Skip disposal to avoid "object does not belong to this context" errors
      // The old GPU resources are already invalid and will be garbage collected by the browser
      if (currentRestoreCount > createdAt) {
        return;
      }

      // Normal cleanup for unmount (when context is still valid)
      composer.dispose();
      sceneTarget.dispose();
      objectDepthTarget.dispose();
      normalTarget.dispose();
      mainObjectMRT.dispose();
      normalCopyMaterial.dispose();
      volumetricNormalCopyMaterial.dispose();
      cloudCompositeMaterial.dispose();
      cloudTemporalPass.dispose();

      // NOTE: Do NOT dispose TemporalDepthManager and TemporalCloudManager here!
      // They are singletons managed by resourceRecovery. Disposing them here would
      // null out their render targets that may have been just reinitialized.
      // Their lifecycle is: resourceRecovery.invalidate() → resourceRecovery.reinitialize()
    };
  }, [composer, sceneTarget, objectDepthTarget, normalTarget, mainObjectMRT, normalCopyMaterial, cloudCompositeMaterial, cloudTemporalPass, volumetricNormalCopyMaterial]);

  const prevRotationsRef = useRef<Map<string, number>>(new Map());
  const rotationVelocityRef = useRef(0);
  const transitionTraumaRef = useRef(0);
  const prevDimensionRef = useRef(useRotationStore.getState().dimension);

  // Performance optimization: Cache store state in refs to avoid getState() calls every frame
  // These refs are updated via subscriptions, eliminating per-frame store reads
  const ppStateRef = useRef(usePostProcessingStore.getState());
  const uiStateRef = useRef(useUIStore.getState());
  const rotationStateRef = useRef(useRotationStore.getState());
  const perfStateRef = useRef(usePerformanceStore.getState());
  const geometryStateRef = useRef(useGeometryStore.getState());

  // Subscribe to store changes to update refs
  useEffect(() => {
    const unsubPP = usePostProcessingStore.subscribe((s) => { ppStateRef.current = s; });
    const unsubUI = useUIStore.subscribe((s) => { uiStateRef.current = s; });
    const unsubRot = useRotationStore.subscribe((s) => { rotationStateRef.current = s; });
    const unsubPerf = usePerformanceStore.subscribe((s) => { perfStateRef.current = s; });
    const unsubGeo = useGeometryStore.subscribe((s) => {
      // Invalidate caches when geometry changes
      if (s.objectType !== geometryStateRef.current.objectType) {
        volumetricMeshesValidRef.current = false;
        mainObjectCountCacheRef.current.valid = false;
      }
      geometryStateRef.current = s;
    });
    // Also invalidate mesh caches when dimension changes (affects geometry)
    const unsubRotDim = useRotationStore.subscribe((s) => {
      if (s.dimension !== rotationStateRef.current.dimension) {
        volumetricMeshesValidRef.current = false;
        mainObjectCountCacheRef.current.valid = false;
      }
    });
    return () => {
      unsubPP();
      unsubUI();
      unsubRot();
      unsubPerf();
      unsubGeo();
      unsubRotDim();
    };
  }, []);

  // P2 Optimization: Cache scene traversal results to avoid per-frame traversals
  // uniqueVertices only changes when geometry changes (objectType/dimension)
  const cachedUniqueVerticesRef = useRef({ count: 0, key: '' });
  // Volumetric meshes for updateVolumetricResolution - invalidate when scene changes
  const volumetricMeshesRef = useRef<Set<THREE.Mesh>>(new Set());
  const volumetricMeshesValidRef = useRef(false);
  // Main object count cache
  const mainObjectCountCacheRef = useRef({ count: 0, valid: false });

  // P3 Optimization: Reusable Maps to avoid per-frame allocations
  // These Maps store material state during render passes and are cleared/reused each frame
  const savedDepthWriteForObjectPassRef = useRef<Map<THREE.Material, boolean>>(new Map());
  const savedDepthWriteRef = useRef<Map<THREE.Material, boolean>>(new Map());
  const savedPropsForMRTPassRef = useRef<Map<THREE.Material, { transparent: boolean; depthWrite: boolean; blending: THREE.Blending }>>(new Map());

  // Render
  useFrame((_, delta) => {
    // Use cached state refs instead of getState() for performance
    const ppState = ppStateRef.current;
    const uiState = uiStateRef.current;

    // Update Cinematic Shader (Dynamic Chromatic Aberration)
    const rotationState = rotationStateRef.current;
    const rotations = rotationState.rotations;
    const currentDimension = rotationState.dimension;

    // Detect dimension change for transition effect
    if (currentDimension !== prevDimensionRef.current) {
        transitionTraumaRef.current = 1.0;
        prevDimensionRef.current = currentDimension;
    }

    // Decay trauma
    transitionTraumaRef.current = Math.max(0, transitionTraumaRef.current - delta * 2.0); // 0.5s fade

    let totalDiff = 0;
    const prevRotations = prevRotationsRef.current;
    
    for (const [plane, angle] of rotations) {
      const prev = prevRotations.get(plane) ?? angle;
      let diff = Math.abs(angle - prev);
      if (diff > Math.PI) diff = 2 * Math.PI - diff; // Handle wrap
      totalDiff += diff;
    }
    // Update ref with new map (copy)
    prevRotationsRef.current = new Map(rotations);

    // Calculate angular velocity (rad/s)
    const currentVelocity = totalDiff / (Math.max(delta, 0.001));
    // Smooth it
    rotationVelocityRef.current += (currentVelocity - rotationVelocityRef.current) * 0.1;
    
    // Map velocity to distortion
    // Base user setting + dynamic velocity + transition trauma
    // Clamp to reasonable max to avoid nausea
    const dynamicAberration = Math.min(rotationVelocityRef.current * 0.005, 0.03) + (transitionTraumaRef.current * 0.05);
    const totalAberration = ppState.cinematicAberration + dynamicAberration;
    
    cinematicPass.enabled = ppState.cinematicEnabled;
    if (cinematicPass.material.uniforms['uTime']) {
        cinematicPass.material.uniforms['uTime'].value += delta;
    }
    if (cinematicPass.material.uniforms['uDistortion']) {
        cinematicPass.material.uniforms['uDistortion'].value = totalAberration;
    }
    if (cinematicPass.material.uniforms['uVignetteDarkness']) {
        cinematicPass.material.uniforms['uVignetteDarkness'].value = ppState.cinematicVignette;
    }
    
    // Update Film Pass (grain effect)
    filmPass.enabled = ppState.cinematicEnabled && ppState.cinematicGrain > 0;
    // FilmPass in Three.js r150+ uses intensity property directly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filmUniforms = (filmPass as any).uniforms;
    if (filmUniforms?.nIntensity) {
        filmUniforms.nIntensity.value = ppState.cinematicGrain;
    }
    if (filmUniforms?.time) {
        filmUniforms.time.value += delta;
    }

    const currentBloomEnabled = ppState.bloomEnabled;
    const currentBokehEnabled = ppState.bokehEnabled;
    const currentShowDepthBuffer = uiState.showDepthBuffer;
    const currentShowNormalBuffer = uiState.showNormalBuffer;
    const currentShowTemporalDepthBuffer = uiState.showTemporalDepthBuffer;
    const currentSSREnabled = ppState.ssrEnabled;
    const currentRefractionEnabled = ppState.refractionEnabled;
    const currentAntiAliasingMethod = ppState.antiAliasingMethod;

    // Buffer preview logic
    const isBufferPreviewEnabled = currentShowDepthBuffer || currentShowNormalBuffer || currentShowTemporalDepthBuffer;

    // Update pass enabled states every frame to ensure sync
    bloomPass.enabled = currentBloomEnabled;
    // Disable bokeh if we are previewing a buffer (to save perf and avoid conflicts)
    bokehPass.enabled = currentBokehEnabled && !isBufferPreviewEnabled;
    bufferPreviewPass.enabled = isBufferPreviewEnabled;
    
    ssrPass.enabled = currentSSREnabled;
    refractionPass.enabled = currentRefractionEnabled;
    fxaaPass.enabled = currentAntiAliasingMethod === 'fxaa';
    smaaPass.enabled = currentAntiAliasingMethod === 'smaa';

    // Set bloom strength (0 when disabled for smooth transition)
    bloomPass.strength = currentBloomEnabled ? ppState.bloomIntensity : 0;

    // Update temporal depth manager camera matrices (before any rendering)
    TemporalDepthManager.updateCameraMatrices(camera);

    // Save renderer state
    const currentAutoClear = gl.autoClear;
    const currentClearColor = gl.getClearColor(tempClearColor);
    const currentClearAlpha = gl.getClearAlpha();

    // Check if we need object-only depth for SSR/refraction/bokeh/temporal reprojection
    // Also render when showing temporal depth buffer preview
    const temporalReprojectionEnabled = perfStateRef.current.temporalReprojectionEnabled;
    // Need object depth if any effect that uses it is enabled, OR if we are previewing temporal depth
    const renderObjectDepth = needsObjectOnlyDepth({
      ssrEnabled: currentSSREnabled,
      refractionEnabled: currentRefractionEnabled,
      bokehEnabled: currentBokehEnabled,
      bokehFocusMode: ppState.bokehFocusMode,
      temporalReprojectionEnabled: temporalReprojectionEnabled || currentShowTemporalDepthBuffer,
    });

    // Render object-only depth pass (excludes walls, gizmos, axes)
    // Only rendered when SSR, refraction, or bokeh auto-focus needs it
    if (renderObjectDepth && camera instanceof THREE.PerspectiveCamera) {
      const savedCameraLayers = camera.layers.mask;

      // Only render main object layer
      camera.layers.set(RENDER_LAYERS.MAIN_OBJECT);
      camera.layers.enable(RENDER_LAYERS.VOLUMETRIC); // Also include volumetric objects

      gl.autoClear = false;
      gl.setRenderTarget(objectDepthTarget);
      gl.setClearColor(0x000000, 0);
      gl.clear(true, true, false); // Clear color and depth

      // Force all materials to write depth during object-only pass
      // This ensures transparent faces (like polytope faces with opacity < 1) write to depth
      // P3 Optimization: Reuse Map from ref to avoid per-frame allocation
      const savedDepthWriteForObjectPass = savedDepthWriteForObjectPassRef.current;
      savedDepthWriteForObjectPass.clear();
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mat = (obj as THREE.Mesh).material as THREE.Material;
          savedDepthWriteForObjectPass.set(mat, mat.depthWrite);
          mat.depthWrite = true;
        }
      });

      // Update uResolution on VOLUMETRIC layer meshes to full resolution
      // This is critical for Schroedinger with temporal accumulation which checks resolution
      // to determine if it's rendering at quarter-res or full-res
      // P2 Optimization: Use cached mesh references
      updateVolumetricResolutionCached(
        scene,
        objectDepthTarget.width,
        objectDepthTarget.height,
        volumetricMeshesRef.current,
        volumetricMeshesValidRef
      );

      // Depth-only pass - disable color writes for performance
      const glContext = gl.getContext();
      glContext.colorMask(false, false, false, false);
      try {
        gl.render(scene, camera);
      } finally {
        // Restore colorMask and depthWrite even if render throws
        glContext.colorMask(true, true, true, true);
        savedDepthWriteForObjectPass.forEach((value, mat) => {
          mat.depthWrite = value;
        });
        // Restore camera layers
        camera.layers.mask = savedCameraLayers;
      }

      // Capture depth to temporal buffer for next frame's reprojection
      // Uses object-only depth (excludes environment) for more accurate hints
      // Force capture when previewing temporal depth buffer
      if (objectDepthTarget.depthTexture) {
        TemporalDepthManager.captureDepth(gl, objectDepthTarget.depthTexture, currentShowTemporalDepthBuffer);
      }
    }

    // ========================================
    // Temporal Cloud Accumulation (Horizon-style)
    // ========================================
    // Check if temporal cloud accumulation should be used for volumetric rendering
    const objectType = geometryStateRef.current.objectType;
    const useTemporalCloud = needsVolumetricSeparation({
      temporalCloudAccumulation: temporalReprojectionEnabled,
      objectType,
    });

    if (useTemporalCloud) {
      // Begin temporal cloud frame
      TemporalCloudManager.beginFrame(camera);

      // Get the cloud render target (quarter resolution)
      const cloudTarget = TemporalCloudManager.getCloudRenderTarget();

      if (cloudTarget && camera instanceof THREE.PerspectiveCamera) {
        const savedCameraLayers = camera.layers.mask;

        // Render ONLY the volumetric layer to quarter-res target
        camera.layers.set(RENDER_LAYERS.VOLUMETRIC);

        // Set up quarter-res rendering
        // IMPORTANT: Use viewport.set() on target, not gl.setViewport() to avoid DPR issues
        cloudTarget.viewport.set(0, 0, cloudTarget.width, cloudTarget.height);
        gl.setRenderTarget(cloudTarget);
        gl.setClearColor(0x000000, 0);
        gl.clear(true, true, false);

        // Update uResolution on VOLUMETRIC layer meshes to quarter resolution
        // This tells the Schroedinger shader to apply the Bayer coordinate transformation
        // P2 Optimization: Use cached mesh references
        updateVolumetricResolutionCached(
          scene,
          cloudTarget.width,
          cloudTarget.height,
          volumetricMeshesRef.current,
          volumetricMeshesValidRef
        );

        // Render volumetric at quarter res with Bayer jitter
        // The shader applies USE_TEMPORAL_ACCUMULATION jitter based on uBayerOffset
        gl.render(scene, camera);

        // Restore camera layers
        camera.layers.mask = savedCameraLayers;
        gl.setRenderTarget(null);

        // Run CloudTemporalPass for reconstruction
        // This reprojects history and blends with new quarter-res data
        cloudTemporalPass.updateCamera(camera);
        cloudTemporalPass.render(gl, sceneTarget, sceneTarget, delta);
      }

      // End temporal cloud frame (swap buffers, advance frame counter)
      // Called unconditionally to keep frame counter in sync even if rendering skipped
      TemporalCloudManager.endFrame();
    }

    // Render full scene to capture color and depth
    // Ensure camera sees environment (layer 0), main object (layer 1), and skybox (layer 2)
    // When temporal cloud accumulation is active, exclude VOLUMETRIC layer (rendered separately)
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.layers.enable(RENDER_LAYERS.ENVIRONMENT);
      camera.layers.enable(RENDER_LAYERS.MAIN_OBJECT);
      camera.layers.enable(RENDER_LAYERS.SKYBOX);

      // Exclude VOLUMETRIC layer when using temporal cloud accumulation
      // The volumetric is rendered separately and composited via CloudTemporalPass
      if (useTemporalCloud) {
        camera.layers.disable(RENDER_LAYERS.VOLUMETRIC);
      }
    }

    gl.autoClear = false;
    gl.setRenderTarget(sceneTarget);
    gl.setClearColor(0x000000, 0);
    gl.clear(true, true, true); // Clear color, depth, stencil

    // Force all materials to write depth during this pass
    // P3 Optimization: Reuse Map from ref to avoid per-frame allocation
    const savedDepthWrite = savedDepthWriteRef.current;
    savedDepthWrite.clear();
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mat = (obj as THREE.Mesh).material as THREE.Material;
        savedDepthWrite.set(mat, mat.depthWrite);
        mat.depthWrite = true;
      }
    });

    // Reset stats JUST before main scene render to get accurate counts
    // This excludes the object-only depth pre-pass from the metrics
    gl.info.reset();

    try {
      gl.render(scene, camera);

      // NOTE: Volumetric cloud compositing happens AFTER this try block
      // (see "Composite reconstructed volumetric over scene" section below)
      // to ensure we only composite when history is valid and avoid double-compositing
    } finally {
      // Restore original depthWrite settings even if render throws
      savedDepthWrite.forEach((value, mat) => {
        mat.depthWrite = value;
      });
      gl.setRenderTarget(null);
      // Restore renderer state
      gl.autoClear = currentAutoClear;
      gl.setClearColor(currentClearColor, currentClearAlpha);
    }

    // Capture scene-only GPU stats IMMEDIATELY after main scene render
    // BEFORE post-processing which adds full-screen quad passes
    // This gives accurate geometry counts (faces, edges, vertices) without
    // inflation from bloom/SSR/bokeh passes which each add full-screen quads
    const sceneRenderStats = gl.info.render;

    // Count unique vertices from actual geometry buffers (not processed vertices)
    // This shows the real memory savings from indexed geometry
    // P2 Optimization: Cache result and only recalculate when geometry changes
    const geomState = geometryStateRef.current;
    const cacheKey = `${geomState.objectType}-${rotationStateRef.current.dimension}`;
    let uniqueVertices: number;
    if (cachedUniqueVerticesRef.current.key !== cacheKey) {
      uniqueVertices = 0;
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh || (obj as THREE.LineSegments).isLineSegments) {
          const geo = (obj as THREE.Mesh).geometry;
          if (geo) {
            const posAttr = geo.getAttribute('position');
            if (posAttr) {
              uniqueVertices += posAttr.count;
            }
          }
        }
      });
      cachedUniqueVerticesRef.current = { count: uniqueVertices, key: cacheKey };
    } else {
      uniqueVertices = cachedUniqueVerticesRef.current.count;
    }

    usePerformanceMetricsStore.getState().updateMetrics({
      sceneGpu: {
        calls: sceneRenderStats.calls,
        triangles: sceneRenderStats.triangles,
        points: sceneRenderStats.points,
        lines: sceneRenderStats.lines,
        uniqueVertices,
      },
    });

    // ========================================
    // Composite reconstructed volumetric over scene
    // ========================================
    // When temporal cloud accumulation is active, blend the reconstructed
    // volumetric over the main scene before post-processing

    // CRITICAL FIX: Always composite when temporal cloud is active, not just when history is valid
    // The reconstruction pass outputs valid data even without history (using spatial interpolation)
    // Previously, this check was: if (useTemporalCloud && TemporalCloudManager.hasValidHistory())
    // This caused the volumetric to be invisible for the first 4 frames since:
    // 1. The VOLUMETRIC layer is excluded from main scene render when temporal cloud is active
    // 2. But the composite only ran after hasValidHistory() became true (after 4 frames)
    if (useTemporalCloud) {
      // CRITICAL FIX: Use getReadTarget() instead of getWriteTarget()!
      // After endFrame() is called (line ~719), buffers are swapped.
      // getWriteTarget() now returns the NEXT frame's buffer (empty/old data).
      // getReadTarget() returns the buffer that was just written to this frame.
      const accumulationBuffer = TemporalCloudManager.getReadTarget();

      if (accumulationBuffer && cloudCompositeMaterial.uniforms.tCloud) {
        // Set the accumulation texture in the compositing material
        cloudCompositeMaterial.uniforms.tCloud.value = accumulationBuffer.texture;

        // CRITICAL: Disable autoClear before composite to prevent clearing the scene!
        // The autoClear state was restored to its original value in the finally block above,
        // which may be true. If we don't disable it, gl.render() will clear sceneTarget.
        const savedAutoClear = gl.autoClear;
        gl.autoClear = false;

        // Render compositing quad to sceneTarget with blending
        gl.setRenderTarget(sceneTarget);
        gl.render(cloudCompositeScene, cloudCompositeCamera);

        // Restore autoClear state
        gl.autoClear = savedAutoClear;
        gl.setRenderTarget(null);
      }
    }

    // Render normal pass for G-buffer (when SSR, refraction, or normal visualization needs normals)
    // Uses MRT to capture correct fractal normals, then composites environment normals
    const needsNormalPass = currentSSREnabled || currentRefractionEnabled || currentShowNormalBuffer;
    if (needsNormalPass) {
      const savedCameraLayers = camera.layers.mask;

      // 1. Render Environment (Walls) to normalTarget
      // Uses MeshNormalMaterial (works fine for standard meshes)
      gl.setRenderTarget(normalTarget);
      gl.setClearColor(0x000000, 0);
      gl.clear(true, true, false); // Clear Color & Depth

      scene.overrideMaterial = normalMaterial;
      camera.layers.set(RENDER_LAYERS.ENVIRONMENT);
      // NOTE: SKYBOX layer is intentionally NOT enabled here.
      // Skybox and grid overlays should not contribute to normal buffer
      // as they would pollute SSR/refraction calculations.

      gl.render(scene, camera);
      scene.overrideMaterial = null;

      // 2. Render Main Object (Fractal) to mainObjectMRT
      // This captures Color (Loc 0) and View-Space Normal (Loc 1)
      // The fractal shader writes to gl_FragData[1]
      // SKIP this pass if there are no MAIN_OBJECT layer objects (e.g., when viewing volumetric-only objects)

      // Count objects in MAIN_OBJECT layer
      // P2 Optimization: Cache count since it only changes when geometry changes
      let mainObjectCount: number;
      if (!mainObjectCountCacheRef.current.valid) {
        const mainObjectLayerMask = new THREE.Layers();
        mainObjectLayerMask.set(RENDER_LAYERS.MAIN_OBJECT);
        mainObjectCount = 0;
        scene.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh && obj.layers.test(mainObjectLayerMask)) {
            mainObjectCount++;
          }
        });
        mainObjectCountCacheRef.current = { count: mainObjectCount, valid: true };
      } else {
        mainObjectCount = mainObjectCountCacheRef.current.count;
      }

      // Only render and copy if there are MAIN_OBJECT layer objects
      if (mainObjectCount > 0) {
        gl.setRenderTarget(mainObjectMRT);
        gl.setClearColor(0x000000, 0);
        gl.clear(true, true, false);

        // Force materials to be opaque and write depth for the MRT pass
        // This is CRITICAL: If the material is transparent, blending will multiply
        // the normal (alpha 0) by 0, resulting in black output.
        // P3 Optimization: Reuse Map from ref to avoid per-frame allocation
        const savedPropsForMRTPass = savedPropsForMRTPassRef.current;
        savedPropsForMRTPass.clear();
        scene.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mat = (obj as THREE.Mesh).material as THREE.Material;
            savedPropsForMRTPass.set(mat, {
              transparent: mat.transparent,
              depthWrite: mat.depthWrite,
              blending: mat.blending
            });
            mat.transparent = false;
            mat.depthWrite = true;
            mat.blending = THREE.NoBlending;
          }
        });

        camera.layers.set(RENDER_LAYERS.MAIN_OBJECT);

        try {
          gl.render(scene, camera);
        } finally {
          // Restore original material properties
          savedPropsForMRTPass.forEach((props, mat) => {
            mat.transparent = props.transparent;
            mat.depthWrite = props.depthWrite;
            mat.blending = props.blending;
          });
        }

        // 3. Composite Fractal Normals into normalTarget
        // Draws a full-screen quad that samples the fractal normal texture
        // and writes it to normalTarget, respecting depth
        gl.setRenderTarget(normalTarget);
        // Do NOT clear - we want to draw on top of environment

        if (mainObjectMRT.textures[1] && mainObjectMRT.depthTexture) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const uniforms = normalCopyMaterial.uniforms as any;
          uniforms.tNormal.value = mainObjectMRT.textures[1];
          uniforms.tDepth.value = mainObjectMRT.depthTexture;

          // CRITICAL: Ensure autoClear is FALSE to preserve wall normals
          const savedAutoClear = gl.autoClear;
          gl.autoClear = false;

          gl.render(normalCopyScene, normalCopyCamera);

          gl.autoClear = savedAutoClear;
        }
      }

      // 4. Composite Volumetric Normals into normalTarget (when temporal cloud is active)
      // Volumetric objects render to cloudRenderTarget.textures[1] (CloudNormal)
      // We need to upsample and composite these normals into the full-res normalTarget
      // NOTE: The cloud accumulation buffer (full-res) has the composited normals after
      // temporal reconstruction, so we use that instead of the quarter-res cloudRenderTarget.
      if (useTemporalCloud) {
        const cloudNormalTexture = TemporalCloudManager.getCloudNormalTexture();

        if (cloudNormalTexture) {
          // Set render target to normalTarget
          gl.setRenderTarget(normalTarget);

          // CRITICAL: Ensure autoClear is FALSE to preserve existing content
          const savedAutoClear = gl.autoClear;
          gl.autoClear = false;

          // Use the dedicated volumetric normal copy material (no depth check)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const volNormalUniforms = volumetricNormalCopyMaterial.uniforms as any;
          volNormalUniforms.tNormal.value = cloudNormalTexture;

          gl.render(volumetricNormalCopyScene, normalCopyCamera);

          // Restore autoClear
          gl.autoClear = savedAutoClear;
        }
      }

      // Restore camera layers
      camera.layers.mask = savedCameraLayers;
      gl.setRenderTarget(null);
    }

    // Use object-only depth or full scene depth based on setting
    // Object-only excludes walls/gizmos; full scene includes them for wall reflections
    const effectDepthTexture = ppState.objectOnlyDepth
      ? objectDepthTarget.depthTexture
      : sceneTarget.depthTexture;

    // Update texture pass (color buffer from MRT)
    texturePass.map = sceneTarget.texture;

    if (currentBokehEnabled && camera instanceof THREE.PerspectiveCamera) {
      let targetFocus = ppState.bokehWorldFocusDistance;

      // Auto-focus: raycast to find depth at screen center
      if (ppState.bokehFocusMode === 'auto-center' || ppState.bokehFocusMode === 'auto-mouse') {
        // Use screen center for auto-center, could add mouse position for auto-mouse
        autoFocusRaycaster.setFromCamera(screenCenter, camera);
        const intersects = autoFocusRaycaster.intersectObjects(scene.children, true);

        if (intersects.length > 0 && intersects[0]) {
          // Use the distance to the first intersection
          autoFocusDistanceRef.current = intersects[0].distance;
        }
        targetFocus = autoFocusDistanceRef.current;
      }

      // Smooth focus transition
      const smoothFactor = ppState.bokehSmoothTime > 0 ? 1 - Math.exp(-delta / ppState.bokehSmoothTime) : 1;
      currentFocusRef.current += (targetFocus - currentFocusRef.current) * smoothFactor;

      const uniforms = bokehPass.uniforms as unknown as BokehUniforms;
      // Use effectDepthTexture which respects objectOnlyDepth setting
      uniforms.tDepth.value = effectDepthTexture;
      uniforms.focus.value = currentFocusRef.current;

      // Focus range: the depth range where objects stay sharp (in world units)
      // This creates a "dead zone" around the focus point
      uniforms.focusRange.value = ppState.bokehWorldFocusRange;

      // Aperture: controls how quickly blur increases beyond the focus range
      // bokehScale: 0-3 maps to aperture: 0-0.015
      // Lower values = more gradual blur falloff
      uniforms.aperture.value = ppState.bokehScale * 0.005;

      // Maxblur: cap the maximum blur amount (typical: 0.01-0.05)
      // bokehScale: 0-3 maps to maxblur: 0-0.06
      uniforms.maxblur.value = ppState.bokehScale * 0.02;

      uniforms.nearClip.value = camera.near;
      uniforms.farClip.value = camera.far;

      // Blur method: 0=disc, 1=jittered, 2=separable, 3=hexagonal
      const blurMethodMap: Record<string, number> = {
        disc: 0,
        jittered: 1,
        separable: 2,
        hexagonal: 3,
      };
      uniforms.blurMethod.value = blurMethodMap[ppState.bokehBlurMethod] ?? 3;

      // Time for jittered blur animation (prevents static noise patterns)
      uniforms.time.value = performance.now() * 0.001;
    }

    // Configure Buffer Preview Pass
    if (isBufferPreviewEnabled && camera instanceof THREE.PerspectiveCamera) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const uniforms = bufferPreviewPass.uniforms as any;
      uniforms.nearClip.value = camera.near;
      uniforms.farClip.value = camera.far;
      
      // Determine what to show
      if (currentShowDepthBuffer) {
        uniforms.type.value = 1; // Depth
        uniforms.tInput.value = effectDepthTexture;
        uniforms.debugMode.value = 1; // Linear depth (normalized grayscale)
        // debugMode 0 = Raw depth, 1 = Linear depth, 2 = Focus Zones (colored)
        
      } else if (currentShowNormalBuffer) {
        uniforms.type.value = 2; // Normal
        uniforms.tInput.value = normalTarget.texture;
        
      } else if (currentShowTemporalDepthBuffer) {
        uniforms.type.value = 3; // Temporal Depth
        const temporalUniforms = TemporalDepthManager.getUniforms(true);
        uniforms.tInput.value = temporalUniforms.uPrevDepthTexture;
      }

      // Pass bokeh focus params for depth debug "Focus Zones" if we implemented that
      // For now just basic depth visualization is fine.
    }

    // Update SSR uniforms
    if (currentSSREnabled && camera instanceof THREE.PerspectiveCamera) {
      const ssrUniforms = ssrPass.uniforms as unknown as SSRUniforms;
      // Use G-buffer normals from normal render pass (much more accurate than depth reconstruction)
      ssrUniforms.tNormal.value = normalTarget.texture;
      // Use effectDepthTexture which respects objectOnlyDepth setting
      ssrUniforms.tDepth.value = effectDepthTexture;
      ssrUniforms.projMatrix.value.copy(camera.projectionMatrix);
      ssrUniforms.invProjMatrix.value.copy(camera.projectionMatrixInverse);
      ssrUniforms.uViewMat.value.copy(camera.matrixWorldInverse);
      ssrUniforms.intensity.value = ppState.ssrIntensity;
      ssrUniforms.maxDistance.value = ppState.ssrMaxDistance;
      ssrUniforms.thickness.value = ppState.ssrThickness;
      ssrUniforms.fadeStart.value = ppState.ssrFadeStart;
      ssrUniforms.fadeEnd.value = ppState.ssrFadeEnd;
      // Progressive refinement: scale SSR quality from low → user's target
      const qualityMultiplier = perfStateRef.current.qualityMultiplier;
      const effectiveSSRQuality = getEffectiveSSRQuality(
        ppState.ssrQuality as SSRQuality,
        qualityMultiplier
      );
      ssrUniforms.maxSteps.value = SSR_QUALITY_STEPS[effectiveSSRQuality] ?? 32;
      ssrUniforms.nearClip.value = camera.near;
      ssrUniforms.farClip.value = camera.far;
    }

    // Update refraction uniforms
    if (currentRefractionEnabled && camera instanceof THREE.PerspectiveCamera) {
      const refractionUniforms = refractionPass.uniforms as unknown as RefractionUniforms;
      // Use G-buffer normals from normal render pass (much more accurate than depth reconstruction)
      refractionUniforms.tNormal.value = normalTarget.texture;
      // Use effectDepthTexture which respects objectOnlyDepth setting
      refractionUniforms.tDepth.value = effectDepthTexture;
      refractionUniforms.invProjMatrix.value.copy(camera.projectionMatrixInverse);
      refractionUniforms.ior.value = ppState.refractionIOR;
      refractionUniforms.strength.value = ppState.refractionStrength;
      refractionUniforms.chromaticAberration.value = ppState.refractionChromaticAberration;
      refractionUniforms.nearClip.value = camera.near;
      refractionUniforms.farClip.value = camera.far;
    }

    // ========================================
    // SSAO (GTAO) Pass for Mesh Objects
    // ========================================
    // GTAO only applies to mesh-based objects (polytopes)
    // SDF and volumetric objects use shader-based AO
    const gtaoPass = gtaoPassRef.current;
    const gtaoComposer = gtaoComposerRef.current;
    const isPolytope = isPolytopeCategory(geomState.objectType);
    const shouldRunGTAO = ppState.ssaoEnabled && isPolytope && gtaoPass && gtaoComposer;

    // Clear GTAO buffers when transitioning from disabled to enabled
    // This prevents stale data artifacts when first enabling GTAO
    if (shouldRunGTAO && !prevGtaoEnabledRef.current && gtaoComposer) {
      const clearColor = gl.getClearColor(new THREE.Color());
      const clearAlpha = gl.getClearAlpha();
      gl.setClearColor(0x000000, 0);
      gl.setRenderTarget(gtaoComposer.readBuffer);
      gl.clear();
      gl.setRenderTarget(gtaoComposer.writeBuffer);
      gl.clear();
      gl.setRenderTarget(null);
      gl.setClearColor(clearColor, clearAlpha);
    }
    prevGtaoEnabledRef.current = !!shouldRunGTAO;

    if (shouldRunGTAO) {
      // Update GTAO camera (in case it changed)
      gtaoPass.camera = camera;

      // Update GTAO intensity
      gtaoPass.blendIntensity = ppState.ssaoIntensity;

      // Render GTAO - it reads from sceneTarget and outputs AO-blended result
      // We render to screen:false so we can get the result from gtaoComposer
      gtaoComposer.renderToScreen = false;
      gtaoComposer.render();

      // Update main composer's texture pass to use GTAO output
      texturePass.map = gtaoComposer.readBuffer.texture;
    } else {
      // Use original scene texture
      texturePass.map = sceneTarget.texture;
    }

    composer.render();

    // Swap temporal depth buffers at end of frame
    // Force swap when previewing temporal depth buffer
    TemporalDepthManager.swap(currentShowTemporalDepthBuffer);
  }, 1);

  return null;
});
