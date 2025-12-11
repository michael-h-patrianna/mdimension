/**
 * Cross-Section Animation Hook
 * Animates the slice position through the W dimension
 */

import { useEffect, useRef } from 'react';
import { useCrossSectionStore, MIN_SLICE_W, MAX_SLICE_W } from '@/stores/crossSectionStore';

/**
 * Hook that animates the cross-section slice position when animation is enabled
 * The slice oscillates between MIN_SLICE_W and MAX_SLICE_W
 */
export function useCrossSectionAnimation(): void {
  const enabled = useCrossSectionStore((state) => state.enabled);
  const animateSlice = useCrossSectionStore((state) => state.animateSlice);
  const sliceAnimationSpeed = useCrossSectionStore((state) => state.sliceAnimationSpeed);
  const setSliceW = useCrossSectionStore((state) => state.setSliceW);

  const lastTimeRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const directionRef = useRef<1 | -1>(1);

  useEffect(() => {
    if (!enabled || !animateSlice) {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      lastTimeRef.current = null;
      return;
    }

    const animate = (currentTime: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = currentTime;
      }

      const deltaTime = currentTime - lastTimeRef.current;
      lastTimeRef.current = currentTime;

      // Skip if delta is too large (e.g., tab was inactive)
      if (deltaTime > 100) {
        frameRef.current = requestAnimationFrame(animate);
        return;
      }

      const currentSliceW = useCrossSectionStore.getState().sliceW;

      // Calculate movement: full range in ~4 seconds at speed 1.0
      const range = MAX_SLICE_W - MIN_SLICE_W;
      const movement = (range / 4000) * deltaTime * sliceAnimationSpeed * directionRef.current;

      let newSliceW = currentSliceW + movement;

      // Bounce at boundaries
      if (newSliceW >= MAX_SLICE_W) {
        newSliceW = MAX_SLICE_W;
        directionRef.current = -1;
      } else if (newSliceW <= MIN_SLICE_W) {
        newSliceW = MIN_SLICE_W;
        directionRef.current = 1;
      }

      setSliceW(newSliceW);

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [enabled, animateSlice, sliceAnimationSpeed, setSliceW]);
}
