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

import { memo, useEffect, useMemo, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { TexturePass } from 'three/examples/jsm/postprocessing/TexturePass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { useVisualStore, SSR_QUALITY_STEPS, type SSRQuality } from '@/stores/visualStore';
import { TONE_MAPPING_TO_THREE } from '@/lib/shaders/types';
import { SSRShader, type SSRUniforms } from '@/lib/shaders/postprocessing/SSRShader';
import { RefractionShader, type RefractionUniforms } from '@/lib/shaders/postprocessing/RefractionShader';
import { RENDER_LAYERS, needsObjectOnlyDepth } from '@/lib/rendering/layers';

/**
 * Type for bokeh shader uniforms
 */
interface BokehUniforms {
  tDiffuse: { value: THREE.Texture | null };
  tDepth: { value: THREE.DepthTexture | null };
  focus: { value: number };
  focusRange: { value: number };
  aperture: { value: number };
  maxblur: { value: number };
  nearClip: { value: number };
  farClip: { value: number };
  aspect: { value: number };
  debugMode: { value: number };
  blurMethod: { value: number };
  time: { value: number };
}

/**
 * Custom BokehShader - simplified and working with depth texture
 */
const CustomBokehShader = {
  name: 'CustomBokehShader',

  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tDepth: { value: null as THREE.DepthTexture | null },
    focus: { value: 10.0 },
    focusRange: { value: 5.0 },
    aperture: { value: 0.01 },
    maxblur: { value: 0.1 },
    nearClip: { value: 0.1 },
    farClip: { value: 1000.0 },
    aspect: { value: 1.0 },
    debugMode: { value: 0.0 },
    blurMethod: { value: 3.0 }, // 0=disc, 1=jittered, 2=separable, 3=hexagonal
    time: { value: 0.0 },
  },

  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    #include <packing>

    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform float focus;
    uniform float focusRange;
    uniform float aperture;
    uniform float maxblur;
    uniform float nearClip;
    uniform float farClip;
    uniform float aspect;
    uniform float debugMode;
    uniform float blurMethod;
    uniform float time;

    varying vec2 vUv;

    // Pseudo-random function for jittered sampling
    float rand(vec2 co) {
      return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
    }

    float getDepth(vec2 coord) {
      return texture2D(tDepth, coord).x;
    }

    float getViewZ(float depth) {
      return perspectiveDepthToViewZ(depth, nearClip, farClip);
    }

    // Method 0: Basic disc blur (17 samples in circular pattern)
    vec4 discBlur(vec2 uv, vec2 blur) {
      vec4 col = vec4(0.0);
      col += texture2D(tDiffuse, uv);
      col += texture2D(tDiffuse, uv + blur * vec2(0.0, 0.4));
      col += texture2D(tDiffuse, uv + blur * vec2(0.15, 0.37));
      col += texture2D(tDiffuse, uv + blur * vec2(0.29, 0.29));
      col += texture2D(tDiffuse, uv + blur * vec2(-0.37, 0.15));
      col += texture2D(tDiffuse, uv + blur * vec2(0.4, 0.0));
      col += texture2D(tDiffuse, uv + blur * vec2(0.37, -0.15));
      col += texture2D(tDiffuse, uv + blur * vec2(0.29, -0.29));
      col += texture2D(tDiffuse, uv + blur * vec2(-0.15, -0.37));
      col += texture2D(tDiffuse, uv + blur * vec2(0.0, -0.4));
      col += texture2D(tDiffuse, uv + blur * vec2(-0.15, 0.37));
      col += texture2D(tDiffuse, uv + blur * vec2(-0.29, 0.29));
      col += texture2D(tDiffuse, uv + blur * vec2(0.37, 0.15));
      col += texture2D(tDiffuse, uv + blur * vec2(-0.4, 0.0));
      col += texture2D(tDiffuse, uv + blur * vec2(-0.37, -0.15));
      col += texture2D(tDiffuse, uv + blur * vec2(-0.29, -0.29));
      col += texture2D(tDiffuse, uv + blur * vec2(0.15, -0.37));
      return col / 17.0;
    }

    // Method 1: Jittered blur (randomized sample positions for smoother result)
    vec4 jitteredBlur(vec2 uv, vec2 blur) {
      vec4 col = vec4(0.0);
      float total = 0.0;

      // Use pixel position + time for varying noise
      vec2 noise = vec2(rand(uv + time), rand(uv.yx + time)) * 2.0 - 1.0;

      // 25 samples with jitter
      for (float x = -2.0; x <= 2.0; x += 1.0) {
        for (float y = -2.0; y <= 2.0; y += 1.0) {
          vec2 offset = vec2(x, y) / 2.0;
          // Add small random jitter to each sample
          vec2 jitter = vec2(rand(uv + vec2(x, y)), rand(uv + vec2(y, x))) * 0.5 - 0.25;
          offset += jitter;

          // Weight by distance from center (gaussian-like)
          float weight = 1.0 - length(offset) * 0.3;
          weight = max(weight, 0.0);

          col += texture2D(tDiffuse, uv + blur * offset) * weight;
          total += weight;
        }
      }
      return col / total;
    }

    // Method 2: Separable blur (horizontal + vertical, more efficient)
    vec4 separableBlur(vec2 uv, vec2 blur) {
      vec4 col = vec4(0.0);
      float total = 0.0;

      // Gaussian weights for 9-tap filter
      float weights[5];
      weights[0] = 0.227027;
      weights[1] = 0.1945946;
      weights[2] = 0.1216216;
      weights[3] = 0.054054;
      weights[4] = 0.016216;

      // Horizontal samples
      for (int i = -4; i <= 4; i++) {
        float w = weights[int(abs(float(i)))];
        col += texture2D(tDiffuse, uv + vec2(blur.x * float(i) * 0.25, 0.0)) * w;
        total += w;
      }

      // Vertical samples
      for (int i = -4; i <= 4; i++) {
        float w = weights[int(abs(float(i)))];
        col += texture2D(tDiffuse, uv + vec2(0.0, blur.y * float(i) * 0.25)) * w;
        total += w;
      }

      return col / total;
    }

    // Method 3: Hexagonal bokeh (cinematic look with weighted samples)
    vec4 hexagonalBlur(vec2 uv, vec2 blur) {
      vec4 col = vec4(0.0);
      float total = 0.0;

      // Hexagonal pattern with 3 rings + center
      // Ring 0: center
      col += texture2D(tDiffuse, uv) * 1.0;
      total += 1.0;

      // Ring 1: 6 samples at distance 0.33
      float r1 = 0.33;
      for (int i = 0; i < 6; i++) {
        float angle = float(i) * 1.0472; // 60 degrees = PI/3
        vec2 offset = vec2(cos(angle), sin(angle)) * r1;
        col += texture2D(tDiffuse, uv + blur * offset) * 0.9;
        total += 0.9;
      }

      // Ring 2: 12 samples at distance 0.67
      float r2 = 0.67;
      for (int i = 0; i < 12; i++) {
        float angle = float(i) * 0.5236; // 30 degrees = PI/6
        vec2 offset = vec2(cos(angle), sin(angle)) * r2;
        col += texture2D(tDiffuse, uv + blur * offset) * 0.7;
        total += 0.7;
      }

      // Ring 3: 18 samples at distance 1.0
      float r3 = 1.0;
      for (int i = 0; i < 18; i++) {
        float angle = float(i) * 0.349; // 20 degrees
        vec2 offset = vec2(cos(angle), sin(angle)) * r3;
        col += texture2D(tDiffuse, uv + blur * offset) * 0.5;
        total += 0.5;
      }

      return col / total;
    }

    void main() {
      float depth = getDepth(vUv);
      float viewZ = -getViewZ(depth);

      // Calculate distance from focus point
      float diff = viewZ - focus;
      float absDiff = abs(diff);

      // Calculate blur factor with focus range dead zone
      // Objects within focusRange of the focus point stay sharp
      float blurFactor = max(0.0, absDiff - focusRange) * aperture;
      blurFactor = min(blurFactor, maxblur);

      // Debug mode 1: show raw depth buffer (inverted so near=white, far=black)
      if (debugMode > 0.5 && debugMode < 1.5) {
        gl_FragColor = vec4(vec3(1.0 - depth), 1.0);
        return;
      }

      // Debug mode 2: show linear depth normalized to camera range (near=black, far=white)
      if (debugMode > 1.5 && debugMode < 2.5) {
        float normalized = (viewZ - nearClip) / (farClip - nearClip);
        gl_FragColor = vec4(vec3(clamp(normalized, 0.0, 1.0)), 1.0);
        return;
      }

      // Debug mode 3: show focus zones (green=in focus, red/blue=out of focus)
      if (debugMode > 2.5) {
        // Green channel: in-focus zone (within focusRange)
        float inFocus = 1.0 - clamp(absDiff / focusRange, 0.0, 1.0);
        // Red: behind focus (positive diff), Blue: in front (negative diff)
        float behind = clamp(diff / (focusRange * 3.0), 0.0, 1.0);
        float infront = clamp(-diff / (focusRange * 3.0), 0.0, 1.0);
        gl_FragColor = vec4(behind, inFocus, infront, 1.0);
        return;
      }

      // Apply blur based on selected method
      vec2 dofblur = vec2(blurFactor);
      dofblur *= vec2(1.0, aspect);

      vec4 col;

      if (blurMethod < 0.5) {
        // Method 0: Disc
        col = discBlur(vUv, dofblur);
      } else if (blurMethod < 1.5) {
        // Method 1: Jittered
        col = jitteredBlur(vUv, dofblur);
      } else if (blurMethod < 2.5) {
        // Method 2: Separable
        col = separableBlur(vUv, dofblur);
      } else {
        // Method 3: Hexagonal
        col = hexagonalBlur(vUv, dofblur);
      }

      gl_FragColor = col;
      gl_FragColor.a = 1.0;
    }
  `,
};

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
    showDepthBuffer,
    ssrEnabled,
    refractionEnabled,
    toneMappingEnabled,
    toneMappingAlgorithm,
    exposure,
  } = useVisualStore(
    useShallow((state) => ({
      bloomEnabled: state.bloomEnabled,
      bloomIntensity: state.bloomIntensity,
      bloomThreshold: state.bloomThreshold,
      bloomRadius: state.bloomRadius,
      bokehEnabled: state.bokehEnabled,
      showDepthBuffer: state.showDepthBuffer,
      ssrEnabled: state.ssrEnabled,
      refractionEnabled: state.refractionEnabled,
      toneMappingEnabled: state.toneMappingEnabled,
      toneMappingAlgorithm: state.toneMappingAlgorithm,
      exposure: state.exposure,
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
  const { composer, bloomPass, bokehPass, ssrPass, refractionPass, sceneTarget, objectDepthTarget, texturePass } = useMemo(() => {
    // Create single render target with depth texture (full scene)
    const renderTarget = new THREE.WebGLRenderTarget(size.width, size.height, {
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
    // Note: depthBuffer is enabled by default for z-testing, but we don't need
    // a DepthTexture here since all effects use object-only depth

    // Create object-only depth target for SSR/refraction/bokeh
    // This excludes environment objects (walls, gizmos) from depth-based effects
    const objectDepth = new THREE.WebGLRenderTarget(size.width, size.height, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
      stencilBuffer: false,
    });
    objectDepth.texture.name = 'ObjectDepthColor';
    const objectDepthTex = new THREE.DepthTexture(size.width, size.height);
    objectDepthTex.format = THREE.DepthFormat;
    objectDepthTex.type = THREE.UnsignedShortType;
    objectDepthTex.minFilter = THREE.NearestFilter;
    objectDepthTex.magFilter = THREE.NearestFilter;
    objectDepth.depthTexture = objectDepthTex;

    // Create composer - we'll manually render scene to target, then use TexturePass
    const effectComposer = new EffectComposer(gl);

    // TexturePass to copy from our pre-rendered scene
    const texPass = new TexturePass(renderTarget.texture);
    effectComposer.addPass(texPass);

    // Bloom - always created, enabled/disabled dynamically
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      bloomIntensity,
      bloomRadius,
      bloomThreshold
    );
    effectComposer.addPass(bloom);

    // Bokeh - always created, enabled/disabled dynamically
    const bokeh = new ShaderPass(CustomBokehShader);
    bokeh.enabled = false;
    effectComposer.addPass(bokeh);

    // SSR - always created, enabled/disabled dynamically
    const ssr = new ShaderPass(SSRShader);
    ssr.enabled = false;
    effectComposer.addPass(ssr);

    // Refraction - always created, enabled/disabled dynamically
    const refraction = new ShaderPass(RefractionShader);
    refraction.enabled = false;
    effectComposer.addPass(refraction);

    // Output
    const outputPass = new OutputPass();
    effectComposer.addPass(outputPass);

    return {
      composer: effectComposer,
      bloomPass: bloom,
      bokehPass: bokeh,
      ssrPass: ssr,
      refractionPass: refraction,
      sceneTarget: renderTarget,
      objectDepthTarget: objectDepth,
      texturePass: texPass,
    };
  }, [gl, size.width, size.height]);

  // Update bloom pass enabled state and parameters
  useEffect(() => {
    bloomPass.enabled = bloomEnabled;
    if (bloomEnabled) {
      bloomPass.strength = bloomIntensity;
      bloomPass.threshold = bloomThreshold;
      bloomPass.radius = bloomRadius;
    }
  }, [bloomPass, bloomEnabled, bloomIntensity, bloomThreshold, bloomRadius]);

  // Update bokeh enabled state (also enabled when showing depth buffer)
  useEffect(() => {
    bokehPass.enabled = bokehEnabled || showDepthBuffer;
  }, [bokehPass, bokehEnabled, showDepthBuffer]);

  // Update SSR enabled state
  useEffect(() => {
    ssrPass.enabled = ssrEnabled;
  }, [ssrPass, ssrEnabled]);

  // Update refraction enabled state
  useEffect(() => {
    refractionPass.enabled = refractionEnabled;
  }, [refractionPass, refractionEnabled]);

  // Resize
  useEffect(() => {
    composer.setSize(size.width, size.height);
    bloomPass.resolution.set(size.width, size.height);
    sceneTarget.setSize(size.width, size.height);
    objectDepthTarget.setSize(size.width, size.height);

    // Update texture pass with new texture reference after resize (color buffer)
    texturePass.map = sceneTarget.texture;

    const bokehUniforms = bokehPass.uniforms as unknown as BokehUniforms;
    bokehUniforms.aspect.value = size.height / size.width;

    // Update SSR uniforms
    const ssrUniforms = ssrPass.uniforms as unknown as SSRUniforms;
    ssrUniforms.resolution.value.set(size.width, size.height);

    // Update refraction uniforms
    const refractionUniforms = refractionPass.uniforms as unknown as RefractionUniforms;
    refractionUniforms.resolution.value.set(size.width, size.height);
  }, [composer, bloomPass, bokehPass, ssrPass, refractionPass, sceneTarget, objectDepthTarget, texturePass, size.width, size.height]);

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      composer.dispose();
      sceneTarget.dispose();
      objectDepthTarget.dispose();
    };
  }, [composer, sceneTarget, objectDepthTarget]);

  // Render
  useFrame((_, delta) => {
    // Read current enabled states from store to avoid stale closures
    const state = useVisualStore.getState();
    const currentBloomEnabled = state.bloomEnabled;
    const currentBokehEnabled = state.bokehEnabled;
    const currentShowDepthBuffer = state.showDepthBuffer;
    const currentSSREnabled = state.ssrEnabled;
    const currentRefractionEnabled = state.refractionEnabled;

    // Bokeh pass also runs when showing depth buffer (uses same shader)
    const bokehOrDepthEnabled = currentBokehEnabled || currentShowDepthBuffer;

    // Update pass enabled states every frame to ensure sync
    bloomPass.enabled = currentBloomEnabled;
    bokehPass.enabled = bokehOrDepthEnabled;
    ssrPass.enabled = currentSSREnabled;
    refractionPass.enabled = currentRefractionEnabled;

    // Set bloom strength (0 when disabled for smooth transition)
    bloomPass.strength = currentBloomEnabled ? state.bloomIntensity : 0;

    // Save renderer state
    const currentAutoClear = gl.autoClear;
    const currentClearColor = gl.getClearColor(tempClearColor);
    const currentClearAlpha = gl.getClearAlpha();

    // Check if we need object-only depth for SSR/refraction/bokeh/depth visualization
    const renderObjectDepth = needsObjectOnlyDepth({
      ssrEnabled: currentSSREnabled,
      refractionEnabled: currentRefractionEnabled,
      bokehEnabled: bokehOrDepthEnabled,
      bokehFocusMode: state.bokehFocusMode,
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
      gl.render(scene, camera);
      glContext.colorMask(true, true, true, true);

      // Restore original depthWrite settings
      savedDepthWriteForObjectPass.forEach((value, mat) => {
        mat.depthWrite = value;
      });

      // Restore camera layers
      camera.layers.mask = savedCameraLayers;
    }

    // Render full scene to capture color and depth
    // Ensure camera sees both environment (layer 0) and main object (layer 1)
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.layers.enable(RENDER_LAYERS.ENVIRONMENT);
      camera.layers.enable(RENDER_LAYERS.MAIN_OBJECT);
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

    gl.render(scene, camera);

    // Restore original depthWrite settings
    savedDepthWrite.forEach((value, mat) => {
      mat.depthWrite = value;
    });

    gl.setRenderTarget(null);

    // Restore renderer state
    gl.autoClear = currentAutoClear;
    gl.setClearColor(currentClearColor, currentClearAlpha);

    // Use object-only depth for all effects (excludes walls, gizmos)
    // Only available when renderObjectDepth is true (effects are enabled)
    const effectDepthTexture = objectDepthTarget.depthTexture;

    // Update texture pass (color buffer from MRT)
    texturePass.map = sceneTarget.texture;

    if (bokehOrDepthEnabled && camera instanceof THREE.PerspectiveCamera) {
      let targetFocus = state.bokehWorldFocusDistance;

      // Auto-focus: raycast to find depth at screen center
      if (state.bokehFocusMode === 'auto-center' || state.bokehFocusMode === 'auto-mouse') {
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
      const smoothFactor = state.bokehSmoothTime > 0 ? 1 - Math.exp(-delta / state.bokehSmoothTime) : 1;
      currentFocusRef.current += (targetFocus - currentFocusRef.current) * smoothFactor;

      const uniforms = bokehPass.uniforms as unknown as BokehUniforms;
      // Use object-only depth for bokeh to focus on main object, not walls
      uniforms.tDepth.value = effectDepthTexture;
      uniforms.focus.value = currentFocusRef.current;

      // Focus range: the depth range where objects stay sharp (in world units)
      // This creates a "dead zone" around the focus point
      uniforms.focusRange.value = state.bokehWorldFocusRange;

      // Aperture: controls how quickly blur increases beyond the focus range
      // bokehScale: 0-3 maps to aperture: 0-0.015
      // Lower values = more gradual blur falloff
      uniforms.aperture.value = state.bokehScale * 0.005;

      // Maxblur: cap the maximum blur amount (typical: 0.01-0.05)
      // bokehScale: 0-3 maps to maxblur: 0-0.06
      uniforms.maxblur.value = state.bokehScale * 0.02;

      uniforms.nearClip.value = camera.near;
      uniforms.farClip.value = camera.far;

      // Debug mode: 0=normal, 1=raw depth, 2=linear depth, 3=focus zones
      // showDepthBuffer (from Settings) shows linear depth visualization
      // bokehShowDebug (from Bokeh controls) shows focus zones
      let debugMode = 0;
      if (state.showDepthBuffer) {
        debugMode = 2; // Linear depth
      } else if (state.bokehShowDebug) {
        debugMode = 3; // Focus zones
      }
      uniforms.debugMode.value = debugMode;

      // Blur method: 0=disc, 1=jittered, 2=separable, 3=hexagonal
      const blurMethodMap: Record<string, number> = {
        disc: 0,
        jittered: 1,
        separable: 2,
        hexagonal: 3,
      };
      uniforms.blurMethod.value = blurMethodMap[state.bokehBlurMethod] ?? 3;

      // Time for jittered blur animation (prevents static noise patterns)
      uniforms.time.value = performance.now() * 0.001;
    }

    // Update SSR uniforms
    if (currentSSREnabled && camera instanceof THREE.PerspectiveCamera) {
      const ssrUniforms = ssrPass.uniforms as unknown as SSRUniforms;
      ssrUniforms.tNormal.value = null; // No normal buffer - SSR will use depth-based reconstruction
      // Use object-only depth for SSR to only reflect main object, not walls
      ssrUniforms.tDepth.value = effectDepthTexture;
      ssrUniforms.projMatrix.value.copy(camera.projectionMatrix);
      ssrUniforms.invProjMatrix.value.copy(camera.projectionMatrixInverse);
      ssrUniforms.uViewMat.value.copy(camera.matrixWorldInverse);
      ssrUniforms.intensity.value = state.ssrIntensity;
      ssrUniforms.maxDistance.value = state.ssrMaxDistance;
      ssrUniforms.thickness.value = state.ssrThickness;
      ssrUniforms.fadeStart.value = state.ssrFadeStart;
      ssrUniforms.fadeEnd.value = state.ssrFadeEnd;
      ssrUniforms.maxSteps.value = SSR_QUALITY_STEPS[state.ssrQuality as SSRQuality] ?? 32;
      ssrUniforms.nearClip.value = camera.near;
      ssrUniforms.farClip.value = camera.far;
    }

    // Update refraction uniforms
    if (currentRefractionEnabled && camera instanceof THREE.PerspectiveCamera) {
      const refractionUniforms = refractionPass.uniforms as unknown as RefractionUniforms;
      refractionUniforms.tNormal.value = null; // No normal buffer - refraction will use depth-based reconstruction
      // Use object-only depth for refraction to only distort main object, not walls
      refractionUniforms.tDepth.value = effectDepthTexture;
      refractionUniforms.invProjMatrix.value.copy(camera.projectionMatrixInverse);
      refractionUniforms.ior.value = state.refractionIOR;
      refractionUniforms.strength.value = state.refractionStrength;
      refractionUniforms.chromaticAberration.value = state.refractionChromaticAberration;
      refractionUniforms.nearClip.value = camera.near;
      refractionUniforms.farClip.value = camera.far;
    }

    composer.render();
  }, 1);

  return null;
});
