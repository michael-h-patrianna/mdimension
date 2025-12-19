import { describe, it, expect } from 'vitest';
import { generateNoiseTexture3D } from '@/rendering/utils/NoiseGenerator';
import * as THREE from 'three';

describe('NoiseGenerator', () => {
  it('should generate a 3D texture with default size', () => {
    const texture = generateNoiseTexture3D();
    expect(texture).toBeInstanceOf(THREE.Data3DTexture);
    expect(texture.image.width).toBe(64);
    expect(texture.image.height).toBe(64);
    expect(texture.image.depth).toBe(64);
    expect(texture.format).toBe(THREE.RedFormat);
    expect(texture.type).toBe(THREE.UnsignedByteType);
  });

  it('should generate a 3D texture with custom size', () => {
    const size = 32;
    const texture = generateNoiseTexture3D(size);
    expect(texture.image.width).toBe(size);
    expect(texture.image.height).toBe(size);
    expect(texture.image.depth).toBe(size);
    expect(texture.image.data.length).toBe(size * size * size);
  });

  it('should generate valid noise data', () => {
    const size = 16;
    const texture = generateNoiseTexture3D(size);
    const data = texture.image.data;
    
    // Check if data contains values other than just 0 or 255 (indicating noise)
    let min = 255;
    let max = 0;
    let hasVariation = false;
    
    for (let i = 0; i < data.length; i++) {
        const val = data[i];
        if (val < min) min = val;
        if (val > max) max = val;
    }
    
    hasVariation = min < max;
    
    expect(hasVariation).toBe(true);
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThanOrEqual(255);
  });
});
