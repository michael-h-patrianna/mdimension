/**
 * ObjectSettingsSection Component
 *
 * Displays type-specific settings for all object types (both polytopes and extended objects).
 * Uses the registry to dynamically load the appropriate controls component.
 *
 * Features:
 * - Dynamic lazy loading of controls via registry
 * - Code-split controls components for smaller initial bundle
 * - Unified control rendering across all object types
 *
 * Polytopes:
 * - Hypercube, Simplex, Cross-polytope: scale (0.5-3.0)
 *
 * Extended Objects:
 * - Root System: type (A/D/E8), scale (0.5-2.0), always has edges
 * - Clifford Torus: radius, resolution, edge mode
 * - Mandelbrot: max iterations, escape radius, etc.
 * - Quaternion Julia: constant, power, iterations, etc.
 */

import {
  getControlsComponentKey,
  getControlsComponent,
  hasControlsComponent,
} from '@/lib/geometry/registry';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useGeometryStore } from '@/stores/geometryStore';
import React, { Suspense, useMemo } from 'react';

export interface ObjectSettingsSectionProps {
  className?: string;
}

/**
 * Skeleton loader for controls while they're being loaded
 */
const ControlsSkeleton: React.FC = () => (
  <div className="space-y-3 animate-pulse" data-testid="controls-skeleton">
    <div className="h-4 bg-panel-border/50 rounded w-24" />
    <div className="h-8 bg-panel-border/30 rounded" />
    <div className="h-8 bg-panel-border/30 rounded" />
  </div>
);

/**
 * Error fallback for failed component loads
 */
const ControlsError: React.FC = () => (
  <div
    className="p-3 text-sm text-red-400 bg-red-900/20 rounded-md border border-red-900/50"
    data-testid="controls-error"
  >
    <p className="font-medium">Failed to load controls</p>
    <p className="text-xs text-red-500 mt-1">Please refresh the page</p>
  </div>
);

/**
 * Main ObjectSettingsSection component
 *
 * Displays controls specific to the currently selected object type.
 * Uses the registry to dynamically load the appropriate controls component,
 * enabling code-splitting for smaller initial bundle size.
 *
 * @param root0 - Component props
 * @param root0.className - Optional CSS class name
 */
export const ObjectSettingsSection: React.FC<ObjectSettingsSectionProps> = ({
  className = '',
}) => {
  const objectType = useGeometryStore((state) => state.objectType);

  // Get the controls component key from registry
  const componentKey = useMemo(
    () => getControlsComponentKey(objectType),
    [objectType]
  );

  // Get the lazy-loaded component from registry
  const ControlsComponent = useMemo(() => {
    if (!componentKey || !hasControlsComponent(componentKey)) {
      return null;
    }
    return getControlsComponent(componentKey);
  }, [componentKey]);

  return (
    <div className={className} data-testid="object-settings-section">
      {ControlsComponent && (
        <ErrorBoundary fallback={<ControlsError />}>
          <Suspense fallback={<ControlsSkeleton />}>
            <ControlsComponent />
          </Suspense>
        </ErrorBoundary>
      )}
    </div>
  );
};