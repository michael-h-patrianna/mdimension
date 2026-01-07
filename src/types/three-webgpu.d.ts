/**
 * TypeScript declarations for Three.js WebGPU modules.
 *
 * Three.js v0.182+ includes WebGPU support through the 'three/webgpu' entry point.
 * The WebGPURenderer automatically falls back to WebGL when WebGPU is unavailable.
 *
 * @module types/three-webgpu
 */

declare module 'three/webgpu' {
  // Re-export everything from three
  export * from 'three'

  /**
   * WebGPU Renderer configuration options.
   */
  export interface WebGPURendererParameters {
    /** Target canvas element */
    canvas?: HTMLCanvasElement
    /** Enable antialiasing (default: true) */
    antialias?: boolean
    /** Enable alpha channel (default: true) */
    alpha?: boolean
    /** GPU power preference */
    powerPreference?: 'high-performance' | 'low-power' | 'default'
    /** Force WebGL fallback (useful for testing) */
    forceWebGL?: boolean
    /** Preserve drawing buffer for screenshots */
    preserveDrawingBuffer?: boolean
    /** Enable logarithmic depth buffer */
    logarithmicDepthBuffer?: boolean
    /** Enable stencil buffer */
    stencil?: boolean
    /** Enable depth buffer */
    depth?: boolean
    /** Required WebGPU features */
    requiredFeatures?: GPUFeatureName[]
    /** Required WebGPU limits */
    requiredLimits?: Record<string, number>
  }

  /**
   * Backend interface providing access to the underlying graphics API.
   */
  export interface WebGPUBackend {
    /** Whether WebGPU is being used (false if fell back to WebGL) */
    isWebGPU: boolean
    /** GPU adapter information */
    parameters?: {
      adapterInfo?: GPUAdapterInfo
    }
  }

  /**
   * WebGPU-capable renderer with automatic WebGL fallback.
   *
   * When WebGPU is unavailable, automatically falls back to WebGL2.
   * The API remains the same regardless of the active backend.
   *
   * @example
   * ```typescript
   * const renderer = new WebGPURenderer({
   *   canvas,
   *   antialias: true,
   *   powerPreference: 'high-performance',
   * });
   * await renderer.init();
   * ```
   */
  export class WebGPURenderer {
    constructor(parameters?: WebGPURendererParameters)

    /**
     * Initialize the renderer. MUST be called before any rendering.
     * This is async because WebGPU adapter/device acquisition is async.
     */
    init(): Promise<void>

    /**
     * Render a scene with a camera.
     */
    render(scene: import('three').Scene, camera: import('three').Camera): void

    /**
     * Set the render target (null for screen).
     */
    setRenderTarget(
      target: import('three').WebGLRenderTarget | null,
      activeCubeFace?: number,
      activeMipmapLevel?: number
    ): void

    /**
     * Set the pixel ratio.
     */
    setPixelRatio(value: number): void

    /**
     * Set the renderer size.
     */
    setSize(width: number, height: number, updateStyle?: boolean): void

    /**
     * Get the current size.
     */
    getSize(target: import('three').Vector2): import('three').Vector2

    /**
     * Get the pixel ratio.
     */
    getPixelRatio(): number

    /**
     * Get the current clear color.
     * @param target - Color object to store the result
     * @returns The current clear color
     */
    getClearColor(target: import('three').Color): import('three').Color

    /**
     * Get the current clear alpha.
     * @returns The current clear alpha value
     */
    getClearAlpha(): number

    /**
     * Set the clear color and optional alpha.
     * @param color - Clear color
     * @param alpha - Clear alpha (optional)
     */
    setClearColor(color: import('three').ColorRepresentation, alpha?: number): void

    /**
     * Whether to automatically clear before each render.
     */
    autoClear: boolean

    /**
     * Clear the current render target.
     */
    clear(color?: boolean, depth?: boolean, stencil?: boolean): void

    /**
     * Clear the color buffer.
     */
    clearColor(): void

    /**
     * Clear the depth buffer.
     */
    clearDepth(): void

    /**
     * Clear the stencil buffer.
     */
    clearStencil(): void

    /**
     * Dispose of the renderer.
     */
    dispose(): void

    /**
     * Read pixels from render target.
     */
    readRenderTargetPixels(
      renderTarget: import('three').WebGLRenderTarget,
      x: number,
      y: number,
      width: number,
      height: number,
      buffer: ArrayBufferView,
      activeCubeFaceIndex?: number
    ): void

    /**
     * Compile a scene's materials.
     */
    compile(
      scene: import('three').Scene,
      camera: import('three').Camera,
      targetScene?: import('three').Scene
    ): Promise<void>

    /** The underlying backend (WebGPU or WebGL) */
    backend: WebGPUBackend

    /** Renderer capabilities */
    capabilities: {
      maxTextureSize: number
      maxTextures: number
      maxVertexTextures: number
      maxTextureUnits: number
      precision: string
      logarithmicDepthBuffer: boolean
      floatVertexTextures: boolean
      maxSamples: number
    }

    /** DOM element (canvas) */
    domElement: HTMLCanvasElement

    /** Tone mapping mode */
    toneMapping: import('three').ToneMapping

    /** Tone mapping exposure */
    toneMappingExposure: number

    /** Output color space */
    outputColorSpace: import('three').ColorSpace

    /** Enable/disable shadow maps */
    shadowMap: {
      enabled: boolean
      autoUpdate: boolean
      needsUpdate: boolean
      type: import('three').ShadowMapType
    }

    /** Renderer info (memory, render counts) */
    info: {
      memory: {
        geometries: number
        textures: number
      }
      render: {
        calls: number
        triangles: number
        points: number
        lines: number
        frame: number
      }
      programs: number | null
      autoReset: boolean
      reset(): void
    }
  }

  import { MeshPhysicalMaterial, MeshStandardMaterial } from 'three'

  /**
   * MeshPhysicalNodeMaterial - PBR material with TSL node support.
   * Extends MeshPhysicalMaterial with custom shader nodes.
   */
  export interface MeshPhysicalNodeMaterial extends MeshPhysicalMaterial {
    /** Custom color node (replaces color uniform) */
    colorNode: import('three/tsl').Node | null
    /** Custom normal node */
    normalNode: import('three/tsl').Node | null
    /** Custom roughness node */
    roughnessNode: import('three/tsl').Node | null
    /** Custom metalness node */
    metalnessNode: import('three/tsl').Node | null
    /** Custom emissive node */
    emissiveNode: import('three/tsl').Node | null
    /** Custom opacity node */
    opacityNode: import('three/tsl').Node | null
    /** Custom position node (vertex displacement) */
    positionNode: import('three/tsl').Node | null
    /** Custom output node (final fragment color) */
    outputNode: import('three/tsl').Node | null
    /** Custom specular intensity node */
    specularIntensityNode: import('three/tsl').Node | null
    /** Custom specular color node */
    specularColorNode: import('three/tsl').Node | null
    /** Custom clearcoat node */
    clearcoatNode: import('three/tsl').Node | null
    /** Custom clearcoat roughness node */
    clearcoatRoughnessNode: import('three/tsl').Node | null
    /** Custom iridescence node */
    iridescenceNode: import('three/tsl').Node | null
    /** Custom transmission node */
    transmissionNode: import('three/tsl').Node | null
    /** Custom thickness node */
    thicknessNode: import('three/tsl').Node | null
    /** MRT (Multiple Render Target) node for multi-buffer output */
    mrtNode: MRTNode | null
  }

  export const MeshPhysicalNodeMaterial: {
    new (parameters?: import('three').MeshPhysicalMaterialParameters): MeshPhysicalNodeMaterial
  }

  /**
   * MeshStandardNodeMaterial - Standard PBR material with TSL node support.
   */
  export interface MeshStandardNodeMaterial extends MeshStandardMaterial {
    /** Custom color node */
    colorNode: import('three/tsl').Node | null
    /** Custom normal node */
    normalNode: import('three/tsl').Node | null
    /** Custom roughness node */
    roughnessNode: import('three/tsl').Node | null
    /** Custom metalness node */
    metalnessNode: import('three/tsl').Node | null
    /** Custom emissive node */
    emissiveNode: import('three/tsl').Node | null
    /** Custom opacity node */
    opacityNode: import('three/tsl').Node | null
    /** Custom position node */
    positionNode: import('three/tsl').Node | null
    /** Custom output node */
    outputNode: import('three/tsl').Node | null
  }

  export const MeshStandardNodeMaterial: {
    new (parameters?: import('three').MeshStandardMaterialParameters): MeshStandardNodeMaterial
  }

  /**
   * MeshBasicNodeMaterial - Basic material with TSL node support.
   * Used for unlit rendering with custom shader nodes.
   */
  export interface MeshBasicNodeMaterial extends import('three').MeshBasicMaterial {
    /** Custom color node */
    colorNode: import('three/tsl').Node | null
    /** Custom opacity node */
    opacityNode: import('three/tsl').Node | null
    /** Custom position node */
    positionNode: import('three/tsl').Node | null
    /** Custom output node */
    outputNode: import('three/tsl').Node | null
    /** Custom fragment node */
    fragmentNode: import('three/tsl').Node | null
    /** MRT (Multiple Render Target) node for multi-buffer output */
    mrtNode: MRTNode | null
    /** Custom depth node for gl_FragDepth equivalent */
    depthNode: import('three/tsl').Node | null
    /** Material side (inherited but needs explicit type for TSL) */
    side: import('three').Side
    /** Transparency flag */
    transparent: boolean
    /** Depth write flag */
    depthWrite: boolean
    /** Blending mode */
    blending: import('three').Blending
    /** Update flag */
    needsUpdate: boolean
    /** Dispose resources */
    dispose(): void
  }

  export const MeshBasicNodeMaterial: {
    new (parameters?: import('three').MeshBasicMaterialParameters): MeshBasicNodeMaterial
  }

  /**
   * LineBasicNodeMaterial - Line material with TSL node support.
   * Used for line rendering with custom shader nodes.
   */
  export interface LineBasicNodeMaterial extends import('three').LineBasicMaterial {
    /** Custom color node */
    colorNode: import('three/tsl').Node | null
    /** Custom opacity node */
    opacityNode: import('three/tsl').Node | null
    /** Custom position node */
    positionNode: import('three/tsl').Node | null
    /** Custom output node */
    outputNode: import('three/tsl').Node | null
    /** Update flag */
    needsUpdate: boolean
    /** Dispose resources */
    dispose(): void
  }

  export const LineBasicNodeMaterial: {
    new (parameters?: import('three').LineBasicMaterialParameters): LineBasicNodeMaterial
  }

  /**
   * PostProcessing class for TSL-based effect chains.
   *
   * @example
   * ```typescript
   * const postProcessing = new PostProcessing(renderer);
   * postProcessing.outputNode = someEffectNode;
   * // In render loop:
   * postProcessing.render();
   * ```
   */
  export class PostProcessing {
    constructor(renderer: WebGPURenderer)

    /** The output node for the effect chain */
    outputNode: import('three/tsl').Node | null

    /** Render the post-processing chain */
    render(): void

    /** Dispose of resources */
    dispose(): void
  }
}

declare module 'three/addons/capabilities/WebGPU.js' {
  /**
   * WebGPU capability detection utilities.
   */
  const WebGPU: {
    /**
     * Check if WebGPU is available in the current browser.
     * @returns True if WebGPU is available
     */
    isAvailable(): boolean

    /**
     * Get an error message if WebGPU is not available.
     * @returns Error message string
     */
    getErrorMessage(): string
  }

  export default WebGPU
}

declare module 'three/tsl' {
  import type * as THREE from 'three'

  /**
   * Base node type for TSL shader nodes.
   * TSL nodes support a fluent API for building shader expressions.
   */
  export interface Node {
    /** Node type identifier */
    nodeType: string
    /** Convert to string representation */
    toString(): string

    // ========================================================================
    // Arithmetic Operations (fluent API)
    // ========================================================================

    /** Add a value */
    add(value: number | Node): Node
    /** Subtract a value */
    sub(value: number | Node): Node
    /** Multiply by a value */
    mul(value: number | Node): Node
    /** Divide by a value */
    div(value: number | Node): Node
    /** Modulo operation */
    mod(value: number | Node): Node
    /** Power operation */
    pow(value: number | Node): Node

    // ========================================================================
    // Math Operations (fluent API)
    // ========================================================================

    /** Absolute value */
    abs(): Node
    /** Sign of value (-1, 0, or 1) */
    sign(): Node
    /** Floor */
    floor(): Node
    /** Ceiling */
    ceil(): Node
    /** Fractional part */
    fract(): Node
    /** Square root */
    sqrt(): Node
    /** Natural exponential */
    exp(): Node
    /** Natural logarithm */
    log(): Node
    /** Base-2 exponential */
    exp2(): Node
    /** Base-2 logarithm */
    log2(): Node

    // ========================================================================
    // Trigonometric Operations (fluent API)
    // ========================================================================

    /** Sine */
    sin(): Node
    /** Cosine */
    cos(): Node
    /** Tangent */
    tan(): Node
    /** Arc sine */
    asin(): Node
    /** Arc cosine */
    acos(): Node
    /** Arc tangent */
    atan(): Node

    // ========================================================================
    // Vector Operations (fluent API)
    // ========================================================================

    /** Vector length/magnitude */
    length(): Node
    /** Normalize to unit length */
    normalize(): Node
    /** Dot product */
    dot(value: Node): Node
    /** Cross product */
    cross(value: Node): Node
    /** Reflect vector */
    reflect(normal: Node): Node
    /** Negate (multiply by -1) */
    negate(): Node

    // ========================================================================
    // Clamping and Interpolation (fluent API)
    // ========================================================================

    /** Clamp to range */
    clamp(minVal: number | Node, maxVal: number | Node): Node
    /** Saturate (clamp to 0-1) */
    saturate(): Node
    /** One minus value (1 - x) */
    oneMinus(): Node
    /** Mix/lerp with another value */
    mix(b: Node, t: number | Node): Node
    /** Step function */
    step(edge: number | Node): Node
    /** Smooth step */
    smoothstep(edge0: number | Node, edge1: number | Node): Node
    /** Maximum of this and another value */
    max(value: number | Node): Node
    /** Minimum of this and another value */
    min(value: number | Node): Node

    // ========================================================================
    // Comparison Operations (fluent API)
    // ========================================================================

    /** Less than */
    lessThan(value: number | Node): Node
    /** Less than or equal */
    lessThanEqual(value: number | Node): Node
    /** Greater than */
    greaterThan(value: number | Node): Node
    /** Greater than or equal */
    greaterThanEqual(value: number | Node): Node
    /** Equal */
    equal(value: number | Node): Node
    /** Not equal */
    notEqual(value: number | Node): Node

    // ========================================================================
    // Additional Math Methods
    // ========================================================================

    /** Two-argument arctangent (atan2) */
    atan2(x: number | Node): Node
    /** Transform direction by matrix */
    transformDirection(matrix: Node): Node

    // ========================================================================
    // Logical Operations (fluent API for boolean nodes)
    // ========================================================================

    /** Logical AND with another condition */
    and(condition: Node): Node
    /** Logical OR with another condition */
    or(condition: Node): Node
    /** Logical NOT */
    not(): Node

    // ========================================================================
    // Conditional Selection
    // ========================================================================

    /** Select between two values based on this condition node */
    select(valueIfTrue: Node | number, valueIfFalse: Node | number): Node

    // ========================================================================
    // Swizzle Accessors (vector component access)
    // ========================================================================

    /** X component (first element) */
    readonly x: Node
    /** Y component (second element) */
    readonly y: Node
    /** Z component (third element) */
    readonly z: Node
    /** W component (fourth element) */
    readonly w: Node

    /** R component (alias for x) */
    readonly r: Node
    /** G component (alias for y) */
    readonly g: Node
    /** B component (alias for z) */
    readonly b: Node
    /** A component (alias for w) */
    readonly a: Node

    // Multi-component swizzles
    readonly xy: Node
    readonly xz: Node
    readonly yz: Node
    readonly xyz: Node
    readonly xyzw: Node
    readonly rgb: Node
    readonly rgba: Node

    // ========================================================================
    // Variable Operations
    // ========================================================================

    /** Convert to a variable node (for mutation) */
    toVar(name?: string): VarNode

    // ========================================================================
    // Varying Operations (r176+)
    // ========================================================================

    /**
     * Convert to a varying node for passing data between shader stages.
     * @param name - Optional varying name (for debugging/GLSL output)
     * @returns VaryingNode that can be configured with setInterpolation()
     */
    toVarying(name?: string): VaryingNode

    /**
     * Execute in vertex stage and pass result to fragment stage as varying.
     * Equivalent to `varying(this)`.
     * @returns VaryingNode with result available in fragment stage
     */
    toVertexStage(): VaryingNode

    // ========================================================================
    // Array Access
    // ========================================================================

    /** Access array element by index (for uniformArray nodes) */
    element(index: number | Node): Node
  }

  /**
   * Variable node that can be assigned new values.
   */
  export interface VarNode extends Node {
    /** Assign a new value to this variable */
    assign(value: number | Node): VarNode
    /** Add and assign (+=) */
    addAssign(value: number | Node): VarNode
    /** Subtract and assign (-=) */
    subAssign(value: number | Node): VarNode
    /** Multiply and assign (*=) */
    mulAssign(value: number | Node): VarNode
    /** Divide and assign (/=) */
    divAssign(value: number | Node): VarNode
  }

  /**
   * Uniform node for shader parameters.
   */
  export interface UniformNode<T> extends Node {
    value: T
  }

  /**
   * Uniform array node for array-based shader parameters.
   * Created via uniformArray() function.
   */
  export interface UniformArrayNode<T = unknown> extends Node {
    /** The underlying array value */
    array: T[]
    /** Element type */
    elementType: string
    /** Access array element by index */
    element(index: number | Node): Node
  }

  // ============================================================================
  // Core TSL Functions
  // ============================================================================

  /**
   * Create a uniform node.
   */
  export function uniform<T>(value: T): UniformNode<T>

  /**
   * Define a custom shader function.
   * The callback receives an array of input nodes.
   */
  export function Fn<T extends Node[]>(
    callback: (inputs: T) => Node
  ): (...args: { [K in keyof T]: T[K] | number }) => Node

  /**
   * Conditional select (ternary operator for TSL).
   * Returns valueIfTrue if condition is true, otherwise valueIfFalse.
   */
  export function select(
    condition: Node,
    valueIfTrue: Node | number,
    valueIfFalse: Node | number
  ): Node

  /**
   * Check if a value is greater than another.
   */
  export function greaterThan(a: Node | number, b: Node | number): Node

  /**
   * Check if a value is less than another.
   */
  export function lessThan(a: Node | number, b: Node | number): Node

  /**
   * Check if two values are equal.
   */
  export function equal(a: Node | number, b: Node | number): Node

  /**
   * Logical AND.
   */
  export function and(a: Node, b: Node): Node

  /**
   * Logical OR.
   */
  export function or(a: Node, b: Node): Node

  /**
   * Logical NOT.
   */
  export function not(a: Node): Node

  /**
   * TextureNode - a Node that represents a texture and can be sampled.
   * This is returned by texture() and convertToTexture().
   */
  export interface TextureNode extends Node {
    /**
     * Sample the texture at specific UV coordinates.
     * @param uv - UV coordinates node
     * @returns Sampled color value as vec4 node
     */
    sample(uv: Node): Node

    /**
     * The underlying Three.js texture (readable/writable).
     */
    value: THREE.Texture
  }

  /**
   * ShaderNodeObject wrapper type - used for TSL node objects.
   * In practice, this is just an alias for the underlying node type.
   */
  export type ShaderNodeObject<T extends Node> = T

  /**
   * Create a texture sampling node.
   * Can sample a Three.js Texture or a Node (from a render pass).
   */
  export function texture(tex: THREE.Texture | Node, uv?: Node): TextureNode

  /**
   * Convert a node to a TextureNode for custom UV sampling.
   * Essential for post-processing effects that need to sample at offset UVs
   * (chromatic aberration, gravitational lensing, etc.).
   *
   * @param node - The node to convert (typically an accumulated output node)
   * @returns TextureNode that can be sampled at arbitrary UV coordinates
   */
  export function convertToTexture(node: Node): TextureNode

  /**
   * Sample a texture node at specific UV coordinates.
   * Used for effects that need UV displacement (like lensing).
   */
  export function texturePass(passNode: Node, uv?: Node): TextureNode

  /**
   * Get UV coordinates.
   */
  export function uv(): Node

  /**
   * Create a vec2 node.
   */
  export function vec2(x: number | Node, y?: number | Node): Node

  /**
   * Create a vec3 node.
   */
  export function vec3(x: number | Node, y?: number | Node, z?: number | Node): Node

  /**
   * Create a vec4 node.
   */
  export function vec4(
    x: number | Node,
    y?: number | Node,
    z?: number | Node,
    w?: number | Node
  ): Node

  /**
   * Create a float node.
   */
  export function float(value: number | Node): Node

  /**
   * Create an int node.
   */
  export function int(value: number | Node): Node

  /**
   * Create a mat3 (3x3 matrix) node.
   * Can be constructed from three vec3 column vectors or from a mat4 (extracts upper-left 3x3).
   *
   * @example From three column vectors
   * ```ts
   * const rotation = mat3(
   *   vec3(1, 0, 0),
   *   vec3(0, 1, 0),
   *   vec3(0, 0, 1)
   * )
   * ```
   *
   * @example Extract from mat4
   * ```ts
   * const mat4Node = uniform(new THREE.Matrix4())
   * const upperLeft3x3 = mat3(
   *   mat4Node.element(0).xyz,
   *   mat4Node.element(1).xyz,
   *   mat4Node.element(2).xyz
   * )
   * ```
   */
  export function mat3(col0: Node, col1: Node, col2: Node): Mat3Node

  /**
   * Mat3Node - 3x3 matrix node type.
   * Supports matrix-vector multiplication via .mul()
   */
  export interface Mat3Node extends Node {
    /** Multiply matrix by a vector (mat3 * vec3) */
    mul(vector: Node): Node
  }

  /**
   * CubeTextureNode - a Node that represents a cube texture for environment mapping.
   * Returned by cubeTexture() function.
   */
  export interface CubeTextureNode extends Node {
    /**
     * Sample the cube texture at a direction.
     * @param direction - Direction vector (vec3 node)
     * @returns Sampled color value as vec4 node
     */
    sample(direction: Node): Node

    /**
     * The underlying Three.js CubeTexture (readable/writable).
     * Update this to change the texture at runtime.
     */
    value: THREE.CubeTexture
  }

  /**
   * Create a cube texture sampling node for environment mapping.
   * Used for skyboxes, reflections, and environment-based lighting.
   *
   * @param texture - Three.js CubeTexture to sample
   * @returns CubeTextureNode that can be sampled with a direction vector
   *
   * @example
   * ```ts
   * const envMap = cubeTexture(myCubeTexture)
   * const reflected = envMap.sample(reflectedDirection)
   * ```
   */
  export function cubeTexture(texture: THREE.CubeTexture): CubeTextureNode

  /**
   * Create an attribute node for reading vertex attributes.
   * @param name - Attribute name (e.g., 'aExtraDims0_3')
   * @param nodeType - Attribute type (e.g., 'vec4', 'vec3', 'float')
   * @returns Node representing the attribute value
   */
  export function attribute(name: string, nodeType?: string | null): Node

  /**
   * Create a uniform array node for array-based uniforms.
   * Use .element(index) to access individual elements.
   * @param values - Array of values (numbers, vectors, colors, matrices)
   * @param nodeType - Element type ('float', 'int', 'vec3', 'color', etc.)
   * @example
   * ```ts
   * const colors = uniformArray([new Color(1,0,0), new Color(0,1,0)], 'color');
   * const red = colors.element(0);
   * ```
   */
  export function uniformArray<T = unknown>(values: T[], nodeType?: string): UniformArrayNode<T>

  // ============================================================================
  // Built-in Nodes
  // ============================================================================

  /** World position of current fragment/vertex */
  export const positionWorld: Node

  /** Local position of current vertex */
  export const positionLocal: Node

  /** View-space position */
  export const positionView: Node

  /** Camera position in world space */
  export const cameraPosition: Node

  /** View-space normal */
  export const normalView: Node

  /** Local-space normal */
  export const normalLocal: Node

  /** World-space normal */
  export const normalWorld: Node

  /** Whether current fragment is front facing (boolean node) */
  export const frontFacing: Node

  /** Face direction: 1.0 for front facing, -1.0 for back facing */
  export const faceDirection: Node

  /** UV coordinates */
  export const uv: Node

  /** Viewport coordinate (pixel position in viewport) */
  export const viewportCoordinate: Node

  /** Time in seconds */
  export const time: Node

  /** Frame delta time */
  export const deltaTime: Node

  // ============================================================================
  // Screen-Space Nodes
  // ============================================================================

  /** Screen UV coordinates (0-1 range, origin at bottom-left) */
  export const screenUV: Node

  /** Screen coordinate (pixel position) */
  export const screenCoordinate: Node

  /** Viewport UV coordinates */
  export const viewportUV: Node

  /** Resolution uniform (vec2 of width, height in pixels) */
  export const resolution: Node

  /** Viewport resolution */
  export const viewportResolution: Node

  /** Aspect ratio */
  export const aspect: Node

  // ============================================================================
  // Math Operations
  // ============================================================================

  export function add(a: Node, b: Node): Node
  export function sub(a: Node, b: Node): Node
  export function mul(a: Node, b: Node): Node
  export function div(a: Node, b: Node): Node
  export function mod(a: Node, b: Node): Node
  export function pow(a: Node, b: Node): Node
  export function sqrt(a: Node): Node
  export function abs(a: Node): Node
  export function sign(a: Node): Node
  export function floor(a: Node): Node
  export function ceil(a: Node): Node
  export function fract(a: Node): Node
  export function sin(a: Node): Node
  export function cos(a: Node): Node
  export function tan(a: Node): Node
  export function asin(a: Node): Node
  export function acos(a: Node): Node
  export function atan(a: Node, b?: Node): Node
  /** @deprecated Use atan(y, x) instead */
  export function atan2(y: Node, x: Node): Node
  export function exp(a: Node): Node
  export function log(a: Node): Node
  export function exp2(a: Node): Node
  export function log2(a: Node): Node
  export function min(a: Node, b: Node): Node
  export function max(a: Node, b: Node): Node
  export function clamp(x: Node, minVal: Node, maxVal: Node): Node
  export function mix(a: Node, b: Node, t: Node): Node
  export function step(edge: Node, x: Node): Node
  export function smoothstep(edge0: Node, edge1: Node, x: Node): Node
  export function length(a: Node): Node
  export function distance(a: Node, b: Node): Node
  export function dot(a: Node, b: Node): Node
  export function cross(a: Node, b: Node): Node
  export function normalize(a: Node): Node
  export function reflect(I: Node, N: Node): Node
  export function refract(I: Node, N: Node, eta: Node): Node

  // Screen-space derivatives (partial derivatives for dFdx/dFdy)
  export function dFdx(node: Node): Node
  export function dFdy(node: Node): Node

  // ============================================================================
  // Depth Conversion Functions
  // ============================================================================

  /**
   * Convert perspective depth buffer value to view-space Z coordinate.
   * Essential for depth-based post-processing effects (DOF, SSAO, SSR).
   *
   * @param depth - Depth buffer value node (0-1 range from depth texture)
   * @param near - Camera near plane distance
   * @param far - Camera far plane distance
   * @returns View-space Z coordinate (negative, into screen)
   */
  export function perspectiveDepthToViewZ(
    depth: Node,
    near: number | Node,
    far: number | Node
  ): Node

  /**
   * Convert view-space Z coordinate to perspective depth buffer value.
   * Inverse of perspectiveDepthToViewZ.
   *
   * @param viewZ - View-space Z coordinate (negative)
   * @param near - Camera near plane distance
   * @param far - Camera far plane distance
   * @returns Depth buffer value (0-1 range)
   */
  export function viewZToPerspectiveDepth(
    viewZ: Node,
    near: number | Node,
    far: number | Node
  ): Node

  // Not equal comparison function
  export function notEqual(a: Node | number, b: Node | number): Node

  // Mathematical constant PI
  export const PI: Node

  // ============================================================================
  // Control Flow
  // ============================================================================

  /**
   * Loop options for more complex loop constructs.
   */
  export interface LoopOptions {
    /** Start index (default: 0) */
    start?: number | Node
    /** End index */
    end?: number | Node
    /** Index variable type (default: 'int') */
    type?: 'int' | 'uint' | 'float'
    /** Index variable name (default: 'i') */
    name?: string
    /** Loop condition (default: '<') */
    condition?: '<' | '<=' | '>' | '>='
    /** Update function or increment value */
    update?: number | string | Node | ((context: { i: Node }) => void)
  }

  /**
   * Create a loop construct.
   * @example Simple loop
   * ```ts
   * Loop(10, ({ i }) => { ... });
   * ```
   * @example Loop with options
   * ```ts
   * Loop({ start: 0, end: 10, type: 'int', condition: '<' }, ({ i }) => { ... });
   * ```
   * @example Boolean condition loop (while)
   * ```ts
   * const value = float(0).toVar();
   * Loop(value.lessThan(10), () => { value.addAssign(1); });
   * ```
   */
  export function Loop(
    countOrOptions: number | Node | LoopOptions,
    callback: (context: { i: Node; j?: Node; k?: Node }) => void
  ): void

  /**
   * Create an if statement.
   */
  export function If(condition: Node, callback: () => void): void

  /**
   * Break out of a loop.
   */
  export function Break(): void

  /**
   * Continue to next iteration.
   */
  export function Continue(): void

  /**
   * Discard the current fragment.
   * Can be called with an optional condition.
   * @param conditional - Optional condition node
   */
  export function Discard(conditional?: Node): Node

  // ============================================================================
  // Scene Pass & MRT
  // ============================================================================

  /**
   * Create a scene render pass.
   */
  export function pass(scene: THREE.Scene, camera: THREE.Camera): PassNode

  /**
   * Configure Multiple Render Targets.
   */
  export function mrt(config: Record<string, Node>): MRTNode

  /** Output target for MRT */
  export const output: Node

  /** Velocity target for MRT */
  export const velocity: Node

  /** Depth target */
  export const depth: Node

  export interface PassNode extends Node {
    setMRT(mrtNode: MRTNode): void
    getTextureNode(name: string): Node
  }

  /** MRT configuration node - extends base Node type */
  export type MRTNode = Node & {
    /** MRT node type marker */
    readonly isMRTNode: true
  }

  // ============================================================================
  // Color Utilities
  // ============================================================================

  /**
   * Create a color node.
   */
  export function color(value: THREE.Color | string | number): Node

  /**
   * Convert linear to sRGB color space.
   */
  export function linearToSRGB(value: Node): Node

  /**
   * Convert sRGB to linear color space.
   */
  export function sRGBToLinear(value: Node): Node

  // ============================================================================
  // Varying Nodes (r176+)
  // ============================================================================

  /**
   * Interpolation sampling type for varyings.
   * Matches THREE.InterpolationSamplingType from constants.js
   */
  export type InterpolationSamplingType = 'perspective' | 'linear' | 'flat'

  /**
   * Interpolation sampling mode for varyings.
   * Matches THREE.InterpolationSamplingMode from constants.js
   */
  export type InterpolationSamplingMode = 'normal' | 'centroid' | 'sample' | 'first' | 'either'

  /**
   * VaryingNode - shader varying for passing data between vertex and fragment stages.
   * Supports flat interpolation for per-face values (no interpolation across triangle).
   */
  export interface VaryingNode extends Node {
    /** The source node */
    node: Node
    /** Optional varying name */
    name: string | null
    /** Type marker */
    readonly isVaryingNode: true
    /** Interpolation type (null = default perspective) */
    interpolationType: InterpolationSamplingType | null
    /** Interpolation sampling mode */
    interpolationSampling: InterpolationSamplingMode | null

    /**
     * Set the interpolation type and sampling mode.
     *
     * For flat shading (no interpolation, first vertex wins):
     * ```ts
     * varying(node, 'vFaceDepth').setInterpolation('flat', 'first')
     * ```
     *
     * @param type - Interpolation type: 'perspective', 'linear', or 'flat'
     * @param sampling - Sampling mode: 'normal', 'centroid', 'sample', 'first', 'either'
     * @returns this for method chaining
     */
    setInterpolation(
      type: InterpolationSamplingType | null,
      sampling?: InterpolationSamplingMode | null
    ): this
  }

  /**
   * Create a varying node for passing data between shader stages.
   *
   * @param node - The source node to create a varying from
   * @param name - Optional varying name (for debugging/GLSL output)
   * @returns VaryingNode that can be configured with setInterpolation()
   *
   * @example Flat varying (no interpolation, first vertex wins)
   * ```ts
   * const faceDepth = varying(attribute('aFaceDepth', 'float'), 'vFaceDepth')
   * faceDepth.setInterpolation('flat', 'first')
   * ```
   */
  export function varying(node: Node, name?: string): VaryingNode

  /**
   * Execute a node in vertex stage and pass result to fragment stage.
   * Shorthand for varying() with automatic interpolation.
   *
   * @param node - Node to execute in vertex stage
   * @returns VaryingNode with result available in fragment stage
   */
  export function vertexStage(node: Node): VaryingNode
}

declare module 'three/addons/tsl/display/BloomNode.js' {
  import type { Node } from 'three/tsl'

  /**
   * Create a bloom post-processing effect.
   * @param inputNode - Input color node
   * @param strength - Bloom strength (default: 1.0)
   * @param radius - Bloom radius (default: 0.4)
   * @param threshold - Luminance threshold (default: 0.85)
   */
  export function bloom(
    inputNode: Node,
    strength?: number,
    radius?: number,
    threshold?: number
  ): Node
}

declare module 'three/addons/tsl/display/SSRNode.js' {
  import type { Node } from 'three/tsl'
  import type { Camera } from 'three'

  /**
   * Create a screen-space reflections effect.
   * @param colorNode - Input color node
   * @param depthNode - Depth buffer node
   * @param normalNode - Normal buffer node
   * @param metalnessNode - Metalness node (use float(0) if not needed)
   * @param roughnessNode - Optional roughness node (null for default)
   * @param camera - Scene camera for projection calculations
   * @returns SSR effect node
   */
  export function ssr(
    colorNode: Node,
    depthNode: Node,
    normalNode: Node,
    metalnessNode: Node | null,
    roughnessNode: Node | null,
    camera?: Camera
  ): Node
}

declare module 'three/addons/tsl/display/GTAONode.js' {
  import type { Node, UniformNode } from 'three/tsl'
  import type { Camera, Vector2 } from 'three'

  /**
   * GTAONode - Ground Truth Ambient Occlusion effect node.
   *
   * Computes high-quality ambient occlusion from depth and normal buffers.
   * Supports configurable quality, resolution scaling, and temporal filtering.
   *
   * Note: The AO result is in the .r channel only.
   * Blend formula: `sceneColor.rgb.mul(aoNode.r)`
   */
  export class GTAONode extends Node {
    constructor(depthNode: Node, normalNode: Node, camera: Camera)

    /** AO radius - larger values = wider AO spread */
    radius: UniformNode<number>

    /** AO scale/intensity multiplier */
    scale: UniformNode<number>

    /** Number of samples (higher = better quality, slower) */
    samples: UniformNode<number>

    /** AO thickness */
    thickness: UniformNode<number>

    /** Distance fall-off [0,1] - lower = larger AO effect */
    distanceFallOff: UniformNode<number>

    /** Distance exponent for occlusion attenuation [1,2] recommended */
    distanceExponent: UniformNode<number>

    /** Effect resolution */
    resolution: UniformNode<Vector2>

    /** Resolution scale (0.5 = half-res, 1.0 = full-res) */
    resolutionScale: number

    /** Enable temporal filtering (requires TRAANode) */
    useTemporalFiltering: boolean

    /** Get the AO result as a texture node */
    getTextureNode(): Node

    /** Set the effect dimensions */
    setSize(width: number, height: number): void

    /** Dispose internal resources */
    dispose(): void
  }

  /**
   * Create a ground-truth ambient occlusion effect.
   *
   * @param depthNode - Depth buffer node (typically from pass.getTextureNode('depth'))
   * @param normalNode - Normal buffer node (can be null for auto-reconstruction)
   * @param camera - Scene camera for projection calculations
   * @returns GTAONode instance with configurable properties
   *
   * @example
   * ```ts
   * const aoNode = ao(depthNode, normalNode, camera)
   * aoNode.radius.value = 0.5
   * aoNode.scale.value = 1.0
   * aoNode.resolutionScale = 0.5 // half-res for performance
   *
   * // Blend with scene:
   * const finalColor = sceneColor.rgb.mul(aoNode.r)
   * ```
   */
  export function ao(depthNode: Node, normalNode: Node | null, camera: Camera): GTAONode
}

declare module 'three/addons/tsl/display/FXAANode.js' {
  import type { Node } from 'three/tsl'

  /**
   * Create an FXAA anti-aliasing effect.
   * @param inputNode - Input color node
   */
  export function fxaa(inputNode: Node): Node
}

declare module 'three/addons/tsl/display/SMAANode.js' {
  import type { Node } from 'three/tsl'

  /**
   * Create an SMAA anti-aliasing effect.
   * @param inputNode - Input color node
   */
  export function smaa(inputNode: Node): Node
}

declare module 'three/addons/tsl/display/DepthOfFieldNode.js' {
  import type { Node } from 'three/tsl'

  /**
   * DepthOfFieldNode - creates depth-based bokeh blur effect.
   * Uses Vogel's method for uniformly distributed sample points.
   *
   * Based on:
   * - https://pixelmischiefblog.wordpress.com/2016/11/25/bokeh-depth-of-field/
   * - https://www.adriancourreges.com/blog/2016/09/09/doom-2016-graphics-study/
   */
  export class DepthOfFieldNode extends Node {
    constructor(
      textureNode: Node,
      viewZNode: Node,
      focusDistanceNode: Node,
      focalLengthNode: Node,
      bokehScaleNode: Node
    )

    /**
     * Get the result texture node for chaining.
     */
    getTextureNode(): Node

    /**
     * Set the size of the effect.
     */
    setSize(width: number, height: number): void

    /**
     * Dispose internal render targets and materials.
     */
    dispose(): void
  }

  /**
   * Create a depth of field (DOF/bokeh) effect.
   *
   * @param node - Input color node to apply DOF to
   * @param viewZNode - View-space Z depth node (use perspectiveDepthToViewZ to convert depth buffer)
   * @param focusDistance - Focus distance in world units (where the scene is in focus)
   * @param focalLength - How far from focal plane before fully out-of-focus (in world units)
   * @param bokehScale - Artistic scale factor for bokeh size (unitless)
   * @returns DOF effect node
   */
  export function dof(
    node: Node,
    viewZNode: Node,
    focusDistance?: number | Node,
    focalLength?: number | Node,
    bokehScale?: number | Node
  ): DepthOfFieldNode
}

declare module 'three/addons/transpiler/Transpiler.js' {
  /**
   * Shader transpiler for converting between shader languages.
   */
  export default class Transpiler {
    constructor(decoder: unknown, encoder: unknown)

    /**
     * Parse and transpile shader code.
     * @param code - Source shader code
     * @returns Transpiled shader code
     */
    parse(code: string): string
  }
}

declare module 'three/addons/transpiler/GLSLDecoder.js' {
  /**
   * GLSL shader decoder for the transpiler.
   */
  export default class GLSLDecoder {
    constructor()
  }
}

declare module 'three/addons/transpiler/TSLEncoder.js' {
  /**
   * TSL shader encoder for the transpiler.
   */
  export default class TSLEncoder {
    constructor()
  }
}

