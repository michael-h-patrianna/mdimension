
import { generateHypercube, generateHypercubeFaces } from '../src/lib/geometry/hypercube';
import { createVector, subtractVectors, crossProduct3D, dotProduct, addVectors, scaleVector } from '../src/lib/math';

function verifyWinding() {
    const dim = 3;
    const geometry = generateHypercube(dim);
    const faces = generateHypercubeFaces(dim);
    
    console.log(`Checking ${faces.length} faces for ${dim}D Hypercube`);
    
    let outwardCount = 0;
    let inwardCount = 0;
    let mixedCount = 0;
    
    for (let i = 0; i < faces.length; i++) {
        const face = faces[i];
        // Vertices: 0, 1, 2, 3
        const v0 = geometry.vertices[face[0]];
        const v1 = geometry.vertices[face[1]];
        const v2 = geometry.vertices[face[2]];
        const v3 = geometry.vertices[face[3]];
        
        // Compute center of face
        let center = createVector(dim);
        for (const idx of face) {
            center = addVectors(center, geometry.vertices[idx]);
        }
        center = scaleVector(center, 1.0 / face.length);
        
        // Triangle 1: 0-1-2
        const n1 = crossProduct3D(subtractVectors(v1, v0), subtractVectors(v2, v0));
        const d1 = dotProduct(n1, center);
        const t1Out = d1 > 0.0001;
        
        // Triangle 2: 0-2-3
        const n2 = crossProduct3D(subtractVectors(v2, v0), subtractVectors(v3, v0));
        const d2 = dotProduct(n2, center);
        const t2Out = d2 > 0.0001;
        
        if (t1Out && t2Out) {
            outwardCount++;
            console.log(`Face ${i}: OK (Both Out)`);
        } else if (!t1Out && !t2Out) {
            inwardCount++;
            console.log(`Face ${i}: INVERTED (Both In)`);
        } else {
            mixedCount++;
            console.log(`Face ${i}: MIXED! T1=${t1Out?'Out':'In'} T2=${t2Out?'Out':'In'}`);
            console.log(`  Indices: ${face.join(',')}`);
            console.log(`  Coords:`, 
                v0.slice(0,3), v1.slice(0,3), v2.slice(0,3), v3.slice(0,3)
            );
        }
    }
    
    console.log(`Summary: ${outwardCount} OK, ${inwardCount} Inverted, ${mixedCount} Mixed`);
}

verifyWinding();
