import type { Page } from '@playwright/test'

export type WebGLShaderGuardOptions = Readonly<{
  /**
   * Max characters of shader source to include in the error payload.
   * Keep this small to avoid huge console logs for generated shaders.
   */
  maxSourceChars?: number
}>

/**
 * Installs a WebGL2 shader compile/link guard into the page.
 *
 * This runs in the browser context (via Playwright init script) and will
 * throw if:
 * - `getShaderParameter(shader, COMPILE_STATUS)` is false
 * - `getProgramParameter(program, LINK_STATUS)` is false
 *
 * It also prints actionable info logs and a trimmed source excerpt.
 *
 * IMPORTANT: Call this BEFORE `page.goto()`.
 */
export async function installWebGLShaderCompileLinkGuard(
  page: Page,
  options: WebGLShaderGuardOptions = {}
): Promise<void> {
  const maxSourceChars = options.maxSourceChars ?? 4000

  await page.addInitScript(
    ({ maxSourceChars: injectedMaxSourceChars }) => {
      // Idempotency: avoid re-patching if the test does multiple navigations.
      const g = globalThis as unknown as { __mdimensionWebglShaderGuardInstalled?: boolean }
      if (g.__mdimensionWebglShaderGuardInstalled) return
      g.__mdimensionWebglShaderGuardInstalled = true

      const MAX_SOURCE_CHARS: number = injectedMaxSourceChars

      type GLShader = WebGLShader
      type GLProgram = WebGLProgram

      const shaderSource = new WeakMap<GLShader, string>()
      const shaderType = new WeakMap<GLShader, number>()
      const programShaders = new WeakMap<GLProgram, Set<GLShader>>()
      const shaderId = new WeakMap<GLShader, number>()
      const programId = new WeakMap<GLProgram, number>()

      let nextShaderId = 1
      let nextProgramId = 1

      const reportedShaders = new WeakSet<GLShader>()
      const reportedPrograms = new WeakSet<GLProgram>()

      const trimSource = (src: string): string => {
        if (src.length <= MAX_SOURCE_CHARS) return src
        return `${src.slice(0, MAX_SOURCE_CHARS)}\n/* ...trimmed (${src.length} chars total)... */`
      }

      const shaderTypeName = (gl: WebGL2RenderingContext, t: number): string => {
        if (t === gl.VERTEX_SHADER) return 'VERTEX_SHADER'
        if (t === gl.FRAGMENT_SHADER) return 'FRAGMENT_SHADER'
        return `SHADER_TYPE_${t}`
      }

      const formatGuardError = (name: string, payload: Record<string, unknown>): string => {
        try {
          return `[WebGLShaderGuard] ${name} ${JSON.stringify(payload)}`
        } catch {
          return `[WebGLShaderGuard] ${name} (payload unserializable)`
        }
      }

      const getRuntimeContext = (): Record<string, unknown> => {
        try {
          const url = location?.href ?? ''
          const params = new URL(url).searchParams
          return {
            url,
            objectType: params.get('t') ?? null,
            dimension: params.get('d') ?? null,
          }
        } catch {
          return { url: null, objectType: null, dimension: null }
        }
      }

      const installFor = (Proto: typeof WebGL2RenderingContext.prototype): void => {
        const proto = Proto as unknown as WebGL2RenderingContext
        const glProto = Proto

        // Bind originals once
        const origCreateShader = glProto.createShader
        const origShaderSource = glProto.shaderSource
        const origCompileShader = glProto.compileShader
        const origGetShaderParameter = glProto.getShaderParameter
        const origGetShaderInfoLog = glProto.getShaderInfoLog
        const origCreateProgram = glProto.createProgram
        const origAttachShader = glProto.attachShader
        const origLinkProgram = glProto.linkProgram
        const origGetProgramParameter = glProto.getProgramParameter
        const origGetProgramInfoLog = glProto.getProgramInfoLog

        glProto.createShader = function createShaderPatched(this: WebGL2RenderingContext, type: number) {
          const shader = origCreateShader.call(this, type)
          if (shader) {
            shaderType.set(shader, type)
            shaderId.set(shader, nextShaderId++)
          }
          return shader
        }

        glProto.shaderSource = function shaderSourcePatched(
          this: WebGL2RenderingContext,
          shader: GLShader,
          source: string
        ) {
          shaderSource.set(shader, source)
          return origShaderSource.call(this, shader, source)
        }

        glProto.compileShader = function compileShaderPatched(this: WebGL2RenderingContext, shader: GLShader) {
          return origCompileShader.call(this, shader)
        }

        // The most reliable place to detect compilation failure is where the app
        // checks COMPILE_STATUS (Three.js does this).
        glProto.getShaderParameter = function getShaderParameterPatched(
          this: WebGL2RenderingContext,
          shader: GLShader,
          pname: number
        ) {
          const result = origGetShaderParameter.call(this, shader, pname) as unknown
          if (pname === this.COMPILE_STATUS && result === false && !reportedShaders.has(shader)) {
            reportedShaders.add(shader)

            const type = shaderType.get(shader)
            const id = shaderId.get(shader) ?? null
            const infoLog = origGetShaderInfoLog.call(this, shader) ?? ''
            const src = shaderSource.get(shader) ?? ''

            const message = formatGuardError('ShaderCompileFailed', {
              ...getRuntimeContext(),
              shaderId: id,
              stage: type != null ? shaderTypeName(this, type) : 'UNKNOWN',
              infoLog,
              source: trimSource(src),
            })

            // Surface in console AND as a thrown error (causes Playwright to fail).
            console.error(message)
            throw new Error(message)
          }
          return result as never
        }

        glProto.getShaderInfoLog = function getShaderInfoLogPatched(this: WebGL2RenderingContext, shader: GLShader) {
          return origGetShaderInfoLog.call(this, shader)
        }

        glProto.createProgram = function createProgramPatched(this: WebGL2RenderingContext) {
          const program = origCreateProgram.call(this)
          if (program) {
            programShaders.set(program, new Set())
            programId.set(program, nextProgramId++)
          }
          return program
        }

        glProto.attachShader = function attachShaderPatched(
          this: WebGL2RenderingContext,
          program: GLProgram,
          shader: GLShader
        ) {
          const set = programShaders.get(program)
          if (set) set.add(shader)
          return origAttachShader.call(this, program, shader)
        }

        glProto.linkProgram = function linkProgramPatched(this: WebGL2RenderingContext, program: GLProgram) {
          return origLinkProgram.call(this, program)
        }

        // Similar to compile, Three.js checks LINK_STATUS via getProgramParameter.
        // Hooking there avoids false positives with KHR_parallel_shader_compile.
        glProto.getProgramParameter = function getProgramParameterPatched(
          this: WebGL2RenderingContext,
          program: GLProgram,
          pname: number
        ) {
          const result = origGetProgramParameter.call(this, program, pname) as unknown
          if (pname === this.LINK_STATUS && result === false && !reportedPrograms.has(program)) {
            reportedPrograms.add(program)

            const id = programId.get(program) ?? null
            const infoLog = origGetProgramInfoLog.call(this, program) ?? ''
            const shaders = Array.from(programShaders.get(program) ?? [])
            const shaderDetails = shaders.map((s) => {
              const t = shaderType.get(s)
              const sid = shaderId.get(s) ?? null
              const stage = t != null ? shaderTypeName(this, t) : 'UNKNOWN'
              const src = shaderSource.get(s) ?? ''
              const slog = origGetShaderInfoLog.call(this, s) ?? ''
              return { shaderId: sid, stage, infoLog: slog, source: trimSource(src) }
            })

            const message = formatGuardError('ProgramLinkFailed', {
              ...getRuntimeContext(),
              programId: id,
              infoLog,
              shaders: shaderDetails,
            })

            console.error(message)
            throw new Error(message)
          }
          return result as never
        }

        glProto.getProgramInfoLog = function getProgramInfoLogPatched(this: WebGL2RenderingContext, program: GLProgram) {
          return origGetProgramInfoLog.call(this, program)
        }

        // Avoid unused variable lint warnings in injected scope
        void proto
      }

      try {
        if (typeof WebGL2RenderingContext !== 'undefined') {
          installFor(WebGL2RenderingContext.prototype)
        }
        // Fallback: if app uses WebGL1 somewhere, still catch failures.
        if (typeof WebGLRenderingContext !== 'undefined') {
          installFor(WebGLRenderingContext.prototype as unknown as typeof WebGL2RenderingContext.prototype)
        }
      } catch (err) {
        console.error(
          `[WebGLShaderGuard] Failed to install guard: ${
            err instanceof Error ? err.message : String(err)
          }`
        )
      }
    },
    { maxSourceChars }
  )
}


