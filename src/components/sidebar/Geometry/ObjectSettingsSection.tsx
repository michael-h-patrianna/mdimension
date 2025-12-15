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
  DEFAULT_NESTED_TORUS_CONFIG,
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
import { MengerControls } from './MengerControls';

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
    <div className="space-y-4" data-testid="polytope-settings">
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
        data-testid="polytope-scale"
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
    <div className="space-y-4" data-testid="root-system-settings">
      {/* Root type selection */}
      <Select<'A' | 'D' | 'E8'>
        label="Root System Type"
        options={rootTypeOptions}
        value={config.rootType}
        onChange={setRootType}
        data-testid="root-system-type"
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
        data-testid="root-system-scale"
      />
    </div>
  );
}

/**
 * Clifford Torus settings controls
 *
 * Simplified Clifford Torus settings - flat visualization only.
 * Independent circles in perpendicular planes.
 * @returns Clifford torus settings controls
 */
function CliffordTorusSettings() {
  const dimension = useGeometryStore((state) => state.dimension);
  const config = useExtendedObjectStore((state) => state.cliffordTorus);

  // Flat mode actions
  const setRadius = useExtendedObjectStore((state) => state.setCliffordTorusRadius);
  const setMode = useExtendedObjectStore((state) => state.setCliffordTorusMode);
  const setResolutionU = useExtendedObjectStore((state) => state.setCliffordTorusResolutionU);
  const setResolutionV = useExtendedObjectStore((state) => state.setCliffordTorusResolutionV);
  const setStepsPerCircle = useExtendedObjectStore((state) => state.setCliffordTorusStepsPerCircle);

  // Calculate max k for flat/generalized mode
  const maxK = Math.floor(dimension / 2);

  // Update flat mode internal setting based on dimension
  React.useEffect(() => {
    const effectiveMode = dimension === 4 ? 'classic' : 'generalized';
    if (config.mode !== effectiveMode) {
      setMode(effectiveMode);
    }
  }, [dimension, config.mode, setMode]);

  // Calculate point count
  const getPointCount = () => {
    if (dimension === 4) {
      return config.resolutionU * config.resolutionV;
    }
    return Math.pow(config.stepsPerCircle, Math.min(config.k, maxK));
  };

  const pointCount = getPointCount();

  return (
    <div className="space-y-4" data-testid="clifford-torus-settings">
      {/* Mode description */}
      <div className="text-xs text-text-secondary">
        <span>Independent circles in perpendicular planes</span>
      </div>

      <Slider
        label="Radius"
        min={0.5}
        max={6.0}
        step={0.1}
        value={config.radius}
        onChange={setRadius}
        onReset={() => setRadius(DEFAULT_CLIFFORD_TORUS_CONFIG.radius)}
        showValue
        data-testid="clifford-radius"
      />

      {/* 4D Classic mode */}
      {dimension === 4 && (
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
            data-testid="clifford-res-u"
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
            data-testid="clifford-res-v"
          />
        </>
      )}

      {/* Generalized mode (non-4D) */}
      {dimension !== 4 && (
        <Slider
          label="Steps Per Circle"
          min={4}
          max={32}
          step={2}
          value={config.stepsPerCircle}
          onChange={setStepsPerCircle}
          onReset={() => setStepsPerCircle(DEFAULT_CLIFFORD_TORUS_CONFIG.stepsPerCircle)}
          showValue
          data-testid="clifford-steps"
        />
      )}

      {/* Point count and warnings */}
      <p className="text-xs text-text-secondary">
        {pointCount.toLocaleString()} points
      </p>
      {pointCount > 10000 && (
        <p className="text-xs text-warning">
          High point count may affect performance
        </p>
      )}
    </div>
  );
}

/**
 * Nested Torus settings component.
 * Hopf fibration and coupled circle structures.
 * @returns Nested torus settings controls
 */
function NestedTorusSettings() {
  const dimension = useGeometryStore((state) => state.dimension);
  const config = useExtendedObjectStore((state) => state.nestedTorus);

  // Nested torus actions
  const setRadius = useExtendedObjectStore((state) => state.setNestedTorusRadius);
  const setEta = useExtendedObjectStore((state) => state.setNestedTorusEta);
  const setResolutionXi1 = useExtendedObjectStore((state) => state.setNestedTorusResolutionXi1);
  const setResolutionXi2 = useExtendedObjectStore((state) => state.setNestedTorusResolutionXi2);
  const setShowNestedTori = useExtendedObjectStore((state) => state.setNestedTorusShowNestedTori);
  const setNumberOfTori = useExtendedObjectStore((state) => state.setNestedTorusNumberOfTori);

  // Calculate point count
  const getPointCount = () => {
    const base = config.resolutionXi1 * config.resolutionXi2;
    return config.showNestedTori && dimension === 4 ? base * config.numberOfTori : base;
  };

  const pointCount = getPointCount();

  // Number of tori options for nested mode
  const numberOfToriOptions = [
    { value: '2', label: '2 tori' },
    { value: '3', label: '3 tori' },
    { value: '4', label: '4 tori' },
    { value: '5', label: '5 tori' },
  ];

  // Get dimension-specific description
  const getDescription = () => {
    switch (dimension) {
      case 4: return 'Hopf fibration: linked circles on S³';
      case 5: return 'Twisted 2-torus: T² + helix';
      case 6: return '3-torus (T³): three coupled circles';
      case 7: return 'Twisted 3-torus: T³ + helix';
      case 8: return 'Quaternionic Hopf: S³ fibers over S⁴';
      case 9: return 'Twisted 4-torus: T⁴ + helix';
      case 10: return '5-torus (T⁵): five coupled circles';
      case 11: return 'Twisted 5-torus: T⁵ + helix';
      default: return 'Nested torus structure';
    }
  };

  // Get appropriate label for eta slider based on dimension
  const etaLabel = dimension === 4 || dimension === 8
    ? `Torus Position (η = ${(config.eta / Math.PI).toFixed(2)}π)`
    : `Circle Balance (η = ${(config.eta / Math.PI).toFixed(2)}π)`;

  return (
    <div className="space-y-4" data-testid="nested-torus-settings">
      {/* Mode description */}
      <div className="text-xs text-text-secondary">
        <span>{getDescription()}</span>
      </div>

      <Slider
        label="Radius"
        min={0.5}
        max={6.0}
        step={0.1}
        value={config.radius}
        onChange={setRadius}
        onReset={() => setRadius(DEFAULT_NESTED_TORUS_CONFIG.radius)}
        showValue
        data-testid="nested-radius"
      />
      <Slider
        label={etaLabel}
        min={Math.PI / 64}
        max={Math.PI / 2 - Math.PI / 64}
        step={0.01}
        value={config.eta}
        onChange={setEta}
        onReset={() => setEta(DEFAULT_NESTED_TORUS_CONFIG.eta)}
        showValue={false}
        data-testid="nested-eta"
      />
      <Slider
        label="Resolution ξ₁"
        min={8}
        max={64}
        step={4}
        value={config.resolutionXi1}
        onChange={setResolutionXi1}
        onReset={() => setResolutionXi1(DEFAULT_NESTED_TORUS_CONFIG.resolutionXi1)}
        showValue
        data-testid="nested-res-xi1"
      />
      <Slider
        label="Resolution ξ₂"
        min={8}
        max={64}
        step={4}
        value={config.resolutionXi2}
        onChange={setResolutionXi2}
        onReset={() => setResolutionXi2(DEFAULT_NESTED_TORUS_CONFIG.resolutionXi2)}
        showValue
        data-testid="nested-res-xi2"
      />

      {/* Show nested tori option (4D only) */}
      {dimension === 4 && (
        <>
          <div className="flex items-center justify-between">
            <label htmlFor="show-nested-tori" className="text-sm">Show Nested Tori</label>
            <input
              id="show-nested-tori"
              type="checkbox"
              checked={config.showNestedTori}
              onChange={(e) => setShowNestedTori(e.target.checked)}
              className="h-4 w-4"
              data-testid="nested-show-multiple"
            />
          </div>
          {config.showNestedTori && (
            <Select
              label="Number of Tori"
              options={numberOfToriOptions}
              value={String(config.numberOfTori)}
              onChange={(v) => setNumberOfTori(parseInt(v, 10))}
              data-testid="nested-count"
            />
          )}
        </>
      )}

      {/* Point count and warnings */}
      <p className="text-xs text-text-secondary">
        {pointCount.toLocaleString()} points
        <span> · {(config.resolutionXi1 * config.resolutionXi2 * 2).toLocaleString()} edges</span>
      </p>
      {pointCount > 10000 && (
        <p className="text-xs text-warning">
          High point count may affect performance
        </p>
      )}
    </div>
  );
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
      {objectType === 'nested-torus' && <NestedTorusSettings />}
      {objectType === 'mandelbrot' && <MandelbrotControls />}
      {objectType === 'mandelbox' && <MandelboxControls />}
      {objectType === 'menger' && <MengerControls />}
    </div>
  );
};
