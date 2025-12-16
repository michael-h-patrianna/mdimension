/**
 * Tests for extendedObjectStore
 */

import {
  DEFAULT_CLIFFORD_TORUS_CONFIG,
  DEFAULT_MANDELBROT_CONFIG,
  DEFAULT_ROOT_SYSTEM_CONFIG,
} from '@/lib/geometry/extended/types'
import { useExtendedObjectStore } from '@/stores/extendedObjectStore'
import { beforeEach, describe, expect, it } from 'vitest'

describe('extendedObjectStore', () => {
  beforeEach(() => {
    useExtendedObjectStore.getState().reset()
  })

  describe('initial state', () => {
    it('should have default root system config', () => {
      const state = useExtendedObjectStore.getState()
      expect(state.rootSystem).toEqual(DEFAULT_ROOT_SYSTEM_CONFIG)
    })

    it('should have default clifford torus config', () => {
      const state = useExtendedObjectStore.getState()
      expect(state.cliffordTorus).toEqual(DEFAULT_CLIFFORD_TORUS_CONFIG)
    })

    it('should have default mandelbrot config', () => {
      const state = useExtendedObjectStore.getState()
      expect(state.mandelbrot).toEqual(DEFAULT_MANDELBROT_CONFIG)
    })
  })

  describe('root system actions', () => {
    it('should set root type', () => {
      const { setRootSystemType } = useExtendedObjectStore.getState()

      setRootSystemType('D')
      expect(useExtendedObjectStore.getState().rootSystem.rootType).toBe('D')

      setRootSystemType('E8')
      expect(useExtendedObjectStore.getState().rootSystem.rootType).toBe('E8')

      setRootSystemType('A')
      expect(useExtendedObjectStore.getState().rootSystem.rootType).toBe('A')
    })

    it('should set scale with clamping', () => {
      const { setRootSystemScale } = useExtendedObjectStore.getState()

      setRootSystemScale(1.5)
      expect(useExtendedObjectStore.getState().rootSystem.scale).toBe(1.5)

      // Test clamping - too low
      setRootSystemScale(0.1)
      expect(useExtendedObjectStore.getState().rootSystem.scale).toBe(0.5)

      // Test clamping - too high (range is 0.5-4.0)
      setRootSystemScale(5)
      expect(useExtendedObjectStore.getState().rootSystem.scale).toBe(4.0)
    })
  })

  describe('clifford torus actions', () => {
    it('should set mode', () => {
      const { setCliffordTorusMode } = useExtendedObjectStore.getState()

      setCliffordTorusMode('generalized')
      expect(useExtendedObjectStore.getState().cliffordTorus.mode).toBe('generalized')

      setCliffordTorusMode('classic')
      expect(useExtendedObjectStore.getState().cliffordTorus.mode).toBe('classic')
    })

    it('should set radius with clamping', () => {
      const { setCliffordTorusRadius } = useExtendedObjectStore.getState()

      setCliffordTorusRadius(2.0)
      expect(useExtendedObjectStore.getState().cliffordTorus.radius).toBe(2.0)

      // Test clamping - too low
      setCliffordTorusRadius(0.1)
      expect(useExtendedObjectStore.getState().cliffordTorus.radius).toBe(0.5)

      // Test clamping - too high (range is 0.5-6.0)
      setCliffordTorusRadius(10)
      expect(useExtendedObjectStore.getState().cliffordTorus.radius).toBe(6.0)
    })

    it('should set resolution U with clamping', () => {
      const { setCliffordTorusResolutionU } = useExtendedObjectStore.getState()

      setCliffordTorusResolutionU(32)
      expect(useExtendedObjectStore.getState().cliffordTorus.resolutionU).toBe(32)

      // Test clamping - too low
      setCliffordTorusResolutionU(4)
      expect(useExtendedObjectStore.getState().cliffordTorus.resolutionU).toBe(8)

      // Test clamping - too high
      setCliffordTorusResolutionU(200)
      expect(useExtendedObjectStore.getState().cliffordTorus.resolutionU).toBe(128)
    })

    it('should set resolution V with clamping', () => {
      const { setCliffordTorusResolutionV } = useExtendedObjectStore.getState()

      setCliffordTorusResolutionV(32)
      expect(useExtendedObjectStore.getState().cliffordTorus.resolutionV).toBe(32)

      // Test clamping - too low
      setCliffordTorusResolutionV(4)
      expect(useExtendedObjectStore.getState().cliffordTorus.resolutionV).toBe(8)

      // Test clamping - too high
      setCliffordTorusResolutionV(200)
      expect(useExtendedObjectStore.getState().cliffordTorus.resolutionV).toBe(128)
    })

    it('should set edge mode', () => {
      const { setCliffordTorusEdgeMode } = useExtendedObjectStore.getState()

      setCliffordTorusEdgeMode('grid')
      expect(useExtendedObjectStore.getState().cliffordTorus.edgeMode).toBe('grid')

      setCliffordTorusEdgeMode('none')
      expect(useExtendedObjectStore.getState().cliffordTorus.edgeMode).toBe('none')
    })

    it('should set stepsPerCircle with clamping', () => {
      const { setCliffordTorusStepsPerCircle } = useExtendedObjectStore.getState()

      setCliffordTorusStepsPerCircle(12)
      expect(useExtendedObjectStore.getState().cliffordTorus.stepsPerCircle).toBe(12)

      // Test clamping - too low
      setCliffordTorusStepsPerCircle(2)
      expect(useExtendedObjectStore.getState().cliffordTorus.stepsPerCircle).toBe(4)

      // Test clamping - too high
      setCliffordTorusStepsPerCircle(100)
      expect(useExtendedObjectStore.getState().cliffordTorus.stepsPerCircle).toBe(64)
    })

    it('should floor stepsPerCircle to integer', () => {
      const { setCliffordTorusStepsPerCircle } = useExtendedObjectStore.getState()

      setCliffordTorusStepsPerCircle(15.8)
      expect(useExtendedObjectStore.getState().cliffordTorus.stepsPerCircle).toBe(15)
    })
  })

  describe('mandelbrot actions', () => {
    it('should set max iterations with clamping', () => {
      const { setMandelbrotMaxIterations } = useExtendedObjectStore.getState()

      setMandelbrotMaxIterations(100)
      expect(useExtendedObjectStore.getState().mandelbrot.maxIterations).toBe(100)

      // Test clamping - too low
      setMandelbrotMaxIterations(5)
      expect(useExtendedObjectStore.getState().mandelbrot.maxIterations).toBe(10)

      // Test clamping - too high
      setMandelbrotMaxIterations(1000)
      expect(useExtendedObjectStore.getState().mandelbrot.maxIterations).toBe(500)
    })

    it('should floor max iterations to integer', () => {
      const { setMandelbrotMaxIterations } = useExtendedObjectStore.getState()

      setMandelbrotMaxIterations(75.8)
      expect(useExtendedObjectStore.getState().mandelbrot.maxIterations).toBe(75)
    })

    it('should set escape radius with clamping', () => {
      const { setMandelbrotEscapeRadius } = useExtendedObjectStore.getState()

      setMandelbrotEscapeRadius(4.0)
      expect(useExtendedObjectStore.getState().mandelbrot.escapeRadius).toBe(4.0)

      // Test clamping - too low
      setMandelbrotEscapeRadius(1.0)
      expect(useExtendedObjectStore.getState().mandelbrot.escapeRadius).toBe(2.0)

      // Test clamping - too high (extended to 16 for Hyperbulb support)
      setMandelbrotEscapeRadius(20)
      expect(useExtendedObjectStore.getState().mandelbrot.escapeRadius).toBe(16.0)
    })

    it('should set quality preset and update related settings', () => {
      const { setMandelbrotQualityPreset } = useExtendedObjectStore.getState()

      setMandelbrotQualityPreset('draft')
      const state = useExtendedObjectStore.getState().mandelbrot
      expect(state.qualityPreset).toBe('draft')
      expect(state.maxIterations).toBe(30)
      expect(state.resolution).toBe(24)

      setMandelbrotQualityPreset('ultra')
      const ultraState = useExtendedObjectStore.getState().mandelbrot
      expect(ultraState.qualityPreset).toBe('ultra')
      expect(ultraState.maxIterations).toBe(500)
      expect(ultraState.resolution).toBe(96)
    })

    it('should set resolution to closest valid value', () => {
      const { setMandelbrotResolution } = useExtendedObjectStore.getState()

      setMandelbrotResolution(32)
      expect(useExtendedObjectStore.getState().mandelbrot.resolution).toBe(32)

      // Should snap to closest valid resolution (16, 24, 32, 48, 64, 96, 128)
      // Use 42 which is clearly closer to 48 (distance 6) than 32 (distance 10)
      setMandelbrotResolution(42)
      expect(useExtendedObjectStore.getState().mandelbrot.resolution).toBe(48)

      // Use 60 which is clearly closer to 64 (distance 4) than 48 (distance 12)
      setMandelbrotResolution(60)
      expect(useExtendedObjectStore.getState().mandelbrot.resolution).toBe(64)
    })

    it('should set visualization axes', () => {
      const { setMandelbrotVisualizationAxes } = useExtendedObjectStore.getState()

      setMandelbrotVisualizationAxes([1, 2, 3])
      expect(useExtendedObjectStore.getState().mandelbrot.visualizationAxes).toEqual([1, 2, 3])
    })

    it('should set individual visualization axis', () => {
      const { setMandelbrotVisualizationAxis } = useExtendedObjectStore.getState()

      // Start with default [0, 1, 2]
      setMandelbrotVisualizationAxis(0, 3)
      expect(useExtendedObjectStore.getState().mandelbrot.visualizationAxes).toEqual([3, 1, 2])

      setMandelbrotVisualizationAxis(2, 4)
      expect(useExtendedObjectStore.getState().mandelbrot.visualizationAxes).toEqual([3, 1, 4])
    })

    it('should set parameter value with clamping', () => {
      const { setMandelbrotParameterValues, setMandelbrotParameterValue } =
        useExtendedObjectStore.getState()

      // First set up some parameter values
      setMandelbrotParameterValues([0, 0, 0])

      setMandelbrotParameterValue(1, 0.5)
      expect(useExtendedObjectStore.getState().mandelbrot.parameterValues[1]).toBe(0.5)

      // Test clamping
      setMandelbrotParameterValue(0, 5.0)
      expect(useExtendedObjectStore.getState().mandelbrot.parameterValues[0]).toBe(2.0)

      setMandelbrotParameterValue(2, -5.0)
      expect(useExtendedObjectStore.getState().mandelbrot.parameterValues[2]).toBe(-2.0)
    })

    it('should set parameter values with clamping', () => {
      const { setMandelbrotParameterValues } = useExtendedObjectStore.getState()

      setMandelbrotParameterValues([0.1, -0.2, 0.3])
      expect(useExtendedObjectStore.getState().mandelbrot.parameterValues).toEqual([0.1, -0.2, 0.3])

      // Test clamping
      setMandelbrotParameterValues([5, -5, 1])
      expect(useExtendedObjectStore.getState().mandelbrot.parameterValues).toEqual([2.0, -2.0, 1])
    })

    it('should reset parameters to zeros', () => {
      const { setMandelbrotParameterValues, resetMandelbrotParameters } =
        useExtendedObjectStore.getState()

      setMandelbrotParameterValues([0.5, -0.3, 0.2])
      resetMandelbrotParameters()
      expect(useExtendedObjectStore.getState().mandelbrot.parameterValues).toEqual([0, 0, 0])
    })

    it('should set center coordinates', () => {
      const { setMandelbrotCenter } = useExtendedObjectStore.getState()

      setMandelbrotCenter([0.1, -0.2, 0.3, 0.4])
      expect(useExtendedObjectStore.getState().mandelbrot.center).toEqual([0.1, -0.2, 0.3, 0.4])
    })

    it('should set extent (zoom) with clamping', () => {
      const { setMandelbrotExtent } = useExtendedObjectStore.getState()

      setMandelbrotExtent(1.5)
      expect(useExtendedObjectStore.getState().mandelbrot.extent).toBe(1.5)

      // Test clamping - too low
      setMandelbrotExtent(0.0001)
      expect(useExtendedObjectStore.getState().mandelbrot.extent).toBe(0.001)

      // Test clamping - too high
      setMandelbrotExtent(20)
      expect(useExtendedObjectStore.getState().mandelbrot.extent).toBe(10.0)
    })

    it('should fit to view (reset center and extent)', () => {
      const { setMandelbrotCenter, setMandelbrotExtent, fitMandelbrotToView } =
        useExtendedObjectStore.getState()

      setMandelbrotCenter([0.5, -0.3, 0.2])
      setMandelbrotExtent(0.5)

      fitMandelbrotToView()

      const state = useExtendedObjectStore.getState().mandelbrot
      expect(state.center).toEqual([0, 0, 0])
      expect(state.extent).toBe(2.5)
    })

    it('should set color mode', () => {
      const { setMandelbrotColorMode } = useExtendedObjectStore.getState()

      setMandelbrotColorMode('smoothColoring')
      expect(useExtendedObjectStore.getState().mandelbrot.colorMode).toBe('smoothColoring')

      setMandelbrotColorMode('interiorOnly')
      expect(useExtendedObjectStore.getState().mandelbrot.colorMode).toBe('interiorOnly')
    })

    it('should set palette', () => {
      const { setMandelbrotPalette } = useExtendedObjectStore.getState()

      setMandelbrotPalette('triadic')
      expect(useExtendedObjectStore.getState().mandelbrot.palette).toBe('triadic')

      setMandelbrotPalette('analogous')
      expect(useExtendedObjectStore.getState().mandelbrot.palette).toBe('analogous')
    })

    it('should set custom palette', () => {
      const { setMandelbrotCustomPalette } = useExtendedObjectStore.getState()

      const customPalette = { start: '#ff0000', mid: '#00ff00', end: '#0000ff' }
      setMandelbrotCustomPalette(customPalette)
      expect(useExtendedObjectStore.getState().mandelbrot.customPalette).toEqual(customPalette)
    })

    it('should set invert colors', () => {
      const { setMandelbrotInvertColors } = useExtendedObjectStore.getState()

      setMandelbrotInvertColors(true)
      expect(useExtendedObjectStore.getState().mandelbrot.invertColors).toBe(true)

      setMandelbrotInvertColors(false)
      expect(useExtendedObjectStore.getState().mandelbrot.invertColors).toBe(false)
    })

    it('should set interior color', () => {
      const { setMandelbrotInteriorColor } = useExtendedObjectStore.getState()

      setMandelbrotInteriorColor('#ff0000')
      expect(useExtendedObjectStore.getState().mandelbrot.interiorColor).toBe('#ff0000')
    })

    it('should set palette cycles with clamping', () => {
      const { setMandelbrotPaletteCycles } = useExtendedObjectStore.getState()

      setMandelbrotPaletteCycles(5)
      expect(useExtendedObjectStore.getState().mandelbrot.paletteCycles).toBe(5)

      // Test clamping - too low
      setMandelbrotPaletteCycles(0)
      expect(useExtendedObjectStore.getState().mandelbrot.paletteCycles).toBe(1)

      // Test clamping - too high
      setMandelbrotPaletteCycles(30)
      expect(useExtendedObjectStore.getState().mandelbrot.paletteCycles).toBe(20)
    })

    it('should set render style', () => {
      const { setMandelbrotRenderStyle } = useExtendedObjectStore.getState()

      setMandelbrotRenderStyle('rayMarching')
      expect(useExtendedObjectStore.getState().mandelbrot.renderStyle).toBe('rayMarching')
    })

    it('should set point size with clamping', () => {
      const { setMandelbrotPointSize } = useExtendedObjectStore.getState()

      setMandelbrotPointSize(5)
      expect(useExtendedObjectStore.getState().mandelbrot.pointSize).toBe(5)

      // Test clamping - too low
      setMandelbrotPointSize(0)
      expect(useExtendedObjectStore.getState().mandelbrot.pointSize).toBe(1)

      // Test clamping - too high
      setMandelbrotPointSize(30)
      expect(useExtendedObjectStore.getState().mandelbrot.pointSize).toBe(20)
    })

    it('should initialize for dimension', () => {
      const { initializeMandelbrotForDimension } = useExtendedObjectStore.getState()

      initializeMandelbrotForDimension(5)

      const state = useExtendedObjectStore.getState().mandelbrot
      expect(state.parameterValues).toHaveLength(2) // 5 - 3 = 2
      expect(state.parameterValues).toEqual([0, 0])
      expect(state.center).toHaveLength(5)
      expect(state.center).toEqual([0, 0, 0, 0, 0])
      expect(state.visualizationAxes).toEqual([0, 1, 2])
    })

    it('should set boundary threshold with clamping and ordering', () => {
      const { setMandelbrotBoundaryThreshold } = useExtendedObjectStore.getState()

      // Normal setting
      setMandelbrotBoundaryThreshold([0.2, 0.8])
      expect(useExtendedObjectStore.getState().mandelbrot.boundaryThreshold).toEqual([0.2, 0.8])

      // Clamp too low
      setMandelbrotBoundaryThreshold([-0.5, 0.5])
      expect(useExtendedObjectStore.getState().mandelbrot.boundaryThreshold).toEqual([0, 0.5])

      // Clamp too high
      setMandelbrotBoundaryThreshold([0.3, 1.5])
      expect(useExtendedObjectStore.getState().mandelbrot.boundaryThreshold).toEqual([0.3, 1])

      // Ensure min <= max (min is clamped, then max is clamped to be >= min)
      setMandelbrotBoundaryThreshold([0.8, 0.3])
      const threshold = useExtendedObjectStore.getState().mandelbrot.boundaryThreshold
      expect(threshold[0]).toBeLessThanOrEqual(threshold[1])
    })

    it('should set mandelbulb power with clamping and integer', () => {
      const { setMandelbrotMandelbulbPower } = useExtendedObjectStore.getState()

      // Normal setting
      setMandelbrotMandelbulbPower(8)
      expect(useExtendedObjectStore.getState().mandelbrot.mandelbulbPower).toBe(8)

      // Different value
      setMandelbrotMandelbulbPower(3)
      expect(useExtendedObjectStore.getState().mandelbrot.mandelbulbPower).toBe(3)

      // Clamp too low (min 2)
      setMandelbrotMandelbulbPower(1)
      expect(useExtendedObjectStore.getState().mandelbrot.mandelbulbPower).toBe(2)

      // Clamp too high (max 16)
      setMandelbrotMandelbulbPower(20)
      expect(useExtendedObjectStore.getState().mandelbrot.mandelbulbPower).toBe(16)

      // Should floor decimal values
      setMandelbrotMandelbulbPower(5.7)
      expect(useExtendedObjectStore.getState().mandelbrot.mandelbulbPower).toBe(5)
    })

    it('should get config as copy', () => {
      const { getMandelbrotConfig, setMandelbrotMaxIterations } = useExtendedObjectStore.getState()

      setMandelbrotMaxIterations(150)
      const config = getMandelbrotConfig()

      expect(config.maxIterations).toBe(150)

      // Should be a copy, not a reference
      config.maxIterations = 999
      expect(useExtendedObjectStore.getState().mandelbrot.maxIterations).toBe(150)
    })
  })

  describe('reset', () => {
    it('should reset all configs to defaults', () => {
      const state = useExtendedObjectStore.getState()

      // Modify all configs
      state.setRootSystemType('E8')
      state.setCliffordTorusRadius(2.5)
      state.setMandelbrotMaxIterations(200)
      state.setMandelbrotPalette('triadic')

      // Reset
      state.reset()

      // Verify all reset to defaults
      const newState = useExtendedObjectStore.getState()
      expect(newState.rootSystem).toEqual(DEFAULT_ROOT_SYSTEM_CONFIG)
      expect(newState.cliffordTorus).toEqual(DEFAULT_CLIFFORD_TORUS_CONFIG)
      expect(newState.mandelbrot).toEqual(DEFAULT_MANDELBROT_CONFIG)
    })
  })
})
