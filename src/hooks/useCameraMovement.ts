/**
 * Camera Movement Hook
 * Provides WASD camera movement and Shift+WASD camera rotation
 */

import { useEffect, useRef, MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, Spherical } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

export interface UseCameraMovementOptions {
  /** Enable camera movement (default: true) */
  enabled?: boolean;
  /** Movement speed in units per frame (default: 0.08) */
  speed?: number;
  /** Rotation speed in radians per frame (default: 0.02) */
  rotationSpeed?: number;
  /** Reference to OrbitControls for target updates */
  controlsRef?: MutableRefObject<OrbitControlsImpl | null>;
}

/** Keys used for camera movement/rotation */
const MOVEMENT_KEYS = ['w', 'a', 's', 'd'] as const;

/** Origin point */
const ORIGIN = new Vector3(0, 0, 0);

/** Default camera position when resetting from origin */
const DEFAULT_CAMERA_POSITION = new Vector3(0, 0, 5);

/** Threshold for considering camera "at origin" */
const ORIGIN_THRESHOLD = 0.001;

/**
 * Check if the event target is an input field
 */
function isInputField(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement
  );
}

/**
 * Hook for WASD camera movement and Shift+WASD camera rotation.
 *
 * - WASD: Move camera (W=forward, S=backward, A=left, D=right)
 * - Shift+WASD: Rotate camera (W=pitch up, S=pitch down, A=yaw left, D=yaw right)
 *
 * Movement/rotation is calculated per-frame using useFrame for smooth continuous motion.
 * Key state is tracked via refs to avoid unnecessary re-renders.
 *
 * @param options - Configuration options
 * @param options.enabled - Enable/disable camera movement
 * @param options.speed - Movement speed in units per frame
 * @param options.rotationSpeed - Rotation speed in radians per frame
 * @param options.controlsRef - Reference to OrbitControls for target updates
 *
 * @example
 * ```tsx
 * function CameraController() {
 *   const controlsRef = useRef<OrbitControlsImpl | null>(null);
 *   useCameraMovement({ enabled: true, controlsRef });
 *   return null;
 * }
 * ```
 */
export function useCameraMovement(options: UseCameraMovementOptions = {}): void {
  const { enabled = true, speed = 0.08, rotationSpeed = 0.02, controlsRef } = options;

  const { camera } = useThree();
  const keysPressed = useRef<Set<string>>(new Set());
  const shiftPressed = useRef(false);

  // Reusable vectors to avoid allocation in the render loop
  const forward = useRef(new Vector3());
  const right = useRef(new Vector3());
  const movement = useRef(new Vector3());
  const offset = useRef(new Vector3());
  const spherical = useRef(new Spherical());

  // Set up keyboard event listeners
  useEffect(() => {
    // Capture ref values at effect time for cleanup
    const keysPressedSet = keysPressed.current;

    if (!enabled) {
      keysPressedSet.clear();
      shiftPressed.current = false;
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      // Don't capture keys when typing in input fields
      if (isInputField(event.target)) {
        return;
      }

      // Track Shift key
      if (event.key === 'Shift') {
        shiftPressed.current = true;
        return;
      }

      // Handle "0" key - use event.code for keyboard-layout independence
      if (event.code === 'Digit0') {
        event.preventDefault();
        const controls = controlsRef?.current;

        // Use event.shiftKey for reliable shift detection across all keyboards
        if (event.shiftKey) {
          // Shift+0: Look at origin
          // Edge case: if camera is at origin, move it to default position first
          if (camera.position.distanceTo(ORIGIN) < ORIGIN_THRESHOLD) {
            camera.position.copy(DEFAULT_CAMERA_POSITION);
          }
          // Update OrbitControls target to origin
          if (controls) {
            controls.target.copy(ORIGIN);
          }
          // Make camera look at origin
          camera.lookAt(ORIGIN);
        } else {
          // 0: Move camera to origin, preserving look direction
          // Get current look direction before moving
          const lookDirection = new Vector3();
          camera.getWorldDirection(lookDirection);

          // Move camera to origin
          camera.position.copy(ORIGIN);

          // Set target along the preserved look direction
          // Use distance of 3 to satisfy OrbitControls minDistance (default 2)
          if (controls) {
            controls.target.copy(lookDirection.multiplyScalar(3));
          }
        }
        return;
      }

      const key = event.key.toLowerCase();
      if (MOVEMENT_KEYS.includes(key as typeof MOVEMENT_KEYS[number])) {
        keysPressed.current.add(key);
      }
    };

    const handleKeyUp = (event: KeyboardEvent): void => {
      // Track Shift key release
      if (event.key === 'Shift') {
        shiftPressed.current = false;
        return;
      }

      const key = event.key.toLowerCase();
      keysPressed.current.delete(key);
    };

    // Clear keys when window loses focus
    const handleBlur = (): void => {
      keysPressedSet.clear();
      shiftPressed.current = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      keysPressedSet.clear();
      shiftPressed.current = false;
    };
  }, [enabled, camera, controlsRef]);

  // Per-frame movement/rotation update
  useFrame(() => {
    if (!enabled || keysPressed.current.size === 0) {
      return;
    }

    const controls = controlsRef?.current;
    // Use pre-allocated vector to avoid allocation in render loop
    // If no controls, default target is origin (reusing ORIGIN constant)
    const target = controls?.target ?? ORIGIN;

    // Shift+WASD: Rotate camera around the target
    if (shiftPressed.current) {
      // Get offset from target to camera
      offset.current.copy(camera.position).sub(target);

      // Convert to spherical coordinates
      spherical.current.setFromVector3(offset.current);

      // Apply rotation based on pressed keys
      // W/S: Change polar angle (pitch - looking up/down)
      // A/D: Change azimuthal angle (yaw - looking left/right)
      if (keysPressed.current.has('w')) {
        // Pitch up (decrease polar angle, with limit to avoid flipping)
        spherical.current.phi = Math.max(0.1, spherical.current.phi - rotationSpeed);
      }
      if (keysPressed.current.has('s')) {
        // Pitch down (increase polar angle, with limit to avoid flipping)
        spherical.current.phi = Math.min(Math.PI - 0.1, spherical.current.phi + rotationSpeed);
      }
      if (keysPressed.current.has('a')) {
        // Yaw left (increase azimuthal angle)
        spherical.current.theta += rotationSpeed;
      }
      if (keysPressed.current.has('d')) {
        // Yaw right (decrease azimuthal angle)
        spherical.current.theta -= rotationSpeed;
      }

      // Convert back to Cartesian and update camera position
      offset.current.setFromSpherical(spherical.current);
      camera.position.copy(target).add(offset.current);

      // Make camera look at target
      camera.lookAt(target);

      return;
    }

    // Regular WASD: Move camera
    // Get camera's forward direction (where it's looking)
    // This is the true sight vector - movement follows exactly where you're looking
    camera.getWorldDirection(forward.current);
    forward.current.normalize();

    // Calculate right vector (perpendicular to forward, in the horizontal plane)
    // Use world up (0,1,0) to ensure strafing stays horizontal
    right.current.crossVectors(forward.current, camera.up).normalize();

    // Reset movement vector
    movement.current.set(0, 0, 0);

    // Accumulate movement based on pressed keys
    if (keysPressed.current.has('w')) {
      movement.current.addScaledVector(forward.current, speed);
    }
    if (keysPressed.current.has('s')) {
      movement.current.addScaledVector(forward.current, -speed);
    }
    if (keysPressed.current.has('a')) {
      movement.current.addScaledVector(right.current, -speed);
    }
    if (keysPressed.current.has('d')) {
      movement.current.addScaledVector(right.current, speed);
    }

    // Apply movement to camera position
    camera.position.add(movement.current);

    // Update OrbitControls target to maintain relative look direction
    if (controls) {
      controls.target.add(movement.current);
    }
  });
}

/**
 * Get the list of movement/rotation shortcuts for display purposes
 */
export const CAMERA_MOVEMENT_SHORTCUTS = [
  { key: 'w', description: 'Move camera forward' },
  { key: 'a', description: 'Strafe camera left' },
  { key: 's', description: 'Move camera backward' },
  { key: 'd', description: 'Strafe camera right' },
] as const;

export const CAMERA_ROTATION_SHORTCUTS = [
  { key: 'w', shift: true, description: 'Rotate camera up' },
  { key: 'a', shift: true, description: 'Rotate camera left' },
  { key: 's', shift: true, description: 'Rotate camera down' },
  { key: 'd', shift: true, description: 'Rotate camera right' },
] as const;

export const CAMERA_ORIGIN_SHORTCUTS = [
  { key: '0', description: 'Move camera to origin' },
  { key: '0', shift: true, description: 'Look at origin' },
] as const;
