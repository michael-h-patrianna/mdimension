/**
 * WebGPU Badge Component
 *
 * Displays a badge indicating the active renderer backend (WebGPU or WebGL).
 * Only shows when WebGPU is active to highlight the modern rendering path.
 *
 * @module components/ui/WebGPUBadge
 */

import { useRendererStore } from '@/stores/rendererStore'
import { useThree } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

/**
 * Badge position options.
 */
export type BadgePosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

/**
 * Props for the WebGPUBadge component.
 */
export interface WebGPUBadgeProps {
  /** Position of the badge (default: 'bottom-right') */
  position?: BadgePosition
  /** Whether to always show the badge, even for WebGL (default: false) */
  showWebGL?: boolean
  /** Additional CSS classes */
  className?: string
}

/**
 * Get CSS positioning classes for the badge.
 */
function getPositionClasses(position: BadgePosition): string {
  switch (position) {
    case 'top-left':
      return 'top-2 left-2'
    case 'top-right':
      return 'top-2 right-2'
    case 'bottom-left':
      return 'bottom-2 left-2'
    case 'bottom-right':
    default:
      return 'bottom-2 right-2'
  }
}

/**
 * Badge component showing the active renderer backend.
 *
 * Detects whether WebGPU or WebGL is being used and displays
 * an appropriate indicator. By default, only shows when WebGPU
 * is active to highlight the modern rendering path.
 *
 * @example
 * ```tsx
 * // Inside R3F Canvas
 * <WebGPUBadge position="bottom-right" />
 *
 * // Show both WebGPU and WebGL badges
 * <WebGPUBadge showWebGL />
 * ```
 */
export function WebGPUBadge({
  position = 'bottom-right',
  showWebGL = false,
  className = '',
}: WebGPUBadgeProps) {
  const gl = useThree((state) => state.gl)
  const [backend, setBackend] = useState<'webgpu' | 'webgl' | null>(null)
  const [gpuName, setGpuName] = useState<string | null>(null)

  useEffect(() => {
    // Check if the renderer is a WebGPURenderer with WebGPU backend
    const renderer = gl as unknown as {
      backend?: {
        isWebGPUBackend?: boolean
        parameters?: {
          adapterInfo?: GPUAdapterInfo
        }
      }
    }

    // Three.js r181+ uses isWebGPUBackend property
    if (renderer.backend?.isWebGPUBackend) {
      setBackend('webgpu')
      // Try to get GPU name from adapter info
      const adapterInfo = renderer.backend.parameters?.adapterInfo
      if (adapterInfo?.description) {
        setGpuName(adapterInfo.description)
      }
    } else {
      setBackend('webgl')
    }
  }, [gl])

  // Don't render if backend not detected yet
  if (backend === null) return null

  // Don't render WebGL badge unless explicitly requested
  if (backend === 'webgl' && !showWebGL) return null

  const positionClasses = getPositionClasses(position)

  const isWebGPU = backend === 'webgpu'

  return (
    <div
      className={`
        absolute ${positionClasses} z-10
        glass-panel px-2 py-1
        flex items-center gap-1.5
        text-xs font-medium
        select-none pointer-events-none
        ${isWebGPU ? 'text-emerald-400' : 'text-amber-400'}
        ${className}
      `}
      title={gpuName ?? undefined}
    >
      {/* Icon */}
      <span className="text-sm">{isWebGPU ? '⚡' : '🔷'}</span>

      {/* Label */}
      <span>{isWebGPU ? 'WebGPU' : 'WebGL'}</span>

      {/* Optional GPU name tooltip indicator */}
      {gpuName && (
        <span className="text-[10px] opacity-60 max-w-[100px] truncate">({gpuName})</span>
      )}
    </div>
  )
}

/**
 * Standalone badge component for use outside R3F Canvas.
 *
 * Uses browser capability detection instead of renderer state.
 * Shows what backend *would* be used, not what is currently active.
 */
export function WebGPUCapabilityBadge({
  position = 'bottom-right',
  className = '',
}: Omit<WebGPUBadgeProps, 'showWebGL'>) {
  const [isWebGPUAvailable, setIsWebGPUAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    const checkWebGPU = async () => {
      if (!('gpu' in navigator)) {
        setIsWebGPUAvailable(false)
        return
      }

      try {
        const adapter = await navigator.gpu?.requestAdapter()
        setIsWebGPUAvailable(adapter !== null)
      } catch {
        setIsWebGPUAvailable(false)
      }
    }

    checkWebGPU()
  }, [])

  if (isWebGPUAvailable === null) return null

  const positionClasses = getPositionClasses(position)

  return (
    <div
      className={`
        absolute ${positionClasses} z-10
        glass-panel px-2 py-1
        flex items-center gap-1.5
        text-xs font-medium
        select-none
        ${isWebGPUAvailable ? 'text-emerald-400' : 'text-amber-400'}
        ${className}
      `}
    >
      <span className="text-sm">{isWebGPUAvailable ? '⚡' : '🔷'}</span>
      <span>{isWebGPUAvailable ? 'WebGPU Ready' : 'WebGL Only'}</span>
    </div>
  )
}

/**
 * Store-based badge component for use outside R3F Canvas.
 *
 * Uses the rendererStore to display the active backend.
 * This is the preferred version for placement outside the Canvas element.
 */
export function WebGPUBadgeStore({
  position = 'bottom-right',
  showWebGL = false,
  className = '',
}: WebGPUBadgeProps) {
  const { backend, gpuName } = useRendererStore(
    useShallow((state) => ({
      backend: state.backend,
      gpuName: state.gpuName,
    }))
  )

  // Don't render if backend not detected yet
  if (backend === 'unknown') return null

  // Don't render WebGL badge unless explicitly requested
  if (backend === 'webgl' && !showWebGL) return null

  const positionClasses = getPositionClasses(position)
  const isWebGPU = backend === 'webgpu'

  return (
    <div
      className={`
        absolute ${positionClasses} z-10
        glass-panel px-2 py-1
        flex items-center gap-1.5
        text-xs font-medium
        select-none pointer-events-none
        ${isWebGPU ? 'text-emerald-400' : 'text-amber-400'}
        ${className}
      `}
      title={gpuName ?? undefined}
    >
      {/* Icon */}
      <span className="text-sm">{isWebGPU ? '⚡' : '🔷'}</span>

      {/* Label */}
      <span>{isWebGPU ? 'WebGPU' : 'WebGL'}</span>

      {/* Optional GPU name tooltip indicator */}
      {gpuName && (
        <span className="text-[10px] opacity-60 max-w-[100px] truncate">({gpuName})</span>
      )}
    </div>
  )
}

export default WebGPUBadge







