/**
 * Environment Controls Component
 * Controls for scene environment settings (background, ground plane, axis helper)
 */

import { useShallow } from 'zustand/react/shallow';
import { ToggleButton } from '@/components/ui/ToggleButton';
import { useVisualStore } from '@/stores/visualStore';
import React from 'react';

export interface EnvironmentControlsProps {
  className?: string;
}

export const EnvironmentControls: React.FC<EnvironmentControlsProps> = React.memo(({
  className = '',
}) => {
  const {
    backgroundColor,
    showGroundPlane,
    showAxisHelper,
    setBackgroundColor,
    setShowGroundPlane,
    setShowAxisHelper,
  } = useVisualStore(
    useShallow((state) => ({
      backgroundColor: state.backgroundColor,
      showGroundPlane: state.showGroundPlane,
      showAxisHelper: state.showAxisHelper,
      setBackgroundColor: state.setBackgroundColor,
      setShowGroundPlane: state.setShowGroundPlane,
      setShowAxisHelper: state.setShowAxisHelper,
    }))
  );

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Background Color */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-text-secondary">
          Background Color
        </label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={backgroundColor}
            onChange={(e) => setBackgroundColor(e.target.value)}
            className="w-10 h-10 rounded cursor-pointer border border-panel-border"
            aria-label="Background Color"
          />
          <span className="text-xs font-mono text-text-secondary">{backgroundColor}</span>
        </div>
      </div>

      {/* Ground Plane Toggle */}
      <ToggleButton
        pressed={showGroundPlane}
        onToggle={setShowGroundPlane}
        ariaLabel="Show Ground Plane"
      >
        Show Ground Plane
      </ToggleButton>

      {/* Axis Helper Toggle */}
      <ToggleButton
        pressed={showAxisHelper}
        onToggle={setShowAxisHelper}
        ariaLabel="Show Axis Helper"
      >
        Show Axis Helper
      </ToggleButton>
    </div>
  );
});
