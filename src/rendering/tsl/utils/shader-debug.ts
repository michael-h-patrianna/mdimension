/**
 * TSL Shader Debug Information
 *
 * Track and report shader composition for debugging.
 * Matches WebGL shader info patterns.
 *
 * @module rendering/tsl/utils/shader-debug
 */

/**
 * Shader debug information
 */
export interface ShaderDebugInfo {
  /** Material name/type */
  materialName: string
  /** Active feature modules */
  modules: string[]
  /** Feature flags */
  features: string[]
  /** Uniform count estimate */
  uniformCount: number
  /** Whether using WebGPU or WebGL backend */
  backend: 'webgpu' | 'webgl'
  /** Timestamp of creation */
  createdAt: number
}

/**
 * Shader debug registry
 */
class ShaderDebugRegistry {
  private shaders: Map<string, ShaderDebugInfo> = new Map()
  private listeners: Set<(info: ShaderDebugInfo) => void> = new Set()

  /**
   * Register a shader for debugging
   */
  register(id: string, info: ShaderDebugInfo): void {
    this.shaders.set(id, info)
    this.notifyListeners(info)
  }

  /**
   * Unregister a shader
   */
  unregister(id: string): void {
    this.shaders.delete(id)
  }

  /**
   * Get all registered shaders
   */
  getAll(): Map<string, ShaderDebugInfo> {
    return new Map(this.shaders)
  }

  /**
   * Get shader by ID
   */
  get(id: string): ShaderDebugInfo | undefined {
    return this.shaders.get(id)
  }

  /**
   * Add listener for shader registrations
   */
  addListener(listener: (info: ShaderDebugInfo) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notifyListeners(info: ShaderDebugInfo): void {
    this.listeners.forEach((listener) => listener(info))
  }

  /**
   * Generate debug report
   */
  generateReport(): string {
    const lines: string[] = ['=== TSL Shader Debug Report ===', '']

    for (const [id, info] of this.shaders) {
      lines.push(`[${id}] ${info.materialName}`)
      lines.push(`  Backend: ${info.backend}`)
      lines.push(`  Features: ${info.features.join(', ') || 'none'}`)
      lines.push(`  Modules: ${info.modules.join(', ') || 'none'}`)
      lines.push(`  Uniforms: ~${info.uniformCount}`)
      lines.push('')
    }

    return lines.join('\n')
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.shaders.clear()
  }
}

// Singleton instance
let globalRegistry: ShaderDebugRegistry | null = null

/**
 * Get the global shader debug registry
 */
export function getShaderDebugRegistry(): ShaderDebugRegistry {
  if (!globalRegistry) {
    globalRegistry = new ShaderDebugRegistry()
  }
  return globalRegistry
}

/**
 * Create debug info for a composed material
 *
 * @param materialName - Name of the material
 * @param features - Enabled features
 * @param backend - Rendering backend
 * @returns ShaderDebugInfo object
 */
export function createShaderDebugInfo(
  materialName: string,
  features: string[],
  backend: 'webgpu' | 'webgl' = 'webgpu'
): ShaderDebugInfo {
  // Estimate uniform count based on features
  let uniformCount = 10 // Base uniforms (color, opacity, transform)

  const uniformCounts: Record<string, number> = {
    lighting: 50, // 8 lights * 6 properties + ambient
    shadows: 30, // 4 shadow maps + matrices
    ibl: 5, // env map + intensity + quality
    sss: 7, // SSS parameters
    fresnel: 5, // Fresnel parameters
    colorAlgorithm: 15, // Cosine + distribution + LCH
    mrt: 0, // No extra uniforms
    screenSpaceNormals: 0, // No extra uniforms
  }

  for (const feature of features) {
    uniformCount += uniformCounts[feature] || 0
  }

  // Determine modules based on features
  const modules: string[] = ['ndTransform'] // Always present

  if (features.includes('lighting')) modules.push('multiLight', 'pbr')
  if (features.includes('shadows')) modules.push('shadowMaps')
  if (features.includes('ibl')) modules.push('ibl', 'pmrem')
  if (features.includes('sss')) modules.push('sss')
  if (features.includes('fresnel')) modules.push('fresnel')
  if (features.includes('colorAlgorithm')) modules.push('colorAlgorithm', 'hsl', 'oklab', 'cosinePalette')
  if (features.includes('screenSpaceNormals')) modules.push('screenSpaceNormals')

  return {
    materialName,
    modules,
    features,
    uniformCount,
    backend,
    createdAt: Date.now(),
  }
}

/**
 * Log shader debug info to console
 */
export function logShaderDebugInfo(info: ShaderDebugInfo): void {
  console.log(
    `[TSL Shader] ${info.materialName} (${info.backend})`,
    `\n  Features: ${info.features.join(', ')}`,
    `\n  Modules: ${info.modules.join(', ')}`,
    `\n  Uniforms: ~${info.uniformCount}`
  )
}
