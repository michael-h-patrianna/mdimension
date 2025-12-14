/**
 * Interaction State Hook
 * Detects camera movement, canvas resize, and user interaction for performance optimizations
 */

import { useCallback, useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, Euler } from 'three';
import { INTERACTION_RESTORE_DELAY, usePerformanceStore } from '@/stores';

/** Threshold for detecting camera movement */
const POSITION_THRESHOLD = 0.0001;
const ROTATION_THRESHOLD = 0.0001;

/** Threshold for detecting camera teleport (large sudden movement) */
const TELEPORT_POSITION_THRESHOLD = 2.0;
const TELEPORT_ROTATION_THRESHOLD = 0.5;

/** Minimum size change to trigger interaction (pixels) */
const SIZE_CHANGE_THRESHOLD = 1;

export interface UseInteractionStateOptions {
  /** Enable interaction detection (default: true) */
  enabled?: boolean;
  /** Delay before interaction is considered stopped (ms) (default: 150) */
  debounceDelay?: number;
}

export interface InteractionState {
  /** Whether user is currently interacting */
  isInteracting: boolean;
  /** Timestamp of last interaction */
  lastInteractionTime: number;
  /** Whether camera has teleported (large sudden movement) */
  cameraTeleported: boolean;
}

/**
 * Hook for detecting camera movement, canvas resize, and user interaction.
 * Used by progressive refinement.
 *
 * Detects:
 * - Camera position changes (zoom, pan, orbit)
 * - Camera rotation changes
 * - Canvas resize (sidebar resize, window resize)
 * - Mouse/touch drag events
 * - Camera teleports (for temporal reprojection)
 *
 * Does NOT detect:
 * - N-D rotation changes (handled separately by mesh fastMode)
 * - Parameter changes (fractal settings, colors, etc.)
 *
 * @param options - Configuration options
 * @returns Current interaction state
 */
export function useInteractionState(
  options: UseInteractionStateOptions = {}
): InteractionState {
  const { enabled = true, debounceDelay = INTERACTION_RESTORE_DELAY } = options;

  const { camera, gl, size } = useThree();

  // Use refs for all state to avoid re-renders
  const isInteractingRef = useRef(false);
  const lastInteractionTimeRef = useRef(0);

  // Previous camera state for comparison
  const prevPositionRef = useRef(new Vector3());
  const prevRotationRef = useRef(new Euler());

  // Previous canvas size for resize detection
  const prevSizeRef = useRef({ width: 0, height: 0 });

  // Debounce timer
  const debounceTimerRef = useRef<number | null>(null);

  // Mouse/touch state
  const isPointerDownRef = useRef(false);

  // Get store state (stable references)
  const cameraTeleported = usePerformanceStore((s) => s.cameraTeleported);

  // Start interaction
  const startInteraction = useCallback(() => {
    const now = performance.now();
    lastInteractionTimeRef.current = now;

    if (!isInteractingRef.current) {
      isInteractingRef.current = true;

      // Update store interaction state
      const state = usePerformanceStore.getState();
      state.setIsInteracting(true);

      // Reset progressive refinement
      if (state.progressiveRefinementEnabled) {
        state.resetRefinement();
      }
    }

    // Clear existing debounce timer
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  // Stop interaction (with debounce)
  const stopInteraction = useCallback(() => {
    // Don't stop if pointer is still down
    if (isPointerDownRef.current) {
      return;
    }

    // Clear existing timer
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
    }

    // Set debounce timer
    debounceTimerRef.current = window.setTimeout(() => {
      isInteractingRef.current = false;
      debounceTimerRef.current = null;

      // Update store interaction state
      usePerformanceStore.getState().setIsInteracting(false);
    }, debounceDelay);
  }, [debounceDelay]);

  // Pointer event handlers
  useEffect(() => {
    if (!enabled) return;

    const canvas = gl.domElement;

    const handlePointerDown = () => {
      isPointerDownRef.current = true;
      startInteraction();
    };

    const handlePointerUp = () => {
      isPointerDownRef.current = false;
      stopInteraction();
    };

    const handlePointerMove = (e: PointerEvent) => {
      // Only trigger interaction if pointer is down (dragging)
      if (isPointerDownRef.current || e.buttons > 0) {
        startInteraction();
      }
    };

    const handleWheel = () => {
      startInteraction();
      stopInteraction(); // Will debounce
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointerleave', handlePointerUp);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('wheel', handleWheel);

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointerleave', handlePointerUp);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('wheel', handleWheel);

      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, [enabled, gl, startInteraction, stopInteraction]);

  // Per-frame camera movement detection
  useFrame(() => {
    if (!enabled) return;

    const pos = camera.position;
    const rot = camera.rotation;
    const prevPos = prevPositionRef.current;
    const prevRot = prevRotationRef.current;

    // Calculate deltas
    const posDelta = Math.sqrt(
      (pos.x - prevPos.x) ** 2 +
        (pos.y - prevPos.y) ** 2 +
        (pos.z - prevPos.z) ** 2
    );

    const rotDelta = Math.sqrt(
      (rot.x - prevRot.x) ** 2 +
        (rot.y - prevRot.y) ** 2 +
        (rot.z - prevRot.z) ** 2
    );

    // Check for teleport (large sudden movement)
    const isTeleport =
      posDelta > TELEPORT_POSITION_THRESHOLD ||
      rotDelta > TELEPORT_ROTATION_THRESHOLD;

    if (isTeleport) {
      usePerformanceStore.getState().setCameraTeleported(true);
      // Reset teleport flag after one frame
      requestAnimationFrame(() => {
        usePerformanceStore.getState().setCameraTeleported(false);
      });
    }

    // Check for movement
    const hasMoved =
      posDelta > POSITION_THRESHOLD || rotDelta > ROTATION_THRESHOLD;

    if (hasMoved) {
      startInteraction();
      stopInteraction(); // Will debounce
    }

    // Update previous values
    prevPos.copy(pos);
    prevRot.copy(rot);
  });

  // Initialize previous camera values (runs once per camera change)
  useEffect(() => {
    prevPositionRef.current.copy(camera.position);
    prevRotationRef.current.copy(camera.rotation);
  }, [camera]);

  // Canvas resize detection - triggers progressive refinement when canvas size changes
  // This handles sidebar resize, window resize, and any other canvas size changes
  useEffect(() => {
    if (!enabled) return;

    const prevSize = prevSizeRef.current;
    const widthDelta = Math.abs(size.width - prevSize.width);
    const heightDelta = Math.abs(size.height - prevSize.height);

    // Only trigger if size actually changed (not initial mount when prev is 0)
    if (prevSize.width > 0 && prevSize.height > 0) {
      if (widthDelta >= SIZE_CHANGE_THRESHOLD || heightDelta >= SIZE_CHANGE_THRESHOLD) {
        startInteraction();
        stopInteraction(); // Will debounce
      }
    }

    // Always update previous size
    prevSizeRef.current = { width: size.width, height: size.height };
  }, [enabled, size.width, size.height, startInteraction, stopInteraction]);

  return {
    isInteracting: isInteractingRef.current,
    lastInteractionTime: lastInteractionTimeRef.current,
    cameraTeleported,
  };
}
