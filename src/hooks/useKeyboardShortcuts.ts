/**
 * Keyboard Shortcuts Hook
 * Provides keyboard shortcuts for common actions
 */

import { exportSceneToPNG, generateTimestampFilename } from '@/lib/export'
import { useGeometryStore } from '@/stores/geometryStore'
import { useLayoutStore } from '@/stores/layoutStore'
import { useLightingStore } from '@/stores/lightingStore'
import { useCallback, useEffect } from 'react'

export interface ShortcutConfig {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  description: string
  action: () => void
}

export interface UseKeyboardShortcutsOptions {
  enabled?: boolean
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
]

/**
 *
 * @param options
 */
export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}): void {
  const { enabled = true } = options

  const dimension = useGeometryStore((state) => state.dimension)
  const setDimension = useGeometryStore((state) => state.setDimension)
  const setObjectType = useGeometryStore((state) => state.setObjectType)

  const toggleCinematicMode = useLayoutStore((state) => state.toggleCinematicMode)

  // Light-related state and actions
  const selectedLightId = useLightingStore((state) => state.selectedLightId)
  const setTransformMode = useLightingStore((state) => state.setTransformMode)
  const selectLight = useLightingStore((state) => state.selectLight)
  const removeLight = useLightingStore((state) => state.removeLight)
  const duplicateLight = useLightingStore((state) => state.duplicateLight)

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }

      const { key, ctrlKey, metaKey, shiftKey } = event
      const isCtrlOrMeta = ctrlKey || metaKey
      const lowerKey = key.toLowerCase()

      // --- Light-specific shortcuts (High Priority) ---
      if (selectedLightId) {
        // Actions that ignore modifiers (mostly) or handle them specifically
        if (key === 'Delete' || key === 'Backspace') {
          event.preventDefault()
          removeLight(selectedLightId)
          return
        }

        if (key === 'Escape') {
          event.preventDefault()
          selectLight(null)
          return
        }

        // Mode switching / Actions requiring NO modifiers
        if (!shiftKey && !isCtrlOrMeta) {
          const lightActions: Record<string, () => void> = {
            w: () => setTransformMode('translate'),
            e: () => setTransformMode('rotate'),
            d: () => {
              const newId = duplicateLight(selectedLightId)
              if (newId) selectLight(newId)
            },
          }

          if (lightActions[lowerKey]) {
            event.preventDefault()
            lightActions[lowerKey]()
            return
          }
        }
      }

      // --- Global Shortcuts ---

      // 1. Modifier-specific actions
      if (isCtrlOrMeta && lowerKey === 's') {
        event.preventDefault()
        const filename = generateTimestampFilename('ndimensional')
        exportSceneToPNG({ filename })
        return
      }

      if (!isCtrlOrMeta && !shiftKey && lowerKey === 'c') {
        event.preventDefault()
        toggleCinematicMode()
        return
      }

      // 2. Simple Key Map (Modifiers ignored/allowed as per original implementation)
      // Note: Original implementation allowed modifiers for Arrows and Numbers
      const globalKeyMap: Record<string, () => void> = {
        ArrowUp: () => {
          if (dimension < 6) setDimension(dimension + 1)
        },
        ArrowDown: () => {
          if (dimension > 3) setDimension(dimension - 1)
        },
        '1': () => setObjectType('hypercube'),
        '2': () => setObjectType('simplex'),
        '3': () => setObjectType('cross-polytope'),
      }

      if (globalKeyMap[key]) {
        event.preventDefault()
        globalKeyMap[key]()
        return
      }

      // Note: WASD keys are handled by useCameraMovement hook for camera movement
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
  )

  useEffect(() => {
    if (!enabled) {
      return
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [enabled, handleKeyDown])
}

/**
 * Get a human-readable label for a keyboard shortcut
 * @param shortcut - The shortcut configuration
 * @returns Human-readable shortcut label (e.g., "Ctrl + Shift + A")
 */
export function getShortcutLabel(shortcut: Omit<ShortcutConfig, 'action'>): string {
  const parts: string[] = []
  if (shortcut.ctrl) parts.push('Ctrl')
  if (shortcut.shift) parts.push('Shift')
  if (shortcut.alt) parts.push('Alt')

  let keyLabel = shortcut.key
  if (shortcut.key === ' ') keyLabel = 'Space'
  if (shortcut.key === 'ArrowUp') keyLabel = '↑'
  if (shortcut.key === 'ArrowDown') keyLabel = '↓'
  if (shortcut.key === '+') keyLabel = '+'
  if (shortcut.key === '-') keyLabel = '-'

  parts.push(keyLabel)
  return parts.join(' + ')
}
