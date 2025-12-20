/**
 * Visual Controls Component
 * Controls for customizing the visual appearance of polytopes edges and raymarching rim lighting (which appears as pseudo-edges).
 */

import { Slider } from '@/components/ui/Slider';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { ControlGroup } from '@/components/ui/ControlGroup';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { useGeometryStore } from '@/stores/geometryStore';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { EdgeMaterialControls } from './EdgeMaterialControls';

export interface EdgesControlsProps {
  className?: string;
}

export const EdgeControls: React.FC<EdgesControlsProps> = React.memo(({
  className = '',
}) => {
  const objectType = useGeometryStore(state => state.objectType);
  
  // Consolidate visual store selectors with useShallow to reduce subscriptions
  const appearanceSelector = useShallow((state: any) => ({
    edgeColor: state.edgeColor,
    edgeThickness: state.edgeThickness,
    setEdgeColor: state.setEdgeColor,
    setEdgeThickness: state.setEdgeThickness,
  }));
  const {
    edgeColor,
    edgeThickness,
    setEdgeColor,
    setEdgeThickness,
  } = useAppearanceStore(appearanceSelector);

  // Schrödinger specific controls
  const extendedObjectSelector = useShallow((state: any) => ({
    config: state.schroedinger,
    setErosionStrength: state.setSchroedingerErosionStrength,
    setErosionScale: state.setSchroedingerErosionScale,
    setErosionTurbulence: state.setSchroedingerErosionTurbulence,
    setErosionNoiseType: state.setSchroedingerErosionNoiseType,
  }));
  const {
    config,
    setErosionStrength,
    setErosionScale,
    setErosionTurbulence,
    setErosionNoiseType
  } = useExtendedObjectStore(extendedObjectSelector);

  return (
    <div className={`space-y-4 ${className}`}>
      <ControlGroup title="Appearance" defaultOpen>
        {/* Edge Color */}
        <ColorPicker
            label="Edge Color"
            value={edgeColor}
            onChange={setEdgeColor}
            disableAlpha={true}
        />

        {/* Edge Thickness */}
        <Slider
            label="Edge Thickness"
            min={0}
            max={5}
            step={0.1}
            value={edgeThickness}
            onChange={setEdgeThickness}
            showValue
        />
      </ControlGroup>

      {/* Edge Material Controls (only visible when thickness > 1) */}
      <EdgeMaterialControls />

      {/* Schrödinger Edge Erosion */}
      {objectType === 'schroedinger' && (
        <ControlGroup title="Edge Erosion" collapsible defaultOpen={false}>
            <Slider
                label="Strength"
                min={0.0}
                max={1.0}
                step={0.05}
                value={config.erosionStrength ?? 0.0}
                onChange={setErosionStrength}
                showValue
                data-testid="schroedinger-erosion-strength"
            />
            {config.erosionStrength > 0 && (
                <>
                    <Slider
                        label="Scale"
                        min={0.25}
                        max={4.0}
                        step={0.25}
                        value={config.erosionScale ?? 1.0}
                        onChange={setErosionScale}
                        showValue
                        data-testid="schroedinger-erosion-scale"
                    />
                    <Slider
                        label="Turbulence"
                        min={0.0}
                        max={1.0}
                        step={0.1}
                        value={config.erosionTurbulence ?? 0.5}
                        onChange={setErosionTurbulence}
                        showValue
                        data-testid="schroedinger-erosion-turbulence"
                    />
                    <div className="pt-2">
                        <label className="text-xs text-text-secondary">Noise Type</label>
                        <select 
                            className="w-full bg-surface-dark border border-white/10 rounded px-2 py-1 text-xs text-text-primary mt-1 focus:outline-none focus:border-accent"
                            value={config.erosionNoiseType ?? 0}
                            onChange={(e) => setErosionNoiseType(parseInt(e.target.value))}
                            data-testid="schroedinger-erosion-type"
                        >
                            <option value={0}>Worley (Cloudy)</option>
                            <option value={1}>Perlin (Smooth)</option>
                            <option value={2}>Hybrid (Billowy)</option>
                        </select>
                    </div>
                </>
            )}
        </ControlGroup>
      )}
    </div>
  );
});
