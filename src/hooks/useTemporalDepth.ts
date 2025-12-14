/**
 * Temporal Depth Hook
 * Manages ping-pong depth buffers for temporal reprojection
 *
 * Temporal reprojection reuses the previous frame's depth to accelerate
 * raymarching by providing a better starting point for the ray.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { usePerformanceStore } from '@/stores';

/** Depth buffer format - single channel float for depth storage */
const DEPTH_FORMAT = THREE.RedFormat;
const DEPTH_TYPE = THREE.FloatType;

export interface TemporalDepthState {
  /** Previous frame's depth texture */
  prevDepthTexture: THREE.Texture | null;
  /** Previous frame's view-projection matrix */
  prevViewProjectionMatrix: THREE.Matrix4;
  /** Previous frame's inverse view-projection matrix */
  prevInverseViewProjectionMatrix: THREE.Matrix4;
  /** Whether temporal data is valid (not teleported) */
  isValid: boolean;
  /** Swap the ping-pong buffers */
  swap: () => void;
  /** Get the current write target */
  getCurrentTarget: () => THREE.WebGLRenderTarget | null;
}

export interface UseTemporalDepthOptions {
  /** Enable temporal depth (default: true) */
  enabled?: boolean;
  /** Resolution scale for depth buffers (default: 0.5) */
  resolutionScale?: number;
}

/**
 * Hook for managing temporal depth buffers.
 *
 * Creates two depth render targets that alternate each frame (ping-pong).
 * Stores the previous frame's depth and camera matrices for reprojection.
 *
 * @param options - Configuration options
 * @returns Temporal depth state and controls
 */
export function useTemporalDepth(
  options: UseTemporalDepthOptions = {}
): TemporalDepthState {
  const { enabled: optionEnabled = true, resolutionScale = 0.5 } = options;

  const { size } = useThree();

  // Store state
  const storeEnabled = usePerformanceStore((s) => s.temporalReprojectionEnabled);
  const cameraTeleported = usePerformanceStore((s) => s.cameraTeleported);

  const enabled = optionEnabled && storeEnabled;

  // Ping-pong buffer index (0 or 1)
  const bufferIndexRef = useRef(0);

  // Previous frame camera matrices
  const prevViewProjectionMatrixRef = useRef(new THREE.Matrix4());
  const prevInverseViewProjectionMatrixRef = useRef(new THREE.Matrix4());

  // Validity flag (false after teleport until next frame)
  const isValidRef = useRef(false);

  // Calculate buffer dimensions
  const bufferWidth = Math.max(1, Math.floor(size.width * resolutionScale));
  const bufferHeight = Math.max(1, Math.floor(size.height * resolutionScale));

  // Create ping-pong render targets
  const renderTargets = useMemo(() => {
    if (!enabled) return [null, null];

    const createTarget = () =>
      new THREE.WebGLRenderTarget(bufferWidth, bufferHeight, {
        format: DEPTH_FORMAT,
        type: DEPTH_TYPE,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        wrapS: THREE.ClampToEdgeWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
        generateMipmaps: false,
        depthBuffer: false,
        stencilBuffer: false,
      });

    return [createTarget(), createTarget()];
  }, [enabled, bufferWidth, bufferHeight]);

  // Cleanup render targets on unmount or when disabled
  useEffect(() => {
    return () => {
      renderTargets.forEach((target) => target?.dispose());
    };
  }, [renderTargets]);

  // Resize render targets when size changes
  useEffect(() => {
    if (!enabled) return;

    renderTargets.forEach((target) => {
      if (target) {
        target.setSize(bufferWidth, bufferHeight);
      }
    });
  }, [enabled, bufferWidth, bufferHeight, renderTargets]);

  // Invalidate temporal data on camera teleport
  useEffect(() => {
    if (cameraTeleported) {
      isValidRef.current = false;
    }
  }, [cameraTeleported]);

  // Swap buffers
  const swap = useCallback(() => {
    bufferIndexRef.current = 1 - bufferIndexRef.current;
    // After first swap, temporal data becomes valid
    isValidRef.current = true;
  }, []);

  // Get current write target (the one we're rendering to)
  const getCurrentTarget = useCallback((): THREE.WebGLRenderTarget | null => {
    if (!enabled) return null;
    return renderTargets[bufferIndexRef.current] ?? null;
  }, [enabled, renderTargets]);

  // Get previous read target (the one with last frame's data)
  const getPrevTarget = useCallback((): THREE.WebGLRenderTarget | null => {
    if (!enabled) return null;
    return renderTargets[1 - bufferIndexRef.current] ?? null;
  }, [enabled, renderTargets]);

  // Update camera matrices each frame
  useFrame(({ camera }) => {
    if (!enabled) return;

    // Store current matrices for next frame
    const viewMatrix = camera.matrixWorldInverse;
    const projectionMatrix = camera.projectionMatrix;

    // Compute view-projection matrix
    prevViewProjectionMatrixRef.current
      .copy(projectionMatrix)
      .multiply(viewMatrix);

    // Compute inverse for reprojection
    prevInverseViewProjectionMatrixRef.current
      .copy(prevViewProjectionMatrixRef.current)
      .invert();
  });

  // Get previous depth texture
  const prevDepthTexture = useMemo(() => {
    const prevTarget = getPrevTarget();
    return prevTarget?.texture ?? null;
  }, [getPrevTarget]);

  return {
    prevDepthTexture,
    prevViewProjectionMatrix: prevViewProjectionMatrixRef.current,
    prevInverseViewProjectionMatrix: prevInverseViewProjectionMatrixRef.current,
    isValid: isValidRef.current && enabled,
    swap,
    getCurrentTarget,
  };
}

/**
 * Temporal depth uniforms for shader integration.
 * These uniforms are passed to the fractal shaders for reprojection.
 */
export interface TemporalDepthUniforms {
  /** Previous frame's depth texture */
  uPrevDepthTexture: { value: THREE.Texture | null };
  /** Previous frame's view-projection matrix */
  uPrevViewProjectionMatrix: { value: THREE.Matrix4 };
  /** Previous frame's inverse view-projection matrix */
  uPrevInverseViewProjectionMatrix: { value: THREE.Matrix4 };
  /** Whether temporal reprojection is enabled and valid */
  uTemporalEnabled: { value: boolean };
  /** Depth buffer resolution for UV calculation */
  uDepthBufferResolution: { value: THREE.Vector2 };
}

/**
 * Create temporal depth uniforms for shader material.
 */
export function createTemporalDepthUniforms(): TemporalDepthUniforms {
  return {
    uPrevDepthTexture: { value: null },
    uPrevViewProjectionMatrix: { value: new THREE.Matrix4() },
    uPrevInverseViewProjectionMatrix: { value: new THREE.Matrix4() },
    uTemporalEnabled: { value: false },
    uDepthBufferResolution: { value: new THREE.Vector2(1, 1) },
  };
}

/**
 * Update temporal depth uniforms from hook state.
 */
export function updateTemporalDepthUniforms(
  uniforms: TemporalDepthUniforms,
  state: TemporalDepthState,
  bufferSize: { width: number; height: number }
): void {
  uniforms.uPrevDepthTexture.value = state.prevDepthTexture;
  uniforms.uPrevViewProjectionMatrix.value.copy(state.prevViewProjectionMatrix);
  uniforms.uPrevInverseViewProjectionMatrix.value.copy(
    state.prevInverseViewProjectionMatrix
  );
  uniforms.uTemporalEnabled.value = state.isValid;
  uniforms.uDepthBufferResolution.value.set(bufferSize.width, bufferSize.height);
}
