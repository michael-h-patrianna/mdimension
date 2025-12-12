/**
 * Keyboard Shortcuts Hook
 * Provides keyboard shortcuts for common actions
 */

import { useEffect, useCallback } from 'react';
import { useAnimationStore } from '@/stores/animationStore';
import { useGeometryStore } from '@/stores/geometryStore';
import { useRotationStore } from '@/stores/rotationStore';
import { exportSceneToPNG, generateTimestampFilename } from '@/lib/export';

export interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  action: () => void;
}

export interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
}

/** Shortcut configuration for display (grouped by category) */
export const SHORTCUTS: Omit<ShortcutConfig, 'action'>[] = [
  // Camera Movement
  { key: 'w', description: 'Move camera forward' },
  { key: 'a', description: 'Strafe camera left' },
  { key: 's', description: 'Move camera backward' },
  { key: 'd', description: 'Strafe camera right' },
  // Camera Rotation (Shift + WASD)
  { key: 'w', shift: true, description: 'Rotate camera up' },
  { key: 'a', shift: true, description: 'Rotate camera left' },
  { key: 's', shift: true, description: 'Rotate camera down' },
  { key: 'd', shift: true, description: 'Rotate camera right' },
  // Camera Origin
  { key: '0', description: 'Move camera to origin' },
  { key: '0', shift: true, description: 'Look at origin' },
  // Animation
  { key: ' ', description: 'Play/Pause animation' },
  { key: 'r', description: 'Reverse animation direction' },
  { key: '+', description: 'Increase animation speed' },
  { key: '-', description: 'Decrease animation speed' },
  // Geometry
  { key: 'ArrowUp', description: 'Increase dimension' },
  { key: 'ArrowDown', description: 'Decrease dimension' },
  { key: '1', description: 'Select hypercube' },
  { key: '2', description: 'Select simplex' },
  { key: '3', description: 'Select cross-polytope' },
  // Rotation
  { key: 'x', description: 'Reset rotation' },
  // Export
  { key: 's', ctrl: true, description: 'Export PNG' },
];

/**
 *
 * @param options
 */
export function useKeyboardShortcuts(
  options: UseKeyboardShortcutsOptions = {}
): void {
  const { enabled = true } = options;

  const toggle = useAnimationStore((state) => state.toggle);
  const setSpeed = useAnimationStore((state) => state.setSpeed);
  const speed = useAnimationStore((state) => state.speed);
  const toggleDirection = useAnimationStore((state) => state.toggleDirection);

  const dimension = useGeometryStore((state) => state.dimension);
  const setDimension = useGeometryStore((state) => state.setDimension);
  const setObjectType = useGeometryStore((state) => state.setObjectType);

  const resetAllRotations = useRotationStore((state) => state.resetAllRotations);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const { key, ctrlKey, metaKey } = event;
      const isCtrlOrMeta = ctrlKey || metaKey;

      // Space - Play/Pause
      if (key === ' ') {
        event.preventDefault();
        toggle();
        return;
      }

      // R - Reverse animation direction
      if (key === 'r' && !isCtrlOrMeta) {
        event.preventDefault();
        toggleDirection();
        return;
      }

      // X - Reset rotation
      if (key === 'x' && !isCtrlOrMeta) {
        event.preventDefault();
        resetAllRotations();
        return;
      }

      // Arrow Up - Increase dimension
      if (key === 'ArrowUp') {
        event.preventDefault();
        if (dimension < 6) {
          setDimension(dimension + 1);
        }
        return;
      }

      // Arrow Down - Decrease dimension
      if (key === 'ArrowDown') {
        event.preventDefault();
        if (dimension > 3) {
          setDimension(dimension - 1);
        }
        return;
      }

      // Ctrl/Cmd + S - Export PNG
      if (key === 's' && isCtrlOrMeta) {
        event.preventDefault();
        const filename = generateTimestampFilename('ndimensional');
        exportSceneToPNG({ filename });
        return;
      }

      // 1 - Hypercube
      if (key === '1') {
        event.preventDefault();
        setObjectType('hypercube');
        return;
      }

      // 2 - Simplex
      if (key === '2') {
        event.preventDefault();
        setObjectType('simplex');
        return;
      }

      // 3 - Cross-polytope
      if (key === '3') {
        event.preventDefault();
        setObjectType('cross-polytope');
        return;
      }

      // + - Increase speed
      if (key === '+' || key === '=') {
        event.preventDefault();
        setSpeed(Math.min(speed + 0.25, 3));
        return;
      }

      // - - Decrease speed
      if (key === '-') {
        event.preventDefault();
        setSpeed(Math.max(speed - 0.25, 0.25));
        return;
      }

      // Note: WASD keys are handled by useCameraMovement hook for camera movement
    },
    [
      toggle,
      resetAllRotations,
      dimension,
      setDimension,
      setObjectType,
      setSpeed,
      speed,
      toggleDirection,
    ]
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);
}

/**
 *
 * @param shortcut
 */
export function getShortcutLabel(shortcut: Omit<ShortcutConfig, 'action'>): string {
  const parts: string[] = [];
  if (shortcut.ctrl) parts.push('Ctrl');
  if (shortcut.shift) parts.push('Shift');
  if (shortcut.alt) parts.push('Alt');

  let keyLabel = shortcut.key;
  if (shortcut.key === ' ') keyLabel = 'Space';
  if (shortcut.key === 'ArrowUp') keyLabel = '↑';
  if (shortcut.key === 'ArrowDown') keyLabel = '↓';
  if (shortcut.key === '+') keyLabel = '+';
  if (shortcut.key === '-') keyLabel = '-';

  parts.push(keyLabel);
  return parts.join(' + ');
}
