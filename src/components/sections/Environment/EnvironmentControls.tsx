/**
 * Environment Controls Component
 * Controls for scene environment settings (background, ground plane, grid, axis helper)
 * Organized into tabs: Walls (surface/grid) and Misc (helpers)
 */

import { MultiToggleGroup } from '@/components/ui/MultiToggleGroup';
import { Select } from '@/components/ui/Select';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { Tabs } from '@/components/ui/Tabs';
import { type GroundPlaneType, type WallPosition } from '@/stores/defaults/visualDefaults'; // Types can stay or move if exported from environmentStore
import { useEnvironmentStore } from '@/stores/environmentStore';
import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { SkyboxControls } from './SkyboxControls';

/** Options for wall position toggle group */
const WALL_OPTIONS: { value: WallPosition; label: string }[] = [
  { value: 'floor', label: 'Floor' },
  { value: 'back', label: 'Back' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'top', label: 'Top' },
];

/** Options for surface type select */
const SURFACE_TYPE_OPTIONS: { value: GroundPlaneType; label: string }[] = [
  { value: 'two-sided', label: 'Two-Sided' },
  { value: 'plane', label: 'Plane' },
];

export interface EnvironmentControlsProps {
  className?: string;
}

export const EnvironmentControls: React.FC<EnvironmentControlsProps> = React.memo(({
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState('walls');

  const {
    activeWalls,
    groundPlaneOffset,
    groundPlaneColor,
    groundPlaneType,
    groundPlaneSizeScale,
    showGroundGrid,
    groundGridColor,
    groundGridSpacing,
    groundMaterialRoughness,
    groundMaterialMetalness,
    groundMaterialEnvMapIntensity,
    setActiveWalls,
    setGroundPlaneOffset,
    setGroundPlaneColor,
    setGroundPlaneType,
    setGroundPlaneSizeScale,
    setShowGroundGrid,
    setGroundGridColor,
    setGroundGridSpacing,
    setGroundMaterialRoughness,
    setGroundMaterialMetalness,
    setGroundMaterialEnvMapIntensity,
  } = useEnvironmentStore(
    useShallow((state) => ({
      activeWalls: state.activeWalls,
      groundPlaneOffset: state.groundPlaneOffset,
      groundPlaneColor: state.groundPlaneColor,
      groundPlaneType: state.groundPlaneType,
      groundPlaneSizeScale: state.groundPlaneSizeScale,
      showGroundGrid: state.showGroundGrid,
      groundGridColor: state.groundGridColor,
      groundGridSpacing: state.groundGridSpacing,
      groundMaterialRoughness: state.groundMaterialRoughness,
      groundMaterialMetalness: state.groundMaterialMetalness,
      groundMaterialEnvMapIntensity: state.groundMaterialEnvMapIntensity,
      setActiveWalls: state.setActiveWalls,
      setGroundPlaneOffset: state.setGroundPlaneOffset,
      setGroundPlaneColor: state.setGroundPlaneColor,
      setGroundPlaneType: state.setGroundPlaneType,
      setGroundPlaneSizeScale: state.setGroundPlaneSizeScale,
      setShowGroundGrid: state.setShowGroundGrid,
      setGroundGridColor: state.setGroundGridColor,
      setGroundGridSpacing: state.setGroundGridSpacing,
      setGroundMaterialRoughness: state.setGroundMaterialRoughness,
      setGroundMaterialMetalness: state.setGroundMaterialMetalness,
      setGroundMaterialEnvMapIntensity: state.setGroundMaterialEnvMapIntensity,
    }))
  );

  /**
   * Walls tab content - ground plane and grid settings
   * @param e
   */
  const wallsContent = (
    <div className="space-y-4">
      {/* Wall Selection Toggle Group */}
      <MultiToggleGroup
        options={WALL_OPTIONS}
        value={activeWalls}
        onChange={setActiveWalls}
        label="Visible Walls"
        ariaLabel="Select which walls to display"
      />

      {/* Distance Offset */}
      <Slider
        label="Distance Offset"
        value={groundPlaneOffset}
        min={0}
        max={10}
        step={0.5}
        onChange={setGroundPlaneOffset}
        tooltip="Additional distance offset for walls from center"
      />

      {/* Surface Color */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-text-secondary">
          Surface Color
        </label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={groundPlaneColor}
            onChange={(e) => setGroundPlaneColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border border-panel-border"
            aria-label="Surface Color"
          />
          <span className="text-xs font-mono text-text-secondary">{groundPlaneColor}</span>
        </div>
      </div>

      {/* Surface Type */}
      <Select
        label="Surface Type"
        options={SURFACE_TYPE_OPTIONS}
        value={groundPlaneType}
        onChange={setGroundPlaneType}
      />

      {/* Surface Size */}
      <Slider
        label="Surface Size"
        value={groundPlaneSizeScale}
        min={1}
        max={10}
        step={0.5}
        onChange={setGroundPlaneSizeScale}
        tooltip="Scale multiplier for ground surface size"
      />

      {/* Grid Toggle */}
      <Switch
        checked={showGroundGrid}
        onCheckedChange={setShowGroundGrid}
        label="Show Grid"
      />

      {/* Grid Color */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-text-secondary">
          Grid Color
        </label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={groundGridColor}
            onChange={(e) => setGroundGridColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border border-panel-border"
            aria-label="Grid Color"
          />
          <span className="text-xs font-mono text-text-secondary">{groundGridColor}</span>
        </div>
      </div>

      {/* Grid Spacing */}
      <Slider
        label="Grid Spacing"
        value={groundGridSpacing}
        min={0.5}
        max={5}
        step={0.5}
        onChange={setGroundGridSpacing}
        tooltip="Distance between grid lines"
      />

      {/* --- Material Subsection --- */}
      <div className="flex items-center justify-between border-b border-panel-border pb-2 mt-4">
        <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Wall Material</span>
      </div>

      {/* Roughness */}
      <Slider
        label="Roughness"
        value={groundMaterialRoughness}
        min={0}
        max={1}
        step={0.05}
        onChange={setGroundMaterialRoughness}
        tooltip="Surface roughness (0 = sharp reflections, 1 = matte)"
      />

      {/* Metalness */}
      <Slider
        label="Metalness"
        value={groundMaterialMetalness}
        min={0}
        max={1}
        step={0.05}
        onChange={setGroundMaterialMetalness}
        tooltip="Metallic appearance (0 = plastic, 1 = metal)"
      />

      {/* Environment Map Intensity */}
      <Slider
        label="Env Reflection"
        value={groundMaterialEnvMapIntensity}
        min={0}
        max={2}
        step={0.1}
        onChange={setGroundMaterialEnvMapIntensity}
        tooltip="Brightness of reflections (requires low Roughness to be visible)"
      />
    </div>
  );

  return (
    <div className={className}>
      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        data-testid="env-controls"
        tabs={[
          { id: 'walls', label: 'Walls', content: wallsContent },
          { id: 'skybox', label: 'Skybox', content: <SkyboxControls /> },
        ]}
      />
    </div>
  );
});
