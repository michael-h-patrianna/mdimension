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
 * Polytopes (hypercube, simplex, cross-polytope), root-system, and mandelbrot (via raymarching) support faces
 * @param objectType - The current object type
 * @returns true if faces can be rendered for this object type
 */
function canRenderFaces(objectType: string): boolean {
  const polytopeTypes = ['hypercube', 'simplex', 'cross-polytope'];
  return polytopeTypes.includes(objectType) || objectType === 'root-system' || objectType === 'mandelbrot';
}

/**
 * Checks if an object type supports edge rendering
 * Mandelbrot does not support explicit edge rendering in Ray Marching mode
 * @param objectType - The current object type
 * @returns true if edges can be rendered for this object type
 */
function canRenderEdges(objectType: string): boolean {
  // Mandelbrot uses raymarching or point cloud, explicit edges are visually chaotic/expensive and disabled
  if (objectType === 'mandelbrot') return false;
  return true;
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
 * - Faces toggle is disabled for hypersphere, clifford-torus (Mandelbrot allowed for Ray Marching)
 * - Edges toggle is disabled for Mandelbrot
 * - When switching to an incompatible object, faces/edges auto-turn off
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
  const dimension = useGeometryStore((state) => state.dimension);

  // Track if faces/edges were auto-disabled due to object type switch
  // Initialize to false - only set to true when we auto-disable, not for manual toggles
  const previousFacesState = useRef(false);
  const previousEdgesState = useRef(false);

  // Check support for current object type
  const facesSupported = canRenderFaces(objectType);
  const edgesSupported = canRenderEdges(objectType);

  // Toggle handlers with mutual exclusivity logic for Mandelbrot 3D+
  const handleVertexToggle = (visible: boolean) => {
    setVertexVisible(visible);
    // If enabling vertices for Mandelbrot 3D+, disable faces (Ray Marching)
    if (visible && objectType === 'mandelbrot' && dimension >= 3) {
      setFacesVisible(false);
    }
  };

  const handleFaceToggle = (visible: boolean) => {
    setFacesVisible(visible);
    // If enabling faces (Ray Marching) for Mandelbrot 3D+, disable vertices
    if (visible && objectType === 'mandelbrot' && dimension >= 3) {
      setVertexVisible(false);
    }
  };

  // Auto-disable faces when switching to incompatible object
  useEffect(() => {
    if (!facesSupported && facesVisible) {
      // Store the previous state before auto-disabling
      previousFacesState.current = true;
      setFacesVisible(false);
    } else if (facesSupported && previousFacesState.current && !facesVisible) {
      // Restore faces when switching back to compatible object
      // BUT: Check mutual exclusivity first (don't restore if Vertices are ON for Mandelbrot)
      if (objectType === 'mandelbrot' && dimension >= 3 && vertexVisible) {
        // Do not restore faces if vertices are already visible to respect exclusivity
        previousFacesState.current = false;
      } else {
        setFacesVisible(true);
        previousFacesState.current = false;
      }
    }
  }, [facesSupported, facesVisible, setFacesVisible, objectType, dimension, vertexVisible]);

  // Auto-disable edges when switching to incompatible object (Mandelbrot)
  useEffect(() => {
    if (!edgesSupported && edgesVisible) {
      previousEdgesState.current = true;
      setEdgesVisible(false);
    } else if (edgesSupported && previousEdgesState.current && !edgesVisible) {
      setEdgesVisible(true);
      previousEdgesState.current = false;
    }
  }, [edgesSupported, edgesVisible, setEdgesVisible]);

  // Enforce mutual exclusivity for Mandelbrot 3D+ on object type switch
  // When switching TO mandelbrot with both vertices and faces enabled, disable faces
  useEffect(() => {
    if (objectType === 'mandelbrot' && dimension >= 3) {
      if (vertexVisible && facesVisible) {
        // Both enabled - vertices takes priority, disable faces
        setFacesVisible(false);
      }
    }
  }, [objectType, dimension, vertexVisible, facesVisible, setFacesVisible]);

  // Ensure at least one render mode is always active
  // Fallback to vertices if all modes would be off
  useEffect(() => {
    const noModeActive = !vertexVisible && !edgesVisible && !facesVisible;
    if (noModeActive) {
      setVertexVisible(true);
    }
  }, [vertexVisible, edgesVisible, facesVisible, setVertexVisible]);

  return (
    <div className={`flex gap-2 ${className}`} data-testid="render-mode-toggles">
      <ToggleButton
        pressed={vertexVisible}
        onToggle={handleVertexToggle}
        ariaLabel="Toggle vertex visibility"
        data-testid="toggle-vertices"
      >
        Vertices
      </ToggleButton>

      <div
        title={!edgesSupported ? 'Edges not available for this object type' : undefined}
      >
        <ToggleButton
          pressed={edgesVisible}
          onToggle={setEdgesVisible}
          ariaLabel="Toggle edge visibility"
          disabled={!edgesSupported}
          data-testid="toggle-edges"
        >
          Edges
        </ToggleButton>
      </div>

      <div
        title={!facesSupported ? 'Faces not available for this object type' : undefined}
      >
        <ToggleButton
          pressed={facesVisible}
          onToggle={handleFaceToggle}
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
