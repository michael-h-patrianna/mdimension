/**
 * TrackedShaderMaterial - Centralized shader compilation tracking
 *
 * Wrapper component around <shaderMaterial> that automatically tracks
 * shader compilation state and shows a loading overlay to users.
 *
 * Features:
 * - Supports multiple simultaneous shader compilations
 * - Properly cleans up on unmount to prevent stuck overlay
 * - Validates required props at runtime
 * - Uses getState() for performance (no subscription overhead)
 * - Defers shader rendering to allow overlay to appear first
 *
 * Usage:
 * ```tsx
 * <TrackedShaderMaterial
 *   shaderName="My Shader"
 *   vertexShader={vertexSource}
 *   fragmentShader={fragmentSource}
 *   uniforms={uniforms}
 *   // ... other shaderMaterial props
 * />
 * ```
 *
 * The overlay appears BEFORE the GPU compiles by deferring shader rendering
 * by one frame, giving React time to paint the overlay.
 *
 * @module rendering/materials/TrackedShaderMaterial
 */

import { usePerformanceStore } from '@/stores/performanceStore';
import { useLayoutEffect, useEffect, useRef, useState } from 'react';
import type { Side } from 'three';
import * as THREE from 'three';

/**
 * Props for TrackedShaderMaterial component.
 * Extends standard shaderMaterial props with tracking metadata.
 */
interface TrackedShaderMaterialProps {
  /** Display name shown in compilation overlay (e.g., "Schrödinger Quantum Volume") */
  shaderName: string;
  /** Fragment shader GLSL source (required) */
  fragmentShader: string;
  /** Vertex shader GLSL source (required) */
  vertexShader: string;
  /** Material key for React reconciliation (forces remount when changed) */
  materialKey?: string;
  /** Shader uniforms (required for functional shaders) */
  uniforms: Record<string, THREE.IUniform>;
  /** GLSL version */
  glslVersion?: typeof THREE.GLSL3 | typeof THREE.GLSL1;
  /** Which side of faces to render */
  side?: Side;
  /** Whether material is transparent */
  transparent?: boolean;
  /** Whether to write to depth buffer */
  depthWrite?: boolean;
  /** Blending mode */
  blending?: THREE.Blending;
}

/**
 * ShaderMaterial wrapper that automatically tracks compilation state.
 *
 * Shows a loading overlay when:
 * - Component first mounts (initial shader compilation)
 * - fragmentShader or vertexShader strings change (recompilation)
 *
 * The tracking is automatic - no manual dependency arrays needed.
 * Properly handles multiple simultaneous compilations and cleanup on unmount.
 *
 * Key insight: Shader compilation blocks the main thread, preventing React from
 * rendering the overlay. We solve this by deferring the actual shader render
 * by one frame, giving the overlay time to appear first.
 */
export function TrackedShaderMaterial({
  shaderName,
  fragmentShader,
  vertexShader,
  materialKey,
  ...props
}: TrackedShaderMaterialProps) {
  // Input validation - provide fallback for empty shaderName
  const validShaderName = shaderName?.trim() || 'Unknown Shader';
  const hasValidShaders = Boolean(fragmentShader && vertexShader);

  // Track which shader version we've rendered to detect changes
  const renderedShaderRef = useRef<{ fragment: string; vertex: string } | null>(null);

  // State to control deferred rendering
  // When shaders change, we set this to false, show overlay, then set to true next frame
  const [readyToRender, setReadyToRender] = useState(false);

  // Detect if shaders have changed since last render
  const shadersChanged =
    !renderedShaderRef.current ||
    renderedShaderRef.current.fragment !== fragmentShader ||
    renderedShaderRef.current.vertex !== vertexShader;

  // When shaders change, reset ready state and show overlay
  useLayoutEffect(() => {
    if (!hasValidShaders) {
      return;
    }

    if (shadersChanged) {
      // Reset ready state - this will cause us to return null this render
      setReadyToRender(false);

      // Show the compilation overlay immediately
      usePerformanceStore.getState().setShaderCompiling(validShaderName, true);
    }
  }, [fragmentShader, vertexShader, validShaderName, hasValidShaders, shadersChanged]);

  // After one frame (overlay is visible), allow shader to render
  useEffect(() => {
    if (!hasValidShaders) {
      return;
    }

    if (!readyToRender && shadersChanged) {
      // Use RAF to defer rendering until next frame
      // This ensures the overlay has painted before we block the thread
      const frameId = requestAnimationFrame(() => {
        setReadyToRender(true);
        // Update the ref to track what we're about to render
        renderedShaderRef.current = { fragment: fragmentShader, vertex: vertexShader };
      });

      return () => cancelAnimationFrame(frameId);
    }
  }, [fragmentShader, vertexShader, hasValidShaders, readyToRender, shadersChanged]);

  // Hide overlay after shader has compiled (render completes)
  useEffect(() => {
    if (!hasValidShaders || !readyToRender) {
      return;
    }

    // Shader is rendering this frame, hide overlay after GPU compile finishes
    let cancelled = false;

    // Double RAF ensures we're past the blocking GPU compilation
    requestAnimationFrame(() => {
      if (cancelled) return;
      requestAnimationFrame(() => {
        if (cancelled) return;
        usePerformanceStore.getState().setShaderCompiling(validShaderName, false);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [readyToRender, validShaderName, hasValidShaders]);

  // Cleanup on unmount - prevent stuck overlay
  useEffect(() => {
    return () => {
      usePerformanceStore.getState().setShaderCompiling(validShaderName, false);
    };
  }, [validShaderName]);

  // Warn about missing shader sources in development
  if (!hasValidShaders) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(
        `TrackedShaderMaterial [${validShaderName}]: Missing shader source. ` +
        `fragmentShader: ${fragmentShader ? 'provided' : 'MISSING'}, ` +
        `vertexShader: ${vertexShader ? 'provided' : 'MISSING'}`
      );
    }
    return null;
  }

  // While shader is compiling, render an invisible placeholder material
  // to prevent Three.js from using a default white MeshBasicMaterial.
  // Returning null would leave the mesh without a material, causing a white cube flash.
  if (!readyToRender) {
    return (
      <meshBasicMaterial
        visible={false}
        key="placeholder-while-compiling"
      />
    );
  }

  return (
    <shaderMaterial
      key={materialKey}
      fragmentShader={fragmentShader}
      vertexShader={vertexShader}
      {...props}
    />
  );
}
