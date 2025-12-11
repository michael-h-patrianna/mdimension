/**
 * Cross-Section Controls Component
 * Controls for visualizing cross-sections of 4D+ objects
 */

import React from 'react';
import { Slider } from '@/components/ui/Slider';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import {
  useCrossSectionStore,
  MIN_SLICE_W,
  MAX_SLICE_W,
  DEFAULT_SLICE_W,
} from '@/stores/crossSectionStore';
import { useGeometryStore } from '@/stores/geometryStore';

export interface CrossSectionControlsProps {
  className?: string;
}

export const CrossSectionControls: React.FC<CrossSectionControlsProps> = ({
  className = '',
}) => {
  const dimension = useGeometryStore((state) => state.dimension);

  const enabled = useCrossSectionStore((state) => state.enabled);
  const sliceW = useCrossSectionStore((state) => state.sliceW);
  const showOriginal = useCrossSectionStore((state) => state.showOriginal);
  const originalOpacity = useCrossSectionStore((state) => state.originalOpacity);
  const animateSlice = useCrossSectionStore((state) => state.animateSlice);

  const toggle = useCrossSectionStore((state) => state.toggle);
  const setSliceW = useCrossSectionStore((state) => state.setSliceW);
  const setShowOriginal = useCrossSectionStore((state) => state.setShowOriginal);
  const setOriginalOpacity = useCrossSectionStore((state) => state.setOriginalOpacity);
  const setAnimateSlice = useCrossSectionStore((state) => state.setAnimateSlice);
  const reset = useCrossSectionStore((state) => state.reset);

  // Cross-section only works for 4D+ objects
  const isSupported = dimension >= 4;

  if (!isSupported) {
    return (
      <div className={`space-y-2 ${className}`}>
        <p className="text-text-secondary text-sm">
          Cross-sections require 4D or higher dimensions.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Enable Toggle */}
      <div className="flex items-center gap-2">
        <Button
          variant={enabled ? 'primary' : 'secondary'}
          size="sm"
          onClick={toggle}
          className="flex-1"
        >
          {enabled ? 'Disable' : 'Enable'} Cross-Section
        </Button>
      </div>

      {enabled && (
        <>
          {/* Info */}
          <Tooltip
            content="Slices the 4D object with a 3D hyperplane at W = value, showing the 3D cross-section"
            position="top"
          >
            <p className="text-xs text-text-secondary">
              Move the slice through the W dimension to see different 3D cross-sections
            </p>
          </Tooltip>

          {/* Slice Position */}
          <Slider
            label="Slice W Position"
            min={MIN_SLICE_W}
            max={MAX_SLICE_W}
            step={0.05}
            value={sliceW}
            onChange={setSliceW}
            onReset={() => setSliceW(DEFAULT_SLICE_W)}
            showValue
          />

          {/* Animate Slice */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAnimateSlice(!animateSlice)}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors
                ${animateSlice
                  ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/50'
                  : 'bg-panel-border text-text-secondary border border-panel-border'
                }
              `}
              aria-pressed={animateSlice}
            >
              <span>{animateSlice ? '⏸' : '▶'}</span>
              <span>Animate Slice</span>
            </button>
          </div>

          {/* Show Original */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowOriginal(!showOriginal)}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors
                ${showOriginal
                  ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/50'
                  : 'bg-panel-border text-text-secondary border border-panel-border'
                }
              `}
              aria-pressed={showOriginal}
            >
              <span>Show Original</span>
            </button>
          </div>

          {/* Original Opacity */}
          {showOriginal && (
            <Slider
              label="Original Opacity"
              min={0}
              max={1}
              step={0.05}
              value={originalOpacity}
              onChange={setOriginalOpacity}
              onReset={() => setOriginalOpacity(0.3)}
              showValue
            />
          )}

          {/* Reset */}
          <Button
            variant="secondary"
            size="sm"
            onClick={reset}
            className="w-full"
          >
            Reset Cross-Section
          </Button>
        </>
      )}
    </div>
  );
};
