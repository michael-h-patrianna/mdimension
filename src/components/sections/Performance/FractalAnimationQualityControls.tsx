/**
 * Fractal Animation Quality Controls Component
 * Controls for reducing quality during fractal animation for smoother interaction
 */

import { Switch } from '@/components/ui/Switch';
import { usePerformanceStore } from '@/stores';
import React from 'react';

/**
 * Fractal animation quality controls for the Performance section.
 * When enabled, reduces rendering quality during rotation/animation for smoother interaction.
 * Only affects fractal objects (Mandelbulb, Julia, Schroedinger).
 */
export const FractalAnimationQualityControls: React.FC = () => {
  const enabled = usePerformanceStore((s) => s.fractalAnimationLowQuality);
  const setEnabled = usePerformanceStore((s) => s.setFractalAnimationLowQuality);

  return (
    <div className="space-y-2">
      <Switch
        checked={enabled}
        onCheckedChange={setEnabled}
        label="Lower quality for fractal animation"
        data-testid="fractal-animation-quality-toggle"
      />
      <p className="text-xs text-text-tertiary ml-4">
        Fractals only. Smoother rotation at lower quality.
      </p>
    </div>
  );
};
