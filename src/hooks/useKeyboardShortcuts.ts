/**
 * Keyboard Shortcuts Hook
 * Provides keyboard shortcuts for common actions
 */

import { useEffect, useCallback } from 'react';
import { useGeometryStore } from '@/stores/geometryStore';
import { useVisualStore } from '@/stores/visualStore';
import { useLayoutStore } from '@/stores/layoutStore';
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
  // Geometry
  { key: 'ArrowUp', description: 'Increase dimension' },
  { key: 'ArrowDown', description: 'Decrease dimension' },
  { key: '1', description: 'Select hypercube' },
  { key: '2', description: 'Select simplex' },
  { key: '3', description: 'Select cross-polytope' },
  // View
  { key: 'c', description: 'Toggle cinematic mode' },
  // Export
  { key: 's', ctrl: true, description: 'Export PNG' },
  // Light controls (when light selected)
  { key: 'w', description: 'Light: Move mode*' },
  { key: 'e', description: 'Light: Rotate mode*' },
  { key: 'd', description: 'Light: Duplicate*' },
  { key: 'Delete', description: 'Light: Remove*' },
  { key: 'Escape', description: 'Light: Deselect*' },
];

/**
 *
 * @param options
 */
export function useKeyboardShortcuts(
  options: UseKeyboardShortcutsOptions = {}
): void {
  const { enabled = true } = options;

  const dimension = useGeometryStore((state) => state.dimension);
  const setDimension = useGeometryStore((state) => state.setDimension);
  const setObjectType = useGeometryStore((state) => state.setObjectType);
  
  const toggleCinematicMode = useLayoutStore((state) => state.toggleCinematicMode);

  // Light-related state and actions
  const selectedLightId = useVisualStore((state) => state.selectedLightId);
  const setTransformMode = useVisualStore((state) => state.setTransformMode);
  const selectLight = useVisualStore((state) => state.selectLight);
  const removeLight = useVisualStore((state) => state.removeLight);
  const duplicateLight = useVisualStore((state) => state.duplicateLight);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const { key, ctrlKey, metaKey, shiftKey } = event;
      const isCtrlOrMeta = ctrlKey || metaKey;

      // Light-specific shortcuts (when a light is selected)
      if (selectedLightId) {
        const lowerKey = key.toLowerCase();

        // W - Move mode (only when no shift)
        if (lowerKey === 'w' && !shiftKey && !isCtrlOrMeta) {
          event.preventDefault();
          setTransformMode('translate');
          return;
        }

        // E - Rotate mode
        if (lowerKey === 'e' && !shiftKey && !isCtrlOrMeta) {
          event.preventDefault();
          setTransformMode('rotate');
          return;
        }

        // D - Duplicate light (only when no shift)
        if (lowerKey === 'd' && !shiftKey && !isCtrlOrMeta) {
          event.preventDefault();
          const newId = duplicateLight(selectedLightId);
          if (newId) {
            selectLight(newId);
          }
          return;
        }

        // Delete/Backspace - Remove light
        if (key === 'Delete' || key === 'Backspace') {
          event.preventDefault();
          removeLight(selectedLightId);
          return;
        }

        // Escape - Deselect light
        if (key === 'Escape') {
          event.preventDefault();
          selectLight(null);
          return;
        }
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

      // C - Toggle Cinematic Mode
      if (key.toLowerCase() === 'c' && !isCtrlOrMeta && !shiftKey) {
        event.preventDefault();
        toggleCinematicMode();
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

      // Note: WASD keys are handled by useCameraMovement hook for camera movement
      // When a light is selected, W and D are intercepted by light shortcuts above
    },
    [
      dimension,
      setDimension,
      setObjectType,
      selectedLightId,
      setTransformMode,
      selectLight,
      removeLight,
      duplicateLight,
      toggleCinematicMode,
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
