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

import { RENDER_LAYERS, needsObjectOnlyDepth } from '@/rendering/core/layers';
import { TemporalDepthManager } from '@/rendering/core/TemporalDepthManager';
import { BokehShader, type BokehUniforms } from '@/rendering/shaders/postprocessing/BokehShader';
import { RefractionShader, type RefractionUniforms } from '@/rendering/shaders/postprocessing/RefractionShader';
import { SSRShader, type SSRUniforms } from '@/rendering/shaders/postprocessing/SSRShader';
import { TONE_MAPPING_TO_THREE } from '@/rendering/shaders/types';
import { getEffectiveSSRQuality, usePerformanceStore } from '@/stores';
import { SSR_QUALITY_STEPS, type SSRQuality } from '@/stores/defaults/visualDefaults';
import { useLightingStore } from '@/stores/lightingStore';
import { usePerformanceMetricsStore, type BufferStats } from '@/stores/performanceMetricsStore';
import { usePostProcessingStore } from '@/stores/postProcessingStore';
import { useUIStore } from '@/stores/uiStore';
import { useFrame, useThree } from '@react-three/fiber';
import { memo, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
// SMAAShader imports not needed - we modify SMAAPass internals directly
import { TexturePass } from 'three/examples/jsm/postprocessing/TexturePass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { useShallow } from 'zustand/react/shallow';

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

export const PostProcessing = memo(function PostProcessing() {
  const { gl, scene, camera, size } = useThree();
  const originalToneMapping = useRef<THREE.ToneMapping>(gl.toneMapping);
  const originalExposure = useRef<number>(gl.toneMappingExposure);
  const currentFocusRef = useRef<number>(15);
  const autoFocusDistanceRef = useRef<number>(15);

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
  const { composer, bloomPass, bokehPass, ssrPass, refractionPass, fxaaPass, smaaPass, sceneTarget, objectDepthTarget, normalTarget, mainObjectMRT, normalCopyMaterial, normalCopyScene, normalCopyCamera, texturePass } = useMemo(() => {
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
      type: THREE.HalfFloatType, // Match Three.js SSRPass precision needs
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
    mainObjectMRT.textures[0].name = 'MainObjectColor_Discarded';
    mainObjectMRT.textures[1].name = 'MainObjectNormal';
    // Add depth texture for proper occlusion testing
    const mainObjectDepthTex = new THREE.DepthTexture(initialWidth, initialHeight);
    mainObjectDepthTex.format = THREE.DepthFormat;
    mainObjectDepthTex.type = THREE.UnsignedShortType;
    mainObjectMRT.depthTexture = mainObjectDepthTex;

    // Create copy material for transferring MRT normal texture to normalTarget
    // This replaces blitFramebuffer which has unreliable behavior across browsers
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
        void main() {
          fragColor = texture(tNormal, vUv);
          // Also copy depth to gl_FragDepth for proper compositing
          gl_FragDepth = texture(tDepth, vUv).r;
        }
      `,
      depthTest: false,
      depthWrite: true, // Write depth for environment pass compositing
    });
    const normalCopyQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), normalCopyMaterial);
    const normalCopyScene = new THREE.Scene();
    normalCopyScene.add(normalCopyQuad);
    const normalCopyCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

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

    // Output - tone mapping and final output
    const outputPass = new OutputPass();
    effectComposer.addPass(outputPass);

    return {
      composer: effectComposer,
      bloomPass: bloom,
      bokehPass: bokeh,
      ssrPass: ssr,
      refractionPass: refraction,
      fxaaPass: fxaa,
      smaaPass: smaa,
      sceneTarget: renderTarget,
      objectDepthTarget: objectDepth,
      normalTarget: normalTarget,
      mainObjectMRT: mainObjectMRT,
      normalCopyMaterial: normalCopyMaterial,
      normalCopyScene: normalCopyScene,
      normalCopyCamera: normalCopyCamera,
      texturePass: texPass,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl]); // Only recreate when gl changes, NOT on size changes

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
  }, [composer, bloomPass, bokehPass, ssrPass, refractionPass, sceneTarget, objectDepthTarget, normalTarget, mainObjectMRT, texturePass, size.width, size.height]);

  // Initialize temporal depth manager on mount and resize
  useEffect(() => {
    TemporalDepthManager.initialize(size.width, size.height, gl);
  }, [gl, size.width, size.height]);

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
  useEffect(() => {
    return () => {
      composer.dispose();
      sceneTarget.dispose();
      objectDepthTarget.dispose();
      normalTarget.dispose();
      mainObjectMRT.dispose();
      normalCopyMaterial.dispose();
      TemporalDepthManager.dispose();
    };
  }, [composer, sceneTarget, objectDepthTarget, normalTarget, mainObjectMRT, normalCopyMaterial]);

  // Render
  useFrame((_, delta) => {
    // Read current enabled states from store to avoid stale closures
    const ppState = usePostProcessingStore.getState();
    const uiState = useUIStore.getState();

    const currentBloomEnabled = ppState.bloomEnabled;
    const currentBokehEnabled = ppState.bokehEnabled;
    const currentShowDepthBuffer = uiState.showDepthBuffer;
    const currentSSREnabled = ppState.ssrEnabled;
    const currentRefractionEnabled = ppState.refractionEnabled;
    const currentAntiAliasingMethod = ppState.antiAliasingMethod;

    // Bokeh pass also runs when showing depth/normal buffer or temporal depth (uses same shader)
    const currentShowNormalBuffer = uiState.showNormalBuffer;
    const bokehOrDepthEnabled = currentBokehEnabled || currentShowDepthBuffer || currentShowNormalBuffer || uiState.showTemporalDepthBuffer;

    // Update pass enabled states every frame to ensure sync
    bloomPass.enabled = currentBloomEnabled;
    bokehPass.enabled = bokehOrDepthEnabled;
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
    const temporalReprojectionEnabled = usePerformanceStore.getState().temporalReprojectionEnabled;
    const renderObjectDepth = needsObjectOnlyDepth({
      ssrEnabled: currentSSREnabled,
      refractionEnabled: currentRefractionEnabled,
      bokehEnabled: bokehOrDepthEnabled,
      bokehFocusMode: ppState.bokehFocusMode,
      temporalReprojectionEnabled,
    });

    // Render object-only depth pass (excludes walls, gizmos, axes)
    // Only rendered when SSR, refraction, or bokeh auto-focus needs it
    if (renderObjectDepth && camera instanceof THREE.PerspectiveCamera) {
      const savedCameraLayers = camera.layers.mask;

      // Only render main object layer
      camera.layers.set(RENDER_LAYERS.MAIN_OBJECT);

      gl.autoClear = false;
      gl.setRenderTarget(objectDepthTarget);
      gl.setClearColor(0x000000, 0);
      gl.clear(true, true, false); // Clear color and depth

      // Force all materials to write depth during object-only pass
      // This ensures transparent faces (like polytope faces with opacity < 1) write to depth
      const savedDepthWriteForObjectPass: Map<THREE.Material, boolean> = new Map();
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mat = (obj as THREE.Mesh).material as THREE.Material;
          savedDepthWriteForObjectPass.set(mat, mat.depthWrite);
          mat.depthWrite = true;
        }
      });

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
      if (objectDepthTarget.depthTexture) {
        TemporalDepthManager.captureDepth(gl, objectDepthTarget.depthTexture);
      }
    }

    // Render full scene to capture color and depth
    // Ensure camera sees environment (layer 0), main object (layer 1), and skybox (layer 2)
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.layers.enable(RENDER_LAYERS.ENVIRONMENT);
      camera.layers.enable(RENDER_LAYERS.MAIN_OBJECT);
      camera.layers.enable(RENDER_LAYERS.SKYBOX);
    }

    gl.autoClear = false;
    gl.setRenderTarget(sceneTarget);
    gl.setClearColor(0x000000, 0);
    gl.clear(true, true, true); // Clear color, depth, stencil

    // Force all materials to write depth during this pass
    const savedDepthWrite: Map<THREE.Material, boolean> = new Map();
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
    let uniqueVertices = 0;
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

    usePerformanceMetricsStore.getState().updateMetrics({
      sceneGpu: {
        calls: sceneRenderStats.calls,
        triangles: sceneRenderStats.triangles,
        points: sceneRenderStats.points,
        lines: sceneRenderStats.lines,
        uniqueVertices,
      },
    });

    // Render normal pass for G-buffer (when SSR, refraction, or normal visualization needs normals)
    // DEBUG: Simplified approach - render main objects directly to normalTarget
    // to verify they render at all (bypassing MRT complexity)
    const needsNormalPass = currentSSREnabled || currentRefractionEnabled || currentShowNormalBuffer;
    if (needsNormalPass) {
      const savedCameraLayers = camera.layers.mask;

      // Clear normalTarget
      gl.setRenderTarget(normalTarget);
      gl.setClearColor(0x000000, 0);
      gl.clear(true, true, false);

      // DEBUG: Render main objects directly to normalTarget (no MRT)
      // This tests if main objects render at all with their shaders
      camera.layers.set(RENDER_LAYERS.MAIN_OBJECT);
      gl.render(scene, camera);

      // Then render environment with MeshNormalMaterial WITH DEPTH TEST
      camera.layers.set(RENDER_LAYERS.ENVIRONMENT);
      scene.overrideMaterial = normalMaterial;
      gl.render(scene, camera);
      scene.overrideMaterial = null;

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

    if (bokehOrDepthEnabled && camera instanceof THREE.PerspectiveCamera) {
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

      // Debug modes: 0=normal, 1=raw depth, 2=linear depth, 3=focus zones
      let debugMode = 0;
      if (uiState.showDepthBuffer) {
        debugMode = 2; // Linear depth
      } else if (ppState.bokehShowDebug) {
        debugMode = 3; // Focus zones
      }
      uniforms.debugMode.value = debugMode;

      // Temporal depth visualization (separate from debug modes)
      uniforms.showTemporalDepth.value = uiState.showTemporalDepthBuffer;
      const temporalUniforms = TemporalDepthManager.getUniforms();
      uniforms.tTemporalDepth.value = temporalUniforms.uPrevDepthTexture;

      // Normal buffer visualization
      uniforms.showNormalBuffer.value = currentShowNormalBuffer;
      uniforms.tNormal.value = normalTarget.texture;

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
      const qualityMultiplier = usePerformanceStore.getState().qualityMultiplier;
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

    composer.render();

    // Swap temporal depth buffers at end of frame
    TemporalDepthManager.swap();
  }, 1);

  return null;
});
