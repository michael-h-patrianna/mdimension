/**
 * TSL Render Graph
 *
 * WebGPU/TSL-compatible render graph implementation.
 * Mirrors the WebGL RenderGraph architecture exactly.
 *
 * ## Architecture (matches WebGL RenderGraph)
 * - ResourcePool: Render target management
 * - GraphCompiler: Dependency resolution
 * - ExternalResourceRegistry: Freeze external values at frame start
 * - ExternalBridge: Import/export scene properties
 * - captureFrameContext: Freeze store state per frame
 * - GPUTimerTSL: Performance profiling
 * - StateBarrierTSL: State isolation
 *
 * @module rendering/graph-tsl/RenderGraphTSL
 */

import * as THREE from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import { texture, uv, vec4 } from 'three/tsl'

import type { SupportedRenderer } from '@/rendering/core/rendererUtils'
import { isWebGLRenderer } from '@/rendering/core/rendererUtils'

// Import shared components from WebGL graph
import { ResourcePool } from '@/rendering/graph/ResourcePool'
import { GraphCompiler } from '@/rendering/graph/GraphCompiler'
import { captureFrameContext, type FrozenFrameContext, type StoreGetters } from '@/rendering/graph/FrameContext'
import {
  ExternalBridge,
  type PendingExport,
  type ExternalResourceId,
  type ExportConfig,
} from '@/rendering/graph/ExternalBridge'
import { ExternalResourceRegistry, type ExternalResourceConfig } from '@/rendering/graph/ExternalResourceRegistry'
import { getGlobalMRTManager, initializeGlobalMRT } from '@/rendering/graph/MRTStateManager'
import type {
  RenderResourceConfig,
  RenderPass,
  CompiledGraph,
  CompileOptions,
  FrameStats,
} from '@/rendering/graph/types'

// Import TSL-specific components
import { GPUTimerTSL } from './GPUTimerTSL'
import { StateBarrierTSL } from './StateBarrierTSL'
import type { RenderContextTSL, RenderPassTSL, SupportedRenderTarget } from './types'

// =============================================================================
// Debug Logging
// =============================================================================

type DebugCategory = 'compile' | 'execute' | 'resources' | 'timing' | 'passthrough' | 'external' | 'lifecycle'

const DEBUG_FLAGS: Record<DebugCategory, boolean> = {
  compile: false,
  execute: false,
  resources: false,
  timing: false,
  passthrough: false,
  external: false,
  lifecycle: false,
}

function debugLog(category: DebugCategory, ...args: unknown[]): void {
  if (import.meta.env.DEV && DEBUG_FLAGS[category]) {
    console.log(`[RenderGraphTSL:${category}]`, ...args)
  }
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_DISABLE_GRACE_PERIOD = 60

// =============================================================================
// RenderGraphContextTSL - Context Implementation
// =============================================================================

/**
 * Render context passed to TSL passes during execution.
 * Mirrors the WebGL RenderGraphContext exactly.
 */
class RenderGraphContextTSL implements RenderContextTSL {
  constructor(
    public renderer: SupportedRenderer,
    public scene: THREE.Scene,
    public camera: THREE.Camera,
    public delta: number,
    public time: number,
    public size: { width: number; height: number },
    public isWebGPU: boolean,
    private pool: ResourcePool,
    private pingPongResources: Set<string>,
    private externalRegistry: ExternalResourceRegistry,
    private externalBridge: ExternalBridge,
    public frame: FrozenFrameContext | null,
    private resourceAliases: Map<string, string>
  ) {}

  getResource<T = SupportedRenderTarget | THREE.Texture>(resourceId: string): T | null {
    return this.pool.get(resourceId) as T | null
  }

  getWriteTarget(resourceId: string): SupportedRenderTarget | null {
    if (this.pingPongResources.has(resourceId)) {
      return this.pool.getWriteTarget(resourceId)
    }
    return this.pool.get(resourceId)
  }

  getReadTarget(resourceId: string): SupportedRenderTarget | null {
    const resolvedId = this.resolveAlias(resourceId)
    if (this.pingPongResources.has(resolvedId)) {
      return this.pool.getReadTarget(resolvedId)
    }
    return this.pool.get(resolvedId)
  }

  getReadTexture(resourceId: string, attachment?: number | 'depth'): THREE.Texture | null {
    const resolvedId = this.resolveAlias(resourceId)
    if (this.pingPongResources.has(resolvedId)) {
      return this.pool.getReadTarget(resolvedId)?.texture ?? null
    }
    return this.pool.getTexture(resolvedId, attachment)
  }

  private resolveAlias(resourceId: string): string {
    let current = resourceId
    const visited = new Set<string>()

    while (this.resourceAliases.has(current)) {
      if (visited.has(current)) {
        console.warn(`RenderGraphTSL: Alias cycle detected at '${current}'`)
        return current
      }
      visited.add(current)
      current = this.resourceAliases.get(current)!
    }

    return current
  }

  getExternal<T>(id: string): T | null {
    return this.externalRegistry.get<T>(id)
  }

  queueExport<T>(pending: PendingExport<T>): void {
    this.externalBridge.queueExport(pending)
  }

  hasExportRegistered(id: ExternalResourceId): boolean {
    return this.externalBridge.hasExport(id)
  }
}

// =============================================================================
// RenderGraphTSL Class
// =============================================================================

/**
 * TSL Render Graph - declarative, dependency-driven render graph for WebGPU.
 */
export class RenderGraphTSL {
  // ===========================================================================
  // Core State
  // ===========================================================================

  private resources: Map<string, RenderResourceConfig> = new Map()
  private passes: Map<string, RenderPass | RenderPassTSL> = new Map()
  private compiledGraph: CompiledGraph | null = null
  private isDirty = true

  private pool = new ResourcePool()
  private compiler = new GraphCompiler()
  private externalRegistry = new ExternalResourceRegistry()
  private externalBridge = new ExternalBridge()
  private gpuTimer = new GPUTimerTSL()
  private stateBarrier = new StateBarrierTSL()

  private initialized = false
  private renderer: SupportedRenderer | null = null
  private isWebGPU = false

  private frameNumber = 0
  private lastFrameContext: FrozenFrameContext | null = null
  private storeGetters: StoreGetters | null = null

  // Screen size (matching WebGL RenderGraph)
  private width = 1
  private height = 1

  // Elapsed time tracking (accumulates delta each frame)
  private elapsedTime = 0

  // Statistics (matching WebGL RenderGraph)
  // Note: Timing logic delegates to gpuTimer; these fields maintain API parity
  private _timingEnabled = false
  private _gpuTimingEnabled = false
  private lastFrameStats: FrameStats | null = null

  // ===========================================================================
  // TSL Passthrough Resources
  // ===========================================================================

  /**
   * Passthrough rendering resources.
   *
   * CRITICAL FOR WEBGPU: We do NOT cache passthrough materials because WebGPU
   * bind groups are fixed at material compilation time. Each passthrough copy
   * needs a fresh material bound to the specific input texture.
   *
   * For optimal performance, prefer skipPassthrough=true (zero-cost aliasing)
   * over passthrough copies whenever possible.
   */
  private passthroughMesh: THREE.Mesh | null = null
  private passthroughScene: THREE.Scene | null = null
  private passthroughCamera: THREE.OrthographicCamera | null = null
  private passthroughGeometry: THREE.PlaneGeometry | null = null

  // ===========================================================================
  // Pass State Tracking
  // ===========================================================================

  private passEnabledState: Map<string, boolean> = new Map()
  private passDisableFrames: Map<string, number> = new Map()
  private resourceAliases: Map<string, string> = new Map()

  // ===========================================================================
  // Initialization
  // ===========================================================================

  /**
   * Initialize the render graph with a renderer.
   */
  initialize(renderer: SupportedRenderer): void {
    if (this.initialized && this.renderer === renderer) {
      return
    }

    this.renderer = renderer
    this.isWebGPU = !isWebGLRenderer(renderer)

    // Initialize MRT manager (WebGL only - WebGPU handles MRT differently)
    if (!this.isWebGPU) {
      initializeGlobalMRT(renderer as THREE.WebGLRenderer)
    }

    // Initialize GPU timer
    this.gpuTimer.initialize(renderer)

    // Create passthrough resources
    this.ensurePassthroughResources()

    this.initialized = true

    debugLog('lifecycle', `Initialized (${this.isWebGPU ? 'WebGPU' : 'WebGL'} backend)`)
  }

  // ===========================================================================
  // Store Getters (for frame context)
  // ===========================================================================

  /**
   * Register store getters for frame context capture.
   */
  setStoreGetters(getters: StoreGetters): this {
    this.storeGetters = getters
    return this
  }

  /**
   * Check if store getters are configured.
   * @returns True if store getters are configured
   */
  hasStoreGetters(): boolean {
    return this.storeGetters !== null
  }

  /**
   * Get the last captured frame context.
   */
  getLastFrameContext(): FrozenFrameContext | null {
    return this.lastFrameContext
  }

  /**
   * Get current frame number.
   * @returns The current frame number
   */
  getFrameNumber(): number {
    return this.frameNumber
  }

  // ===========================================================================
  // Resource Declaration
  // ===========================================================================

  /**
   * Add a resource to the graph.
   */
  addResource(config: RenderResourceConfig): void {
    if (this.resources.has(config.id)) {
      console.warn(`[RenderGraphTSL] Resource '${config.id}' already declared, overwriting`)
    }
    this.resources.set(config.id, config)
    this.pool.register(config)
    this.compiler.addResource(config)
    this.isDirty = true

    debugLog('resources', `Added resource: ${config.id}`)
  }

  /**
   * Remove a resource from the graph.
   */
  removeResource(resourceId: string): void {
    this.resources.delete(resourceId)
    this.pool.unregister(resourceId)
    this.compiler.removeResource(resourceId)
    this.isDirty = true
  }

  /**
   * Check if a resource exists.
   *
   * @param resourceId - Resource identifier
   * @returns True if the resource exists
   */
  hasResource(resourceId: string): boolean {
    return this.pool.has(resourceId)
  }

  /**
   * Get a resource's render target directly.
   *
   * @param resourceId - Resource identifier
   * @returns The render target or null
   */
  getResource(resourceId: string): THREE.WebGLRenderTarget | null {
    return this.pool.get(resourceId)
  }

  /**
   * Get a resource's write target directly.
   *
   * @param resourceId - Resource identifier
   * @returns The write target or null
   */
  getWriteTarget(resourceId: string): THREE.WebGLRenderTarget | null {
    return this.pool.getWriteTarget(resourceId)
  }

  /**
   * Get a resource's texture directly.
   *
   * @param resourceId - Resource identifier
   * @param attachment - Attachment index or 'depth'
   * @returns The texture or null
   */
  getTexture(resourceId: string, attachment?: number | 'depth'): THREE.Texture | null {
    return this.pool.getTexture(resourceId, attachment)
  }

  // ===========================================================================
  // Pass Registration
  // ===========================================================================

  /**
   * Add a pass to the graph.
   */
  addPass(pass: RenderPass | RenderPassTSL): void {
    if (this.passes.has(pass.id)) {
      console.warn(`[RenderGraphTSL] Pass '${pass.id}' already registered, overwriting`)
    }
    this.passes.set(pass.id, pass)
    // Cast to RenderPass for compiler (RenderPassTSL has compatible interface)
    this.compiler.addPass(pass as RenderPass)
    this.isDirty = true

    debugLog('lifecycle', `Added pass: ${pass.id}`)
  }

  /**
   * Remove a pass from the graph.
   */
  removePass(passId: string): void {
    const pass = this.passes.get(passId)
    if (pass) {
      pass.dispose?.()
      this.passes.delete(passId)
      this.compiler.removePass(passId)
      this.passEnabledState.delete(passId)
      this.passDisableFrames.delete(passId)
      this.isDirty = true
    }
  }

  // ===========================================================================
  // External Resource Management
  // ===========================================================================

  /**
   * Register an external resource for capture.
   */
  registerExternal<T>(config: ExternalResourceConfig<T>): this {
    this.externalRegistry.register(config)
    return this
  }

  /**
   * Unregister an external resource.
   *
   * @param id - External resource identifier
   * @returns this for chaining
   */
  unregisterExternal(id: string): this {
    this.externalRegistry.unregister(id)
    return this
  }

  /**
   * Check if an external resource is registered.
   *
   * @param id - External resource identifier
   * @returns True if the external resource is registered
   */
  hasExternal(id: string): boolean {
    return this.externalRegistry.has(id)
  }

  /**
   * Get debug information about external resources.
   * @returns Debug information string
   */
  getExternalDebugInfo(): string {
    return this.externalRegistry.getDebugInfo()
  }

  /**
   * Register an export configuration.
   */
  registerExport<T, TExternal = T>(config: ExportConfig<T, TExternal>): this {
    this.externalBridge.registerExport(config)
    return this
  }

  /**
   * Unregister an export.
   *
   * @param id - External resource ID to unregister
   * @returns this for chaining
   */
  unregisterExport(id: string): this {
    this.externalBridge.unregisterExport(id)
    return this
  }

  /**
   * Check if an export is registered.
   */
  hasExport(id: ExternalResourceId): boolean {
    return this.externalBridge.hasExport(id)
  }

  /**
   * Get debug information about the external bridge.
   * @returns Debug information about imports and exports
   */
  getExternalBridgeDebugInfo(): {
    imports: Array<{ id: string; captured: boolean }>
    exports: Array<{ id: string; queued: boolean }>
  } {
    return this.externalBridge.getDebugInfo()
  }

  // ===========================================================================
  // Texture Access (for external code like useFrame)
  // ===========================================================================

  /**
   * Get a read texture from the graph.
   * For ping-pong resources, returns the read buffer (previous frame).
   *
   * @param resourceId - Resource identifier
   * @param attachment - Optional attachment index for MRT, or 'depth' for depth texture
   * @returns The read texture or null
   */
  getReadTexture(resourceId: string, attachment?: number | 'depth'): THREE.Texture | null {
    // Resolve any aliases first
    let resolvedId = resourceId
    const visited = new Set<string>()
    const aliasChain: string[] = [resourceId]
    while (this.resourceAliases.has(resolvedId)) {
      if (visited.has(resolvedId)) break
      visited.add(resolvedId)
      resolvedId = this.resourceAliases.get(resolvedId)!
      aliasChain.push(resolvedId)
    }

    // DEBUG: Log alias resolution for key resources
    if (import.meta.env.DEV && aliasChain.length > 1) {
      console.log(`[RenderGraphTSL] Alias chain: ${aliasChain.join(' → ')}`)
    }

    // Check if this is a ping-pong resource
    if (this.compiledGraph?.pingPongResources.has(resolvedId)) {
      const target = this.pool.getReadTarget(resolvedId)
      if (!target) return null

      // Handle attachment types
      if (attachment === 'depth') {
        return target.depthTexture ?? null
      }
      if (typeof attachment === 'number' && target.textures) {
        return target.textures[attachment] ?? null
      }
      return target.texture ?? null
    }

    // Non-ping-pong: delegate to getTexture
    return this.pool.getTexture(resolvedId, attachment)
  }

  // ===========================================================================
  // Compilation
  // ===========================================================================

  /**
   * Compile the render graph.
   */
  compile(options: CompileOptions = {}): CompiledGraph {
    debugLog('compile', 'Starting compilation...')

    const compiled = this.compiler.compile(options)

    // Enable ping-pong for resources that need it
    for (const resourceId of compiled.pingPongResources) {
      this.pool.enablePingPong(resourceId)
    }

    this.compiledGraph = compiled
    this.isDirty = false

    debugLog('compile', `Compiled ${compiled.passes.length} passes`)
    if (compiled.warnings.length > 0) {
      console.warn('[RenderGraphTSL] Compilation warnings:', compiled.warnings)
    }

    return compiled
  }

  /**
   * Force recompilation on next execute.
   */
  invalidate(): void {
    this.isDirty = true
  }

  /**
   * Check if graph needs recompilation.
   * @returns True if the graph needs recompilation
   */
  needsCompile(): boolean {
    return this.isDirty || this.compiledGraph === null
  }

  // ===========================================================================
  // Execution
  // ===========================================================================

  /**
   * Execute the render graph for one frame.
   */
  execute(
    renderer: SupportedRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    delta: number,
    _time: number // Not used - we track elapsedTime internally like WebGL RenderGraph
  ): void {
    // DEBUG: Log execution state
    if (import.meta.env.DEV && this.frameNumber < 10) {
      // console.log(`[RenderGraphTSL] Execute frame ${this.frameNumber}, size: ${this.width}x${this.height}, scene children: ${scene.children.length}`)
    }

    // Skip execution if size is invalid (can happen on first frames before canvas is sized)
    // This prevents GL_INVALID_FRAMEBUFFER_OPERATION errors from zero-sized render targets
    if (this.width < 1 || this.height < 1) {
      if (import.meta.env.DEV) {
        console.warn(`[RenderGraphTSL] Skipping execute - invalid size: ${this.width}x${this.height}`)
      }
      return
    }

    // Initialize if needed
    if (!this.initialized || this.renderer !== renderer) {
      this.initialize(renderer)
    }

    // Recompile if needed
    if (this.isDirty || !this.compiledGraph) {
      this.compile()
    }

    const compiled = this.compiledGraph!

    // Update timing (accumulate delta like WebGL RenderGraph)
    this.elapsedTime += delta

    // Begin frame (frame number incremented at END, matching WebGL RenderGraph)
    this.gpuTimer.beginFrame()

    // Update resource pool size
    this.pool.updateSize(this.width, this.height)

    // Capture external resources
    this.externalRegistry.captureAll()
    this.externalBridge.beginFrame()

    // Capture frame context (freeze store state)
    let frozenFrameContext: FrozenFrameContext | null = null
    if (this.storeGetters) {
      try {
        frozenFrameContext = captureFrameContext(this.frameNumber, scene, camera, this.storeGetters)
        this.lastFrameContext = frozenFrameContext
      } catch (error) {
        console.warn('[RenderGraphTSL] Error capturing frame context:', error)
      }
    }

    // Clear resource aliases
    this.resourceAliases.clear()

    // Track resources written by enabled passes
    const writtenResources = new Set<string>()

    // Build context
    const context = new RenderGraphContextTSL(
      renderer,
      scene,
      camera,
      delta,
      this.elapsedTime, // Use accumulated elapsed time, not passed-in time
      { width: this.width, height: this.height },
      this.isWebGPU,
      this.pool,
      compiled.pingPongResources,
      this.externalRegistry,
      this.externalBridge,
      frozenFrameContext,
      this.resourceAliases
    )

    // DEBUG: Commented out to reduce console noise during shadow debugging
    // if (import.meta.env.DEV && this.frameNumber < 5) {
    //   console.log(`[RenderGraphTSL] Compiled passes: ${compiled.passes.length}, frozenFrameContext: ${frozenFrameContext ? 'valid' : 'NULL'}`)
    // }

    // Execute passes
    for (const pass of compiled.passes) {
      const passConfig = pass.config
      const isEnabled = passConfig.enabled ? passConfig.enabled(frozenFrameContext) : true

      // DEBUG: Commented out to reduce console noise during shadow debugging
      // if (import.meta.env.DEV && this.frameNumber < 3) {
      //   console.log(`[RenderGraphTSL] Pass '${pass.id}' enabled: ${isEnabled}`)
      // }

      // Track enable/disable transitions
      const wasEnabled = this.passEnabledState.get(pass.id) ?? true
      this.passEnabledState.set(pass.id, isEnabled)

      if (isEnabled) {
        // Reset disable counter
        this.passDisableFrames.delete(pass.id)

        // Mark outputs as written
        for (const output of passConfig.outputs) {
          writtenResources.add(output.resourceId)
        }

        // Execute pass
        this.executePass(pass, context)
      } else {
        // Handle disabled pass
        this.handleDisabledPass(pass, wasEnabled, writtenResources, renderer, context)
      }
    }

    // Apply queued exports
    this.externalBridge.executeExports()
    this.externalBridge.endFrame()

    // Post-frame hooks
    for (const pass of compiled.passes) {
      pass.postFrame?.()
    }

    // Swap ping-pong buffers for resources that need it
    for (const resourceId of compiled.pingPongResources) {
      this.pool.swap(resourceId)
    }

    // TBDR optimization: invalidate non-persistent framebuffers (WebGL only)
    // On mobile GPUs (Apple, Mali, Adreno), this allows skipping tile store operations
    // WebGPU handles this differently through render pass load/store operations
    if (!this.isWebGPU) {
      this.pool.invalidateFramebuffers(renderer as THREE.WebGLRenderer, compiled.pingPongResources)
    }

    // End frame
    this.pool.endFrame()
    this.gpuTimer.endFrame()

    // Advance external resource registry frame - resets captured state for next frame
    this.externalRegistry.advanceFrame()

    // Increment frame number at END (matching WebGL RenderGraph behavior)
    this.frameNumber++

    debugLog('execute', 'Frame complete')
  }

  /**
   * Execute a single pass.
   */
  private executePass(pass: RenderPass | RenderPassTSL, context: RenderGraphContextTSL): void {
    debugLog('execute', `Executing pass: ${pass.id}`)
    

    // Capture state
    this.stateBarrier.capture(context.renderer, context.scene, context.camera)

    // Time the pass
    this.gpuTimer.beginQuery(pass.id)

    try {
      // Execute - pass the context which implements RenderContextTSL
      pass.execute(context as never)
    } catch (error) {
      console.error(`[RenderGraphTSL] Error in pass '${pass.id}':`, error)
    }

    this.gpuTimer.endQuery()

    // Restore state
    this.stateBarrier.restore(context.renderer, context.scene, context.camera)
  }

  /**
   * Handle a disabled pass (passthrough or aliasing).
   */
  private handleDisabledPass(
    pass: RenderPass | RenderPassTSL,
    wasEnabled: boolean,
    writtenResources: Set<string>,
    renderer: SupportedRenderer,
    _context: RenderGraphContextTSL
  ): void {
    const passConfig = pass.config

    // Track frames since disable
    if (wasEnabled) {
      this.passDisableFrames.set(pass.id, 0)
    } else {
      const frames = (this.passDisableFrames.get(pass.id) ?? 0) + 1
      this.passDisableFrames.set(pass.id, frames)

      // Check grace period - call releaseInternalResources exactly ONCE at grace period
      // Using === ensures single invocation, not repeated calls every frame after threshold
      const gracePeriod = passConfig.disableGracePeriod ?? DEFAULT_DISABLE_GRACE_PERIOD
      if (!passConfig.keepResourcesWhenDisabled && frames === gracePeriod) {
        pass.releaseInternalResources?.()
      }
    }

    // Check if passthrough is needed
    const firstOutput = passConfig.outputs[0]
    const firstInput = passConfig.inputs[0]
    if (!firstOutput || !firstInput) {
      return
    }

    // Check if output was already written
    const outputId = firstOutput.resourceId
    if (writtenResources.has(outputId)) {
      return
    }

    // Check if skipPassthrough
    if (passConfig.skipPassthrough) {
      // Use aliasing instead
      const inputId = firstInput.resourceId
      this.resourceAliases.set(outputId, inputId)
      debugLog('passthrough', `Aliasing ${inputId} → ${outputId}`)
      return
    }

    // Execute passthrough
    const inputId = firstInput.resourceId
    this.executePassthrough(inputId, outputId, renderer)
  }

  /**
   * Execute a passthrough copy from input to output.
   *
   * CRITICAL FOR WEBGPU: This creates a new material each time because WebGPU
   * bind groups are fixed at material compilation time. We cannot reuse a
   * cached material with different input textures.
   *
   * For optimal performance, prefer skipPassthrough=true (aliasing) over
   * passthrough copies whenever possible.
   */
  private executePassthrough(
    inputId: string,
    outputId: string,
    renderer: SupportedRenderer
  ): void {
    const inputTexture = this.pool.getTexture(inputId)
    const outputTarget = this.pool.getWriteTarget(outputId)

    if (!inputTexture || !outputTarget) {
      debugLog('passthrough', `Passthrough failed: input=${!!inputTexture}, output=${!!outputTarget}`)
      return
    }

    debugLog('passthrough', `Passthrough ${inputId} → ${outputId}`)

    this.ensurePassthroughResources()

    // Warn for MRT targets - passthrough only copies first attachment
    const attachmentCount = outputTarget.textures?.length ?? 1
    if (attachmentCount > 1) {
      console.warn(
        `[RenderGraphTSL] Passthrough to MRT target '${outputId}' only copies first attachment. ` +
        `Consider using skipPassthrough=true for MRT passes.`
      )
    }

    // CRITICAL FOR WEBGPU: Create NEW material with the EXACT input texture
    // WebGPU bind groups are fixed at material compilation time - we cannot
    // reuse a cached material and just update the texture value!
    const material = this.createPassthroughMaterial(inputTexture)

    // Create mesh if needed
    if (!this.passthroughMesh && this.passthroughGeometry) {
      this.passthroughMesh = new THREE.Mesh(this.passthroughGeometry, material)
      this.passthroughMesh.frustumCulled = false
      this.passthroughScene?.add(this.passthroughMesh)
    }

    if (!this.passthroughMesh || !this.passthroughScene || !this.passthroughCamera) {
      return
    }

    // Update material with the new one bound to this specific texture
    this.passthroughMesh.material = material

    // Render
    renderer.setRenderTarget(outputTarget as THREE.WebGLRenderTarget)
    renderer.render(this.passthroughScene, this.passthroughCamera)
  }

  // ===========================================================================
  // TSL Passthrough Materials
  // ===========================================================================

  private ensurePassthroughResources(): void {
    if (this.passthroughScene) return

    this.passthroughGeometry = new THREE.PlaneGeometry(2, 2)

    // DON'T create material here - defer until we have a real texture
    // WebGPU bind groups are fixed at material compilation time!
    // Creating with null/placeholder texture will bind the wrong texture forever.

    this.passthroughScene = new THREE.Scene()
    this.passthroughCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  }

  /**
   * Create a NEW passthrough material for the given input texture.
   *
   * CRITICAL FOR WEBGPU: WebGPU bind groups are fixed at material compilation time.
   * Unlike WebGL, updating texture.value does NOT change what texture is sampled.
   * We MUST create a new material for each unique input texture.
   *
   * This is called each frame for passthrough copies, which is acceptable because:
   * 1. Most passes should use skipPassthrough=true (aliasing) instead
   * 2. Passthrough copies are rare and only for non-MRT targets
   * 3. WebGPU material creation is relatively fast
   */
  private createPassthroughMaterial(
    inputTexture: THREE.Texture
  ): THREE.Material {
    // CRITICAL: Create TextureNode with the EXACT input texture
    // WebGPU bind groups are fixed - we cannot reuse materials across different textures!
    const texNode = texture(inputTexture, uv())

    const nodeMaterial = new MeshBasicNodeMaterial()
    nodeMaterial.depthWrite = false
    ;(nodeMaterial as unknown as { depthTest: boolean }).depthTest = false

    // Set output node - this defines the shader graph
    nodeMaterial.outputNode = vec4(texNode.rgb, texNode.a)

    debugLog('passthrough', `Created NEW passthrough material for texture`)

    return nodeMaterial as unknown as THREE.Material
  }

  // ===========================================================================
  // Screen Size (matching WebGL RenderGraph)
  // ===========================================================================

  /**
   * Update screen dimensions.
   *
   * Call this when the viewport size changes.
   *
   * @param width - Screen width in pixels
   * @param height - Screen height in pixels
   * @param resolutionScale - Resolution scale factor (0.5 = half res, 1.0 = full res)
   */
  setSize(width: number, height: number, resolutionScale = 1.0): void {
    this.width = Math.max(1, Math.floor(width * resolutionScale))
    this.height = Math.max(1, Math.floor(height * resolutionScale))
    // CRITICAL: Force resize on next ensureAllocated call
    this.pool.updateSize(this.width, this.height)
    // Force a recompile to ensure all passes use new dimensions
    this.isDirty = true
  }

  /**
   * Get current screen dimensions.
   * @returns Object containing width and height in pixels
   */
  getSize(): { width: number; height: number } {
    return { width: this.width, height: this.height }
  }

  /**
   * Resize (legacy alias for setSize).
   * @deprecated Use setSize() instead for parity with WebGL RenderGraph
   */
  resize(width: number, height: number): void {
    this.setSize(width, height)
  }

  // ===========================================================================
  // Statistics (matching WebGL RenderGraph)
  // ===========================================================================

  /**
   * Enable or disable timing collection (CPU timing).
   *
   * @param enabled - Whether to collect timing data
   */
  enableTiming(enabled: boolean): void {
    this._timingEnabled = enabled
  }

  /**
   * Check if timing collection is enabled.
   * @returns True if timing is enabled
   */
  isTimingEnabled(): boolean {
    return this._timingEnabled
  }

  /**
   * Enable or disable GPU timing queries.
   *
   * @param enabled - Whether to collect GPU timing data
   */
  enableTimingQueries(enabled: boolean): void {
    this._gpuTimingEnabled = enabled
    this.gpuTimer.setEnabled(enabled)
    // Also enable CPU timing when GPU timing is enabled
    if (enabled) {
      this._timingEnabled = true
    }
  }

  /**
   * Check if GPU timing queries are enabled.
   * @returns True if GPU timing is enabled
   */
  isGPUTimingEnabled(): boolean {
    return this._gpuTimingEnabled
  }

  /**
   * Check if GPU timing queries are available.
   *
   * @returns True if timer query extension is supported
   */
  isGPUTimingAvailable(): boolean {
    return this.gpuTimer.isAvailable()
  }

  /**
   * Get per-pass timing information.
   *
   * @returns Array of pass timing data
   */
  getPassTimings(): import('@/rendering/graph/types').PassTiming[] {
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
   * Get statistics (legacy alias for getFrameStats).
   * @deprecated Use getFrameStats() instead
   */
  getStats(): FrameStats {
    return this.lastFrameStats ?? {
      totalTimeMs: 0,
      passTiming: [],
      targetSwitches: 0,
      vramUsage: this.pool.getVRAMUsage(),
    }
  }

  /**
   * Set timing enabled (legacy alias).
   * @deprecated Use enableTiming() instead
   */
  setTimingEnabled(enabled: boolean): void {
    this.enableTiming(enabled)
  }

  /**
   * Get estimated VRAM usage.
   * @returns VRAM usage in bytes
   */
  getVRAMUsage(): number {
    return this.pool.getVRAMUsage()
  }

  /**
   * Get list of registered resource IDs.
   * @returns Array of registered resource IDs
   */
  getResourceIds(): string[] {
    return this.pool.getResourceIds()
  }

  /**
   * Get dimensions of all allocated resources.
   * @returns Map of resource IDs to dimensions
   */
  getResourceDimensions(): Map<string, { width: number; height: number }> {
    return this.pool.getResourceDimensions()
  }

  // ===========================================================================
  // Lazy Resource Deallocation
  // ===========================================================================

  /**
   * Get resource deallocation statistics.
   *
   * Useful for monitoring memory management and debugging.
   *
   * @returns Stats about pass states and pending deallocations
   */
  getResourceDeallocationStats(): {
    enabledPasses: number
    disabledPasses: number
    pendingDeallocations: number
  } {
    let enabled = 0
    let disabled = 0
    let pending = 0

    for (const [passId, disabledFrameCount] of this.passDisableFrames) {
      const pass = this.compiledGraph?.passes.find((p) => p.id === passId)
      if (!pass) continue

      if (disabledFrameCount === 0) {
        enabled++
      } else {
        disabled++
        const gracePeriod = pass.config.disableGracePeriod ?? DEFAULT_DISABLE_GRACE_PERIOD
        const keepResources = pass.config.keepResourcesWhenDisabled ?? false
        if (!keepResources && disabledFrameCount < gracePeriod && pass.releaseInternalResources) {
          pending++
        }
      }
    }

    return { enabledPasses: enabled, disabledPasses: disabled, pendingDeallocations: pending }
  }

  /**
   * Force immediate resource release for a disabled pass.
   *
   * @param passId - Pass identifier
   * @returns True if resources were released
   */
  forceReleasePassResources(passId: string): boolean {
    const pass = this.compiledGraph?.passes.find((p) => p.id === passId)
    if (pass?.releaseInternalResources) {
      pass.releaseInternalResources()
      return true
    }
    return false
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Initialize the renderer early.
   *
   * CRITICAL: Call this in useLayoutEffect BEFORE any useFrame callbacks run.
   *
   * @param renderer - Three.js renderer to initialize with
   */
  initializeRenderer(renderer: SupportedRenderer): void {
    if (!this.initialized) {
      this.initialize(renderer)
    }
  }

  invalidateForContextLoss(): void {
    this.pool.invalidateForContextLoss()
    this.gpuTimer.invalidateForContextLoss()
    this.externalRegistry.invalidateCaptures()
    // MRT manager is WebGL only
    if (!this.isWebGPU) {
      getGlobalMRTManager().invalidateForContextLoss()
    }
    this.initialized = false
  }

  reinitialize(renderer: SupportedRenderer): void {
    this.renderer = renderer
    this.isWebGPU = !isWebGLRenderer(renderer)
    this.pool.reinitialize()
    this.gpuTimer.reinitialize(renderer)
    // MRT manager is WebGL only
    if (!this.isWebGPU) {
      getGlobalMRTManager().reinitialize(renderer as THREE.WebGLRenderer)
    }
    this.initialized = true
    this.isDirty = true
  }

  // ===========================================================================
  // Debugging
  // ===========================================================================

  /**
   * Get debug information about the graph.
   * @returns Debug information string
   */
  getDebugInfo(): string {
    return this.compiler.getDebugInfo()
  }

  /**
   * Get current resource aliases for debugging.
   *
   * @returns Map of outputId → resolvedInputId
   */
  getResourceAliases(): Map<string, string> {
    const resolved = new Map<string, string>()
    for (const [outputId] of this.resourceAliases) {
      let current = outputId
      const visited = new Set<string>()
      while (this.resourceAliases.has(current) && !visited.has(current)) {
        visited.add(current)
        current = this.resourceAliases.get(current)!
      }
      resolved.set(outputId, current)
    }
    return resolved
  }

  /**
   * Get the compiled pass order.
   * @returns Array of pass IDs in execution order
   */
  getPassOrder(): string[] {
    return this.compiledGraph?.passes.map((p) => p.id) ?? []
  }

  /**
   * Get all compiled passes for debugging.
   * @internal Debug only
   * @returns Array of compiled render passes
   */
  getPasses(): (RenderPass | RenderPassTSL)[] {
    return this.compiledGraph?.passes ?? []
  }

  /**
   * Force disable a pass by ID (for debugging).
   * @param passId - Pass identifier
   * @returns True if pass was found and disabled
   * @internal Debug only
   */
  debugDisablePass(passId: string): boolean {
    const pass = this.compiledGraph?.passes.find((p) => p.id === passId)
    if (pass) {
      ;(pass as unknown as { _debugDisabled?: boolean })._debugDisabled = true
      return true
    }
    return false
  }

  /**
   * Re-enable a previously disabled pass (for debugging).
   * @param passId - Pass identifier
   * @returns True if pass was found and enabled
   * @internal Debug only
   */
  debugEnablePass(passId: string): boolean {
    const pass = this.compiledGraph?.passes.find((p) => p.id === passId)
    if (pass) {
      ;(pass as unknown as { _debugDisabled?: boolean })._debugDisabled = false
      return true
    }
    return false
  }

  // ===========================================================================
  // Disposal
  // ===========================================================================

  dispose(): void {
    debugLog('lifecycle', 'Disposing...')

    // Dispose passes
    for (const pass of this.passes.values()) {
      pass.dispose?.()
    }
    this.passes.clear()

    // Dispose resources
    this.pool.dispose()
    this.gpuTimer.dispose()
    this.externalBridge.dispose()

    // Dispose passthrough resources
    // Note: Materials are created per-frame and not cached (WebGPU bind group requirement)
    // so we only need to dispose the geometry
    if (this.passthroughGeometry) {
      this.passthroughGeometry.dispose()
      this.passthroughGeometry = null
    }
    this.passthroughMesh = null
    this.passthroughScene = null
    this.passthroughCamera = null

    // Clear state
    this.resources.clear()
    this.compiledGraph = null
    this.isDirty = true
    this.initialized = false
    this.renderer = null

    debugLog('lifecycle', 'Disposed')
  }
}
