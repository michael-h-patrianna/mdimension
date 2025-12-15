import { useEffect } from 'react';
import { useMotionValue, useSpring, MotionValue } from 'motion/react';
import { useLayoutStore } from '@/stores/layoutStore';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { useShallow } from 'zustand/react/shallow';

const SIDEBAR_WIDTH = 320;
const TOP_BAR_HEIGHT = 48;
const BOTTOM_BAR_HEIGHT = 48;
const PADDING = 16; // 16px (matches left-4/bottom-4)
const GAP = 16;     // Minimum gap between UI and monitor
const SPRING_CONFIG = { damping: 25, stiffness: 200 };

/**
 * Hook to manage collision between a floating element (PerformanceMonitor) and the application UI panels
 * (Sidebars, Top Bar, Bottom Bar).
 * 
 * It simulates the panel animations using springs and "pushes" the floating element's 
 * X and Y motion values if a collision is detected.
 * 
 * @param x The MotionValue<number> controlling the element's X position.
 * @param y The MotionValue<number> controlling the element's Y position.
 * @param width The current width of the floating element.
 * @param height The current height of the floating element.
 * @param isDragging Whether the user is currently dragging the element.
 */
export function usePanelCollision(
  x: MotionValue<number>,
  y: MotionValue<number>,
  width: number,
  height: number,
  isDragging: boolean
) {
  const isDesktop = useIsDesktop();

  // 1. Get Layout States
  const { 
    showLeftPanel, 
    isRightPanelOpen, 
    showTopBar, 
    showBottomPanel,
    isCinematicMode
  } = useLayoutStore(
    useShallow((state) => ({
      showLeftPanel: state.showLeftPanel && !state.isCinematicMode,
      // Right panel is open if NOT collapsed AND NOT cinematic
      isRightPanelOpen: !state.isCollapsed && !state.isCinematicMode,
      // Top/Bottom bars are visible if NOT cinematic
      showTopBar: !state.isCinematicMode,
      showBottomPanel: !state.isCinematicMode && isDesktop, // Bottom panel only on desktop
      isCinematicMode: state.isCinematicMode,
    }))
  );

  // 2. Simulate Animations (0 -> 1)
  const leftSpring = useSpring(showLeftPanel ? 1 : 0, SPRING_CONFIG);
  const rightSpring = useSpring(isRightPanelOpen ? 1 : 0, SPRING_CONFIG);
  const topSpring = useSpring(showTopBar ? 1 : 0, SPRING_CONFIG);
  const bottomSpring = useSpring(showBottomPanel ? 1 : 0, SPRING_CONFIG);

  useEffect(() => { leftSpring.set(showLeftPanel ? 1 : 0); }, [showLeftPanel, leftSpring]);
  useEffect(() => { rightSpring.set(isRightPanelOpen ? 1 : 0); }, [isRightPanelOpen, rightSpring]);
  useEffect(() => { topSpring.set(showTopBar ? 1 : 0); }, [showTopBar, topSpring]);
  useEffect(() => { bottomSpring.set(showBottomPanel ? 1 : 0); }, [showBottomPanel, bottomSpring]);

  // 3. Collision Logic Loop
  useEffect(() => {
    const checkCollision = () => {
      if (isDragging) return;

      const currentX = x.get();
      const currentY = y.get();
      
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;

      // --- X Axis Constraints ---
      const leftEdge = leftSpring.get() * SIDEBAR_WIDTH;
      const minAbsoluteX = leftEdge + GAP;
      const minX = minAbsoluteX - PADDING; // Convert back to relative x (CSS left: 16px)

      const rightEdge = windowWidth - (rightSpring.get() * SIDEBAR_WIDTH);
      const maxAbsoluteRight = rightEdge - GAP;
      const maxX = maxAbsoluteRight - width - PADDING;

      // --- Y Axis Constraints ---
      // Note: The monitor is anchored at `bottom: 16px`.
      // So `y=0` means `absoluteBottom = 16`.
      // Positive `y` moves UP (away from bottom).
      // Negative `y` moves DOWN (towards bottom). This is Motion default for 'y' usually...
      // Wait, let's check PerformanceMonitor CSS:
      // It uses `bottom-4 left-4`.
      // So `y` transform usually moves element DOWN (positive) or UP (negative) relative to origin.
      // IF transform-origin is bottom-left? No, translate Y moves element relative to its static position.
      // Standard CSS translate Y: positive = down, negative = up.
      
      // Let's verify coordinate system:
      // Element is at `bottom: 16px`.
      // `y=0`: Visual bottom is 16px from viewport bottom.
      // `y=-100`: Visual bottom is 116px from viewport bottom (moved UP).
      // `y=100`: Visual bottom is -84px from viewport bottom (moved DOWN).
      
      // Top Bar Collision:
      // Top Bar extends down by `TOP_BAR_HEIGHT * progress`.
      // Visual Top Edge = `TOP_BAR_HEIGHT * progress`.
      // Monitor Top Edge in Viewport Y:
      // ViewportHeight - (16 + height - y)  <-- Wait, this logic is confusing.
      
      // Let's think in "Distance from Bottom":
      // Monitor Bottom = 16 - y (Since y negative moves up, -y is positive distance?)
      // NO. usually `y` in framer motion adds to the `top` or `transform`.
      // Since it's `bottom: 4` (16px), 
      // y = -10 moves it UP 10px.
      // So:
      // Monitor Visual Bottom = 16 - y (pixels from bottom)
      // Monitor Visual Top = 16 - y + height
      
      // Top Bar:
      // Top Limit from bottom = WindowHeight - (TopSpring * Height) - GAP.
      // We need Monitor Visual Top <= Top Limit.
      // 16 - y + height <= WindowHeight - (TopSpring * Height) - GAP
      // -y <= WindowHeight - TopBar - GAP - 16 - height
      // y >= -(WindowHeight - TopBar - GAP - 16 - height)
      
      const topBarVisibleHeight = topSpring.get() * TOP_BAR_HEIGHT;
      // The highest the monitor top can be:
      const maxVisualTop = windowHeight - topBarVisibleHeight - GAP;
      // This corresponds to a minimum `y` (since y is negative to go up):
      // (16 - y + height) <= maxVisualTop
      // -y <= maxVisualTop - 16 - height
      // y >= 16 + height - maxVisualTop  (Wait, multiplying by -1 flips inequality)
      // Let's re-solve:
      // 16 - y + height = absoluteTopDistance (from bottom)
      // We want absoluteTopDistance <= maxVisualTop
      // 16 - y + height <= maxVisualTop
      // -y <= maxVisualTop - 16 - height
      // y >= -(maxVisualTop - 16 - height) 
      
      // Simplification:
      // allowedUpwardsMovement = maxVisualTop - 16 - height
      // Since up is negative y, min Y = -allowedUpwardsMovement.
      const allowedUpwardsSpace = maxVisualTop - 16 - height;
      const minY = -allowedUpwardsSpace; // e.g. -500 (can go up 500px)

      // Bottom Bar Collision:
      // Bottom Bar extends up by `BOTTOM_BAR_HEIGHT * progress`.
      // Monitor Bottom = 16 - y.
      // We need Monitor Bottom >= Bottom Bar Height + GAP.
      // 16 - y >= (BottomSpring * Height) + GAP
      // -y >= (BottomSpring * Height) + GAP - 16
      // y <= 16 - GAP - (BottomSpring * Height)
      
      const bottomBarVisibleHeight = bottomSpring.get() * BOTTOM_BAR_HEIGHT;
      // We need to be above this:
      const minVisualBottom = bottomBarVisibleHeight + GAP;
      // 16 - y >= minVisualBottom
      // -y >= minVisualBottom - 16
      // y <= 16 - minVisualBottom
      
      const maxY = 16 - minVisualBottom; // e.g. 0 (if no bar), or -48 (if bar exists)

      // Apply Constraints
      let newX = currentX;
      let newY = currentY;

      // X Clamping
      if (currentX < minX) newX = minX;
      else if (currentX > maxX) {
        if (maxX >= minX) newX = maxX;
        else newX = minX; // Prioritize left visibility
      }

      // Y Clamping (remember Y is inverted/negative for Up)
      // We want y to be BETWEEN minY (highest position, most negative) and maxY (lowest position, least negative)
      // e.g. Range [-500, 0]
      // If y = -600 (too high), set to -500.
      // If y = 10 (too low), set to 0.
      
      if (currentY < minY) newY = minY; // Too high (collisions with top bar)
      else if (currentY > maxY) newY = maxY; // Too low (collisions with bottom bar)
      
      // Edge case: If window is too small vertically, prioritize Top visibility?
      // If minY > maxY (available space is negative), we must choose.
      // Usually showing the header of the monitor is better -> prioritize Top constraint?
      // Or prioritize Bottom constraint (controls)?
      // Let's prioritize preventing Bottom overlap (maxY), so controls aren't covered.
      if (minY > maxY) {
          newY = maxY;
      }

      // Update if changed
      if (Math.abs(newX - currentX) > 0.5) x.set(newX);
      if (Math.abs(newY - currentY) > 0.5) y.set(newY);
    };

    // Subscribe to all springs
    const unsubs = [
      leftSpring.on('change', checkCollision),
      rightSpring.on('change', checkCollision),
      topSpring.on('change', checkCollision),
      bottomSpring.on('change', checkCollision)
    ];
    
    const handleResize = () => checkCollision();
    window.addEventListener('resize', handleResize);

    // Initial check
    checkCollision();

    return () => {
      unsubs.forEach(u => u());
      window.removeEventListener('resize', handleResize);
    };
  }, [leftSpring, rightSpring, topSpring, bottomSpring, x, y, width, height, isDragging]);
}