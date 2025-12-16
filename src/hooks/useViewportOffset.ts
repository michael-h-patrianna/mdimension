import { useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { useSpring } from 'framer-motion';
import { useLayoutStore } from '@/stores/layoutStore';
import { useShallow } from 'zustand/react/shallow';
import { PerspectiveCamera } from 'three';

const PANEL_WIDTH = 320;
const SPRING_CONFIG = { damping: 25, stiffness: 200 };

/**
 * Hook to animate the camera view offset based on UI layout state.
 * This creates a smooth "curtain" effect where the canvas remains full-screen
 * but the viewport shifts to center the content in the available space.
 */
export function useViewportOffset() {
  const { camera, size } = useThree();

  // Get layout state
  const { showLeftPanel, isCollapsed, isCinematicMode } = useLayoutStore(
    useShallow((state) => ({
      showLeftPanel: state.showLeftPanel,
      isCollapsed: state.isCollapsed,
      isCinematicMode: state.isCinematicMode,
    }))
  );

  // Calculate target offset
  // If left panel is open, we shift right (+). If right panel is open, we shift left (-).
  // Formula: (LeftWidth - RightWidth) / 2
  const targetOffsetX = isCinematicMode 
    ? 0 
    : ((showLeftPanel ? PANEL_WIDTH : 0) - (!isCollapsed ? PANEL_WIDTH : 0)) / 2;

  // Spring animation for the offset
  const springOffset = useSpring(0, SPRING_CONFIG);

  useEffect(() => {
    springOffset.set(targetOffsetX);
  }, [targetOffsetX, springOffset]);

  // Apply offset on every frame
  useFrame(() => {
    if (!(camera instanceof PerspectiveCamera)) return;

    const currentOffset = springOffset.get();
    
    // We use setViewOffset to shift the visible frustum.
    // fullWidth/Height is the physical canvas size.
    // x, y are the offsets. width, height are the visible viewport size.
    // However, we want to KEEP the viewport size equal to the canvas size (to avoid resizing buffers),
    // but SHIFT the projection window.
    
    // Standard setViewOffset usage:
    // setViewOffset(fullWidth, fullHeight, x, y, width, height)
    
    // To simulate a shift without resizing the underlying "film", we can trick it.
    // Actually, simply offsetting the x parameter works if we assume the full width is larger?
    // No, setViewOffset is for Tiled Rendering.
    
    // Alternative: Modify projection matrix directly via filmOffset?
    // Three.js has camera.filmOffset (in millimeters).
    // Or we can use setViewOffset with the full size.
    
    // Let's try setViewOffset:
    // If we want to shift the view by 'currentOffset' pixels to the RIGHT (positive):
    // effectively, the "window" we are looking through is shifted LEFT relative to the full film.
    // So if we want the center to move RIGHT, we shift the window LEFT.
    
    // x = -currentOffset
    // But wait, setViewOffset(fullWidth, fullHeight, x, y, width, height)
    // If x=0, y=0, width=fullWidth, height=fullHeight -> Standard.
    
    // If we want to shift the content X pixels, we can set:
    // x = -currentOffset
    // width = fullWidth
    // height = fullHeight
    // This defines a window starting at -currentOffset.
    
    // However, setViewOffset expects positive integers for sub-windows usually.
    // But mathematically it constructs a projection matrix.
    
    // Let's look at Three.js source logic for projection matrix:
    // top = near * tan(FOV/2)
    // height = 2 * top
    // width = aspect * height
    // left = - 0.5 * width
    // view.x / view.fullWidth ...
    
    // Easier approach: camera.setViewOffset(size.width, size.height, -currentOffset, 0, size.width, size.height);
    // Note: The third param (x) is the x-offset of the sub-camera.
    
    if (camera.setViewOffset) {
        // We invert the offset because:
        // If UI pushes from LEFT (positive offset needed), we want the camera to look "more left" so the center moves right?
        // No, if UI covers left side, the visible center is to the RIGHT.
        // So the camera must pan LEFT to bring the subject RIGHT? 
        // No, if the subject is at (0,0,0), and we want it to appear at screen x=100 (shifted right),
        // we need the camera to shift its projection window.
        
        // Let's test standard direction:
        // offset > 0 (Left panel open) -> Shift subject RIGHT.
        // setViewOffset x = -offset
        
        camera.setViewOffset(
            size.width,
            size.height,
            -currentOffset, 
            0,
            size.width,
            size.height
        );
    }
    
    // Important: We must force projection matrix update if it's not auto-updated by setViewOffset
    // (Three.js usually updates it when calling setViewOffset)
  });

  // Cleanup: Reset view offset when unmounting or changing modes significantly
  useEffect(() => {
    return () => {
      if (camera instanceof PerspectiveCamera) {
        camera.clearViewOffset();
      }
    };
  }, [camera]);
}
