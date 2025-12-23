/**
 * PostProcessingV2 Component
 *
 * TRUE Render Graph-based post-processing implementation.
 * Uses declarative pass dependencies - the graph compiler automatically
 * determines execution order based on resource inputs/outputs.
 *
 * Architecture:
 * - Resources declared with types (HDR, depth, normal, etc.)
 * - Passes declare inputs/outputs - compiler orders them
 * - graph.execute() runs everything in dependency order
 * - Passes dynamically enabled/disabled via enabled() callbacks
 *
 * @module rendering/environment/PostProcessingV2
 */

import { useFrame, useThree } from '@react-three/fiber';
import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useShallow } from 'zustand/react/shallow';

import { isPolytopeType } from '@/lib/geometry/types';
import { FRAME_PRIORITY } from '@/rendering/core/framePriorities';
import { RENDER_LAYERS, needsVolumetricSeparation } from '@/rendering/core/layers';
import { useTemporalDepth } from '@/rendering/core/temporalDepth';
import {
  BloomPass,
  BokehPass,
  BufferPreviewPass,
  CinematicPass,
  CopyPass,
  DepthPass,
  FXAAPass,
  FilmGrainPass,
  FullscreenPass,
  GTAOPass,
  MainObjectMRTPass,
  NormalPass,
  RefractionPass,
  SMAAPass,
  SSRPass,
  ScenePass,
  ScreenSpaceLensingPass,
  TemporalCloudPass,
  TemporalDepthCapturePass,
  ToScreenPass,
  VolumetricFogPass,
} from '@/rendering/graph/passes';
import { RenderGraph } from '@/rendering/graph/RenderGraph';
import { cloudCompositeFragmentShader } from '@/rendering/shaders/postprocessing/cloudComposite.glsl';
import { normalCompositeFragmentShader } from '@/rendering/shaders/postprocessing/normalComposite.glsl';
import { TONE_MAPPING_TO_THREE } from '@/rendering/shaders/types';
import { generateNoiseTexture2D, generateNoiseTexture3D } from '@/rendering/utils/NoiseGenerator';
import { SSR_QUALITY_STEPS } from '@/stores/defaults/visualDefaults';
import { useEnvironmentStore } from '@/stores/environmentStore';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useGeometryStore } from '@/stores/geometryStore';
import { useLightingStore } from '@/stores/lightingStore';
import { getEffectiveSSRQuality, usePerformanceStore, type SSRQualityLevel } from '@/stores/performanceStore';
import { usePostProcessingStore } from '@/stores/postProcessingStore';
import { useUIStore } from '@/stores/uiStore';
import { useWebGLContextStore } from '@/stores/webglContextStore';

// =============================================================================
// Resource IDs (declared once, referenced by passes)
// =============================================================================

const RESOURCES = {
  // G-buffer resources
  SCENE_COLOR: 'sceneColor',
  OBJECT_DEPTH: 'objectDepth',
  NORMAL_ENV: 'normalEnv',
  MAIN_OBJECT_MRT: 'mainObjectMrt',
  NORMAL_BUFFER: 'normalBuffer',
  SCENE_COMPOSITE: 'sceneComposite',
  PREVIEW_OUTPUT: 'previewOutput',

  // Temporal Cloud resources
  TEMPORAL_CLOUD_BUFFER: 'temporalCloudBuffer',
  TEMPORAL_ACCUMULATION: 'temporalAccumulation',
  TEMPORAL_REPROJECTION: 'temporalReprojection',
  TEMPORAL_DEPTH_OUTPUT: 'temporalDepthOutput',

  // Effect chain resources
  FOG_OUTPUT: 'fogOutput',
  GTAO_OUTPUT: 'gtaoOutput',
  BLOOM_OUTPUT: 'bloomOutput',
  SSR_OUTPUT: 'ssrOutput',
  BOKEH_OUTPUT: 'bokehOutput',
  REFRACTION_OUTPUT: 'refractionOutput',
  LENSING_OUTPUT: 'lensingOutput',
  CINEMATIC_OUTPUT: 'cinematicOutput',
  GRAIN_OUTPUT: 'grainOutput',
  AA_OUTPUT: 'aaOutput',
} as const;

// =============================================================================
// Helper: Check WebGL2 support for 3D textures
// =============================================================================

function supports3DTextures(gl: THREE.WebGLRenderer): boolean {
  // WebGL2 supports sampler3D
  const ctx = gl.getContext();
  return ctx instanceof WebGL2RenderingContext;
}

// =============================================================================
// PostProcessingV2 Component
// =============================================================================

/**
 * PostProcessingV2 - True render graph-based post-processing.
 *
 * The graph compiler automatically orders passes based on declared
 * dependencies. No manual pass ordering required.
 */
export const PostProcessingV2 = memo(function PostProcessingV2() {
  const { gl, scene, camera, size } = useThree();

  // Get temporal depth state from context
  const temporalDepth = useTemporalDepth();

  // Context restore counter for recreation
  const restoreCount = useWebGLContextStore((s) => s.restoreCount);

  // Get object type to determine which effects to enable
  const objectType = useGeometryStore((s) => s.objectType);
  const isPolytope = isPolytopeType(objectType);
  const isBlackHole = objectType === 'blackhole';
  const objectTypeRef = useRef(objectType);

  useEffect(() => {
    objectTypeRef.current = objectType;
    // Invalidate MainObjectMRTPass cache when object type changes
    // (scene structure changes, materials are recreated)
    passRefs.current.mainObjectMrt?.invalidateCache();
  }, [objectType]);

  // Store subscriptions - Post Processing
  const postProcessingSelector = useShallow((s: ReturnType<typeof usePostProcessingStore.getState>) => ({
    // Bloom
    bloomEnabled: s.bloomEnabled,
    bloomIntensity: s.bloomIntensity,
    bloomRadius: s.bloomRadius,
    bloomThreshold: s.bloomThreshold,
    // Bokeh
    bokehEnabled: s.bokehEnabled,
    bokehFocusMode: s.bokehFocusMode,
    bokehBlurMethod: s.bokehBlurMethod,
    bokehWorldFocusDistance: s.bokehWorldFocusDistance,
    bokehWorldFocusRange: s.bokehWorldFocusRange,
    bokehScale: s.bokehScale,
    bokehSmoothTime: s.bokehSmoothTime,
    // SSR
    ssrEnabled: s.ssrEnabled,
    ssrIntensity: s.ssrIntensity,
    ssrMaxDistance: s.ssrMaxDistance,
    ssrThickness: s.ssrThickness,
    ssrFadeStart: s.ssrFadeStart,
    ssrFadeEnd: s.ssrFadeEnd,
    ssrQuality: s.ssrQuality,
    // Refraction
    refractionEnabled: s.refractionEnabled,
    refractionIOR: s.refractionIOR,
    refractionStrength: s.refractionStrength,
    refractionChromaticAberration: s.refractionChromaticAberration,
    // Anti-aliasing
    antiAliasingMethod: s.antiAliasingMethod,
    // Cinematic
    cinematicEnabled: s.cinematicEnabled,
    cinematicAberration: s.cinematicAberration,
    cinematicVignette: s.cinematicVignette,
    cinematicGrain: s.cinematicGrain,
    // SSAO (GTAO)
    ssaoEnabled: s.ssaoEnabled,
    ssaoIntensity: s.ssaoIntensity,
    // Depth selection
    objectOnlyDepth: s.objectOnlyDepth,
  }));
  const ppState = usePostProcessingStore(postProcessingSelector);

  // Store subscriptions - Environment (fog)
  const fogSelector = useShallow((s: ReturnType<typeof useEnvironmentStore.getState>) => ({
    fogEnabled: s.fogEnabled,
  }));
  const fogState = useEnvironmentStore(fogSelector);

  // Store subscriptions - Lighting (tone mapping)
  const lightingSelector = useShallow((s: ReturnType<typeof useLightingStore.getState>) => ({
    toneMappingEnabled: s.toneMappingEnabled,
    toneMappingAlgorithm: s.toneMappingAlgorithm,
    exposure: s.exposure,
  }));
  const lightingState = useLightingStore(lightingSelector);

  // Store subscriptions - UI debug toggles
  const uiSelector = useShallow((s: ReturnType<typeof useUIStore.getState>) => ({
    showDepthBuffer: s.showDepthBuffer,
    showNormalBuffer: s.showNormalBuffer,
    showTemporalDepthBuffer: s.showTemporalDepthBuffer,
  }));
  const uiState = useUIStore(uiSelector);

  // Store subscriptions - Performance (temporal reprojection)
  const perfSelector = useShallow((s: ReturnType<typeof usePerformanceStore.getState>) => ({
    temporalReprojectionEnabled: s.temporalReprojectionEnabled,
    qualityMultiplier: s.qualityMultiplier,
  }));
  const perfState = usePerformanceStore(perfSelector);

  // Store subscriptions - Black hole config
  const blackHoleSelector = useShallow((s: ReturnType<typeof useExtendedObjectStore.getState>) => ({
    deferredLensingEnabled: s.blackhole.deferredLensingEnabled,
    deferredLensingStrength: s.blackhole.deferredLensingStrength,
    deferredLensingRadius: s.blackhole.deferredLensingRadius,
    deferredLensingChromaticAberration: s.blackhole.deferredLensingChromaticAberration,
    screenSpaceLensingEnabled: s.blackhole.screenSpaceLensingEnabled,
    lensingFalloff: s.blackhole.lensingFalloff,
    distanceFalloff: s.blackhole.distanceFalloff,
    bendScale: s.blackhole.bendScale,
    gravityStrength: s.blackhole.gravityStrength,
    horizonRadius: s.blackhole.horizonRadius,
    skyCubemapResolution: s.blackhole.skyCubemapResolution,
    schroedingerIsoEnabled: s.schroedinger.isoEnabled,
  }));
  const blackHoleState = useExtendedObjectStore(blackHoleSelector);

  // Keep latest store states in refs for render graph callbacks
  const ppStateRef = useRef(ppState);
  const fogStateRef = useRef(fogState);
  const uiStateRef = useRef(uiState);
  const perfStateRef = useRef(perfState);
  const blackHoleStateRef = useRef(blackHoleState);

  useEffect(() => {
    ppStateRef.current = ppState;
  }, [ppState]);

  useEffect(() => {
    fogStateRef.current = fogState;
  }, [fogState]);

  useEffect(() => {
    uiStateRef.current = uiState;
  }, [uiState]);

  useEffect(() => {
    perfStateRef.current = perfState;
  }, [perfState]);

  useEffect(() => {
    blackHoleStateRef.current = blackHoleState;
  }, [blackHoleState]);

  // ==========================================================================
  // Camera-relative helpers (auto-focus, lensing center)
  // ==========================================================================

  const autoFocusRaycaster = useMemo(() => new THREE.Raycaster(), []);
  const screenCenter = useMemo(() => new THREE.Vector2(0, 0), []);
  const autoFocusDistanceRef = useRef(ppState.bokehWorldFocusDistance);
  const currentFocusRef = useRef(ppState.bokehWorldFocusDistance);
  const blackHoleWorldPosition = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const projectedBlackHole = useMemo(() => new THREE.Vector3(), []);

  // Set up Three.js renderer tone mapping
  useEffect(() => {
    if (lightingState.toneMappingEnabled) {
      gl.toneMapping = TONE_MAPPING_TO_THREE[lightingState.toneMappingAlgorithm] as THREE.ToneMapping;
      gl.toneMappingExposure = lightingState.exposure;
    } else {
      gl.toneMapping = THREE.NoToneMapping;
      gl.toneMappingExposure = 1;
    }
  }, [gl, lightingState.toneMappingEnabled, lightingState.toneMappingAlgorithm, lightingState.exposure]);

  // ==========================================================================
  // Noise texture for volumetric fog (created synchronously so graph can use it)
  // ==========================================================================

  // Create noise texture synchronously in useMemo so it's available for graph creation
  const noiseTextureData = useMemo(() => {
    const use3D = supports3DTextures(gl);
    const texture = use3D ? generateNoiseTexture3D(128) : generateNoiseTexture2D(256);
    return { texture, use3D };
  }, [gl, restoreCount]);

  // Cleanup noise texture on unmount or recreation
  useEffect(() => {
    return () => {
      noiseTextureData.texture.dispose();
    };
  }, [noiseTextureData]);

  // ==========================================================================
  // Create Render Graph (once, with all passes)
  // ==========================================================================

  const graphRef = useRef<RenderGraph | null>(null);
  const passRefs = useRef<{
    objectDepth?: DepthPass;
    temporalDepthCapture?: TemporalDepthCapturePass;
    temporalCloud?: TemporalCloudPass;
    normalPass?: NormalPass;
    mainObjectMrt?: MainObjectMRTPass;
    normalComposite?: FullscreenPass;
    cloudComposite?: FullscreenPass;
    bufferPreview?: BufferPreviewPass;
    fog?: VolumetricFogPass;
    gtao?: GTAOPass;
    bloom?: BloomPass;
    ssr?: SSRPass;
    bokeh?: BokehPass;
    refraction?: RefractionPass;
    lensing?: ScreenSpaceLensingPass;
    cinematic?: CinematicPass;
    filmGrain?: FilmGrainPass;
    fxaa?: FXAAPass;
    smaa?: SMAAPass;
  }>({});

  // Create graph with all resources and passes
  const graph = useMemo(() => {
    // Dispose previous graph
    graphRef.current?.dispose();

    const g = new RenderGraph();

    // ========================================================================
    // Register Resources
    // ========================================================================

    // Main scene HDR color buffer (with depth texture)
    // Uses 3 attachments to match shader outputs (gColor, gNormal, gPosition)
    // All shaders output to 3 locations to prevent GL_INVALID_OPERATION
    g.addResource({
      id: RESOURCES.SCENE_COLOR,
      type: 'mrt',
      size: { mode: 'screen' },
      attachmentCount: 3,
      attachmentFormats: [THREE.RGBAFormat, THREE.RGBAFormat, THREE.RGBAFormat],
      dataType: THREE.HalfFloatType,
      depthBuffer: true,
      depthTexture: true,
      depthTextureFormat: THREE.DepthFormat,
      depthTextureType: THREE.UnsignedShortType,
      depthTextureMinFilter: THREE.NearestFilter,
      depthTextureMagFilter: THREE.NearestFilter,
    });

    // Object-only depth (for effects that should ignore environment)
    g.addResource({
      id: RESOURCES.OBJECT_DEPTH,
      type: 'renderTarget',
      size: { mode: 'screen' },
      format: THREE.RGBAFormat,
      dataType: THREE.UnsignedByteType,
      depthBuffer: true,
      depthTexture: true,
      depthTextureFormat: THREE.DepthFormat,
      depthTextureType: THREE.UnsignedShortType,
      depthTextureMinFilter: THREE.NearestFilter,
      depthTextureMagFilter: THREE.NearestFilter,
      textureRole: 'depth',
    });

    // Environment normals
    g.addResource({
      id: RESOURCES.NORMAL_ENV,
      type: 'renderTarget',
      size: { mode: 'screen' },
      format: THREE.RGBAFormat,
      dataType: THREE.HalfFloatType,
      depthBuffer: false,
    });

    // Main object MRT (color + normal + position)
    // Uses 3 attachments: gColor, gNormal, gPosition
    // Position is needed for raymarching objects (Schroedinger, BlackHole) that use
    // temporal reprojection even when on MAIN_OBJECT layer.
    // IMPORTANT: All shaders rendering to this target MUST output to all 3 locations
    // to avoid GL_INVALID_OPERATION errors.
    g.addResource({
      id: RESOURCES.MAIN_OBJECT_MRT,
      type: 'mrt',
      size: { mode: 'screen' },
      attachmentCount: 3, // DO NOT CHANGE - needed for temporal reprojection, reducing to 2 is NOT the fix for GL errors
      attachmentFormats: [THREE.RGBAFormat, THREE.RGBAFormat, THREE.RGBAFormat],
      dataType: THREE.HalfFloatType,
      depthBuffer: true,
      depthTexture: true,
      depthTextureFormat: THREE.DepthFormat,
      depthTextureType: THREE.UnsignedShortType,
      depthTextureMinFilter: THREE.NearestFilter,
      depthTextureMagFilter: THREE.NearestFilter,
    });

    // Temporal Cloud Resources
    // 1. Quarter-res render target (Color, Normal, Position)
    g.addResource({
      id: RESOURCES.TEMPORAL_CLOUD_BUFFER,
      type: 'mrt',
      size: { mode: 'fraction', fraction: 0.5 },
      attachmentCount: 3,
      attachmentFormats: [THREE.RGBAFormat, THREE.RGBAFormat, THREE.RGBAFormat],
      dataType: THREE.FloatType, // Float for high precision position
      depthBuffer: true,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    });

    // 2. Accumulation buffer (Color, Position) - PingPong
    g.addResource({
      id: RESOURCES.TEMPORAL_ACCUMULATION,
      type: 'mrt',
      size: { mode: 'screen' },
      attachmentCount: 2,
      attachmentFormats: [THREE.RGBAFormat, THREE.RGBAFormat],
      dataType: THREE.FloatType, // Float for position precision
      depthBuffer: false,
    });

    // 3. Reprojection buffer (Reprojected Color, Validity)
    g.addResource({
      id: RESOURCES.TEMPORAL_REPROJECTION,
      type: 'mrt',
      size: { mode: 'screen' },
      attachmentCount: 2,
      attachmentFormats: [THREE.RGBAFormat, THREE.RGBAFormat], // Validity in R channel
      dataType: THREE.HalfFloatType,
      depthBuffer: false,
    });

    // 4. Temporal depth output for raymarching acceleration
    g.addResource({
      id: RESOURCES.TEMPORAL_DEPTH_OUTPUT,
      type: 'renderTarget',
      size: { mode: 'screen' },
      format: THREE.RGBAFormat,
      dataType: THREE.FloatType,
      depthBuffer: false,
    });

    // Final normal buffer for SSR/refraction/GTAO
    g.addResource({
      id: RESOURCES.NORMAL_BUFFER,
      type: 'renderTarget',
      size: { mode: 'screen' },
      format: THREE.RGBAFormat,
      dataType: THREE.HalfFloatType,
      depthBuffer: false,
    });

    // Scene color after volumetric composite
    g.addResource({
      id: RESOURCES.SCENE_COMPOSITE,
      type: 'renderTarget',
      size: { mode: 'screen' },
      format: THREE.RGBAFormat,
      dataType: THREE.HalfFloatType,
    });

    // Buffer preview output
    g.addResource({
      id: RESOURCES.PREVIEW_OUTPUT,
      type: 'renderTarget',
      size: { mode: 'screen' },
      format: THREE.RGBAFormat,
      dataType: THREE.UnsignedByteType,
    });

    // Effect chain buffers
    g.addResource({
      id: RESOURCES.FOG_OUTPUT,
      type: 'renderTarget',
      size: { mode: 'screen' },
      format: THREE.RGBAFormat,
      dataType: THREE.HalfFloatType,
    });

    g.addResource({
      id: RESOURCES.GTAO_OUTPUT,
      type: 'renderTarget',
      size: { mode: 'screen' },
      format: THREE.RGBAFormat,
      dataType: THREE.HalfFloatType,
    });

    g.addResource({
      id: RESOURCES.BLOOM_OUTPUT,
      type: 'renderTarget',
      size: { mode: 'screen' },
      format: THREE.RGBAFormat,
      dataType: THREE.HalfFloatType,
    });

    g.addResource({
      id: RESOURCES.SSR_OUTPUT,
      type: 'renderTarget',
      size: { mode: 'screen' },
      format: THREE.RGBAFormat,
      dataType: THREE.HalfFloatType,
    });

    g.addResource({
      id: RESOURCES.BOKEH_OUTPUT,
      type: 'renderTarget',
      size: { mode: 'screen' },
      format: THREE.RGBAFormat,
      dataType: THREE.HalfFloatType,
    });

    g.addResource({
      id: RESOURCES.REFRACTION_OUTPUT,
      type: 'renderTarget',
      size: { mode: 'screen' },
      format: THREE.RGBAFormat,
      dataType: THREE.HalfFloatType,
    });

    g.addResource({
      id: RESOURCES.LENSING_OUTPUT,
      type: 'renderTarget',
      size: { mode: 'screen' },
      format: THREE.RGBAFormat,
      dataType: THREE.HalfFloatType,
    });

    g.addResource({
      id: RESOURCES.CINEMATIC_OUTPUT,
      type: 'renderTarget',
      size: { mode: 'screen' },
      format: THREE.RGBAFormat,
      dataType: THREE.HalfFloatType,
    });

    g.addResource({
      id: RESOURCES.GRAIN_OUTPUT,
      type: 'renderTarget',
      size: { mode: 'screen' },
      format: THREE.RGBAFormat,
      dataType: THREE.HalfFloatType,
    });

    g.addResource({
      id: RESOURCES.AA_OUTPUT,
      type: 'renderTarget',
      size: { mode: 'screen' },
      format: THREE.RGBAFormat,
      dataType: THREE.UnsignedByteType, // AA output is LDR
    });

    // ========================================================================
    // Add Passes (order determined by graph compiler!)
    // ========================================================================

    const shouldRenderNormals = () => {
      const pp = ppStateRef.current;
      const ui = uiStateRef.current;
      return (
        pp.ssrEnabled ||
        pp.refractionEnabled ||
        (pp.ssaoEnabled && isPolytope) ||
        ui.showNormalBuffer
      );
    };

    const shouldRenderObjectDepth = () => {
      const pp = ppStateRef.current;
      const ui = uiStateRef.current;
      const perf = perfStateRef.current;
      const depthForEffects =
        pp.objectOnlyDepth && (pp.ssrEnabled || pp.refractionEnabled || pp.bokehEnabled);
      const depthForTemporal = perf.temporalReprojectionEnabled || ui.showTemporalDepthBuffer;
      const depthPreview = ui.showDepthBuffer && pp.objectOnlyDepth;
      return depthForEffects || depthForTemporal || depthPreview;
    };

    const shouldRenderTemporalCloud = () => {
      const perf = perfStateRef.current;
      const temporalCloudAccumulation = perf.temporalReprojectionEnabled && !blackHoleStateRef.current.schroedingerIsoEnabled;
      return needsVolumetricSeparation({ temporalCloudAccumulation, objectType: objectTypeRef.current });
    };

    // Scene render pass - renders all layers to 3-attachment MRT
    g.addPass(
      new ScenePass({
        id: 'scene',
        outputs: [{ resourceId: RESOURCES.SCENE_COLOR, access: 'write' }],
        layers: [RENDER_LAYERS.MAIN_OBJECT, RENDER_LAYERS.ENVIRONMENT, RENDER_LAYERS.SKYBOX],
        clearColor: 0x000000,
        autoClear: true,
      })
    );

    // Object depth pass
    const objectDepthPass = new DepthPass({
      id: 'objectDepth',
      outputs: [{ resourceId: RESOURCES.OBJECT_DEPTH, access: 'write' }],
      layers: [RENDER_LAYERS.MAIN_OBJECT],
      mode: 'material',
      forceDepthWrite: 'all',
      disableColorWrites: true,
      clear: true,
      enabled: shouldRenderObjectDepth,
    });
    passRefs.current.objectDepth = objectDepthPass;
    g.addPass(objectDepthPass);

    // Temporal depth capture pass
    const temporalDepthCapture = new TemporalDepthCapturePass({
      id: 'temporalDepthCapture',
      depthInput: RESOURCES.OBJECT_DEPTH,
      outputResource: RESOURCES.TEMPORAL_DEPTH_OUTPUT,
      temporalDepthState: temporalDepth,
      enabled: () => {
        const perf = perfStateRef.current;
        const ui = uiStateRef.current;
        return perf.temporalReprojectionEnabled || ui.showTemporalDepthBuffer;
      },
      forceCapture: () => uiStateRef.current.showTemporalDepthBuffer,
    });
    passRefs.current.temporalDepthCapture = temporalDepthCapture;
    g.addPass(temporalDepthCapture);

    // Temporal cloud accumulation (quarter-res volumetric pass)
    const temporalCloudPass = new TemporalCloudPass({
      id: 'temporalCloud',
      volumetricLayer: RENDER_LAYERS.VOLUMETRIC,
      shouldRender: shouldRenderTemporalCloud,
      cloudBuffer: RESOURCES.TEMPORAL_CLOUD_BUFFER,
      accumulationBuffer: RESOURCES.TEMPORAL_ACCUMULATION,
      reprojectionBuffer: RESOURCES.TEMPORAL_REPROJECTION,
      enabled: shouldRenderTemporalCloud,
      priority: -10,
    });
    passRefs.current.temporalCloud = temporalCloudPass;
    g.addPass(temporalCloudPass);

    // Environment normal pass
    const normalPass = new NormalPass({
      id: 'normalEnv',
      outputs: [{ resourceId: RESOURCES.NORMAL_ENV, access: 'write' }],
      layers: [RENDER_LAYERS.ENVIRONMENT],
      renderBackground: false,
      enabled: shouldRenderNormals,
    });
    passRefs.current.normalPass = normalPass;
    g.addPass(normalPass);

    // Main object MRT (color + normal + position)
    // ALWAYS enabled - main objects only render here now (not in ScenePass)
    const mainObjectMrt = new MainObjectMRTPass({
      id: 'mainObjectMrt',
      outputResource: RESOURCES.MAIN_OBJECT_MRT,
      layers: [RENDER_LAYERS.MAIN_OBJECT],
      renderBackground: false,
      forceOpaque: true,
    });
    passRefs.current.mainObjectMrt = mainObjectMrt;
    g.addPass(mainObjectMrt);

    // Composite normals (env + main object + volumetric)
    const normalComposite = new FullscreenPass({
      id: 'normalComposite',
      inputs: [
        { resourceId: RESOURCES.NORMAL_ENV, access: 'read', binding: 'uNormalEnv' },
        { resourceId: RESOURCES.MAIN_OBJECT_MRT, access: 'read', attachment: 1, binding: 'uMainNormal' },
        { resourceId: RESOURCES.MAIN_OBJECT_MRT, access: 'read', attachment: 'depth', binding: 'uMainDepth' },
        { resourceId: RESOURCES.SCENE_COLOR, access: 'read', attachment: 'depth', binding: 'uSceneDepth' },
      ],
      outputs: [{ resourceId: RESOURCES.NORMAL_BUFFER, access: 'write' }],
      fragmentShader: normalCompositeFragmentShader,
      uniforms: {
        uCloudNormal: { value: null },
        uCloudAvailable: { value: 0 },
      },
      enabled: shouldRenderNormals,
    });
    passRefs.current.normalComposite = normalComposite;
    g.addPass(normalComposite);

    // Composite temporal clouds over the scene color
    const cloudComposite = new FullscreenPass({
      id: 'cloudComposite',
      inputs: [{ resourceId: RESOURCES.SCENE_COLOR, access: 'read', binding: 'uSceneColor' }],
      outputs: [{ resourceId: RESOURCES.SCENE_COMPOSITE, access: 'write' }],
      fragmentShader: cloudCompositeFragmentShader,
      uniforms: {
        uCloud: { value: null },
        uCloudAvailable: { value: 0 },
      },
    });
    passRefs.current.cloudComposite = cloudComposite;
    g.addPass(cloudComposite);

    // Volumetric Fog pass (early in chain, after scene render)
    const fogPass = new VolumetricFogPass({
      id: 'volumetricFog',
      colorInput: RESOURCES.SCENE_COMPOSITE,
      depthInput: RESOURCES.SCENE_COLOR,
      depthInputAttachment: 'depth',
      outputResource: RESOURCES.FOG_OUTPUT,
      noiseTexture: noiseTextureData.texture,
      use3DNoise: noiseTextureData.use3D,
      enabled: () => fogStateRef.current.fogEnabled,
    });
    passRefs.current.fog = fogPass;
    g.addPass(fogPass);

    // GTAO pass (only for polytopes)
    const gtaoPass = new GTAOPass({
      id: 'gtao',
      colorInput: RESOURCES.FOG_OUTPUT,
      normalInput: RESOURCES.NORMAL_BUFFER,
      depthInput: RESOURCES.SCENE_COLOR,
      depthInputAttachment: 'depth',
      outputResource: RESOURCES.GTAO_OUTPUT,
      enabled: () => ppStateRef.current.ssaoEnabled && isPolytope,
    });
    passRefs.current.gtao = gtaoPass;
    g.addPass(gtaoPass);

    // Bloom pass
    const bloomPass = new BloomPass({
      id: 'bloom',
      inputResource: RESOURCES.GTAO_OUTPUT,
      outputResource: RESOURCES.BLOOM_OUTPUT,
      strength: ppStateRef.current.bloomIntensity,
      radius: ppStateRef.current.bloomRadius,
      threshold: ppStateRef.current.bloomThreshold,
      enabled: () => ppStateRef.current.bloomEnabled,
    });
    passRefs.current.bloom = bloomPass;
    g.addPass(bloomPass);

    // SSR pass
    const ssrPass = new SSRPass({
      id: 'ssr',
      colorInput: RESOURCES.BLOOM_OUTPUT,
      normalInput: RESOURCES.NORMAL_BUFFER,
      depthInput: RESOURCES.OBJECT_DEPTH,
      alternateDepthInput: RESOURCES.SCENE_COLOR,
      alternateDepthInputAttachment: 'depth',
      depthInputSelector: () =>
        ppStateRef.current.objectOnlyDepth ? RESOURCES.OBJECT_DEPTH : RESOURCES.SCENE_COLOR,
      outputResource: RESOURCES.SSR_OUTPUT,
      intensity: ppStateRef.current.ssrIntensity,
      maxDistance: ppStateRef.current.ssrMaxDistance,
      thickness: ppStateRef.current.ssrThickness,
      fadeStart: ppStateRef.current.ssrFadeStart,
      fadeEnd: ppStateRef.current.ssrFadeEnd,
      enabled: () => ppStateRef.current.ssrEnabled,
    });
    passRefs.current.ssr = ssrPass;
    g.addPass(ssrPass);

    // Refraction pass
    const refractionPass = new RefractionPass({
      id: 'refraction',
      colorInput: RESOURCES.SSR_OUTPUT,
      normalInput: RESOURCES.NORMAL_BUFFER,
      depthInput: RESOURCES.OBJECT_DEPTH,
      alternateDepthInput: RESOURCES.SCENE_COLOR,
      alternateDepthInputAttachment: 'depth',
      depthInputSelector: () =>
        ppStateRef.current.objectOnlyDepth ? RESOURCES.OBJECT_DEPTH : RESOURCES.SCENE_COLOR,
      outputResource: RESOURCES.REFRACTION_OUTPUT,
      ior: ppStateRef.current.refractionIOR,
      strength: ppStateRef.current.refractionStrength,
      chromaticAberration: ppStateRef.current.refractionChromaticAberration,
      enabled: () => ppStateRef.current.refractionEnabled,
    });
    passRefs.current.refraction = refractionPass;
    g.addPass(refractionPass);

    // Bokeh pass
    const bokehPass = new BokehPass({
      id: 'bokeh',
      colorInput: RESOURCES.REFRACTION_OUTPUT,
      depthInput: RESOURCES.OBJECT_DEPTH,
      alternateDepthInput: RESOURCES.SCENE_COLOR,
      alternateDepthInputAttachment: 'depth',
      depthInputSelector: () =>
        ppStateRef.current.objectOnlyDepth ? RESOURCES.OBJECT_DEPTH : RESOURCES.SCENE_COLOR,
      outputResource: RESOURCES.BOKEH_OUTPUT,
      focus: ppStateRef.current.bokehWorldFocusDistance,
      focusRange: ppStateRef.current.bokehWorldFocusRange,
      aperture: ppStateRef.current.bokehScale * 0.005,
      maxBlur: ppStateRef.current.bokehScale * 0.02,
      enabled: () => {
        const ui = uiStateRef.current;
        return ppStateRef.current.bokehEnabled &&
          !(ui.showDepthBuffer || ui.showNormalBuffer || ui.showTemporalDepthBuffer);
      },
    });
    passRefs.current.bokeh = bokehPass;
    g.addPass(bokehPass);

    // Screen-space lensing pass (black hole)
    const lensingPass = new ScreenSpaceLensingPass({
      id: 'lensing',
      colorInput: RESOURCES.BOKEH_OUTPUT,
      depthInput: RESOURCES.SCENE_COLOR,
      depthInputAttachment: 'depth',
      outputResource: RESOURCES.LENSING_OUTPUT,
      intensity: blackHoleStateRef.current.deferredLensingStrength,
      mass: blackHoleStateRef.current.gravityStrength,
      distortionScale: blackHoleStateRef.current.bendScale,
      chromaticAberration: blackHoleStateRef.current.deferredLensingChromaticAberration,
      falloff: blackHoleStateRef.current.lensingFalloff,
      enabled: () => blackHoleStateRef.current.screenSpaceLensingEnabled && isBlackHole,
    });
    passRefs.current.lensing = lensingPass;
    g.addPass(lensingPass);

    // Cinematic pass
    const cinematicPass = new CinematicPass({
      id: 'cinematic',
      colorInput: RESOURCES.LENSING_OUTPUT,
      outputResource: RESOURCES.CINEMATIC_OUTPUT,
      aberration: ppStateRef.current.cinematicAberration,
      vignette: ppStateRef.current.cinematicVignette,
      enabled: () => ppStateRef.current.cinematicEnabled,
    });
    passRefs.current.cinematic = cinematicPass;
    g.addPass(cinematicPass);

    // Film grain pass (separate from cinematic for better control)
    const filmGrainPass = new FilmGrainPass({
      id: 'filmGrain',
      colorInput: RESOURCES.CINEMATIC_OUTPUT,
      outputResource: RESOURCES.GRAIN_OUTPUT,
      intensity: ppStateRef.current.cinematicGrain,
      grainSize: 1.0,
      colored: false,
      enabled: () => ppStateRef.current.cinematicGrain > 0.01,
    });
    passRefs.current.filmGrain = filmGrainPass;
    g.addPass(filmGrainPass);

    // Anti-aliasing pass (only add the active one to avoid multiple writers)
    // Graph is recreated when antiAliasingMethod changes (see dependency array)
    if (ppStateRef.current.antiAliasingMethod === 'fxaa') {
      const fxaaPass = new FXAAPass({
        id: 'fxaa',
        colorInput: RESOURCES.GRAIN_OUTPUT,
        outputResource: RESOURCES.AA_OUTPUT,
      });
      passRefs.current.fxaa = fxaaPass;
      passRefs.current.smaa = undefined;
      g.addPass(fxaaPass);
    } else if (ppStateRef.current.antiAliasingMethod === 'smaa') {
      const smaaPass = new SMAAPass({
        id: 'smaa',
        colorInput: RESOURCES.GRAIN_OUTPUT,
        outputResource: RESOURCES.AA_OUTPUT,
      });
      passRefs.current.smaa = smaaPass;
      passRefs.current.fxaa = undefined;
      g.addPass(smaaPass);
    } else {
      // No AA - use efficient CopyPass instead of FXAAPass for passthrough
      const passthroughPass = new CopyPass({
        id: 'aaPassthrough',
        colorInput: RESOURCES.GRAIN_OUTPUT,
        outputResource: RESOURCES.AA_OUTPUT,
      });
      passRefs.current.fxaa = undefined;
      passRefs.current.smaa = undefined;
      g.addPass(passthroughPass);
    }

    // Buffer preview pass
    const bufferPreview = new BufferPreviewPass({
      id: 'bufferPreview',
      bufferInput: RESOURCES.NORMAL_BUFFER,
      additionalInputs: [RESOURCES.OBJECT_DEPTH, RESOURCES.SCENE_COLOR, RESOURCES.NORMAL_BUFFER],
      outputResource: RESOURCES.PREVIEW_OUTPUT,
      bufferType: 'copy',
      depthMode: 'linear',
      enabled: () => {
        const ui = uiStateRef.current;
        return ui.showDepthBuffer || ui.showNormalBuffer || ui.showTemporalDepthBuffer;
      },
    });
    passRefs.current.bufferPreview = bufferPreview;
    g.addPass(bufferPreview);

    // Output to screen (preview vs final)
    g.addPass(
      new ToScreenPass({
        id: 'previewToScreen',
        inputs: [{ resourceId: RESOURCES.PREVIEW_OUTPUT, access: 'read' }],
        gammaCorrection: false,
        toneMapping: false,
        enabled: () => {
          const ui = uiStateRef.current;
          return ui.showDepthBuffer || ui.showNormalBuffer || ui.showTemporalDepthBuffer;
        },
      })
    );

    g.addPass(
      new ToScreenPass({
        id: 'finalToScreen',
        inputs: [{ resourceId: RESOURCES.AA_OUTPUT, access: 'read' }],
        gammaCorrection: false, // Let renderer handle it
        toneMapping: false,
        enabled: () => {
          const ui = uiStateRef.current;
          return !(ui.showDepthBuffer || ui.showNormalBuffer || ui.showTemporalDepthBuffer);
        },
      })
    );

    // Compile the graph (resolves dependencies, orders passes)
    const result = g.compile({ debug: false });
    if (result.warnings.length > 0) {
      console.warn('[PostProcessingV2] Graph compilation warnings:', result.warnings);
    }

    graphRef.current = g;
    return g;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoreCount, isPolytope, isBlackHole, noiseTextureData, ppState.antiAliasingMethod, temporalDepth]); // Recreate on context restore, object type, noise texture, AA method, or temporal depth change

  // ==========================================================================
  // Update pass parameters when store changes
  // ==========================================================================

  useEffect(() => {
    const { fog, gtao, bloom, ssr, bokeh, refraction, lensing, cinematic, filmGrain } = passRefs.current;

    // Update noise texture if it changed
    if (fog) {
      fog.setNoiseTexture(noiseTextureData.texture);
    }

    if (gtao) {
      gtao.setIntensity(ppState.ssaoIntensity);
    }

    if (bloom) {
      bloom.setStrength(ppState.bloomIntensity);
      bloom.setRadius(ppState.bloomRadius);
      bloom.setThreshold(ppState.bloomThreshold);
    }

    if (ssr) {
      ssr.setIntensity(ppState.ssrIntensity);
      ssr.setMaxDistance(ppState.ssrMaxDistance);
      ssr.setThickness(ppState.ssrThickness);
    }

    if (bokeh) {
      bokeh.setFocus(ppState.bokehWorldFocusDistance);
      bokeh.setFocusRange(ppState.bokehWorldFocusRange);
      bokeh.setAperture(ppState.bokehScale * 0.005);
      bokeh.setMaxBlur(ppState.bokehScale * 0.02);
    }

    autoFocusDistanceRef.current = ppState.bokehWorldFocusDistance;
    currentFocusRef.current = ppState.bokehWorldFocusDistance;

    if (refraction) {
      refraction.setIOR(ppState.refractionIOR);
      refraction.setStrength(ppState.refractionStrength);
      refraction.setChromaticAberration(ppState.refractionChromaticAberration);
    }

    if (lensing) {
      lensing.setIntensity(blackHoleState.deferredLensingStrength);
      lensing.setMass(blackHoleState.gravityStrength);
      lensing.setDistortionScale(blackHoleState.bendScale);
      lensing.setFalloff(blackHoleState.lensingFalloff);
      lensing.setChromaticAberration(blackHoleState.deferredLensingChromaticAberration);
      lensing.setHybridSkyEnabled(true);
    }

    if (cinematic) {
      cinematic.setAberration(ppState.cinematicAberration);
      cinematic.setVignette(ppState.cinematicVignette);
    }

    if (filmGrain) {
      filmGrain.setIntensity(ppState.cinematicGrain);
    }
  }, [ppState, blackHoleState, noiseTextureData]);

  // ==========================================================================
  // Update size - use useLayoutEffect to run BEFORE useFrame
  // ==========================================================================

  useLayoutEffect(() => {
    // CRITICAL: Use graphRef.current to match what useFrame uses
    // Using `graph` from useMemo causes a mismatch during React StrictMode double-render
    const graphInstance = graphRef.current;
    if (!graphInstance) return;

    graphInstance.setSize(size.width, size.height);
  }, [graph, size.width, size.height]); // Still depend on graph to re-run when graph changes

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  useEffect(() => {
    return () => {
      graphRef.current?.dispose();
      graphRef.current = null;
    };
  }, []);

  // ==========================================================================
  // Main Render Loop - Just call graph.execute()!
  // ==========================================================================

  useFrame((_, delta) => {
    const graphInstance = graphRef.current;
    if (!graphInstance) return;

    const pp = ppStateRef.current;
    const ui = uiStateRef.current;
    const perf = perfStateRef.current;
    const blackHole = blackHoleStateRef.current;

    const showDepthBuffer = ui.showDepthBuffer;
    const showNormalBuffer = ui.showNormalBuffer;
    const showTemporalDepthBuffer = ui.showTemporalDepthBuffer;

    // Determine temporal cloud usage (Schroedinger volumetric accumulation)
    const temporalCloudAccumulation = perf.temporalReprojectionEnabled && !blackHole.schroedingerIsoEnabled;
    const useTemporalCloud = needsVolumetricSeparation({
      temporalCloudAccumulation,
      objectType: objectTypeRef.current,
    });

    // Update object-depth layers (exclude volumetric when temporal cloud is active)
    const objectDepthLayers: number[] = [RENDER_LAYERS.MAIN_OBJECT];
    if (!useTemporalCloud) {
      objectDepthLayers.push(RENDER_LAYERS.VOLUMETRIC);
    }
    passRefs.current.objectDepth?.setLayers(objectDepthLayers);

    // Update temporal depth camera matrices before rendering
    temporalDepth.updateCameraMatrices(camera);

    // Update SSR quality based on performance refinement
    if (passRefs.current.ssr) {
      const effectiveQuality = getEffectiveSSRQuality(pp.ssrQuality as SSRQualityLevel, perf.qualityMultiplier);
      passRefs.current.ssr.setMaxSteps(SSR_QUALITY_STEPS[effectiveQuality] ?? 32);
    }

    // Update bokeh focus (auto-focus + smoothing)
    if (passRefs.current.bokeh && camera instanceof THREE.PerspectiveCamera) {
      let targetFocus = pp.bokehWorldFocusDistance;

      if (pp.bokehFocusMode === 'auto-center' || pp.bokehFocusMode === 'auto-mouse') {
        autoFocusRaycaster.setFromCamera(screenCenter, camera);
        const intersects = autoFocusRaycaster.intersectObjects(scene.children, true);
        if (intersects.length > 0 && intersects[0]) {
          autoFocusDistanceRef.current = intersects[0].distance;
        }
        targetFocus = autoFocusDistanceRef.current;
      }

      const smoothFactor = pp.bokehSmoothTime > 0 ? 1 - Math.exp(-delta / pp.bokehSmoothTime) : 1;
      currentFocusRef.current += (targetFocus - currentFocusRef.current) * smoothFactor;

      passRefs.current.bokeh.setFocus(currentFocusRef.current);
    }

    // Update lensing center + horizon radius (screen-space)
    if (passRefs.current.lensing && camera instanceof THREE.PerspectiveCamera) {
      projectedBlackHole.copy(blackHoleWorldPosition).project(camera);
      const centerX = (projectedBlackHole.x + 1) * 0.5;
      const centerY = (projectedBlackHole.y + 1) * 0.5;
      passRefs.current.lensing.setCenter(centerX, centerY);

      const distance = camera.position.distanceTo(blackHoleWorldPosition);
      const fovY = (camera.fov * Math.PI) / 180;
      const screenHeight = 2 * distance * Math.tan(fovY / 2);
      const horizonRadiusUV = screenHeight > 0 ? blackHole.horizonRadius / screenHeight : 0.05;
      passRefs.current.lensing.setHorizonRadius(horizonRadiusUV * blackHole.deferredLensingRadius);
    }

    // Update cloud composite uniforms (use write target before swap)
    if (passRefs.current.cloudComposite) {
      const cloudTarget = useTemporalCloud ? graphInstance.getWriteTarget(RESOURCES.TEMPORAL_ACCUMULATION) : null;
      passRefs.current.cloudComposite.setUniform('uCloud', cloudTarget ? cloudTarget.texture : null);
      passRefs.current.cloudComposite.setUniform('uCloudAvailable', cloudTarget ? 1 : 0);
    }

    // Update normal composite with volumetric normals
    if (passRefs.current.normalComposite) {
      // Normal is attachment 1 of cloud buffer
      const cloudNormal = useTemporalCloud ? graphInstance.getTexture(RESOURCES.TEMPORAL_CLOUD_BUFFER, 1) : null;
      passRefs.current.normalComposite.setUniform('uCloudNormal', cloudNormal);
      passRefs.current.normalComposite.setUniform('uCloudAvailable', cloudNormal ? 1 : 0);
    }

    // Configure buffer preview
    if (passRefs.current.bufferPreview && camera instanceof THREE.PerspectiveCamera) {
      if (showDepthBuffer) {
        passRefs.current.bufferPreview.setBufferType('depth');
        passRefs.current.bufferPreview.setDepthMode('linear');
        const depthTexture = pp.objectOnlyDepth
          ? graphInstance.getTexture(RESOURCES.OBJECT_DEPTH)
          : graphInstance.getTexture(RESOURCES.SCENE_COLOR, 'depth');
        passRefs.current.bufferPreview.setExternalTexture(depthTexture);
      } else if (showNormalBuffer) {
        passRefs.current.bufferPreview.setBufferType('normal');
        passRefs.current.bufferPreview.setExternalTexture(null);
        passRefs.current.bufferPreview.setBufferInput(RESOURCES.NORMAL_BUFFER);
      } else if (showTemporalDepthBuffer) {
        passRefs.current.bufferPreview.setBufferType('temporalDepth');
        const temporalUniforms = temporalDepth.getUniforms(true);
        passRefs.current.bufferPreview.setExternalTexture(temporalUniforms.uPrevDepthTexture);
      } else {
        passRefs.current.bufferPreview.setExternalTexture(null);
      }
    }

    // Execute the graph
    graphInstance.execute(gl, scene, camera, delta);

    // Temporal Cloud swap handled by RenderGraph (ping-pong on TEMPORAL_ACCUMULATION)
  }, FRAME_PRIORITY.POST_EFFECTS);

  return null;
});
