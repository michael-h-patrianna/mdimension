
import { computeConvexHullFaces } from '../src/lib/geometry/extended/utils/convex-hull-faces';
import { createVector, subtractVectors, crossProduct3D, dotProduct, addVectors, scaleVector } from '../src/lib/math';

// Simple 3D cube vertices for hull test
const vertices = [
    [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
    [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]
];

function verifyHullWinding() {
    console.log('Computing Convex Hull for 3D Cube...');
    const faces = computeConvexHullFaces(vertices);
    console.log(`Generated ${faces.length} faces (triangles)`);
    
    let outwardCount = 0;
    let inwardCount = 0;
    
    // Cube center is (0,0,0)
    
    for (let i = 0; i < faces.length; i++) {
        const [i0, i1, i2] = faces[i];
        const v0 = vertices[i0];
        const v1 = vertices[i1];
        const v2 = vertices[i2];
        
        // Centroid of face
        let center = [0, 0, 0];
        center[0] = (v0[0] + v1[0] + v2[0]) / 3;
        center[1] = (v0[1] + v1[1] + v2[1]) / 3;
        center[2] = (v0[2] + v1[2] + v2[2]) / 3;
        
        // Normal
        const e1 = subtractVectors(v1, v0);
        const e2 = subtractVectors(v2, v0);
        const normal = crossProduct3D(e1, e2);
        
        const dot = dotProduct(normal, center);
        
        if (dot > 0.0001) outwardCount++;
        else if (dot < -0.0001) inwardCount++;
    }
    
    console.log(`Convex Hull: ${outwardCount} Outward, ${inwardCount} Inward`);
}

verifyHullWinding();
