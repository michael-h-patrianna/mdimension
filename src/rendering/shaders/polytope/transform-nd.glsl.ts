import { MAX_EXTRA_DIMS } from '../../renderers/Polytope/constants'

/**
 * N-D Transformation Block for Polytope Rendering
 *
 * Provides transformND() function that transforms the current vertex,
 * and transformNDFromInputs() that can transform any vertex given its coordinates.
 * This enables computing face normals from all 3 triangle vertices in the vertex shader.
 *
 * IMPORTANT: WebGL has a 16 attribute slot limit. We pack extra dimensions into vec4/vec3
 * to stay within limits:
 *   - position (vec3) = 1 slot
 *   - aExtraDims0_3 (vec4) = 1 slot (dims 4-7)
 *   - aExtraDims4_6 (vec3) = 1 slot (dims 8-10)
 *   - aNeighbor1Pos (vec3) = 1 slot
 *   - aNeighbor1Extra0_3 (vec4) = 1 slot
 *   - aNeighbor1Extra4_6 (vec3) = 1 slot
 *   - aNeighbor2Pos (vec3) = 1 slot
 *   - aNeighbor2Extra0_3 (vec4) = 1 slot
 *   - aNeighbor2Extra4_6 (vec3) = 1 slot
 *   Total: 9 slots (under 16 limit)
 */
export const transformNDBlock = `
    // N-D Transformation uniforms
    uniform mat4 uRotationMatrix4D;
    uniform int uDimension;
    uniform vec4 uScale4D;
    uniform float uExtraScales[${MAX_EXTRA_DIMS}];
    uniform float uProjectionDistance;
    uniform float uExtraRotationCols[${MAX_EXTRA_DIMS * 4}];
    uniform float uDepthRowSums[11];

    // Extra dimension attributes for THIS vertex (packed into vec4 + vec3)
    in vec4 aExtraDims0_3;  // dims 4-7 (w component of 4D + first 3 extra)
    in vec3 aExtraDims4_6;  // dims 8-10 (remaining 3 extra dims)

    // Neighbor vertex 1 (for face normal computation) - packed
    in vec3 aNeighbor1Pos;
    in vec4 aNeighbor1Extra0_3;
    in vec3 aNeighbor1Extra4_6;

    // Neighbor vertex 2 (for face normal computation) - packed
    in vec3 aNeighbor2Pos;
    in vec4 aNeighbor2Extra0_3;
    in vec3 aNeighbor2Extra4_6;

    /**
     * Transform an N-D vertex to 3D given explicit coordinates.
     * Used for transforming neighbor vertices for normal computation.
     */
    vec3 transformNDFromInputs(vec3 pos3d, float e0, float e1, float e2, float e3, float e4, float e5, float e6) {
      float scaledInputs[11];
      scaledInputs[0] = pos3d.x * uScale4D.x;
      scaledInputs[1] = pos3d.y * uScale4D.y;
      scaledInputs[2] = pos3d.z * uScale4D.z;
      scaledInputs[3] = e0 * uScale4D.w;
      scaledInputs[4] = e1 * uExtraScales[0];
      scaledInputs[5] = e2 * uExtraScales[1];
      scaledInputs[6] = e3 * uExtraScales[2];
      scaledInputs[7] = e4 * uExtraScales[3];
      scaledInputs[8] = e5 * uExtraScales[4];
      scaledInputs[9] = e6 * uExtraScales[5];
      scaledInputs[10] = 0.0;

      vec4 scaledPos = vec4(scaledInputs[0], scaledInputs[1], scaledInputs[2], scaledInputs[3]);
      vec4 rotated = uRotationMatrix4D * scaledPos;

      for (int i = 0; i < ${MAX_EXTRA_DIMS}; i++) {
        if (i + 5 <= uDimension) {
          float extraDimValue = scaledInputs[i + 4];
          rotated.x += uExtraRotationCols[i * 4 + 0] * extraDimValue;
          rotated.y += uExtraRotationCols[i * 4 + 1] * extraDimValue;
          rotated.z += uExtraRotationCols[i * 4 + 2] * extraDimValue;
          rotated.w += uExtraRotationCols[i * 4 + 3] * extraDimValue;
        }
      }

      // Perspective projection: apply depth-based scaling from higher dimensions
      float effectiveDepth = rotated.w;
      for (int j = 0; j < 11; j++) {
        if (j < uDimension) {
          effectiveDepth += uDepthRowSums[j] * scaledInputs[j];
        }
      }
      float normFactor = uDimension > 4 ? sqrt(float(uDimension - 3)) : 1.0;
      effectiveDepth /= normFactor;
      // Guard against division by zero when effectiveDepth approaches projectionDistance
      float denom = uProjectionDistance - effectiveDepth;
      // Clamp denominator away from zero (preserve sign for correct projection direction)
      if (abs(denom) < 0.0001) denom = denom >= 0.0 ? 0.0001 : -0.0001;
      float factor = 1.0 / denom;
      vec3 projected = rotated.xyz * factor;

      return projected;
    }

    /**
     * Transform the current vertex (uses built-in position and packed aExtraDims attributes)
     */
    vec3 transformND() {
      return transformNDFromInputs(
        position,
        aExtraDims0_3.x, aExtraDims0_3.y, aExtraDims0_3.z, aExtraDims0_3.w,
        aExtraDims4_6.x, aExtraDims4_6.y, aExtraDims4_6.z
      );
    }

    /**
     * Transform neighbor vertex 1 (uses packed neighbor attributes)
     */
    vec3 transformNeighbor1() {
      return transformNDFromInputs(
        aNeighbor1Pos,
        aNeighbor1Extra0_3.x, aNeighbor1Extra0_3.y, aNeighbor1Extra0_3.z, aNeighbor1Extra0_3.w,
        aNeighbor1Extra4_6.x, aNeighbor1Extra4_6.y, aNeighbor1Extra4_6.z
      );
    }

    /**
     * Transform neighbor vertex 2 (uses packed neighbor attributes)
     */
    vec3 transformNeighbor2() {
      return transformNDFromInputs(
        aNeighbor2Pos,
        aNeighbor2Extra0_3.x, aNeighbor2Extra0_3.y, aNeighbor2Extra0_3.z, aNeighbor2Extra0_3.w,
        aNeighbor2Extra4_6.x, aNeighbor2Extra4_6.y, aNeighbor2Extra4_6.z
      );
    }

    /**
     * Compute face normal from the 3 triangle vertices after nD transformation.
     * Returns normalized normal vector pointing based on vertex winding.
     */
    vec3 computeFaceNormal(vec3 v0, vec3 v1, vec3 v2) {
      vec3 edge1 = v1 - v0;
      vec3 edge2 = v2 - v0;
      vec3 n = cross(edge1, edge2);
      float len = length(n);
      // Guard against degenerate triangles
      return len > 0.0001 ? n / len : vec3(0.0, 0.0, 1.0);
    }
`
