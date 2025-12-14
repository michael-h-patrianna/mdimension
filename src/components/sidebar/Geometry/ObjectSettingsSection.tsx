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
 * Supports two visualization modes with dimension-specific availability:
 * - Flat (2D-11D): Grid-like, independent circles
 * - Nested (4D, 8D): Hopf fibration with coupled angles
 */
function CliffordTorusSettings() {
  const dimension = useGeometryStore((state) => state.dimension);
  const config = useExtendedObjectStore((state) => state.cliffordTorus);

  // Visualization mode actions
  const setVisualizationMode = useExtendedObjectStore((state) => state.setCliffordTorusVisualizationMode);
  const initializeForDimension = useExtendedObjectStore((state) => state.initializeCliffordTorusForDimension);

  // Shared actions
  const setRadius = useExtendedObjectStore((state) => state.setCliffordTorusRadius);

  // Flat mode actions
  const setMode = useExtendedObjectStore((state) => state.setCliffordTorusMode);
  const setResolutionU = useExtendedObjectStore((state) => state.setCliffordTorusResolutionU);
  const setResolutionV = useExtendedObjectStore((state) => state.setCliffordTorusResolutionV);
  const setK = useExtendedObjectStore((state) => state.setCliffordTorusK);
  const setStepsPerCircle = useExtendedObjectStore((state) => state.setCliffordTorusStepsPerCircle);

  // Nested (Hopf) 4D actions
  const setEta = useExtendedObjectStore((state) => state.setCliffordTorusEta);
  const setResolutionXi1 = useExtendedObjectStore((state) => state.setCliffordTorusResolutionXi1);
  const setResolutionXi2 = useExtendedObjectStore((state) => state.setCliffordTorusResolutionXi2);
  const setShowNestedTori = useExtendedObjectStore((state) => state.setCliffordTorusShowNestedTori);
  const setNumberOfTori = useExtendedObjectStore((state) => state.setCliffordTorusNumberOfTori);

  // Note: 8D now uses the same controls as 4D (resolutionXi1, resolutionXi2, eta)
  // The old fiberResolution/baseResolution are no longer used

  // Mode availability
  const nestedAvailable = dimension === 4 || dimension === 8;

  // Auto-switch mode when dimension changes
  React.useEffect(() => {
    initializeForDimension(dimension);
  }, [dimension, initializeForDimension]);

  // Update flat mode internal setting based on dimension
  React.useEffect(() => {
    const effectiveMode = dimension === 4 ? 'classic' : 'generalized';
    if (config.mode !== effectiveMode && config.visualizationMode === 'flat') {
      setMode(effectiveMode);
    }
  }, [dimension, config.mode, config.visualizationMode, setMode]);

  // Build visualization mode options
  const visualizationModeOptions = React.useMemo(() => [
    { value: 'flat', label: 'Flat' },
    {
      value: 'nested',
      label: nestedAvailable ? 'Nested (Hopf)' : 'Nested (Hopf) - 4D/8D only',
      disabled: !nestedAvailable,
    },
  ], [nestedAvailable]);

  // Calculate max k for flat/generalized mode
  const maxK = Math.floor(dimension / 2);

  // Build k options for flat/generalized mode
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

  // Calculate point counts for each mode
  const getPointCount = () => {
    switch (config.visualizationMode) {
      case 'flat':
        if (dimension === 4) {
          return config.resolutionU * config.resolutionV;
        }
        return Math.pow(config.stepsPerCircle, Math.min(config.k, maxK));
      case 'nested':
        // Both 4D and 8D now use the same 2D surface structure
        if (dimension === 4 || dimension === 8) {
          const base = config.resolutionXi1 * config.resolutionXi2;
          return config.showNestedTori && dimension === 4 ? base * config.numberOfTori : base;
        }
        return 0;
      default:
        return 0;
    }
  };

  const pointCount = getPointCount();

  // Number of tori options for nested mode
  const numberOfToriOptions = [
    { value: '2', label: '2 tori' },
    { value: '3', label: '3 tori' },
    { value: '4', label: '4 tori' },
    { value: '5', label: '5 tori' },
  ];

  return (
    <div className="space-y-4">
      {/* Visualization Mode Selector */}
      <Select
        label="Visualization Mode"
        options={visualizationModeOptions}
        value={config.visualizationMode}
        onChange={(v) => setVisualizationMode(v as 'flat' | 'nested')}
      />

      {/* Mode descriptions */}
      <div className="text-xs text-text-secondary">
        {config.visualizationMode === 'flat' && (
          <span>Independent circles in perpendicular planes</span>
        )}
        {config.visualizationMode === 'nested' && dimension === 4 && (
          <span>Hopf fibration: linked circles on S³</span>
        )}
        {config.visualizationMode === 'nested' && dimension === 8 && (
          <span>Quaternionic Hopf: S³ fibers over S⁴</span>
        )}
      </div>

      {/* ===== FLAT MODE SETTINGS ===== */}
      {config.visualizationMode === 'flat' && (
        <>
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

          {/* Generalized mode (non-4D) */}
          {dimension !== 4 && (
            <>
              <Select
                label="Torus Dimension (k)"
                options={kOptions}
                value={String(Math.min(config.k, maxK))}
                onChange={(v) => setK(parseInt(v, 10))}
              />
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
            </>
          )}
        </>
      )}

      {/* ===== NESTED (HOPF) MODE SETTINGS - 4D ===== */}
      {config.visualizationMode === 'nested' && dimension === 4 && (
        <>
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
          <Slider
            label={`Torus Position (η = ${(config.eta / Math.PI).toFixed(2)}π)`}
            min={Math.PI / 64}
            max={Math.PI / 2 - Math.PI / 64}
            step={0.01}
            value={config.eta}
            onChange={setEta}
            onReset={() => setEta(DEFAULT_CLIFFORD_TORUS_CONFIG.eta)}
            showValue={false}
          />
          <Slider
            label="Resolution ξ₁"
            min={8}
            max={64}
            step={4}
            value={config.resolutionXi1}
            onChange={setResolutionXi1}
            onReset={() => setResolutionXi1(DEFAULT_CLIFFORD_TORUS_CONFIG.resolutionXi1)}
            showValue
          />
          <Slider
            label="Resolution ξ₂"
            min={8}
            max={64}
            step={4}
            value={config.resolutionXi2}
            onChange={setResolutionXi2}
            onReset={() => setResolutionXi2(DEFAULT_CLIFFORD_TORUS_CONFIG.resolutionXi2)}
            showValue
          />
          <div className="flex items-center justify-between">
            <span className="text-sm">Show Nested Tori</span>
            <input
              type="checkbox"
              checked={config.showNestedTori}
              onChange={(e) => setShowNestedTori(e.target.checked)}
              className="h-4 w-4"
            />
          </div>
          {config.showNestedTori && (
            <Select
              label="Number of Tori"
              options={numberOfToriOptions}
              value={String(config.numberOfTori)}
              onChange={(v) => setNumberOfTori(parseInt(v, 10))}
            />
          )}
        </>
      )}

      {/* ===== NESTED (HOPF) MODE SETTINGS - 8D ===== */}
      {/* Uses the same 2D surface controls as 4D (resolutionXi1/Xi2, eta) */}
      {config.visualizationMode === 'nested' && dimension === 8 && (
        <>
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
          <Slider
            label={`Torus Position (η = ${(config.eta / Math.PI).toFixed(2)}π)`}
            min={Math.PI / 64}
            max={Math.PI / 2 - Math.PI / 64}
            step={0.01}
            value={config.eta}
            onChange={setEta}
            onReset={() => setEta(DEFAULT_CLIFFORD_TORUS_CONFIG.eta)}
            showValue={false}
          />
          <Slider
            label="Resolution ξ₁"
            min={8}
            max={64}
            step={4}
            value={config.resolutionXi1}
            onChange={setResolutionXi1}
            onReset={() => setResolutionXi1(DEFAULT_CLIFFORD_TORUS_CONFIG.resolutionXi1)}
            showValue
          />
          <Slider
            label="Resolution ξ₂"
            min={8}
            max={64}
            step={4}
            value={config.resolutionXi2}
            onChange={setResolutionXi2}
            onReset={() => setResolutionXi2(DEFAULT_CLIFFORD_TORUS_CONFIG.resolutionXi2)}
            showValue
          />
        </>
      )}

      {/* Point count and warnings (same for both 4D and 8D now) */}
      <p className="text-xs text-text-secondary">
        {pointCount.toLocaleString()} points
        {config.visualizationMode === 'nested' && (
          <span> · {(config.resolutionXi1 * config.resolutionXi2 * 2).toLocaleString()} edges</span>
        )}
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
      {objectType === 'mandelbrot' && <MandelbrotControls />}
      {objectType === 'mandelbox' && <MandelboxControls />}
      {objectType === 'menger' && <MengerControls />}
    </div>
  );
};
