/**
 * Cloud Temporal Accumulation Pass
 *
 * Post-processing pass that handles temporal reconstruction of volumetric clouds.
 * Implements Horizon Zero Dawn-style temporal accumulation:
 *
 * 1. Reprojection: Project previous frame's accumulated cloud to current view
 * 2. Reconstruction: Blend new quarter-res pixels with reprojected history
 *
 * This pass runs after the volumetric cloud render and before final compositing.
 */

import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { TemporalCloudManager } from '@/rendering/core/TemporalCloudManager';
import {
  reprojectionVertexShader,
  reprojectionFragmentShader,
  reconstructionVertexShader,
  reconstructionFragmentShader,
} from '@/rendering/shaders/schroedinger/temporal';

export interface CloudTemporalPassOptions {
  /** History blend weight (0.0-1.0, default 0.85) */
  historyWeight?: number;
  /** Disocclusion detection threshold (default 0.15) */
  disocclusionThreshold?: number;
}

/** Uniform type helper for shader materials */
interface UniformValue<T> {
  value: T;
}

/** Reprojection shader uniforms */
interface ReprojectionUniforms {
  uPrevAccumulation: UniformValue<THREE.Texture | null>;
  uPrevPositionBuffer: UniformValue<THREE.Texture | null>;
  uPrevViewProjectionMatrix: UniformValue<THREE.Matrix4>;
  uViewProjectionMatrix: UniformValue<THREE.Matrix4>;
  uInverseViewProjectionMatrix: UniformValue<THREE.Matrix4>;
  uCameraPosition: UniformValue<THREE.Vector3>;
  uAccumulationResolution: UniformValue<THREE.Vector2>;
  uDisocclusionThreshold: UniformValue<number>;
}

/** Reconstruction shader uniforms */
interface ReconstructionUniforms {
  uCloudRender: UniformValue<THREE.Texture | null>;
  uReprojectedHistory: UniformValue<THREE.Texture | null>;
  uValidityMask: UniformValue<THREE.Texture | null>;
  uBayerOffset: UniformValue<THREE.Vector2>;
  uFrameIndex: UniformValue<number>;
  uCloudResolution: UniformValue<THREE.Vector2>;
  uAccumulationResolution: UniformValue<THREE.Vector2>;
  uHistoryWeight: UniformValue<number>;
  uHasValidHistory: UniformValue<boolean>;
}

/**
 * Post-processing pass for temporal cloud accumulation.
 */
export class CloudTemporalPass extends Pass {
  private reprojectionMaterial: THREE.ShaderMaterial;
  private reconstructionMaterial: THREE.ShaderMaterial;
  private reprojectionQuad: FullScreenQuad;
  private reconstructionQuad: FullScreenQuad;

  // Options
  private historyWeight: number;
  private disocclusionThreshold: number;

  // Validity buffer (output from reprojection)
  private validityBuffer: THREE.WebGLRenderTarget | null = null;

  constructor(options: CloudTemporalPassOptions = {}) {
    super();

    this.historyWeight = options.historyWeight ?? 0.85;
    this.disocclusionThreshold = options.disocclusionThreshold ?? 0.15;

    // Create reprojection material
    this.reprojectionMaterial = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        uPrevAccumulation: { value: null },
        uPrevPositionBuffer: { value: null },
        uPrevViewProjectionMatrix: { value: new THREE.Matrix4() },
        uViewProjectionMatrix: { value: new THREE.Matrix4() },
        uInverseViewProjectionMatrix: { value: new THREE.Matrix4() },
        uCameraPosition: { value: new THREE.Vector3() },
        uAccumulationResolution: { value: new THREE.Vector2() },
        uDisocclusionThreshold: { value: this.disocclusionThreshold },
      },
      vertexShader: reprojectionVertexShader,
      fragmentShader: reprojectionFragmentShader,
      depthTest: false,
      depthWrite: false,
    });

    // Create reconstruction material
    this.reconstructionMaterial = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        uCloudRender: { value: null },
        uReprojectedHistory: { value: null },
        uValidityMask: { value: null },
        uBayerOffset: { value: new THREE.Vector2() },
        uFrameIndex: { value: 0 },
        uCloudResolution: { value: new THREE.Vector2() },
        uAccumulationResolution: { value: new THREE.Vector2() },
        uHistoryWeight: { value: this.historyWeight },
        uHasValidHistory: { value: false },
      },
      vertexShader: reconstructionVertexShader,
      fragmentShader: reconstructionFragmentShader,
      depthTest: false,
      depthWrite: false,
    });

    this.reprojectionQuad = new FullScreenQuad(this.reprojectionMaterial);
    this.reconstructionQuad = new FullScreenQuad(this.reconstructionMaterial);
  }

  /**
   * Initialize or resize the validity buffer.
   */
  setSize(_width: number, _height: number): void {
    // Validity buffer is now managed by TemporalCloudManager's reprojectionBuffer MRT
  }

  /**
   * Render the temporal accumulation passes.
   */
  render(
    renderer: THREE.WebGLRenderer,
    _writeBuffer: THREE.WebGLRenderTarget,
    _readBuffer: THREE.WebGLRenderTarget,
    _deltaTime?: number,
    _maskActive?: boolean
  ): void {
    if (!TemporalCloudManager.isEnabled()) {
      return;
    }

    const uniforms = TemporalCloudManager.getUniforms();
    const cloudTarget = TemporalCloudManager.getCloudRenderTarget();
    const reprojectionBuffer = TemporalCloudManager.getReprojectionBuffer();
    const outputTarget = TemporalCloudManager.getWriteTarget();
    const historyTarget = TemporalCloudManager.getReadTarget();

    if (!cloudTarget || !reprojectionBuffer || !outputTarget) {
      return;
    }

    // ========================================
    // Pass 1: Reprojection
    // ========================================
    if (historyTarget && uniforms.uTemporalCloudEnabled) {
      const reprojUniforms = this.reprojectionMaterial.uniforms as unknown as ReprojectionUniforms;
      reprojUniforms.uPrevAccumulation.value = historyTarget.texture;
      reprojUniforms.uPrevPositionBuffer.value = uniforms.uPrevPositionBuffer;
      reprojUniforms.uPrevViewProjectionMatrix.value.copy(uniforms.uPrevViewProjectionMatrix);
      reprojUniforms.uAccumulationResolution.value.copy(uniforms.uAccumulationResolution);
      reprojUniforms.uDisocclusionThreshold.value = this.disocclusionThreshold;

      // Render reprojection to intermediate buffer
      renderer.setRenderTarget(reprojectionBuffer);
      this.reprojectionQuad.render(renderer);
    }

    // ========================================
    // Pass 2: Reconstruction
    // ========================================
    const reconUniforms = this.reconstructionMaterial.uniforms as unknown as ReconstructionUniforms;
    reconUniforms.uCloudRender.value = cloudTarget.texture;
    
    // Bind MRT textures from reprojection buffer
    // texture[0] is reprojected color, texture[1] is validity mask
    if (reprojectionBuffer.textures && reprojectionBuffer.textures.length >= 2) {
      reconUniforms.uReprojectedHistory.value = reprojectionBuffer.textures[0] ?? null;
      reconUniforms.uValidityMask.value = reprojectionBuffer.textures[1] ?? null;
    } else {
      // Fallback for non-MRT (should not happen with updated Manager)
      reconUniforms.uReprojectedHistory.value = reprojectionBuffer.texture;
      reconUniforms.uValidityMask.value = null;
    }

    reconUniforms.uBayerOffset.value.copy(uniforms.uBayerOffset);
    reconUniforms.uFrameIndex.value = uniforms.uFrameIndex;
    reconUniforms.uCloudResolution.value.copy(uniforms.uCloudResolution);
    reconUniforms.uAccumulationResolution.value.copy(uniforms.uAccumulationResolution);
    reconUniforms.uHistoryWeight.value = this.historyWeight;
    reconUniforms.uHasValidHistory.value = TemporalCloudManager.hasValidHistory();

    // Render reconstruction to accumulation buffer
    renderer.setRenderTarget(this.renderToScreen ? null : outputTarget);
    this.reconstructionQuad.render(renderer);

    // Reset render target to null (caller manages target state)
    renderer.setRenderTarget(null);
  }

  /**
   * Update camera uniforms for reprojection calculation.
   * Call this each frame before render() to ensure correct motion vectors.
   *
   * @param camera - The scene camera (perspective or orthographic)
   */
  updateCamera(camera: THREE.Camera): void {
    const viewProj = new THREE.Matrix4();
    viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);

    const invViewProj = viewProj.clone().invert();

    const uniforms = this.reprojectionMaterial.uniforms as any;
    uniforms.uViewProjectionMatrix.value.copy(viewProj);
    uniforms.uInverseViewProjectionMatrix.value.copy(invViewProj);

    if (camera instanceof THREE.PerspectiveCamera || camera instanceof THREE.OrthographicCamera) {
      const worldPos = new THREE.Vector3();
      camera.getWorldPosition(worldPos);
      uniforms.uCameraPosition.value.copy(worldPos);
    }
  }

  /**
   * Set history blend weight for temporal accumulation.
   * Higher values favor reprojected history over new data.
   *
   * @param weight - Blend weight between 0.0 (favor new) and 1.0 (favor history). Default: 0.85
   */
  setHistoryWeight(weight: number): void {
    this.historyWeight = Math.max(0, Math.min(1, weight));
    (this.reconstructionMaterial.uniforms as any).uHistoryWeight.value = this.historyWeight;
  }

  /**
   * Set disocclusion detection threshold.
   * Lower values are stricter about rejecting potentially invalid history.
   *
   * @param threshold - Depth variance threshold. Default: 0.15
   */
  setDisocclusionThreshold(threshold: number): void {
    this.disocclusionThreshold = Math.max(0, threshold);
    (this.reprojectionMaterial.uniforms as any).uDisocclusionThreshold.value = this.disocclusionThreshold;
  }

  /**
   * Dispose all GPU resources held by this pass.
   * Call when removing the pass from the effect composer.
   */
  dispose(): void {
    this.reprojectionMaterial.dispose();
    this.reconstructionMaterial.dispose();
    this.reprojectionQuad.dispose();
    this.reconstructionQuad.dispose();
    this.validityBuffer?.dispose();
    this.validityBuffer = null;
  }
}
