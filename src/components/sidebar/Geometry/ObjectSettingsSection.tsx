/**
 * ObjectSettingsSection Component
 *
 * Displays type-specific settings for all object types (both polytopes and extended objects).
 * Shows relevant controls based on the currently selected object type.
 *
 * Polytopes:
 * - Hypercube, Simplex, Cross-polytope: scale (0.5-3.0)
 *
 * Extended Objects:
 * - Root System: type (A/D/E8), scale (0.5-2.0), always has edges
 * - Clifford Torus: radius, resolution, edge mode
 * - Mandelbrot Set: quality preset, iterations, escape radius, resolution
 * - Mandelbox: scale, folding limit, radii, iterations, escape radius
 */

import { Select } from '@/components/ui/Select';
import { Slider } from '@/components/ui/Slider';
import {
  DEFAULT_CLIFFORD_TORUS_CONFIG,
  DEFAULT_POLYTOPE_CONFIG,
  DEFAULT_POLYTOPE_SCALES,
  DEFAULT_ROOT_SYSTEM_CONFIG,
} from '@/lib/geometry/extended/types';
import { isPolytopeType } from '@/lib/geometry/types';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useGeometryStore } from '@/stores/geometryStore';
import React from 'react';
import { MandelboxControls } from './MandelboxControls';
import { MandelbrotControls } from './MandelbrotControls';

export interface ObjectSettingsSectionProps {
  className?: string;
}

/**
 * Polytope settings controls.
 *
 * Provides scale control for standard polytopes (hypercube, simplex, cross-polytope).
 * This brings polytopes into alignment with extended objects by providing
 * a unified configuration interface.
 */
function PolytopeSettings() {
  const objectType = useGeometryStore((state) => state.objectType);
  const config = useExtendedObjectStore((state) => state.polytope);
  const setScale = useExtendedObjectStore((state) => state.setPolytopeScale);

  // Get display name for the polytope type
  const typeNames: Record<string, string> = {
    'hypercube': 'Hypercube',
    'simplex': 'Simplex',
    'cross-polytope': 'Cross-Polytope',
  };
  const typeName = typeNames[objectType] ?? 'Polytope';

  // Get type-specific default scale
  const defaultScale = DEFAULT_POLYTOPE_SCALES[objectType] ?? DEFAULT_POLYTOPE_CONFIG.scale;

  // Simplex needs a larger range due to its default of 4.0
  const maxScale = objectType === 'simplex' ? 8.0 : 5.0;

  return (
    <div className="space-y-4">
      {/* Scale slider with type-specific range */}
      <Slider
        label={`${typeName} Scale`}
        min={0.5}
        max={maxScale}
        step={0.1}
        value={config.scale}
        onChange={setScale}
        onReset={() => setScale(defaultScale)}
        showValue
      />
      <p className="text-xs text-text-secondary">
        Vertices in [-scale, scale] per axis.
      </p>
    </div>
  );
}

/**
 * Root System settings controls
 *
 * Root systems always have edges enabled (like polytopes).
 * Provides scale control (0.5-2.0) for adjusting the size of the root system.
 */
function RootSystemSettings() {
  const dimension = useGeometryStore((state) => state.dimension);
  const config = useExtendedObjectStore((state) => state.rootSystem);
  const setRootType = useExtendedObjectStore((state) => state.setRootSystemType);
  const setScale = useExtendedObjectStore((state) => state.setRootSystemScale);

  // Build available root types based on dimension
  const rootTypeOptions = React.useMemo(() => {
    const options: { value: 'A' | 'D' | 'E8'; label: string }[] = [
      { value: 'A', label: `A${dimension - 1} (${dimension * (dimension - 1)} roots)` },
    ];

    // D_n requires n >= 4
    if (dimension >= 4) {
      options.push({
        value: 'D',
        label: `D${dimension} (${2 * dimension * (dimension - 1)} roots)`,
      });
    }

    // E8 requires exactly 8 dimensions
    if (dimension === 8) {
      options.push({ value: 'E8', label: 'E8 (240 roots)' });
    }

    return options;
  }, [dimension]);

  return (
    <div className="space-y-4">
      {/* Root type selection */}
      <Select<'A' | 'D' | 'E8'>
        label="Root System Type"
        options={rootTypeOptions}
        value={config.rootType}
        onChange={setRootType}
      />

      {/* Scale slider */}
      <Slider
        label="Root System Scale"
        min={0.5}
        max={4.0}
        step={0.1}
        value={config.scale}
        onChange={setScale}
        onReset={() => setScale(DEFAULT_ROOT_SYSTEM_CONFIG.scale)}
        showValue
      />
    </div>
  );
}

/**
 * Clifford Torus settings controls
 *
 * Mode is automatically selected based on dimension:
 * - Dimension 4: Classic Clifford torus (T² ⊂ S³ ⊂ ℝ⁴)
 * - Other dimensions: Generalized Clifford torus (Tᵏ ⊂ S^(2k-1) ⊂ ℝ^(2k))
 */
function CliffordTorusSettings() {
  const dimension = useGeometryStore((state) => state.dimension);
  const config = useExtendedObjectStore((state) => state.cliffordTorus);
  const setMode = useExtendedObjectStore((state) => state.setCliffordTorusMode);
  const setRadius = useExtendedObjectStore((state) => state.setCliffordTorusRadius);
  const setResolutionU = useExtendedObjectStore((state) => state.setCliffordTorusResolutionU);
  const setResolutionV = useExtendedObjectStore((state) => state.setCliffordTorusResolutionV);
  const setK = useExtendedObjectStore((state) => state.setCliffordTorusK);
  const setStepsPerCircle = useExtendedObjectStore((state) => state.setCliffordTorusStepsPerCircle);

  // Determine mode based on dimension: classic for 4D, generalized otherwise
  const isClassicMode = dimension === 4;
  const effectiveMode = isClassicMode ? 'classic' : 'generalized';

  // Update store mode when dimension changes (synchronize with UI logic)
  React.useEffect(() => {
    if (config.mode !== effectiveMode) {
      setMode(effectiveMode);
    }
  }, [effectiveMode, config.mode, setMode]);

  // Calculate max k for generalized mode
  const maxK = Math.floor(dimension / 2);

  // Build k options for generalized mode
  const kOptions = React.useMemo(() => {
    const options = [];
    for (let k = 1; k <= maxK; k++) {
      const pointCount = Math.pow(config.stepsPerCircle, k);
      const label = k === 1
        ? `k=1 (circle, ${pointCount} pts)`
        : k === 2
          ? `k=2 (2-torus, ${pointCount} pts)`
          : `k=${k} (${k}-torus, ${pointCount} pts)`;
      options.push({ value: String(k), label });
    }
    return options;
  }, [maxK, config.stepsPerCircle]);

  // Calculate point count for display
  const pointCount = isClassicMode
    ? config.resolutionU * config.resolutionV
    : Math.pow(config.stepsPerCircle, Math.min(config.k, maxK));

  // Info text
  const effectiveK = Math.min(config.k, maxK);
  const infoText = isClassicMode
    ? `${pointCount} vertices on T² ⊂ S³ ⊂ ℝ⁴`
    : `${pointCount} vertices on T${superscript(effectiveK)} ⊂ S${superscript(2 * effectiveK - 1)} ⊂ ℝ${superscript(2 * effectiveK)}`;

  return (
    <div className="space-y-4">
      {/* Mode indicator (read-only) */}
      <div className="text-xs text-text-secondary">
        {isClassicMode ? (
          <span>Classic Clifford Torus (T² on S³)</span>
        ) : (
          <span>Generalized Clifford Torus (Tᵏ on S²ᵏ⁻¹)</span>
        )}
      </div>

      {/* Radius (shared) */}
      <Slider
        label="Radius"
        min={0.5}
        max={6.0}
        step={0.1}
        value={config.radius}
        onChange={setRadius}
        onReset={() => setRadius(DEFAULT_CLIFFORD_TORUS_CONFIG.radius)}
        showValue
      />

      {/* Classic mode settings (dimension === 4) */}
      {isClassicMode && (
        <>
          <Slider
            label="Resolution U"
            min={8}
            max={64}
            step={4}
            value={config.resolutionU}
            onChange={setResolutionU}
            onReset={() => setResolutionU(DEFAULT_CLIFFORD_TORUS_CONFIG.resolutionU)}
            showValue
          />
          <Slider
            label="Resolution V"
            min={8}
            max={64}
            step={4}
            value={config.resolutionV}
            onChange={setResolutionV}
            onReset={() => setResolutionV(DEFAULT_CLIFFORD_TORUS_CONFIG.resolutionV)}
            showValue
          />
        </>
      )}

      {/* Generalized mode settings (dimension !== 4) */}
      {!isClassicMode && (
        <>
          {/* K selection */}
          <Select
            label="Torus Dimension (k)"
            options={kOptions}
            value={String(Math.min(config.k, maxK))}
            onChange={(v) => setK(parseInt(v, 10))}
          />

          {/* Steps per circle */}
          <Slider
            label="Steps Per Circle"
            min={4}
            max={32}
            step={2}
            value={config.stepsPerCircle}
            onChange={setStepsPerCircle}
            onReset={() => setStepsPerCircle(DEFAULT_CLIFFORD_TORUS_CONFIG.stepsPerCircle)}
            showValue
          />

          {effectiveK >= 3 && pointCount > 5000 && (
            <p className="text-xs text-warning">
              High point count ({pointCount}). Consider reducing steps or k.
            </p>
          )}
        </>
      )}



      <p className="text-xs text-text-secondary">{infoText}</p>
    </div>
  );
}

/**
 * Helper function for superscript display in UI
 * @param n
 */
function superscript(n: number): string {
  const map: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  };
  return String(n).split('').map(c => map[c] ?? c).join('');
}

/**
 * Main ObjectSettingsSection component
 *
 * Displays controls specific to the currently selected object type.
 * Now includes settings for all object types (both polytopes and extended objects)
 * for unified control across the application.
 *
 * @param root0 - Component props
 * @param root0.className - Optional CSS class name
 */
export const ObjectSettingsSection: React.FC<ObjectSettingsSectionProps> = ({
  className = '',
}) => {
  const objectType = useGeometryStore((state) => state.objectType);

  return (
    <div className={className} data-testid="object-settings-section">
      {/* Polytope settings (hypercube, simplex, cross-polytope) */}
      {isPolytopeType(objectType) && <PolytopeSettings />}

      {/* Extended object settings */}
      {objectType === 'root-system' && <RootSystemSettings />}
      {objectType === 'clifford-torus' && <CliffordTorusSettings />}
      {objectType === 'mandelbrot' && <MandelbrotControls />}
      {objectType === 'mandelbox' && <MandelboxControls />}
    </div>
  );
};
