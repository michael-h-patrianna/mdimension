/**
 * Layout Component
 *
 * Main application layout with canvas and sidebar.
 * Supports two layout modes based on viewport width:
 * - Overlay mode (<1024px): Sidebar floats over canvas
 * - Side-by-side mode (≥1024px): Sidebar and canvas are flex neighbors
 *
 * Canvas minimum width is enforced at 300px to prevent rendering issues.
 */

import { Sidebar } from '@/components/sidebar'
import { useBreakpoint } from '@/hooks/useMediaQuery'
import {
  MIN_CANVAS_WIDTH,
  useLayoutStore
} from '@/stores/layoutStore'
import { useThemeStore } from '@/stores/themeStore'
import React, { useEffect, useMemo } from 'react'

export interface LayoutProps {
  children?: React.ReactNode
  appTitle?: string
  showHeader?: boolean
}

/**
 * Layout - Main application layout container.
 *
 * Automatically switches between overlay and side-by-side modes
 * based on viewport width. In side-by-side mode, the sidebar width
 * is user-adjustable via drag handle.
 *
 * @param props - Component props
 * @param props.children - Canvas/content to render
 * @param props.appTitle - Application title for header
 * @param props.showHeader - Whether to show floating header
 * @returns React component
 */
export const Layout: React.FC<LayoutProps> = ({
  children,
  appTitle = 'MDimension',
  showHeader = true,
}) => {
  const theme = useThemeStore((state) => state.theme)
  const isLargeScreen = useBreakpoint('lg')
  const sidebarWidth = useLayoutStore((state) => state.sidebarWidth)
  const isCollapsed = useLayoutStore((state) => state.isCollapsed)
  const setSidebarWidth = useLayoutStore((state) => state.setSidebarWidth)

  // Determine layout mode based on breakpoint
  const layoutMode = useMemo(
    () => (isLargeScreen ? 'side-by-side' : 'overlay'),
    [isLargeScreen]
  )

  // Apply theme to document root for CSS variable inheritance
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Set appropriate default width when crossing breakpoint
  useEffect(() => {
    const viewportWidth = window.innerWidth
    const defaultWidth = isLargeScreen
      ? DEFAULT_SIDEBAR_WIDTH_LARGE
      : DEFAULT_SIDEBAR_WIDTH

    // Only adjust if sidebar is at the "other" mode's default
    // This prevents overriding user-set custom widths
    if (isLargeScreen && sidebarWidth === DEFAULT_SIDEBAR_WIDTH) {
      setSidebarWidth(defaultWidth, viewportWidth)
    } else if (!isLargeScreen && sidebarWidth === DEFAULT_SIDEBAR_WIDTH_LARGE) {
      setSidebarWidth(defaultWidth, viewportWidth)
    }
  }, [isLargeScreen, sidebarWidth, setSidebarWidth])

  // Side-by-side layout: flex row with canvas taking remaining space
  if (layoutMode === 'side-by-side') {
    const effectiveSidebarWidth = isCollapsed ? 56 : sidebarWidth

    return (
      <div className="flex w-screen h-screen bg-background overflow-hidden selection:bg-accent selection:text-black">
        {/* Canvas container - takes remaining space, min 300px */}
        <div
          className="relative flex-1 h-full"
          style={{ minWidth: `${MIN_CANVAS_WIDTH}px` }}
        >
          {/* Canvas Layer */}
          <div className="absolute inset-0">
            {children || (
              <div className="w-full h-full flex items-center justify-center">
                <p className="text-text-secondary text-lg font-mono tracking-widest">
                  INITIALIZING VISUALIZER...
                </p>
              </div>
            )}
          </div>

          {/* Floating Header - positioned within canvas area */}
          {showHeader && (
            <header className="absolute top-4 left-4 z-40 pointer-events-none">
              <div className="glass-panel px-6 py-3 rounded-full pointer-events-auto flex items-center gap-4">
                <h1 className="text-sm font-bold tracking-[0.2em] text-text-primary">
                  <span className="text-accent">{appTitle.charAt(0)}</span>
                  {appTitle.slice(1).toUpperCase()}
                </h1>
                <div className="h-3 w-[1px] bg-border/20" />
                <span className="text-xs font-mono text-text-secondary">v0.1.0</span>
              </div>
            </header>
          )}
        </div>

        {/* Sidebar - fixed width, flex-shrink-0 */}
        <div
          className="flex-shrink-0 h-full p-4 pl-0 transition-[width] duration-300"
          style={{ width: `${effectiveSidebarWidth + 16}px` }}
        >
          <Sidebar layoutMode={layoutMode} />
        </div>
      </div>
    )
  }

  // Overlay layout: original behavior - canvas fills viewport, sidebar floats
  return (
    <div className="relative w-screen h-screen bg-background overflow-hidden selection:bg-accent selection:text-black">
      {/* Background/Canvas Layer */}
      <div className="absolute inset-0 z-0">
        {children || (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-text-secondary text-lg font-mono tracking-widest">
              INITIALIZING VISUALIZER...
            </p>
          </div>
        )}
      </div>

      {/* Floating Header */}
      {showHeader && (
        <header className="absolute top-4 left-4 z-40 pointer-events-none">
          <div className="glass-panel px-6 py-3 rounded-full pointer-events-auto flex items-center gap-4">
            <h1 className="text-sm font-bold tracking-[0.2em] text-text-primary">
              <span className="text-accent">{appTitle.charAt(0)}</span>
              {appTitle.slice(1).toUpperCase()}
            </h1>
            <div className="h-3 w-[1px] bg-border/20" />
            <span className="text-xs font-mono text-text-secondary">v0.1.0</span>
          </div>
        </header>
      )}

      {/* Control panel (Floating HUD) */}
      <Sidebar layoutMode={layoutMode} />
    </div>
  )
}
