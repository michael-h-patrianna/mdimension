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
import { useShallow } from 'zustand/react/shallow';
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
 * Polytopes (hypercube, simplex, cross-polytope), root-system, clifford-torus,
 * mandelbrot (via raymarching), and mandelbox (via raymarching) support faces
 * @param objectType - The current object type
 * @returns true if faces can be rendered for this object type
 */
function canRenderFaces(objectType: string): boolean {
  const polytopeTypes = ['hypercube', 'simplex', 'cross-polytope'];
  return (
    polytopeTypes.includes(objectType) ||
    objectType === 'root-system' ||
    objectType === 'mandelbrot' ||
    objectType === 'mandelbox' ||
    objectType === 'clifford-torus'
  );
}

/**
 * Checks if an object type supports edge rendering
 * For Mandelbrot/Mandelbox, "Edges" controls fresnel rim lighting on the raymarched surface
 * @param _objectType - The current object type (unused - all types support edges)
 * @returns true if edges can be rendered for this object type
 */
function canRenderEdges(_objectType: string): boolean {
  // All object types support edges (Mandelbrot/Mandelbox use fresnel rim lighting as "edges")
  return true;
}

/**
 * Checks if an object type supports vertex rendering
 * Mandelbox doesn't support vertices (raymarched surface only)
 * @param objectType - The current object type
 * @returns true if vertices can be rendered for this object type
 */
function canRenderVertices(objectType: string): boolean {
  // Mandelbox is raymarched only - no vertex rendering
  return objectType !== 'mandelbox';
}

/**
 * Checks if an object type is a raymarched fractal (mandelbrot 3D+ or mandelbox)
 * These types have special mutual exclusivity rules for render modes
 * @param objectType - The current object type
 * @param dimension - Current dimension
 * @returns true if this is a raymarched fractal type
 */
function isRaymarchedFractal(objectType: string, dimension: number): boolean {
  return (
    (objectType === 'mandelbrot' && dimension >= 3) ||
    (objectType === 'mandelbox' && dimension >= 3)
  );
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
 * - Faces toggle is disabled for hypersphere (Mandelbrot allowed for Ray Marching)
 * - Edges toggle is disabled for Mandelbrot
 * - When switching to an incompatible object, faces/edges auto-turn off
 * - Faces toggle automatically sets shader type (surface vs wireframe)
 */
export const RenderModeToggles: React.FC<RenderModeTogglesProps> = React.memo(({
  className = '',
}) => {
  // Consolidate visual store selectors with useShallow to reduce subscriptions
  const {
    vertexVisible,
    edgesVisible,
    facesVisible,
    setVertexVisible,
    setEdgesVisible,
    setFacesVisible,
  } = useVisualStore(
    useShallow((state) => ({
      vertexVisible: state.vertexVisible,
      edgesVisible: state.edgesVisible,
      facesVisible: state.facesVisible,
      setVertexVisible: state.setVertexVisible,
      setEdgesVisible: state.setEdgesVisible,
      setFacesVisible: state.setFacesVisible,
    }))
  );

  // Consolidate geometry store selectors with useShallow
  const { objectType, dimension } = useGeometryStore(
    useShallow((state) => ({
      objectType: state.objectType,
      dimension: state.dimension,
    }))
  );

  // Track if faces/edges were auto-disabled due to object type switch
  // Initialize to false - only set to true when we auto-disable, not for manual toggles
  const previousFacesState = useRef(false);
  const previousEdgesState = useRef(false);

  // Check support for current object type
  const facesSupported = canRenderFaces(objectType);
  const edgesSupported = canRenderEdges(objectType);
  const verticesSupported = canRenderVertices(objectType);
  const isRaymarched = isRaymarchedFractal(objectType, dimension);

  // Toggle handlers with mutual exclusivity logic for raymarched fractals (Mandelbrot 3D+, Mandelbox)
  // Rules:
  // - Vertices ON → Edges OFF, Faces OFF (only for Mandelbrot, Mandelbox has no vertices)
  // - Edges ON → Faces ON, Vertices OFF
  // - Faces can be ON independently, but if Edges is ON, Faces must stay ON
  const handleVertexToggle = (visible: boolean) => {
    if (!verticesSupported) return; // Mandelbox doesn't support vertices
    if (visible && isRaymarched) {
      // Vertices mode: disable Edges and Faces
      setVertexVisible(true);
      setEdgesVisible(false);
      setFacesVisible(false);
    } else {
      setVertexVisible(visible);
    }
  };

  const handleEdgeToggle = (visible: boolean) => {
    if (visible && isRaymarched) {
      // Edges mode: enable Faces, disable Vertices
      setEdgesVisible(true);
      setFacesVisible(true);
      if (verticesSupported) setVertexVisible(false);
    } else {
      setEdgesVisible(visible);
      // If turning off edges, that's fine - faces can stay on independently
    }
  };

  const handleFaceToggle = (visible: boolean) => {
    if (visible && isRaymarched) {
      // Faces mode: disable Vertices (Edges can stay as-is)
      setFacesVisible(true);
      if (verticesSupported) setVertexVisible(false);
    } else if (!visible && isRaymarched && edgesVisible) {
      // Cannot turn off Faces while Edges is on for raymarched fractals
      // Keep faces on
      return;
    } else {
      setFacesVisible(visible);
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
      // BUT: Check mutual exclusivity first (don't restore if Vertices are ON for raymarched fractals)
      if (isRaymarched && vertexVisible) {
        // Do not restore faces if vertices are already visible to respect exclusivity
        previousFacesState.current = false;
      } else {
        setFacesVisible(true);
        previousFacesState.current = false;
      }
    }
  }, [facesSupported, facesVisible, setFacesVisible, isRaymarched, vertexVisible]);

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

  // Auto-disable vertices when switching to mandelbox (raymarched only, no vertices)
  useEffect(() => {
    if (!verticesSupported && vertexVisible) {
      setVertexVisible(false);
      // Ensure faces is enabled for mandelbox
      if (!facesVisible) {
        setFacesVisible(true);
      }
    }
  }, [verticesSupported, vertexVisible, facesVisible, setVertexVisible, setFacesVisible]);

  // Enforce mutual exclusivity for raymarched fractals (Mandelbrot 3D+, Mandelbox) on object type switch
  // Rules:
  // - Vertices ON → Edges OFF, Faces OFF (only for types that support vertices)
  // - Edges ON → Faces must be ON, Vertices OFF
  useEffect(() => {
    if (isRaymarched) {
      if (verticesSupported && vertexVisible && (facesVisible || edgesVisible)) {
        // Vertices takes priority - disable faces and edges
        setFacesVisible(false);
        setEdgesVisible(false);
      } else if (edgesVisible && !facesVisible) {
        // Edges requires faces to be on
        setFacesVisible(true);
      } else if (verticesSupported && edgesVisible && vertexVisible) {
        // Edges mode - disable vertices
        setVertexVisible(false);
      }
    }
  }, [isRaymarched, verticesSupported, vertexVisible, facesVisible, edgesVisible, setFacesVisible, setEdgesVisible, setVertexVisible]);

  // Ensure at least one render mode is always active
  // Fallback to faces for mandelbox (no vertices), vertices for others
  useEffect(() => {
    const noModeActive = !vertexVisible && !edgesVisible && !facesVisible;
    if (noModeActive) {
      if (verticesSupported) {
        setVertexVisible(true);
      } else {
        // Mandelbox: default to faces
        setFacesVisible(true);
      }
    }
  }, [vertexVisible, edgesVisible, facesVisible, verticesSupported, setVertexVisible, setFacesVisible]);

  return (
    <div className={`flex gap-2 ${className}`} data-testid="render-mode-toggles">
      <div
        title={!verticesSupported ? 'Vertices not available for this object type' : undefined}
      >
        <ToggleButton
          pressed={vertexVisible}
          onToggle={handleVertexToggle}
          ariaLabel="Toggle vertex visibility"
          disabled={!verticesSupported}
          data-testid="toggle-vertices"
        >
          Vertices
        </ToggleButton>
      </div>

      <div
        title={!edgesSupported ? 'Edges not available for this object type' : undefined}
      >
        <ToggleButton
          pressed={edgesVisible}
          onToggle={handleEdgeToggle}
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
});
