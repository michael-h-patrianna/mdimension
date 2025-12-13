/**
 * Environment Controls Component
 * Controls for scene environment settings (background, ground plane, grid, axis helper)
 * Organized into tabs: Walls (surface/grid) and Misc (helpers)
 */

import { Switch } from '@/components/ui/Switch';
import { Select } from '@/components/ui/Select';
import { Slider } from '@/components/ui/Slider';
import { Tabs } from '@/components/ui/Tabs';
import { useVisualStore, type GroundPlaneType } from '@/stores/visualStore';
import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

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
    showGroundPlane,
    groundPlaneColor,
    groundPlaneType,
    showGroundGrid,
    groundGridColor,
    groundGridSpacing,
    groundMaterialRoughness,
    groundMaterialMetalness,
    groundMaterialEnvMapIntensity,
    showAxisHelper,
    setShowGroundPlane,
    setGroundPlaneColor,
    setGroundPlaneType,
    setShowGroundGrid,
    setGroundGridColor,
    setGroundGridSpacing,
    setGroundMaterialRoughness,
    setGroundMaterialMetalness,
    setGroundMaterialEnvMapIntensity,
    setShowAxisHelper,
  } = useVisualStore(
    useShallow((state) => ({
      showGroundPlane: state.showGroundPlane,
      groundPlaneColor: state.groundPlaneColor,
      groundPlaneType: state.groundPlaneType,
      showGroundGrid: state.showGroundGrid,
      groundGridColor: state.groundGridColor,
      groundGridSpacing: state.groundGridSpacing,
      groundMaterialRoughness: state.groundMaterialRoughness,
      groundMaterialMetalness: state.groundMaterialMetalness,
      groundMaterialEnvMapIntensity: state.groundMaterialEnvMapIntensity,
      showAxisHelper: state.showAxisHelper,
      setShowGroundPlane: state.setShowGroundPlane,
      setGroundPlaneColor: state.setGroundPlaneColor,
      setGroundPlaneType: state.setGroundPlaneType,
      setShowGroundGrid: state.setShowGroundGrid,
      setGroundGridColor: state.setGroundGridColor,
      setGroundGridSpacing: state.setGroundGridSpacing,
      setGroundMaterialRoughness: state.setGroundMaterialRoughness,
      setGroundMaterialMetalness: state.setGroundMaterialMetalness,
      setGroundMaterialEnvMapIntensity: state.setGroundMaterialEnvMapIntensity,
      setShowAxisHelper: state.setShowAxisHelper,
    }))
  );

  /** Walls tab content - ground plane and grid settings */
  const wallsContent = (
    <div className="space-y-4">
      {/* Ground Plane Toggle */}
      <Switch
        checked={showGroundPlane}
        onCheckedChange={setShowGroundPlane}
        label="Show Ground Plane"
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
    </div>
  );

  /** Material tab content - shared material properties for ground surfaces */
  const materialContent = (
    <div className="space-y-4">
      {/* Roughness */}
      <Slider
        label="Roughness"
        value={groundMaterialRoughness}
        min={0}
        max={1}
        step={0.05}
        onChange={setGroundMaterialRoughness}
        tooltip="Surface roughness (0 = mirror-like, 1 = matte)"
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
        tooltip="Environment map reflection intensity"
      />
    </div>
  );

  /** Misc tab content - axis helper and other utilities */
  const miscContent = (
    <div className="space-y-4">
      {/* Axis Helper Toggle */}
      <Switch
        checked={showAxisHelper}
        onCheckedChange={setShowAxisHelper}
        label="Show Axis Helper"
      />
    </div>
  );

  return (
    <div className={className}>
      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'walls', label: 'Walls', content: wallsContent },
          { id: 'material', label: 'Material', content: materialContent },
          { id: 'misc', label: 'Misc', content: miscContent },
        ]}
      />
    </div>
  );
});
