/**
 * Animation Loop Hook
 * Uses requestAnimationFrame to animate rotations
 */

import { useEffect, useRef, useCallback } from 'react';
import { useAnimationStore } from '@/stores/animationStore';
import { useRotationStore } from '@/stores/rotationStore';

/**
 * Hook that runs the animation loop when animation is playing
 * Updates rotation angles for all animating planes
 */
export function useAnimationLoop(): void {
  const isPlaying = useAnimationStore((state) => state.isPlaying);
  const animatingPlanes = useAnimationStore((state) => state.animatingPlanes);
  const getRotationDelta = useAnimationStore((state) => state.getRotationDelta);

  const updateRotations = useRotationStore((state) => state.updateRotations);
  const getRotationRadians = useCallback((plane: string) => {
    return useRotationStore.getState().rotations.get(plane) ?? 0;
  }, []);

  const lastTimeRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  const animate = useCallback(
    (currentTime: number) => {
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

      const rotationDelta = getRotationDelta(deltaTime);
      const updates = new Map<string, number>();

      // Update each animating plane
      animatingPlanes.forEach((plane) => {
        const currentAngle = getRotationRadians(plane);
        let newAngle = currentAngle + rotationDelta;

        // In isoclinic mode, XY and ZW rotate at the same rate
        // This is handled by having both in animatingPlanes
        // No special handling needed here

        // Normalize to [0, 2π)
        while (newAngle < 0) newAngle += 2 * Math.PI;
        while (newAngle >= 2 * Math.PI) newAngle -= 2 * Math.PI;

        updates.set(plane, newAngle);
      });

      if (updates.size > 0) {
        updateRotations(updates);
      }

      frameRef.current = requestAnimationFrame(animate);
    },
    [animatingPlanes, getRotationDelta, getRotationRadians, updateRotations]
  );

  useEffect(() => {
    if (isPlaying && animatingPlanes.size > 0) {
      lastTimeRef.current = null;
      frameRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [isPlaying, animatingPlanes, animate]);
}
