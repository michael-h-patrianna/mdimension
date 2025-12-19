import * as THREE from 'three';

/**
 * Self-contained 3D Noise implementation since we can't add dependencies.
 * Based on standard Perlin noise.
 */
class FastNoise {
    private perm: Uint8Array;

    constructor(seed: number = 123) {
        this.perm = new Uint8Array(512);
        const p = new Uint8Array(256);
        for (let i = 0; i < 256; i++) p[i] = i;
        
        // Shuffle
        let s = seed;
        for (let i = 255; i > 0; i--) {
            s = (s * 16807) % 2147483647;
            const j = s % (i + 1);
            [p[i], p[j]] = [p[j], p[i]];
        }
        
        for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
    }

    private fade(t: number): number { return t * t * t * (t * (t * 6 - 15) + 10); }
    private lerp(t: number, a: number, b: number): number { return a + t * (b - a); }
    private grad(hash: number, x: number, y: number, z: number): number {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    public noise(x: number, y: number, z: number): number {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const Z = Math.floor(z) & 255;

        x -= Math.floor(x);
        y -= Math.floor(y);
        z -= Math.floor(z);

        const u = this.fade(x);
        const v = this.fade(y);
        const w = this.fade(z);

        const A = this.perm[X] + Y, AA = this.perm[A] + Z, AB = this.perm[A + 1] + Z;
        const B = this.perm[X + 1] + Y, BA = this.perm[B] + Z, BB = this.perm[B + 1] + Z;

        return this.lerp(w, this.lerp(v, this.lerp(u, this.grad(this.perm[AA], x, y, z),
            this.grad(this.perm[BA], x - 1, y, z)),
            this.lerp(u, this.grad(this.perm[AB], x, y - 1, z),
                this.grad(this.perm[BB], x - 1, y - 1, z))),
            this.lerp(v, this.lerp(u, this.grad(this.perm[AA + 1], x, y, z - 1),
                this.grad(this.perm[BA + 1], x - 1, y, z - 1)),
                this.lerp(u, this.grad(this.perm[AB + 1], x, y - 1, z - 1),
                    this.grad(this.perm[BB + 1], x - 1, y - 1, z - 1))));
    }
}

/**
 * Generates a 3D texture containing noise for volumetric fog.
 * 
 * Uses a combination of Perlin noise and high-freq noise (approx Worley)
 * to create cloud-like structures.
 * 
 * @param size Resolution of the texture (default: 128 for better quality)
 * @returns Data3DTexture
 */
export function generateNoiseTexture3D(size: number = 128): THREE.Data3DTexture {
    const totalSize = size * size * size;
    const data = new Uint8Array(totalSize);

    const noiseGen = new FastNoise(Date.now());
    
    let idx = 0;
    // Optimization: Pre-calculate scalers
    const scale = 1.0 / size;
    
    for (let z = 0; z < size; z++) {
        const nz = z * scale;
        for (let y = 0; y < size; y++) {
            const ny = y * scale;
            for (let x = 0; x < size; x++) {
                const nx = x * scale;

                // 1. Base Perlin Noise
                // Map from -1..1 to 0..1
                let n = noiseGen.noise(nx * 4, ny * 4, nz * 4) * 0.5 + 0.5;
                
                // Add an octave
                n += (noiseGen.noise(nx * 8, ny * 8, nz * 8) * 0.5 + 0.5) * 0.5;
                n /= 1.5; // Normalize

                // 2. High frequency detail (approx Worley)
                let w = noiseGen.noise(nx * 16, ny * 16, nz * 16) * 0.5 + 0.5;
                w = Math.pow(w, 3.0); // Make it sparse

                // Combine: Base clouds with wispy details
                let val = n;
                
                // Apply simple erosion
                val = val - (w * 0.3);

                // Contrast
                val = (val - 0.2) * 1.5;

                data[idx] = Math.max(0, Math.min(255, val * 255));
                idx++;
            }
        }
    }

    const texture = new THREE.Data3DTexture(data, size, size, size);
    texture.format = THREE.RedFormat;
    texture.type = THREE.UnsignedByteType;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.wrapR = THREE.RepeatWrapping;
    texture.needsUpdate = true;

    return texture;
}

/**
 * Generates a 2D noise texture as a fallback for WebGL1 (no sampler3D support).
 *
 * This is a graceful degradation path for volumetric fog: we approximate 3D noise
 * by sampling the 2D texture across multiple planes in the shader.
 *
 * @param size Resolution of the 2D texture (default: 256 for decent detail)
 * @returns DataTexture
 */
export function generateNoiseTexture2D(size: number = 256): THREE.DataTexture {
    const totalSize = size * size;
    const data = new Uint8Array(totalSize);

    const noiseGen = new FastNoise(Date.now());

    let idx = 0;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const nx = x / size;
            const ny = y / size;

            // Base Perlin noise (2D slice of the 3D noise generator)
            let n = noiseGen.noise(nx * 4, ny * 4, 0.0) * 0.5 + 0.5;
            n += (noiseGen.noise(nx * 8, ny * 8, 1.0) * 0.5 + 0.5) * 0.5;
            n /= 1.5;

            // Add high-frequency detail
            let w = noiseGen.noise(nx * 16, ny * 16, 2.0) * 0.5 + 0.5;
            w = Math.pow(w, 3.0);

            let val = n - (w * 0.3);
            val = (val - 0.2) * 1.5;

            data[idx] = Math.max(0, Math.min(255, val * 255));
            idx++;
        }
    }

    const texture = new THREE.DataTexture(data, size, size, THREE.RedFormat, THREE.UnsignedByteType);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.needsUpdate = true;

    return texture;
}
