import { useMemo } from 'react';
import { useCrossSectionStore } from '@/stores/crossSectionStore';
import { useProjectionStore } from '@/stores/projectionStore';
import { computeCrossSection, isPolytopeType } from '@/lib/geometry';
import { projectPerspective, projectOrthographic } from '@/lib/math/projection';
import type { NdGeometry, Face, ObjectType } from '@/lib/geometry';
import type { VectorND, Vector3D } from '@/lib/math/types';

/**
 * Hook to calculate and project the cross-section of an n-dimensional object.
 *
 * @param transformedVertices - The vertices of the object after all transformations.
 * @param geometry - The base geometry object.
 * @param faces - The detected faces of the object.
 * @param dimension - The current dimension.
 * @param objectType - The type of object.
 * @returns An object containing the cross-section vertices (3D), edges, and opacity settings.
 */
export function useCrossSectionCalculator(
  transformedVertices: VectorND[],
  geometry: NdGeometry,
  faces: Face[],
  dimension: number,
  objectType: ObjectType
) {
  const crossSectionEnabled = useCrossSectionStore((state) => state.enabled);
  const sliceW = useCrossSectionStore((state) => state.sliceW);
  const showOriginal = useCrossSectionStore((state) => state.showOriginal);
  const originalOpacity = useCrossSectionStore((state) => state.originalOpacity);

  const projectionType = useProjectionStore((state) => state.type);
  const projectionDistance = useProjectionStore((state) => state.distance);

  // Compute cross-section
  const crossSectionResult = useMemo(() => {
    if (!crossSectionEnabled || dimension < 4) {
      return null;
    }

    if (geometry.isPointCloud) {
      return null;
    }

    const supportsCrossSection = isPolytopeType(objectType) || objectType === 'root-system';
    if (!supportsCrossSection) {
      return null;
    }

    const transformedGeometry = {
      vertices: transformedVertices,
      edges: geometry.edges,
      dimension,
      type: objectType,
    };
    return computeCrossSection(transformedGeometry, sliceW, faces);
  }, [crossSectionEnabled, dimension, transformedVertices, geometry.edges, sliceW, objectType, faces, geometry.isPointCloud]);

  // Project cross-section vertices to 3D
  const crossSectionVertices = useMemo(() => {
    if (!crossSectionResult || !crossSectionResult.hasIntersection) {
      return undefined;
    }

    return crossSectionResult.points.map((p) => {
      const out: Vector3D = [0, 0, 0];
      if (projectionType === 'perspective') {
        projectPerspective(p, projectionDistance, out);
      } else {
        projectOrthographic(p, out);
      }
      return out;
    });
  }, [crossSectionResult, projectionType, projectionDistance]);

  const crossSectionEdges = useMemo(() => {
    if (!crossSectionResult || !crossSectionResult.hasIntersection) {
      return undefined;
    }
    return crossSectionResult.edges;
  }, [crossSectionResult]);

  const mainOpacity = crossSectionEnabled && crossSectionResult?.hasIntersection
    ? (showOriginal ? originalOpacity : 0)
    : 1.0;

  return {
    vertices: crossSectionVertices,
    edges: crossSectionEdges,
    mainOpacity,
    result: crossSectionResult
  };
}
