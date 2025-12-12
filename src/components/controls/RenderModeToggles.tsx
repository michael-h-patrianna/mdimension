/**
 * Render Mode Toggles Component
 *
 * Displays three toggle buttons at the top of the sidebar for controlling
 * which geometry elements are rendered: Vertices, Edges, and Faces.
 *
 * Features:
 * - Toggle visibility for vertices, edges, and faces independently
 * - Faces toggle is disabled for objects that don't support face rendering
 * - Tooltip explains when faces are unavailable
 * - Integrates with visualStore and geometryStore
 *
 * @example
 * ```tsx
 * <RenderModeToggles />
 * ```
 *
 * @see docs/prd/render-mode-toggles.md
 */

import React, { useEffect, useRef } from 'react';
import { ToggleButton } from '@/components/ui/ToggleButton';
import { useVisualStore } from '@/stores/visualStore';
import { useGeometryStore } from '@/stores/geometryStore';

/**
 * Props for RenderModeToggles component
 */
export interface RenderModeTogglesProps {
  /** Optional CSS class name for styling */
  className?: string;
}

/**
 * Checks if an object type supports face rendering
 * Polytopes (hypercube, simplex, cross-polytope) and root-system support faces
 * @param objectType - The current object type
 * @returns true if faces can be rendered for this object type
 */
function canRenderFaces(objectType: string): boolean {
  const polytopeTypes = ['hypercube', 'simplex', 'cross-polytope'];
  return polytopeTypes.includes(objectType) || objectType === 'root-system';
}

/**
 * Render Mode Toggles Component
 *
 * Provides a row of three toggle buttons for controlling geometry rendering:
 * - Vertices: Shows/hides vertex points
 * - Edges: Shows/hides edge lines (wireframe)
 * - Faces: Shows/hides filled surfaces (when supported)
 *
 * @param props - Component props
 * @param props.className - Optional CSS class for custom styling
 *
 * @returns A row of toggle buttons for render mode control
 *
 * @remarks
 * - Faces toggle is disabled for hypersphere, clifford-torus, and mandelbrot
 * - When switching to an incompatible object, faces auto-turn off
 * - Faces toggle automatically sets shader type (surface vs wireframe)
 */
export const RenderModeToggles: React.FC<RenderModeTogglesProps> = ({
  className = '',
}) => {
  // Visual store state
  const vertexVisible = useVisualStore((state) => state.vertexVisible);
  const edgesVisible = useVisualStore((state) => state.edgesVisible);
  const facesVisible = useVisualStore((state) => state.facesVisible);

  // Visual store actions
  const setVertexVisible = useVisualStore((state) => state.setVertexVisible);
  const setEdgesVisible = useVisualStore((state) => state.setEdgesVisible);
  const setFacesVisible = useVisualStore((state) => state.setFacesVisible);

  // Geometry store state
  const objectType = useGeometryStore((state) => state.objectType);

  // Track previous faces state for compatible objects
  const previousFacesState = useRef(facesVisible);

  // Check if faces are supported for current object type
  const facesSupported = canRenderFaces(objectType);

  // Auto-disable faces when switching to incompatible object
  useEffect(() => {
    if (!facesSupported && facesVisible) {
      // Store the previous state before auto-disabling
      previousFacesState.current = true;
      setFacesVisible(false);
    } else if (facesSupported && previousFacesState.current && !facesVisible) {
      // Restore faces when switching back to compatible object
      setFacesVisible(true);
      previousFacesState.current = false;
    }
  }, [facesSupported, facesVisible, setFacesVisible]);

  return (
    <div className={`flex gap-2 ${className}`} data-testid="render-mode-toggles">
      <ToggleButton
        pressed={vertexVisible}
        onToggle={setVertexVisible}
        ariaLabel="Toggle vertex visibility"
        data-testid="toggle-vertices"
      >
        Vertices
      </ToggleButton>

      <ToggleButton
        pressed={edgesVisible}
        onToggle={setEdgesVisible}
        ariaLabel="Toggle edge visibility"
        data-testid="toggle-edges"
      >
        Edges
      </ToggleButton>

      <div
        title={!facesSupported ? 'Faces not available for this object type' : undefined}
      >
        <ToggleButton
          pressed={facesVisible}
          onToggle={setFacesVisible}
          ariaLabel="Toggle face visibility"
          disabled={!facesSupported}
          data-testid="toggle-faces"
        >
          Faces
        </ToggleButton>
      </div>
    </div>
  );
};
