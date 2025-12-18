
import { generateSimplex } from '../src/lib/geometry/simplex';
import { generateCrossPolytope } from '../src/lib/geometry/cross-polytope';
import { detectFaces } from '../src/lib/geometry/faces';
import { createVector, subtractVectors, crossProduct3D, dotProduct, addVectors, scaleVector } from '../src/lib/math';

function verifyWinding(name: string, generator: (dim: number) => any, type: string) {
    const dim = 3;
    const geometry = generator(dim);
    const faces = detectFaces(geometry.vertices, geometry.edges, type);
    
    console.log(`Checking ${faces.length} faces for ${dim}D ${name}`);
    
    let outwardCount = 0;
    let inwardCount = 0;
    
    for (let i = 0; i < faces.length; i++) {
        const face = faces[i].vertices;
        const v0 = geometry.vertices[face[0]];
        const v1 = geometry.vertices[face[1]];
        const v2 = geometry.vertices[face[2]];
        
        // Compute center of face
        let center = createVector(dim);
        for (const idx of face) {
            center = addVectors(center, geometry.vertices[idx]);
        }
        center = scaleVector(center, 1.0 / face.length);
        
        // Compute 3D edges
        const e1 = subtractVectors(v1, v0);
        const e2 = subtractVectors(v2, v0);
        
        // Compute normal
        const normal = crossProduct3D(e1, e2);
        
        // Check dot product with center (radial vector)
        const dot = dotProduct(normal, center);
        
        if (dot > 0.0001) {
            outwardCount++;
        } else if (dot < -0.0001) {
            inwardCount++;
        }
    }
    
    console.log(`${name}: ${outwardCount} Outward, ${inwardCount} Inward`);
}

verifyWinding('Simplex', generateSimplex, 'simplex');
verifyWinding('Cross-Polytope', generateCrossPolytope, 'cross-polytope');
