/**
 * Render Graph
 *
 * Main orchestrator for the declarative render graph system.
 * Manages passes, resources, compilation, and execution.
 *
 * Key responsibilities:
 * - Pass registration and lifecycle
 * - Resource registration and pool management
 * - Graph compilation (dependency resolution, ordering)
 * - Frame execution (pass invocation with context)
 * - Performance statistics collection (CPU and GPU timing)
 *
 * @module rendering/graph/RenderGraph
 */

import * as THREE from 'three'

import { GPUTimer } from './GPUTimer'
import { GraphCompiler } from './GraphCompiler'
import { ResourcePool } from './ResourcePool'
import type {
  CompiledGraph,
  CompileOptions,
  FrameStats,
  PassTiming,
  RenderContext,
  RenderPass,
  RenderResourceConfig,
} from './types'

// =============================================================================
// RenderGraphContext Implementation
// =============================================================================

/**
 * Concrete implementation of RenderContext.
 */
class RenderGraphContext implements RenderContext {
  constructor(
    public renderer: THREE.WebGLRenderer,
    public scene: THREE.Scene,
    public camera: THREE.Camera,
    public delta: number,
    public time: number,
    public size: { width: number; height: number },
    private pool: ResourcePool,
    private pingPongResources: Set<string>
  ) {}

  getResource<T = THREE.WebGLRenderTarget | THREE.Texture>(resourceId: string): T | null {
    return this.pool.get(resourceId) as T | null
  }

  getWriteTarget(resourceId: string): THREE.WebGLRenderTarget | null {
    if (this.pingPongResources.has(resourceId)) {
      return this.pool.getWriteTarget(resourceId)
    }
    return this.pool.get(resourceId)
  }

  getReadTarget(resourceId: string): THREE.WebGLRenderTarget | null {
    if (this.pingPongResources.has(resourceId)) {
      return this.pool.getReadTarget(resourceId)
    }
    return this.pool.get(resourceId)
  }

  getReadTexture(resourceId: string, attachment?: number | 'depth'): THREE.Texture | null {
    if (this.pingPongResources.has(resourceId)) {
      return this.pool.getReadTarget(resourceId)?.texture ?? null
    }
    return this.pool.getTexture(resourceId, attachment)
  }
}

// =============================================================================
// RenderGraph Class
// =============================================================================

/**
 * Declarative render graph for managing complex rendering pipelines.
 *
 * @example
 * ```typescript
 * const graph = new RenderGraph();
 *
 * // Define resources
 * graph.addResource({
 *   id: 'sceneColor',
 *   type: 'renderTarget',
 *   size: { mode: 'screen' },
 *   depthBuffer: true,
 * });
 *
 * graph.addResource({
 *   id: 'bloom',
 *   type: 'renderTarget',
 *   size: { mode: 'fraction', fraction: 0.5 },
 * });
 *
 * // Add passes
 * graph.addPass(new ScenePass({
 *   id: 'scene',
 *   outputs: [{ resourceId: 'sceneColor', access: 'write' }],
 * }));
 *
 * graph.addPass(new BloomPass({
 *   id: 'bloom',
 *   inputs: [{ resourceId: 'sceneColor', access: 'read' }],
 *   outputs: [{ resourceId: 'bloom', access: 'write' }],
 * }));
 *
 * // Compile once (or when graph changes)
 * graph.compile();
 *
 * // Execute each frame
 * graph.execute(renderer, scene, camera, delta, time);
 * ```
 */
export class RenderGraph {
  private compiler = new GraphCompiler()
  private pool = new ResourcePool()
  private compiled: CompiledGraph | null = null
  private isDirty = true

  // Statistics
  private timingEnabled = false
  private lastFrameStats: FrameStats | null = null

  // GPU Timing
  private gpuTimer = new GPUTimer()
  private gpuTimingEnabled = false
  private rendererInitialized = false

  // Screen size
  private width = 1
  private height = 1

  // Elapsed time tracking
  private elapsedTime = 0

  // Passthrough resources for disabled passes
  private passthroughMaterial: THREE.ShaderMaterial | null = null
  private passthroughMesh: THREE.Mesh | null = null
  private passthroughScene: THREE.Scene | null = null
  private passthroughCamera: THREE.OrthographicCamera | null = null

  // ==========================================================================
  // Passthrough for disabled passes
  // ==========================================================================

  /**
   * Ensure passthrough resources are initialized.
   */
  private ensurePassthrough(): void {
    if (this.passthroughMaterial) return

    this.passthroughMaterial = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        tDiffuse: { value: null },
      },
      vertexShader: `
        out vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        in vec2 vUv;
        uniform sampler2D tDiffuse;
        layout(location = 0) out vec4 fragColor;
        void main() {
          fragColor = texture(tDiffuse, vUv);
        }
      `,
      depthTest: false,
      depthWrite: false,
    })

    const geometry = new THREE.PlaneGeometry(2, 2)
    this.passthroughMesh = new THREE.Mesh(geometry, this.passthroughMaterial)
    this.passthroughMesh.frustumCulled = false

    this.passthroughScene = new THREE.Scene()
    this.passthroughScene.add(this.passthroughMesh)

    this.passthroughCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  }

  /**
   * Copy input texture to output for disabled pass.
   */
  private executePassthrough(
    renderer: THREE.WebGLRenderer,
    inputTexture: THREE.Texture,
    outputTarget: THREE.WebGLRenderTarget | null
  ): void {
    this.ensurePassthrough()

    if (!this.passthroughMaterial || !this.passthroughScene || !this.passthroughCamera) {
      return
    }

    this.passthroughMaterial.uniforms['tDiffuse']!.value = inputTexture
    renderer.setRenderTarget(outputTarget)
    renderer.render(this.passthroughScene, this.passthroughCamera)
  }

  // ==========================================================================
  // Resource Management
  // ==========================================================================

  /**
   * Add a resource to the graph.
   *
   * Resources are GPU objects (render targets, textures) managed by the graph.
   * They are created lazily and automatically resized.
   *
   * @param config - Resource configuration
   * @returns this for chaining
   */
  addResource(config: RenderResourceConfig): this {
    this.compiler.addResource(config)
    this.pool.register(config)
    this.isDirty = true
    return this
  }

  /**
   * Remove a resource from the graph.
   *
   * @param resourceId - Resource identifier
   * @returns this for chaining
   */
  removeResource(resourceId: string): this {
    this.compiler.removeResource(resourceId)
    this.pool.unregister(resourceId)
    this.isDirty = true
    return this
  }

  /**
   * Check if a resource exists.
   *
   * @param resourceId - Resource identifier
   */
  hasResource(resourceId: string): boolean {
    return this.pool.has(resourceId)
  }

  /**
   * Get a resource's render target directly.
   *
   * Useful for external code that needs to access graph resources.
   *
   * @param resourceId - Resource identifier
   */
  getResource(resourceId: string): THREE.WebGLRenderTarget | null {
    return this.pool.get(resourceId)
  }

  /**
   * Get a resource's write target directly.
   *
   * Useful for accessing the current write buffer of a ping-pong resource.
   *
   * @param resourceId - Resource identifier
   */
  getWriteTarget(resourceId: string): THREE.WebGLRenderTarget | null {
    return this.pool.getWriteTarget(resourceId)
  }
  /**
   * Get a resource's texture directly.
   *
   * @param resourceId - Resource identifier
   */
  getTexture(resourceId: string, attachment?: number | 'depth'): THREE.Texture | null {
    return this.pool.getTexture(resourceId, attachment)
  }

  // ==========================================================================
  // Pass Management
  // ==========================================================================

  /**
   * Add a pass to the graph.
   *
   * @param pass - The render pass
   * @returns this for chaining
   */
  addPass(pass: RenderPass): this {
    this.compiler.addPass(pass)
    this.isDirty = true
    return this
  }

  /**
   * Remove a pass from the graph.
   *
   * @param passId - Pass identifier
   * @returns this for chaining
   */
  removePass(passId: string): this {
    this.compiler.removePass(passId)
    this.isDirty = true
    return this
  }

  // ==========================================================================
  // Compilation
  // ==========================================================================

  /**
   * Compile the graph.
   *
   * This resolves pass dependencies and determines execution order.
   * Call this after modifying passes/resources, or it will be called
   * automatically on first execute().
   *
   * @param options - Compilation options
   * @returns Compilation result with warnings
   * @throws Error if graph contains cycles
   */
  compile(options: CompileOptions = {}): CompiledGraph {
    this.compiled = this.compiler.compile(options)
    this.isDirty = false

    // Enable ping-pong for resources that need it
    for (const resourceId of this.compiled.pingPongResources) {
      this.pool.enablePingPong(resourceId)
    }

    return this.compiled
  }

  /**
   * Check if graph needs recompilation.
   */
  needsCompile(): boolean {
    return this.isDirty || this.compiled === null
  }

  /**
   * Mark graph as dirty (needs recompilation).
   */
  invalidate(): void {
    this.isDirty = true
  }

  // ==========================================================================
  // Execution
  // ==========================================================================

  /**
   * Execute the render graph for one frame.
   *
   * @param renderer - Three.js WebGL renderer
   * @param scene - Scene to render
   * @param camera - Camera to use
   * @param delta - Time since last frame in seconds
   */
  execute(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    delta: number
  ): void {
    // Skip execution if size is invalid (can happen on first frames before canvas is sized)
    // This prevents GL_INVALID_FRAMEBUFFER_OPERATION errors from zero-sized render targets
    if (this.width < 1 || this.height < 1) {
      return
    }

    // Initialize GPU timer on first execution (renderer is now available)
    if (!this.rendererInitialized) {
      this.gpuTimer.initialize(renderer)
      if (this.gpuTimingEnabled) {
        this.gpuTimer.setEnabled(true)
      }
      this.rendererInitialized = true
    }

    // Auto-compile if needed
    if (this.needsCompile()) {
      this.compile()
    }

    if (!this.compiled) {
      console.warn('RenderGraph: No compiled graph to execute')
      return
    }

    // Update timing
    this.elapsedTime += delta

    // Update pool with current screen size
    this.pool.updateSize(this.width, this.height)

    // Begin GPU timing frame
    this.gpuTimer.beginFrame()

    // Create execution context
    const context = new RenderGraphContext(
      renderer,
      scene,
      camera,
      delta,
      this.elapsedTime,
      { width: this.width, height: this.height },
      this.pool,
      this.compiled.pingPongResources
    )

    // Execute passes
    const passTiming: PassTiming[] = []
    let targetSwitches = 0

    for (const pass of this.compiled.passes) {
      // Check if pass is enabled
      const enabled = pass.config.enabled?.() ?? true

      if (!enabled) {
        // For disabled passes, do passthrough to maintain the chain
        // Use the first input (typically color buffer) and first output
        const inputs = pass.config.inputs ?? []
        const outputs = pass.config.outputs ?? []

        if (inputs.length >= 1 && outputs.length >= 1) {
          // First input is typically the color/main input
          const inputId = inputs[0]!.resourceId
          const outputId = outputs[0]!.resourceId

          const inputTexture = context.getReadTexture(inputId)
          const outputTarget = context.getWriteTarget(outputId)

          if (inputTexture && outputTarget) {
            this.executePassthrough(renderer, inputTexture, outputTarget)
          }
        }

        if (this.timingEnabled) {
          passTiming.push({
            passId: pass.id,
            gpuTimeMs: 0,
            cpuTimeMs: 0,
            skipped: true,
          })
        }
        continue
      }

      // Execute pass with timing if enabled
      if (this.timingEnabled) {
        const startTime = performance.now()

        // Begin GPU query for this pass
        this.gpuTimer.beginQuery(pass.id)

        pass.execute(context)

        // End GPU query
        this.gpuTimer.endQuery()

        const endTime = performance.now()

        // Get GPU time from previous frames (queries are async)
        const gpuTimeMs = this.gpuTimer.getPassTime(pass.id)

        passTiming.push({
          passId: pass.id,
          gpuTimeMs,
          cpuTimeMs: endTime - startTime,
          skipped: false,
        })
      } else {
        pass.execute(context)
      }

      targetSwitches++
    }

    // End GPU timing frame
    this.gpuTimer.endFrame()

    // Swap ping-pong buffers
    for (const resourceId of this.compiled.pingPongResources) {
      this.pool.swap(resourceId)
    }

    // End frame
    this.pool.endFrame()

    // Store stats
    if (this.timingEnabled) {
      this.lastFrameStats = {
        totalTimeMs: passTiming.reduce((sum, p) => sum + p.cpuTimeMs, 0),
        passTiming,
        targetSwitches,
        vramUsage: this.pool.getVRAMUsage(),
      }
    }
  }

  // ==========================================================================
  // Screen Size
  // ==========================================================================

  /**
   * Update screen dimensions.
   *
   * Call this when the viewport size changes.
   *
   * @param width - Screen width in pixels
   * @param height - Screen height in pixels
   */
  setSize(width: number, height: number): void {
    this.width = Math.max(1, width)
    this.height = Math.max(1, height)
    // CRITICAL: Force resize on next ensureAllocated call
    // This ensures the pool actually resizes targets on the next frame
    this.pool.updateSize(this.width, this.height)
    // Force a recompile to ensure all passes use new dimensions
    this.isDirty = true
  }

  /**
   * Get current screen dimensions.
   */
  getSize(): { width: number; height: number } {
    return { width: this.width, height: this.height }
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  /**
   * Enable or disable timing collection (CPU timing).
   *
   * @param enabled - Whether to collect timing data
   */
  enableTiming(enabled: boolean): void {
    this.timingEnabled = enabled
  }

  /**
   * Enable or disable GPU timing queries.
   *
   * Uses EXT_disjoint_timer_query_webgl2 extension when available.
   * GPU timing is inherently asynchronous - results are typically
   * available 1-2 frames after the pass executes.
   *
   * @param enabled - Whether to collect GPU timing data
   */
  enableTimingQueries(enabled: boolean): void {
    this.gpuTimingEnabled = enabled
    if (this.rendererInitialized) {
      this.gpuTimer.setEnabled(enabled)
    }
    // Also enable CPU timing when GPU timing is enabled
    if (enabled) {
      this.timingEnabled = true
    }
  }

  /**
   * Check if GPU timing queries are available.
   *
   * @returns True if EXT_disjoint_timer_query_webgl2 is supported
   */
  isGPUTimingAvailable(): boolean {
    return this.gpuTimer.isAvailable()
  }

  /**
   * Get per-pass timing information.
   *
   * Returns timing data from the most recent frame where results
   * are available. GPU timings are asynchronous and may lag by 1-2 frames.
   *
   * @returns Array of pass timing data
   */
  getPassTimings(): PassTiming[] {
    return this.lastFrameStats?.passTiming ?? []
  }

  /**
   * Get last frame's statistics.
   *
   * @returns Frame statistics or null if timing is disabled
   */
  getFrameStats(): FrameStats | null {
    return this.lastFrameStats
  }

  /**
   * Get estimated VRAM usage.
   */
  getVRAMUsage(): number {
    return this.pool.getVRAMUsage()
  }

  /**
   * Get list of registered resource IDs.
   */
  getResourceIds(): string[] {
    return this.pool.getResourceIds()
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  /**
   * Dispose all resources and passes.
   */
  dispose(): void {
    // Dispose passes
    if (this.compiled) {
      for (const pass of this.compiled.passes) {
        pass.dispose?.()
      }
    }

    // Dispose GPU timer
    this.gpuTimer.dispose()

    // Dispose resource pool
    this.pool.dispose()

    // Dispose passthrough resources
    if (this.passthroughMaterial) {
      this.passthroughMaterial.dispose()
      this.passthroughMaterial = null
    }
    if (this.passthroughMesh) {
      this.passthroughMesh.geometry.dispose()
      this.passthroughMesh = null
    }
    this.passthroughScene = null
    this.passthroughCamera = null

    // Clear compiler
    this.compiler.clear()

    this.compiled = null
    this.isDirty = true
    this.rendererInitialized = false
  }

  /**
   * Handle WebGL context loss.
   */
  invalidateForContextLoss(): void {
    this.pool.invalidateForContextLoss()
    this.gpuTimer.invalidateForContextLoss()
    this.rendererInitialized = false
  }

  /**
   * Reinitialize after context restoration.
   *
   * @param renderer - Three.js WebGL renderer (required to reinitialize GPU timer)
   */
  reinitialize(renderer?: THREE.WebGLRenderer): void {
    this.pool.reinitialize()
    if (renderer) {
      this.gpuTimer.reinitialize(renderer)
      this.rendererInitialized = true
    }
  }

  // ==========================================================================
  // Debugging
  // ==========================================================================

  /**
   * Get debug information about the graph.
   */
  getDebugInfo(): string {
    return this.compiler.getDebugInfo()
  }

  /**
   * Get the compiled pass order.
   */
  getPassOrder(): string[] {
    return this.compiled?.passes.map((p) => p.id) ?? []
  }
}
