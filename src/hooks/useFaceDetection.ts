import { useMemo } from 'react';
import { detectFaces, isPolytopeType } from '@/lib/geometry';
import type { NdGeometry, ObjectType } from '@/lib/geometry';

/**
 * Hook to detect faces for a given geometry and object type.
 *
 * @param geometry - The geometry object containing vertices and edges.
 * @param objectType - The type of object being rendered.
 * @returns An array of detected faces.
 */
export function useFaceDetection(geometry: NdGeometry, objectType: ObjectType) {
  return useMemo(() => {
    // Point clouds don't have faces
    if (geometry.isPointCloud) {
      return [];
    }

    // Polytopes, root-system, and clifford-torus support face detection
    const supportsFaces =
      isPolytopeType(objectType) ||
      objectType === 'root-system' ||
      objectType === 'clifford-torus';
    if (!supportsFaces) {
      return [];
    }

    // Root-system needs edges to detect faces
    if (objectType === 'root-system' && geometry.edges.length === 0) {
      return [];
    }

    // Clifford-torus needs metadata for resolution info
    if (objectType === 'clifford-torus' && !geometry.metadata?.properties) {
      return [];
    }

    try {
      return detectFaces(
        geometry.vertices,
        geometry.edges,
        objectType,
        geometry.metadata
      );
    } catch (e) {
      console.warn('Face detection failed:', e);
      return [];
    }
  }, [geometry, objectType]);
}
