import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { useSpring } from 'framer-motion';
import { PerspectiveCamera } from 'three';

const SPRING_CONFIG = { damping: 25, stiffness: 200 };

/**
 * Hook to smooth out "hard" resizing events (like entering/exiting fullscreen).
 * 
 * Problem: 
 * Three.js PerspectiveCamera maintains a constant vertical FOV. 
 * When the viewport height increases (e.g., hiding browser chrome), 
 * the visible vertical world units remain the same, but are stretched over more pixels.
 * This causes objects to physically grow on screen instantly ("jump").
 * 
 * Solution:
 * We detect height changes and immediately apply a counter-acting `camera.zoom`.
 * If height doubles, we zoom to 0.5 (keeping object size constant).
 * Then we spring-animate the zoom back to 1.0, creating a smooth "reveal" 
 * of the new vertical space instead of a snap.
 */
export function useSmoothResizing() {
  const { size, camera } = useThree();
  const prevHeight = useRef(size.height);
  
  // Spring to animate zoom. Default 1.0.
  const zoomCorrection = useSpring(1, SPRING_CONFIG);

  useEffect(() => {
    // We only care about height changes for the "jump" artifact.
    // Width changes (in vertical FOV cameras) just reveal more side content smoothly.
    const heightChanged = Math.abs(size.height - prevHeight.current) > 1;
    
    // Ignore the very first mount/resize to 0
    const isValidResize = prevHeight.current > 0 && size.height > 0;

    if (heightChanged && isValidResize) {
       // Calculate ratio needed to keep objects same pixel height
       // OldHeight = NewHeight * Ratio
       // Ratio = OldHeight / NewHeight
       const compensationRatio = prevHeight.current / size.height;
       
       // 1. Snap immediately to the compensated zoom level
       // This neutralizes the visual jump in the very next frame
       zoomCorrection.set(compensationRatio);
       
       // 2. Animate back to natural zoom (1.0)
       // This creates the smooth "settling" or "reveal" effect
       // We use a slight delay or just set it in the next microtask to ensure the spring starts
       requestAnimationFrame(() => {
           zoomCorrection.set(1);
       });
    } else if (!isValidResize) {
        // Ensure we start at 1 for initial render
        zoomCorrection.set(1);
    }

    prevHeight.current = size.height;
  }, [size.height, zoomCorrection]);

  useFrame(() => {
    if (!(camera instanceof PerspectiveCamera)) return;

    const scale = zoomCorrection.get();
    
    // Apply zoom correction
    // We assume no other system is aggressively animating camera.zoom
    // If zoom is needed for other features (dolly), those usually move camera position, not zoom property.
    if (camera.zoom !== scale) {
        camera.zoom = scale;
        camera.updateProjectionMatrix();
    }
  });
}
