/**
 * Animation state management using Zustand
 * Manages auto-rotation animation for n-dimensional objects
 */

import { create } from 'zustand';
import { getRotationPlanes } from '@/lib/math/rotation';

/** Minimum animation speed multiplier */
export const MIN_SPEED = 0.1;

/** Maximum animation speed multiplier */
export const MAX_SPEED = 5.0;

/** Default animation speed (1x = one full rotation per 10 seconds) */
export const DEFAULT_SPEED = 1.0;

/** Base rotation rate in radians per second at 1x speed */
export const BASE_ROTATION_RATE = (2 * Math.PI) / 10; // Full rotation in 10 seconds

interface AnimationState {
  /** Whether animation is currently playing */
  isPlaying: boolean;

  /** Speed multiplier (0.1 to 5.0) */
  speed: number;

  /** Rotation direction: 1 = clockwise, -1 = counter-clockwise */
  direction: 1 | -1;

  /** Set of planes currently being animated */
  animatingPlanes: Set<string>;

  /** Whether isoclinic mode is enabled (4D: XY and ZW rotate together) */
  isoclinicMode: boolean;

  // Actions
  play: () => void;
  pause: () => void;
  toggle: () => void;
  setSpeed: (speed: number) => void;
  toggleDirection: () => void;
  togglePlane: (plane: string) => void;
  setPlaneAnimating: (plane: string, animating: boolean) => void;
  animateAll: (dimension: number) => void;
  stopAll: () => void;
  setIsoclinicMode: (enabled: boolean) => void;
  setDimension: (dimension: number) => void;
  reset: () => void;

  /** Calculate the rotation delta for a given time delta */
  getRotationDelta: (deltaTimeMs: number) => number;
}

/**
 * Clamps speed to valid range
 * @param speed
 */
function clampSpeed(speed: number): number {
  return Math.max(MIN_SPEED, Math.min(MAX_SPEED, speed));
}

/**
 * Gets all rotation plane names for a given dimension
 * @param dimension
 */
function getAllPlaneNames(dimension: number): string[] {
  return getRotationPlanes(dimension).map(p => p.name);
}

export const useAnimationStore = create<AnimationState>((set, get) => ({
  isPlaying: true,
  speed: DEFAULT_SPEED,
  direction: 1,
  animatingPlanes: new Set(['XY', 'YZ', 'ZW']),
  isoclinicMode: false,

  play: () => {
    set({ isPlaying: true });
  },

  pause: () => {
    set({ isPlaying: false });
  },

  toggle: () => {
    set((state) => ({ isPlaying: !state.isPlaying }));
  },

  setSpeed: (speed: number) => {
    set({ speed: clampSpeed(speed) });
  },

  toggleDirection: () => {
    set((state) => ({ direction: state.direction === 1 ? -1 : 1 }));
  },

  togglePlane: (plane: string) => {
    set((state) => {
      const newPlanes = new Set(state.animatingPlanes);
      if (newPlanes.has(plane)) {
        newPlanes.delete(plane);
      } else {
        newPlanes.add(plane);
      }
      return { animatingPlanes: newPlanes };
    });
  },

  setPlaneAnimating: (plane: string, animating: boolean) => {
    set((state) => {
      const newPlanes = new Set(state.animatingPlanes);
      if (animating) {
        newPlanes.add(plane);
      } else {
        newPlanes.delete(plane);
      }
      return { animatingPlanes: newPlanes };
    });
  },

  animateAll: (dimension: number) => {
    const planes = getAllPlaneNames(dimension);
    set({ animatingPlanes: new Set(planes), isPlaying: true });
  },

  stopAll: () => {
    set({ animatingPlanes: new Set(), isPlaying: false });
  },

  setIsoclinicMode: (enabled: boolean) => {
    set((state) => {
      if (enabled) {
        // Enable isoclinic: add both XY and ZW to animating planes
        const newPlanes = new Set(state.animatingPlanes);
        newPlanes.add('XY');
        newPlanes.add('ZW');
        return { isoclinicMode: true, animatingPlanes: newPlanes };
      }
      return { isoclinicMode: false };
    });
  },

  setDimension: (dimension: number) => {
    set((state) => {
      // Filter animating planes to only include valid planes for new dimension
      const validPlanes = new Set(getAllPlaneNames(dimension));
      const newAnimatingPlanes = new Set<string>();

      for (const plane of state.animatingPlanes) {
        if (validPlanes.has(plane)) {
          newAnimatingPlanes.add(plane);
        }
      }

      return { animatingPlanes: newAnimatingPlanes };
    });
  },

  reset: () => {
    set({
      isPlaying: true,
      speed: 1,
      direction: 1,
      animatingPlanes: new Set(['XY', 'YZ', 'ZW']),
      isoclinicMode: false,
    });
  },

  getRotationDelta: (deltaTimeMs: number) => {
    const state = get();
    const deltaTimeSec = deltaTimeMs / 1000;
    return BASE_ROTATION_RATE * state.speed * state.direction * deltaTimeSec;
  },
}));
