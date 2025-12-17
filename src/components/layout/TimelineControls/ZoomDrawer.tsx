/**
 * ZoomDrawer Component
 *
 * Zoom controls for Mandelbulb fractal, displayed in the
 * TimelineControls bottom drawer.
 *
 * Features:
 * - Core Zoom: Enable/disable, zoom level, speed
 * - Animation: Continuous or target-based zoom
 * - Autopilot: Three strategies for void avoidance
 *   - Center-Ray Lock (default, minimal performance impact)
 *   - Interest Score (higher quality autopilot)
 *   - Boundary Target (classic Mandelbrot style)
 *
 * @see docs/mandelbulb_zoom_rotation_notes.md
 */

import React, { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useExtendedObjectStore } from '@/stores/extendedObjectStore'
import { ToggleButton } from '@/components/ui/ToggleButton'
import { AnimationDrawerContainer } from './AnimationDrawerContainer'
import type { MandelbulbAutopilotStrategy } from '@/lib/geometry/extended/types'

/**
 * ZoomDrawer component
 *
 * Renders zoom controls for Mandelbulb fractals within
 * the timeline drawer. Provides controls for zoom level,
 * animation, and autopilot void avoidance.
 *
 * @returns React component
 */
export const ZoomDrawer: React.FC = React.memo(() => {
  // UI state for collapsible sections
  const [showStrategySettings, setShowStrategySettings] = useState(false)

  // Get config and setters from store
  const {
    config,
    // Core Zoom
    setZoomEnabled,
    setZoom,
    setZoomSpeed,
    // Animation
    setZoomAnimationEnabled,
    setZoomAnimationMode,
    setZoomTargetLevel,
    // Autopilot
    setAutopilotEnabled,
    setAutopilotStrategy,
    // Strategy A: Center-Ray Lock
    setCenterRayProbeSize,
    setCenterRayProbeFrequency,
    setCenterRayMissThreshold,
    setCenterRayNudgeStrength,
    // Strategy B: Interest Score
    setInterestScoreResolution,
    setInterestScoreInterval,
    setInterestScoreCandidates: _setInterestScoreCandidates,  // Reserved for advanced UI
    setInterestScoreNudgeRadius: _setInterestScoreNudgeRadius,  // Reserved for advanced UI
    setInterestScoreMetric,
    // Strategy C: Boundary Target
    setBoundaryTargetEscapeRatio,
    setBoundaryTargetBand,
    setBoundaryTargetCorrectionStrength,
    // Reset
    resetZoom,
  } = useExtendedObjectStore(
    useShallow((state) => ({
      config: state.mandelbulb,
      // Core Zoom
      setZoomEnabled: state.setMandelbulbZoomEnabled,
      setZoom: state.setMandelbulbZoom,
      setZoomSpeed: state.setMandelbulbZoomSpeed,
      // Animation
      setZoomAnimationEnabled: state.setMandelbulbZoomAnimationEnabled,
      setZoomAnimationMode: state.setMandelbulbZoomAnimationMode,
      setZoomTargetLevel: state.setMandelbulbZoomTargetLevel,
      // Autopilot
      setAutopilotEnabled: state.setMandelbulbAutopilotEnabled,
      setAutopilotStrategy: state.setMandelbulbAutopilotStrategy,
      // Strategy A: Center-Ray Lock
      setCenterRayProbeSize: state.setMandelbulbCenterRayProbeSize,
      setCenterRayProbeFrequency: state.setMandelbulbCenterRayProbeFrequency,
      setCenterRayMissThreshold: state.setMandelbulbCenterRayMissThreshold,
      setCenterRayNudgeStrength: state.setMandelbulbCenterRayNudgeStrength,
      // Strategy B: Interest Score
      setInterestScoreResolution: state.setMandelbulbInterestScoreResolution,
      setInterestScoreInterval: state.setMandelbulbInterestScoreInterval,
      setInterestScoreCandidates: state.setMandelbulbInterestScoreCandidates,
      setInterestScoreNudgeRadius: state.setMandelbulbInterestScoreNudgeRadius,
      setInterestScoreMetric: state.setMandelbulbInterestScoreMetric,
      // Strategy C: Boundary Target
      setBoundaryTargetEscapeRatio: state.setMandelbulbBoundaryTargetEscapeRatio,
      setBoundaryTargetBand: state.setMandelbulbBoundaryTargetBand,
      setBoundaryTargetCorrectionStrength: state.setMandelbulbBoundaryTargetCorrectionStrength,
      // Reset
      resetZoom: state.resetMandelbulbZoom,
    }))
  )

  // Format zoom level for display (show as "Nx" multiplier)
  const formatZoom = (z: number): string => {
    if (z >= 1000) return `${(z / 1000).toFixed(1)}K`
    if (z >= 1) return `${z.toFixed(1)}x`
    return `${z.toFixed(3)}x`
  }

  // Strategy labels
  const strategyLabels: Record<MandelbulbAutopilotStrategy, string> = {
    centerRayLock: 'Center-Ray Lock',
    interestScore: 'Interest Score',
    boundaryTarget: 'Boundary Target',
  }

  return (
    <AnimationDrawerContainer data-testid="zoom-drawer">
      {/* Core Zoom Controls */}
      <div className="space-y-4" data-testid="zoom-panel-core">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">
            Zoom
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={resetZoom}
              className="text-[10px] uppercase font-medium text-text-secondary hover:text-text-primary hover:bg-white/10 px-2 py-0.5 rounded transition-colors"
              aria-label="Reset zoom"
            >
              Reset
            </button>
            <ToggleButton
              pressed={config.zoomEnabled}
              onToggle={() => setZoomEnabled(!config.zoomEnabled)}
              className="text-xs px-2 py-1 h-auto"
              ariaLabel="Toggle zoom"
            >
              {config.zoomEnabled ? 'ON' : 'OFF'}
            </ToggleButton>
          </div>
        </div>

        <div className={`space-y-3 ${!config.zoomEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
          {/* Zoom Level (log scale slider) */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary w-12">Level</span>
            <input
              type="range"
              min={-3}
              max={10}
              step={0.1}
              value={config.logZoom}
              onChange={(e) => setZoom(Math.exp(parseFloat(e.target.value)))}
              className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer"
              aria-label="Zoom level"
            />
            <span className="text-xs font-mono w-12 text-right">
              {formatZoom(config.zoom)}
            </span>
          </div>

          {/* Zoom Speed */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary w-12">Speed</span>
            <input
              type="range"
              min={0.1}
              max={2.0}
              step={0.1}
              value={config.zoomSpeed}
              onChange={(e) => setZoomSpeed(parseFloat(e.target.value))}
              className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer"
              aria-label="Zoom speed"
            />
            <span className="text-xs font-mono w-12 text-right">
              {config.zoomSpeed.toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Animation Controls */}
      {config.zoomEnabled && (
        <div className="space-y-4" data-testid="zoom-panel-animation">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">
              Animation
            </label>
            <ToggleButton
              pressed={config.zoomAnimationEnabled}
              onToggle={() => setZoomAnimationEnabled(!config.zoomAnimationEnabled)}
              className="text-xs px-2 py-1 h-auto"
              ariaLabel="Toggle zoom animation"
            >
              {config.zoomAnimationEnabled ? 'ON' : 'OFF'}
            </ToggleButton>
          </div>

          <div className={`space-y-3 ${!config.zoomAnimationEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
            {/* Mode Selection */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-text-secondary w-12">Mode</span>
              <div className="flex-1 flex gap-2">
                <button
                  onClick={() => setZoomAnimationMode('continuous')}
                  className={`flex-1 text-xs px-2 py-1 rounded transition-colors ${
                    config.zoomAnimationMode === 'continuous'
                      ? 'bg-accent/20 text-accent'
                      : 'bg-white/5 text-text-secondary hover:bg-white/10'
                  }`}
                  aria-label="Continuous zoom"
                >
                  Continuous
                </button>
                <button
                  onClick={() => setZoomAnimationMode('target')}
                  className={`flex-1 text-xs px-2 py-1 rounded transition-colors ${
                    config.zoomAnimationMode === 'target'
                      ? 'bg-accent/20 text-accent'
                      : 'bg-white/5 text-text-secondary hover:bg-white/10'
                  }`}
                  aria-label="Target zoom"
                >
                  To Target
                </button>
              </div>
            </div>

            {/* Target Level (only shown in target mode) */}
            {config.zoomAnimationMode === 'target' && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-text-secondary w-12">Target</span>
                <input
                  type="range"
                  min={0}
                  max={14}
                  step={0.5}
                  value={Math.log(config.zoomTargetLevel)}
                  onChange={(e) => setZoomTargetLevel(Math.exp(parseFloat(e.target.value)))}
                  className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer"
                  aria-label="Target zoom level"
                />
                <span className="text-xs font-mono w-12 text-right">
                  {formatZoom(config.zoomTargetLevel)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Autopilot Controls */}
      {config.zoomEnabled && (
        <div className="space-y-4" data-testid="zoom-panel-autopilot">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">
              Autopilot
            </label>
            <ToggleButton
              pressed={config.autopilotEnabled}
              onToggle={() => setAutopilotEnabled(!config.autopilotEnabled)}
              className="text-xs px-2 py-1 h-auto"
              ariaLabel="Toggle autopilot"
            >
              {config.autopilotEnabled ? 'ON' : 'OFF'}
            </ToggleButton>
          </div>

          <div className={`space-y-3 ${!config.autopilotEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
            {/* Strategy Selection */}
            <div className="space-y-2">
              <span className="text-xs text-text-secondary">Strategy</span>
              <div className="flex flex-col gap-1">
                {(['centerRayLock', 'interestScore', 'boundaryTarget'] as MandelbulbAutopilotStrategy[]).map((strategy) => (
                  <button
                    key={strategy}
                    onClick={() => setAutopilotStrategy(strategy)}
                    className={`text-xs px-3 py-1.5 rounded text-left transition-colors flex items-center justify-between ${
                      config.autopilotStrategy === strategy
                        ? 'bg-accent/20 text-accent'
                        : 'bg-white/5 text-text-secondary hover:bg-white/10'
                    }`}
                    aria-label={`Select ${strategyLabels[strategy]} strategy`}
                  >
                    <span>{strategyLabels[strategy]}</span>
                    {strategy === 'centerRayLock' && config.autopilotStrategy !== strategy && (
                      <span className="text-[10px] opacity-60">(Recommended)</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Strategy Settings Toggle */}
            <button
              onClick={() => setShowStrategySettings(!showStrategySettings)}
              className="text-xs text-text-secondary hover:text-text-primary flex items-center gap-1 transition-colors"
              aria-label="Toggle advanced settings"
            >
              <span className={`transform transition-transform ${showStrategySettings ? 'rotate-90' : ''}`}>
                ▶
              </span>
              <span>Advanced Settings</span>
            </button>

            {/* Strategy-specific Settings */}
            {showStrategySettings && (
              <div className="pl-2 border-l border-panel-border space-y-3">
                {/* Strategy A: Center-Ray Lock Settings */}
                {config.autopilotStrategy === 'centerRayLock' && (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-text-secondary w-16">Probe Size</span>
                      <div className="flex-1 flex gap-1">
                        {([1, 4, 16] as const).map((size) => (
                          <button
                            key={size}
                            onClick={() => setCenterRayProbeSize(size)}
                            className={`flex-1 text-xs px-2 py-0.5 rounded ${
                              config.centerRayProbeSize === size
                                ? 'bg-accent/20 text-accent'
                                : 'bg-white/5 text-text-secondary hover:bg-white/10'
                            }`}
                          >
                            {size === 1 ? '1×1' : size === 4 ? '2×2' : '4×4'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-text-secondary w-16">Probe Hz</span>
                      <input
                        type="range"
                        min={10}
                        max={30}
                        step={1}
                        value={config.centerRayProbeFrequency}
                        onChange={(e) => setCenterRayProbeFrequency(parseFloat(e.target.value))}
                        className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer"
                      />
                      <span className="text-xs font-mono w-8 text-right">{config.centerRayProbeFrequency}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-text-secondary w-16">Miss Thr.</span>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={config.centerRayMissThreshold}
                        onChange={(e) => setCenterRayMissThreshold(parseFloat(e.target.value))}
                        className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer"
                      />
                      <span className="text-xs font-mono w-8 text-right">{config.centerRayMissThreshold.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-text-secondary w-16">Nudge</span>
                      <input
                        type="range"
                        min={0}
                        max={0.1}
                        step={0.005}
                        value={config.centerRayNudgeStrength}
                        onChange={(e) => setCenterRayNudgeStrength(parseFloat(e.target.value))}
                        className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer"
                      />
                      <span className="text-xs font-mono w-8 text-right">{config.centerRayNudgeStrength.toFixed(3)}</span>
                    </div>
                  </>
                )}

                {/* Strategy B: Interest Score Settings */}
                {config.autopilotStrategy === 'interestScore' && (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-text-secondary w-16">Resolution</span>
                      <div className="flex-1 flex gap-1">
                        {([32, 64, 128] as const).map((res) => (
                          <button
                            key={res}
                            onClick={() => setInterestScoreResolution(res)}
                            className={`flex-1 text-xs px-2 py-0.5 rounded ${
                              config.interestScoreResolution === res
                                ? 'bg-accent/20 text-accent'
                                : 'bg-white/5 text-text-secondary hover:bg-white/10'
                            }`}
                          >
                            {res}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-text-secondary w-16">Interval</span>
                      <input
                        type="range"
                        min={1}
                        max={120}
                        step={1}
                        value={config.interestScoreInterval}
                        onChange={(e) => setInterestScoreInterval(parseFloat(e.target.value))}
                        className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer"
                      />
                      <span className="text-xs font-mono w-8 text-right">{config.interestScoreInterval}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-text-secondary w-16">Metric</span>
                      <select
                        value={config.interestScoreMetric}
                        onChange={(e) => setInterestScoreMetric(e.target.value as 'hitRatio' | 'variance' | 'edgeStrength')}
                        className="flex-1 text-xs bg-panel-border text-text-primary px-2 py-1 rounded"
                      >
                        <option value="hitRatio">Hit Ratio</option>
                        <option value="variance">Variance</option>
                        <option value="edgeStrength">Edge Strength</option>
                      </select>
                    </div>
                  </>
                )}

                {/* Strategy C: Boundary Target Settings */}
                {config.autopilotStrategy === 'boundaryTarget' && (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-text-secondary w-16">Target</span>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={config.boundaryTargetEscapeRatio}
                        onChange={(e) => setBoundaryTargetEscapeRatio(parseFloat(e.target.value))}
                        className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer"
                      />
                      <span className="text-xs font-mono w-8 text-right">{config.boundaryTargetEscapeRatio.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-text-secondary w-16">Band</span>
                      <input
                        type="range"
                        min={0.1}
                        max={0.3}
                        step={0.02}
                        value={config.boundaryTargetBand}
                        onChange={(e) => setBoundaryTargetBand(parseFloat(e.target.value))}
                        className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer"
                      />
                      <span className="text-xs font-mono w-8 text-right">{config.boundaryTargetBand.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-text-secondary w-16">Correction</span>
                      <input
                        type="range"
                        min={0.01}
                        max={0.1}
                        step={0.01}
                        value={config.boundaryTargetCorrectionStrength}
                        onChange={(e) => setBoundaryTargetCorrectionStrength(parseFloat(e.target.value))}
                        className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer"
                      />
                      <span className="text-xs font-mono w-8 text-right">{config.boundaryTargetCorrectionStrength.toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </AnimationDrawerContainer>
  )
})

ZoomDrawer.displayName = 'ZoomDrawer'
