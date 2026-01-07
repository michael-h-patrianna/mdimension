/**
 * Tests for WebGPUBadge component
 *
 * Tests the renderer backend badge display logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WebGPUCapabilityBadge } from '@/components/ui/WebGPUBadge'

// Mock navigator.gpu
const mockNavigatorGPU = (available: boolean, adapterAvailable: boolean = true) => {
  if (available) {
    Object.defineProperty(global, 'navigator', {
      value: {
        gpu: {
          requestAdapter: vi.fn().mockResolvedValue(adapterAvailable ? {} : null),
        },
      },
      writable: true,
    })
  } else {
    Object.defineProperty(global, 'navigator', {
      value: {},
      writable: true,
    })
  }
}

describe('WebGPUCapabilityBadge', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('shows "WebGPU Ready" when WebGPU is available', async () => {
    mockNavigatorGPU(true, true)

    render(<WebGPUCapabilityBadge />)

    // Wait for async check to complete
    await vi.waitFor(() => {
      expect(screen.getByText('WebGPU Ready')).toBeInTheDocument()
    })
  })

  it('shows "WebGL Only" when WebGPU is not available', async () => {
    mockNavigatorGPU(false)

    render(<WebGPUCapabilityBadge />)

    // Wait for async check to complete
    await vi.waitFor(() => {
      expect(screen.getByText('WebGL Only')).toBeInTheDocument()
    })
  })

  it('shows "WebGL Only" when adapter is not available', async () => {
    mockNavigatorGPU(true, false)

    render(<WebGPUCapabilityBadge />)

    // Wait for async check to complete
    await vi.waitFor(() => {
      expect(screen.getByText('WebGL Only')).toBeInTheDocument()
    })
  })

  it('applies correct position class for bottom-right', async () => {
    mockNavigatorGPU(true, true)

    const { container } = render(<WebGPUCapabilityBadge position="bottom-right" />)

    await vi.waitFor(() => {
      const badge = container.firstChild as HTMLElement
      expect(badge.className).toContain('bottom-2')
      expect(badge.className).toContain('right-2')
    })
  })

  it('applies correct position class for top-left', async () => {
    mockNavigatorGPU(true, true)

    const { container } = render(<WebGPUCapabilityBadge position="top-left" />)

    await vi.waitFor(() => {
      const badge = container.firstChild as HTMLElement
      expect(badge.className).toContain('top-2')
      expect(badge.className).toContain('left-2')
    })
  })

  it('applies custom className', async () => {
    mockNavigatorGPU(true, true)

    const { container } = render(<WebGPUCapabilityBadge className="custom-class" />)

    await vi.waitFor(() => {
      const badge = container.firstChild as HTMLElement
      expect(badge.className).toContain('custom-class')
    })
  })

  it('uses emerald color for WebGPU', async () => {
    mockNavigatorGPU(true, true)

    const { container } = render(<WebGPUCapabilityBadge />)

    await vi.waitFor(() => {
      const badge = container.firstChild as HTMLElement
      expect(badge.className).toContain('text-emerald-400')
    })
  })

  it('uses amber color for WebGL', async () => {
    mockNavigatorGPU(false)

    const { container } = render(<WebGPUCapabilityBadge />)

    await vi.waitFor(() => {
      const badge = container.firstChild as HTMLElement
      expect(badge.className).toContain('text-amber-400')
    })
  })

  it('returns null initially before detection completes', async () => {
    // Mock a slow adapter request
    Object.defineProperty(global, 'navigator', {
      value: {
        gpu: {
          requestAdapter: vi.fn().mockImplementation(() => new Promise(() => {
            // Never resolves - simulates pending state
          })),
        },
      },
      writable: true,
    })

    const { container } = render(<WebGPUCapabilityBadge />)

    // Initially should be empty (returning null) because detection hasn't completed
    expect(container.firstChild).toBeNull()
  })
})

