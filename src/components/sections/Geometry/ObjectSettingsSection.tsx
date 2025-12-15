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

import { isPolytopeType } from '@/lib/geometry/types';
import { useGeometryStore } from '@/stores/geometryStore';
import React from 'react';
import { MandelboxControls } from './MandelboxControls';
import { MandelbrotControls } from './MandelbrotControls';
import { MengerControls } from './MengerControls';
import { CliffordTorusSettings } from './settings/CliffordTorusSettings';
import { NestedTorusSettings } from './settings/NestedTorusSettings';
import { PolytopeSettings } from './settings/PolytopeSettings';
import { RootSystemSettings } from './settings/RootSystemSettings';

export interface ObjectSettingsSectionProps {
  className?: string;
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