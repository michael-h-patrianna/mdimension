
import { generateHypercube, generateHypercubeFaces } from '../src/lib/geometry/hypercube';
import { createVector, subtractVectors, crossProduct3D, dotProduct, addVectors, scaleVector } from '../src/lib/math';

function verifyWinding() {
    const dim = 3;
    const geometry = generateHypercube(dim);
    const faces = generateHypercubeFaces(dim);
    
    console.log(`Checking ${faces.length} faces for ${dim}D Hypercube`);
    
    let outwardCount = 0;
    let inwardCount = 0;
    
    for (let i = 0; i < faces.length; i++) {
        const face = faces[i];
        // Get vertices
        const v0 = geometry.vertices[face[0]];
        const v1 = geometry.vertices[face[1]];
        const v2 = geometry.vertices[face[2]];
        
        // Compute center of face
        let center = createVector(dim);
        for (const idx of face) {
            center = addVectors(center, geometry.vertices[idx]);
        }
        center = scaleVector(center, 1.0 / face.length);
        
        // Compute 3D edges (project simply by taking first 3 coords)
        const e1 = subtractVectors(v1, v0);
        const e2 = subtractVectors(v2, v0);
        
        // Compute normal
        const normal = crossProduct3D(e1, e2);
        
        // Check dot product with center (radial vector)
        const dot = dotProduct(normal, center);
        
        if (dot > 0.0001) {
            outwardCount++;
            console.log(`Face ${i}: OUT (dot=${dot})`);
        } else if (dot < -0.0001) {
            inwardCount++;
            console.log(`Face ${i}: IN (dot=${dot})`);
        } else {
            console.log(`Face ${i}: ZERO (dot=${dot})`);
        }
    }
    
    console.log(`Summary: ${outwardCount} Outward, ${inwardCount} Inward`);
}

verifyWinding();
