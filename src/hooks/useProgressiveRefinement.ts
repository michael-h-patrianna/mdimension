/**
 * Progressive Refinement Hook
 * Manages quality stages after interaction stops
 */

import { useCallback, useEffect, useRef } from 'react';
import {
  REFINEMENT_STAGE_TIMING,
  REFINEMENT_STAGES,
  usePerformanceStore,
} from '@/stores';
import type { RefinementStage } from '@/stores';

export interface UseProgressiveRefinementOptions {
  /** Enable progressive refinement (default: true) */
  enabled?: boolean;
}

export interface ProgressiveRefinementState {
  /** Current refinement stage */
  stage: RefinementStage;
  /** Current quality multiplier (0.25-1.0) */
  qualityMultiplier: number;
  /** Current progress (0-100) */
  progress: number;
  /** Whether refinement is complete */
  isComplete: boolean;
}

/**
 * Hook for managing progressive quality refinement after interaction stops.
 *
 * Stages: low → medium → high → final
 * Timing: instant → 100ms → 300ms → 500ms
 *
 * The hook listens to interaction state changes and advances through
 * quality stages automatically after interaction stops.
 *
 * @param options - Configuration options
 * @returns Current refinement state
 */
export function useProgressiveRefinement(
  options: UseProgressiveRefinementOptions = {}
): ProgressiveRefinementState {
  const { enabled: optionEnabled = true } = options;

  // Store state
  const storeEnabled = usePerformanceStore(
    (s) => s.progressiveRefinementEnabled
  );
  const stage = usePerformanceStore((s) => s.refinementStage);
  const progress = usePerformanceStore((s) => s.refinementProgress);
  const qualityMultiplier = usePerformanceStore((s) => s.qualityMultiplier);
  const isInteracting = usePerformanceStore((s) => s.isInteracting);
  const setRefinementStage = usePerformanceStore((s) => s.setRefinementStage);
  const setRefinementProgress = usePerformanceStore(
    (s) => s.setRefinementProgress
  );

  const enabled = optionEnabled && storeEnabled;

  // Timer refs
  const stageTimersRef = useRef<number[]>([]);
  const progressIntervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  // Clear all timers
  const clearTimers = useCallback(() => {
    stageTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    stageTimersRef.current = [];

    if (progressIntervalRef.current !== null) {
      window.clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  // Start refinement sequence
  const startRefinement = useCallback(() => {
    if (!enabled) return;

    clearTimers();
    startTimeRef.current = performance.now();

    // Set initial stage
    setRefinementStage('low');
    setRefinementProgress(0);

    // Schedule stage transitions
    const stages = REFINEMENT_STAGES.slice(1); // Skip 'low', already set
    stages.forEach((stageKey) => {
      const delay = REFINEMENT_STAGE_TIMING[stageKey];
      const timer = window.setTimeout(() => {
        setRefinementStage(stageKey);
      }, delay);
      stageTimersRef.current.push(timer);
    });

    // Start progress animation
    const totalDuration = REFINEMENT_STAGE_TIMING.final;
    progressIntervalRef.current = window.setInterval(() => {
      const elapsed = performance.now() - startTimeRef.current;
      const newProgress = Math.min(100, (elapsed / totalDuration) * 100);
      setRefinementProgress(newProgress);

      if (newProgress >= 100) {
        if (progressIntervalRef.current !== null) {
          window.clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
      }
    }, 16); // ~60fps updates
  }, [enabled, clearTimers, setRefinementStage, setRefinementProgress]);

  // Stop refinement (reset to low)
  const stopRefinement = useCallback(() => {
    clearTimers();
    setRefinementStage('low');
    setRefinementProgress(0);
  }, [clearTimers, setRefinementStage, setRefinementProgress]);

  // React to interaction state changes
  useEffect(() => {
    if (!enabled) {
      // If disabled, ensure we're at final quality
      setRefinementStage('final');
      setRefinementProgress(100);
      return;
    }

    if (isInteracting) {
      // Interaction started - reset to low quality
      stopRefinement();
    } else {
      // Interaction stopped - start refinement sequence
      startRefinement();
    }

    return clearTimers;
  }, [
    enabled,
    isInteracting,
    startRefinement,
    stopRefinement,
    clearTimers,
    setRefinementStage,
    setRefinementProgress,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return clearTimers;
  }, [clearTimers]);

  return {
    stage,
    qualityMultiplier,
    progress,
    isComplete: stage === 'final' && progress >= 100,
  };
}
