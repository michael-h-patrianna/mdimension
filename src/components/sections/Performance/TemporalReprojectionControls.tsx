/**
 * Temporal Reprojection Controls Component
 * Controls for reusing previous frame depth data (fractals only)
 */

import { Switch } from '@/components/ui/Switch';
import { usePerformanceStore } from '@/stores';
import React from 'react';

/**
 * Temporal reprojection controls for the Performance section.
 * Only affects fractal objects (Hyperbulb).
 */
export const TemporalReprojectionControls: React.FC = () => {
  const enabled = usePerformanceStore((s) => s.temporalReprojectionEnabled);
  const setEnabled = usePerformanceStore(
    (s) => s.setTemporalReprojectionEnabled
  );

  return (
    <div className="space-y-2">
      <Switch
        checked={enabled}
        onCheckedChange={setEnabled}
        label="Temporal Reprojection"
        data-testid="temporal-reprojection-toggle"
      />
      <p className="text-xs text-text-tertiary ml-4">
        Fractals only. 30-50% faster during motion.
      </p>
    </div>
  );
};
