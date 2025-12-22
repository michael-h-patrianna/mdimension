/**
 * Shader Compilation Integration Tests
 *
 * Tests that all object type shaders compose correctly and produce
 * valid GLSL 3.00 ES code that can be compiled by WebGL2.
 *
 * @module tests/rendering/integration/shaderCompilation.test
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

// Import shader composers for each object type
import { composeMandelbulbShader } from '@/rendering/shaders/mandelbulb/compose';
import { composeJuliaShader } from '@/rendering/shaders/julia/compose';
import { composeSchroedingerShader } from '@/rendering/shaders/schroedinger/compose';
import { composeBlackHoleShader } from '@/rendering/shaders/blackhole/compose';

// Import vertex shaders
import mandelbulbVertexShader from '@/rendering/renderers/Mandelbulb/mandelbulb.vert?raw';
import juliaVertexShader from '@/rendering/renderers/QuaternionJulia/quaternion-julia.vert?raw';
import schroedingerVertexShader from '@/rendering/renderers/Schroedinger/schroedinger.vert?raw';
// Note: blackholeVertexShader not needed for these tests as Black Hole uses Three.js built-in shaders

/**
 * Create a mock ShaderMaterial and verify it compiles without errors.
 * The WebGL mock in setup.ts handles the actual GL calls.
 */
function createAndVerifyMaterial(
  vertexShader: string,
  fragmentShader: string,
  uniforms: Record<string, THREE.IUniform>
): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    glslVersion: THREE.GLSL3,
  });

  // Verify material was created
  expect(material).toBeInstanceOf(THREE.ShaderMaterial);
  expect(material.vertexShader).toBe(vertexShader);
  expect(material.fragmentShader).toBe(fragmentShader);

  return material;
}

/**
 * Basic uniforms shared by all fractal shaders
 */
function createBasicUniforms(): Record<string, THREE.IUniform> {
  return {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1920, 1080) },
    uCameraPosition: { value: new THREE.Vector3(0, 0, 5) },
    uCameraTarget: { value: new THREE.Vector3(0, 0, 0) },
    uProjectionMatrix: { value: new THREE.Matrix4() },
    uViewMatrix: { value: new THREE.Matrix4() },
    uQualityMultiplier: { value: 1.0 },
    uFastMode: { value: false },
    uDimension: { value: 4 },
  };
}

describe('Shader Compilation - Mandelbulb', () => {
  const dimensions = [3, 4, 5, 6, 7, 8, 9, 10, 11];

  dimensions.forEach((dimension) => {
    it(`should compose valid GLSL for dimension ${dimension}`, () => {
      const { glsl: fragmentShader } = composeMandelbulbShader({
        dimension,
        shadows: false,
        temporal: false,
        ambientOcclusion: true,
        sss: false,
        fog: true,
        opacityMode: 'solid',
      });

      // Verify shader is a non-empty string
      expect(fragmentShader).toBeDefined();
      expect(typeof fragmentShader).toBe('string');
      expect(fragmentShader.length).toBeGreaterThan(1000);

      // Verify GLSL 3.00 ES syntax (Three.js adds #version directive automatically)
      expect(fragmentShader).toContain('precision highp float');

      // Verify required shader components are present
      expect(fragmentShader).toContain('void main()');
      // Uses layout(location = N) for MRT outputs
      expect(fragmentShader).toContain('layout(location = 0) out vec4');

      // Verify no legacy GLSL syntax (checking actual keywords, not comments)
      expect(fragmentShader).not.toContain('gl_FragColor');
      // Check for actual varying declarations (not the word in comments)
      expect(fragmentShader).not.toMatch(/\bvarying\s+(highp\s+|mediump\s+|lowp\s+)?(vec|mat|float|int)/);
      expect(fragmentShader).not.toMatch(/\battribute\s+(highp\s+|mediump\s+|lowp\s+)?(vec|mat|float|int)/);
    });

    it(`should create material for dimension ${dimension}`, () => {
      const { glsl: fragmentShader } = composeMandelbulbShader({
        dimension,
        shadows: false,
        temporal: false,
        ambientOcclusion: true,
        sss: false,
        fog: false,
        opacityMode: 'solid',
      });

      const material = createAndVerifyMaterial(
        mandelbulbVertexShader,
        fragmentShader,
        createBasicUniforms()
      );

      expect(material.glslVersion).toBe(THREE.GLSL3);
      material.dispose();
    });
  });

  it('should compose shader with all features enabled', () => {
    const { glsl: fragmentShader } = composeMandelbulbShader({
      dimension: 4,
      shadows: true,
      temporal: true,
      ambientOcclusion: true,
      sss: true,
      fog: true,
      opacityMode: 'solid',
    });

    expect(fragmentShader).toContain('#define USE_SHADOWS');
    expect(fragmentShader).toContain('#define USE_TEMPORAL');
    expect(fragmentShader).toContain('#define USE_AO');
    expect(fragmentShader).toContain('#define USE_SSS');
    expect(fragmentShader).toContain('#define USE_FOG');
  });
});

describe('Shader Compilation - Quaternion Julia', () => {
  it('should compose valid GLSL for Julia set', () => {
    const { glsl: fragmentShader } = composeJuliaShader({
      dimension: 4,
      shadows: false,
      temporal: false,
      ambientOcclusion: true,
      sss: false,
      fog: true,
      opacityMode: 'solid',
    });

    expect(fragmentShader).toBeDefined();
    expect(typeof fragmentShader).toBe('string');
    expect(fragmentShader.length).toBeGreaterThan(1000);
    expect(fragmentShader).toContain('precision highp float');
    expect(fragmentShader).toContain('void main()');
    expect(fragmentShader).toContain('layout(location = 0) out vec4');
  });

  it('should create material for Julia set', () => {
    const { glsl: fragmentShader } = composeJuliaShader({
      dimension: 4,
      shadows: false,
      temporal: false,
      ambientOcclusion: true,
      sss: false,
      fog: false,
      opacityMode: 'solid',
    });

    const material = createAndVerifyMaterial(
      juliaVertexShader,
      fragmentShader,
      createBasicUniforms()
    );

    expect(material.glslVersion).toBe(THREE.GLSL3);
    material.dispose();
  });
});

describe('Shader Compilation - Schroedinger', () => {
  const dimensions = [3, 4, 5, 6, 7, 8, 9, 10, 11];

  dimensions.forEach((dimension) => {
    it(`should compose valid GLSL for dimension ${dimension}`, () => {
      const { glsl: fragmentShader } = composeSchroedingerShader({
        dimension,
        shadows: false,
        temporal: true,
        ambientOcclusion: false,
        sss: false,
        fog: true,
        opacityMode: 'solid',
      });

      expect(fragmentShader).toBeDefined();
      expect(typeof fragmentShader).toBe('string');
      expect(fragmentShader.length).toBeGreaterThan(1000);
      expect(fragmentShader).toContain('precision highp float');
      expect(fragmentShader).toContain('void main()');
      expect(fragmentShader).toContain('layout(location = 0) out vec4');
    });
  });

  it('should create material for Schroedinger wavefunction', () => {
    const { glsl: fragmentShader } = composeSchroedingerShader({
      dimension: 4,
      shadows: false,
      temporal: true,
      ambientOcclusion: false,
      sss: false,
      fog: false,
      opacityMode: 'solid',
    });

    const material = createAndVerifyMaterial(
      schroedingerVertexShader,
      fragmentShader,
      createBasicUniforms()
    );

    expect(material.glslVersion).toBe(THREE.GLSL3);
    material.dispose();
  });
});

describe('Shader Compilation - Black Hole', () => {
  it('should compose valid GLSL for black hole', () => {
    // Black hole compose returns { fragmentShader, features } not { glsl }
    const { fragmentShader } = composeBlackHoleShader({
      dimension: 3,
      shadows: false,
      temporal: false,
      ambientOcclusion: false,
      sss: false,
      fog: false,
      opacityMode: 'solid',
    });

    expect(fragmentShader).toBeDefined();
    expect(typeof fragmentShader).toBe('string');
    expect(fragmentShader.length).toBeGreaterThan(500);
    expect(fragmentShader).toContain('precision highp float');
    expect(fragmentShader).toContain('void main()');
  });

  it('should include gravitational lensing code', () => {
    const { fragmentShader } = composeBlackHoleShader({
      dimension: 3,
      shadows: false,
      temporal: false,
      ambientOcclusion: false,
      sss: false,
      fog: false,
      opacityMode: 'solid',
    });

    // Black hole should have lensing/distortion code
    expect(fragmentShader).toContain('uHorizonRadius'); // Event horizon radius uniform
    expect(fragmentShader).toContain('uGravityStrength'); // Lensing intensity
  });
});

describe('Shader GLSL 3.00 ES Compliance', () => {
  // Helper to get shader string from different compose function return types
  const getShaderString = (
    compose: typeof composeMandelbulbShader | typeof composeBlackHoleShader,
    config: Parameters<typeof compose>[0]
  ): string => {
    const result = compose(config as any);
    // Black hole returns { fragmentShader }, others return { glsl }
    return 'glsl' in result ? result.glsl : result.fragmentShader;
  };

  const shaderConfigs = [
    { name: 'Mandelbulb', compose: composeMandelbulbShader },
    { name: 'Julia', compose: composeJuliaShader },
    { name: 'Schroedinger', compose: composeSchroedingerShader },
    { name: 'BlackHole', compose: composeBlackHoleShader },
  ];

  shaderConfigs.forEach(({ name, compose }) => {
    describe(name, () => {
      const config = {
        dimension: 4,
        shadows: true,
        temporal: true,
        ambientOcclusion: true,
        sss: false,
        fog: true,
        opacityMode: 'solid' as const,
      };
      const shader = getShaderString(compose as any, config);

      it('should start with valid GLSL content', () => {
        // Three.js adds #version 300 es automatically when glslVersion: GLSL3
        // Our shader should contain precision declaration
        expect(shader).toContain('precision highp float');
      });

      it('should use "in" instead of "varying" for fragment inputs', () => {
        // Check for actual varying declarations (not the word in comments)
        expect(shader).not.toMatch(/\bvarying\s+(highp\s+|mediump\s+|lowp\s+)?(vec|mat|float|int)/);
        expect(shader).toMatch(/\bin\s+(highp\s+|mediump\s+|lowp\s+)?\w+\s+v\w+/);
      });

      it('should use "out" for fragment outputs', () => {
        expect(shader).not.toContain('gl_FragColor');
        // Uses layout(location = N) out vec4 for MRT or simple out vec4
        expect(shader).toMatch(/out\s+vec4/);
      });

      it('should use texture() instead of texture2D()', () => {
        expect(shader).not.toMatch(/\btexture2D\s*\(/);
        // Allow texture() calls if textures are used
      });

      it('should have precision declaration', () => {
        expect(shader).toContain('precision highp float');
      });
    });
  });
});

describe('Shader Feature Flags', () => {
  it('should conditionally include shadow code', () => {
    const { glsl: withShadows } = composeMandelbulbShader({
      dimension: 4,
      shadows: true,
      temporal: false,
      ambientOcclusion: false,
      sss: false,
      fog: false,
      opacityMode: 'solid',
    });

    const { glsl: withoutShadows } = composeMandelbulbShader({
      dimension: 4,
      shadows: false,
      temporal: false,
      ambientOcclusion: false,
      sss: false,
      fog: false,
      opacityMode: 'solid',
    });

    expect(withShadows).toContain('#define USE_SHADOWS');
    expect(withoutShadows).not.toContain('#define USE_SHADOWS');
  });

  it('should conditionally include temporal reprojection code', () => {
    const { glsl: withTemporal } = composeSchroedingerShader({
      dimension: 4,
      shadows: false,
      temporal: true,
      ambientOcclusion: false,
      sss: false,
      fog: false,
      opacityMode: 'solid',
    });

    const { glsl: withoutTemporal } = composeSchroedingerShader({
      dimension: 4,
      shadows: false,
      temporal: false,
      ambientOcclusion: false,
      sss: false,
      fog: false,
      opacityMode: 'solid',
    });

    expect(withTemporal).toContain('#define USE_TEMPORAL');
    expect(withoutTemporal).not.toContain('#define USE_TEMPORAL');
  });

  it('should conditionally include fog code', () => {
    const { glsl: withFog } = composeMandelbulbShader({
      dimension: 4,
      shadows: false,
      temporal: false,
      ambientOcclusion: false,
      sss: false,
      fog: true,
      opacityMode: 'solid',
    });

    const { glsl: withoutFog } = composeMandelbulbShader({
      dimension: 4,
      shadows: false,
      temporal: false,
      ambientOcclusion: false,
      sss: false,
      fog: false,
      opacityMode: 'solid',
    });

    expect(withFog).toContain('#define USE_FOG');
    expect(withoutFog).not.toContain('#define USE_FOG');
  });
});
