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

  describe('mandelbulb actions', () => {
    it('should set max iterations with clamping', () => {
      const { setMandelbulbMaxIterations } = useExtendedObjectStore.getState()

      setMandelbulbMaxIterations(100)
      expect(useExtendedObjectStore.getState().mandelbulb.maxIterations).toBe(100)

      // Test clamping - too low
      setMandelbulbMaxIterations(5)
      expect(useExtendedObjectStore.getState().mandelbulb.maxIterations).toBe(10)

      // Test clamping - too high
      setMandelbulbMaxIterations(1000)
      expect(useExtendedObjectStore.getState().mandelbulb.maxIterations).toBe(500)
    })

    it('should floor max iterations to integer', () => {
      const { setMandelbulbMaxIterations } = useExtendedObjectStore.getState()

      setMandelbulbMaxIterations(75.8)
      expect(useExtendedObjectStore.getState().mandelbulb.maxIterations).toBe(75)
    })

    it('should set escape radius with clamping', () => {
      const { setMandelbulbEscapeRadius } = useExtendedObjectStore.getState()

      setMandelbulbEscapeRadius(4.0)
      expect(useExtendedObjectStore.getState().mandelbulb.escapeRadius).toBe(4.0)

      // Test clamping - too low
      setMandelbulbEscapeRadius(1.0)
      expect(useExtendedObjectStore.getState().mandelbulb.escapeRadius).toBe(2.0)

      // Test clamping - too high (extended to 16 for Mandelbulb support)
      setMandelbulbEscapeRadius(20)
      expect(useExtendedObjectStore.getState().mandelbulb.escapeRadius).toBe(16.0)
    })

    it('should set quality preset and update related settings', () => {
      const { setMandelbulbQualityPreset } = useExtendedObjectStore.getState()

      setMandelbulbQualityPreset('draft')
      const state = useExtendedObjectStore.getState().mandelbulb
      expect(state.qualityPreset).toBe('draft')
      expect(state.maxIterations).toBe(30)
      expect(state.resolution).toBe(24)

      setMandelbulbQualityPreset('ultra')
      const ultraState = useExtendedObjectStore.getState().mandelbulb
      expect(ultraState.qualityPreset).toBe('ultra')
      expect(ultraState.maxIterations).toBe(500)
      expect(ultraState.resolution).toBe(96)
    })

    it('should set resolution to closest valid value', () => {
      const { setMandelbulbResolution } = useExtendedObjectStore.getState()

      setMandelbulbResolution(32)
      expect(useExtendedObjectStore.getState().mandelbulb.resolution).toBe(32)

      // Should snap to closest valid resolution (16, 24, 32, 48, 64, 96, 128)
      // Use 42 which is clearly closer to 48 (distance 6) than 32 (distance 10)
      setMandelbulbResolution(42)
      expect(useExtendedObjectStore.getState().mandelbulb.resolution).toBe(48)

      // Use 60 which is clearly closer to 64 (distance 4) than 48 (distance 12)
      setMandelbulbResolution(60)
      expect(useExtendedObjectStore.getState().mandelbulb.resolution).toBe(64)
    })

    it('should set visualization axes', () => {
      const { setMandelbulbVisualizationAxes } = useExtendedObjectStore.getState()

      setMandelbulbVisualizationAxes([1, 2, 3])
      expect(useExtendedObjectStore.getState().mandelbulb.visualizationAxes).toEqual([1, 2, 3])
    })

    it('should set individual visualization axis', () => {
      const { setMandelbulbVisualizationAxis } = useExtendedObjectStore.getState()

      // Start with default [0, 1, 2]
      setMandelbulbVisualizationAxis(0, 3)
      expect(useExtendedObjectStore.getState().mandelbulb.visualizationAxes).toEqual([3, 1, 2])

      setMandelbulbVisualizationAxis(2, 4)
      expect(useExtendedObjectStore.getState().mandelbulb.visualizationAxes).toEqual([3, 1, 4])
    })

    it('should set parameter value with clamping', () => {
      const { setMandelbulbParameterValues, setMandelbulbParameterValue } =
        useExtendedObjectStore.getState()

      // First set up some parameter values
      setMandelbulbParameterValues([0, 0, 0])

      setMandelbulbParameterValue(1, 0.5)
      expect(useExtendedObjectStore.getState().mandelbulb.parameterValues[1]).toBe(0.5)

      // Test clamping
      setMandelbulbParameterValue(0, 5.0)
      expect(useExtendedObjectStore.getState().mandelbulb.parameterValues[0]).toBe(2.0)

      setMandelbulbParameterValue(2, -5.0)
      expect(useExtendedObjectStore.getState().mandelbulb.parameterValues[2]).toBe(-2.0)
    })

    it('should set parameter values with clamping', () => {
      const { setMandelbulbParameterValues } = useExtendedObjectStore.getState()

      setMandelbulbParameterValues([0.1, -0.2, 0.3])
      expect(useExtendedObjectStore.getState().mandelbulb.parameterValues).toEqual([0.1, -0.2, 0.3])

      // Test clamping
      setMandelbulbParameterValues([5, -5, 1])
      expect(useExtendedObjectStore.getState().mandelbulb.parameterValues).toEqual([2.0, -2.0, 1])
    })

    it('should reset parameters to zeros', () => {
      const { setMandelbulbParameterValues, resetMandelbulbParameters } =
        useExtendedObjectStore.getState()

      setMandelbulbParameterValues([0.5, -0.3, 0.2])
      resetMandelbulbParameters()
      expect(useExtendedObjectStore.getState().mandelbulb.parameterValues).toEqual([0, 0, 0])
    })

    it('should set center coordinates', () => {
      const { setMandelbulbCenter } = useExtendedObjectStore.getState()

      setMandelbulbCenter([0.1, -0.2, 0.3, 0.4])
      expect(useExtendedObjectStore.getState().mandelbulb.center).toEqual([0.1, -0.2, 0.3, 0.4])
    })

    it('should set extent (zoom) with clamping', () => {
      const { setMandelbulbExtent } = useExtendedObjectStore.getState()

      setMandelbulbExtent(1.5)
      expect(useExtendedObjectStore.getState().mandelbulb.extent).toBe(1.5)

      // Test clamping - too low
      setMandelbulbExtent(0.0001)
      expect(useExtendedObjectStore.getState().mandelbulb.extent).toBe(0.001)

      // Test clamping - too high
      setMandelbulbExtent(20)
      expect(useExtendedObjectStore.getState().mandelbulb.extent).toBe(10.0)
    })

    it('should fit to view (reset center and extent)', () => {
      const { setMandelbulbCenter, setMandelbulbExtent, fitMandelbulbToView } =
        useExtendedObjectStore.getState()

      setMandelbulbCenter([0.5, -0.3, 0.2])
      setMandelbulbExtent(0.5)

      fitMandelbulbToView()

      const state = useExtendedObjectStore.getState().mandelbulb
      expect(state.center).toEqual([0, 0, 0])
      expect(state.extent).toBe(2.5)
    })

    it('should set color mode', () => {
      const { setMandelbulbColorMode } = useExtendedObjectStore.getState()

      setMandelbulbColorMode('smoothColoring')
      expect(useExtendedObjectStore.getState().mandelbulb.colorMode).toBe('smoothColoring')

      setMandelbulbColorMode('interiorOnly')
      expect(useExtendedObjectStore.getState().mandelbulb.colorMode).toBe('interiorOnly')
    })

    it('should set palette', () => {
      const { setMandelbulbPalette } = useExtendedObjectStore.getState()

      setMandelbulbPalette('triadic')
      expect(useExtendedObjectStore.getState().mandelbulb.palette).toBe('triadic')

      setMandelbulbPalette('analogous')
      expect(useExtendedObjectStore.getState().mandelbulb.palette).toBe('analogous')
    })

    it('should set custom palette', () => {
      const { setMandelbulbCustomPalette } = useExtendedObjectStore.getState()

      const customPalette = { start: '#ff0000', mid: '#00ff00', end: '#0000ff' }
      setMandelbulbCustomPalette(customPalette)
      expect(useExtendedObjectStore.getState().mandelbulb.customPalette).toEqual(customPalette)
    })

    it('should set invert colors', () => {
      const { setMandelbulbInvertColors } = useExtendedObjectStore.getState()

      setMandelbulbInvertColors(true)
      expect(useExtendedObjectStore.getState().mandelbulb.invertColors).toBe(true)

      setMandelbulbInvertColors(false)
      expect(useExtendedObjectStore.getState().mandelbulb.invertColors).toBe(false)
    })

    it('should set interior color', () => {
      const { setMandelbulbInteriorColor } = useExtendedObjectStore.getState()

      setMandelbulbInteriorColor('#ff0000')
      expect(useExtendedObjectStore.getState().mandelbulb.interiorColor).toBe('#ff0000')
    })

    it('should set palette cycles with clamping', () => {
      const { setMandelbulbPaletteCycles } = useExtendedObjectStore.getState()

      setMandelbulbPaletteCycles(5)
      expect(useExtendedObjectStore.getState().mandelbulb.paletteCycles).toBe(5)

      // Test clamping - too low
      setMandelbulbPaletteCycles(0)
      expect(useExtendedObjectStore.getState().mandelbulb.paletteCycles).toBe(1)

      // Test clamping - too high
      setMandelbulbPaletteCycles(30)
      expect(useExtendedObjectStore.getState().mandelbulb.paletteCycles).toBe(20)
    })

    it('should set render style', () => {
      const { setMandelbulbRenderStyle } = useExtendedObjectStore.getState()

      setMandelbulbRenderStyle('rayMarching')
      expect(useExtendedObjectStore.getState().mandelbulb.renderStyle).toBe('rayMarching')
    })

    it('should set point size with clamping', () => {
      const { setMandelbulbPointSize } = useExtendedObjectStore.getState()

      setMandelbulbPointSize(5)
      expect(useExtendedObjectStore.getState().mandelbulb.pointSize).toBe(5)

      // Test clamping - too low
      setMandelbulbPointSize(0)
      expect(useExtendedObjectStore.getState().mandelbulb.pointSize).toBe(1)

      // Test clamping - too high
      setMandelbulbPointSize(30)
      expect(useExtendedObjectStore.getState().mandelbulb.pointSize).toBe(20)
    })

    it('should initialize for dimension', () => {
      const { initializeMandelbulbForDimension } = useExtendedObjectStore.getState()

      initializeMandelbulbForDimension(5)

      const state = useExtendedObjectStore.getState().mandelbulb
      expect(state.parameterValues).toHaveLength(2) // 5 - 3 = 2
      expect(state.parameterValues).toEqual([0, 0])
      expect(state.center).toHaveLength(5)
      expect(state.center).toEqual([0, 0, 0, 0, 0])
      expect(state.visualizationAxes).toEqual([0, 1, 2])
    })

    it('should set boundary threshold with clamping and ordering', () => {
      const { setMandelbulbBoundaryThreshold } = useExtendedObjectStore.getState()

      // Normal setting
      setMandelbulbBoundaryThreshold([0.2, 0.8])
      expect(useExtendedObjectStore.getState().mandelbulb.boundaryThreshold).toEqual([0.2, 0.8])

      // Clamp too low
      setMandelbulbBoundaryThreshold([-0.5, 0.5])
      expect(useExtendedObjectStore.getState().mandelbulb.boundaryThreshold).toEqual([0, 0.5])

      // Clamp too high
      setMandelbulbBoundaryThreshold([0.3, 1.5])
      expect(useExtendedObjectStore.getState().mandelbulb.boundaryThreshold).toEqual([0.3, 1])

      // Ensure min <= max (min is clamped, then max is clamped to be >= min)
      setMandelbulbBoundaryThreshold([0.8, 0.3])
      const threshold = useExtendedObjectStore.getState().mandelbulb.boundaryThreshold
      expect(threshold[0]).toBeLessThanOrEqual(threshold[1])
    })

    it('should set mandelbulb power with clamping and integer', () => {
      const { setMandelbulbMandelbulbPower } = useExtendedObjectStore.getState()

      // Normal setting
      setMandelbulbMandelbulbPower(8)
      expect(useExtendedObjectStore.getState().mandelbulb.mandelbulbPower).toBe(8)

      // Different value
      setMandelbulbMandelbulbPower(3)
      expect(useExtendedObjectStore.getState().mandelbulb.mandelbulbPower).toBe(3)

      // Clamp too low (min 2)
      setMandelbulbMandelbulbPower(1)
      expect(useExtendedObjectStore.getState().mandelbulb.mandelbulbPower).toBe(2)

      // Clamp too high (max 16)
      setMandelbulbMandelbulbPower(20)
      expect(useExtendedObjectStore.getState().mandelbulb.mandelbulbPower).toBe(16)

      // Should floor decimal values
      setMandelbulbMandelbulbPower(5.7)
      expect(useExtendedObjectStore.getState().mandelbulb.mandelbulbPower).toBe(5)
    })

    it('should get config as copy', () => {
      const { getMandelbulbConfig, setMandelbulbMaxIterations } = useExtendedObjectStore.getState()

      setMandelbulbMaxIterations(150)
      const config = getMandelbulbConfig()

      expect(config.maxIterations).toBe(150)

      // Should be a copy, not a reference
      config.maxIterations = 999
      expect(useExtendedObjectStore.getState().mandelbulb.maxIterations).toBe(150)
    })
  })

  describe('reset', () => {
    it('should reset all configs to defaults', () => {
      const state = useExtendedObjectStore.getState()

      // Modify all configs
      state.setRootSystemType('E8')
      state.setCliffordTorusRadius(2.5)
      state.setMandelbulbMaxIterations(200)
      state.setMandelbulbPalette('triadic')

      // Reset
      state.reset()

      // Verify all reset to defaults
      const newState = useExtendedObjectStore.getState()
      expect(newState.rootSystem).toEqual(DEFAULT_ROOT_SYSTEM_CONFIG)
      expect(newState.cliffordTorus).toEqual(DEFAULT_CLIFFORD_TORUS_CONFIG)
      expect(newState.mandelbulb).toEqual(DEFAULT_MANDELBROT_CONFIG)
    })
  })
})
