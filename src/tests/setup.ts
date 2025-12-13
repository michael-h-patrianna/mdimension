import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'

// Suppress expected warnings in test environment
const originalWarn = console.warn
const originalError = console.error

// Patterns to suppress (these are expected in tests)
const suppressedWarnPatterns = [
  'Multiple instances of Three.js', // Expected when tests import Three.js and @react-three/fiber
]

const suppressedErrorPatterns = [
  'is using incorrect casing', // R3F custom elements appear as lowercase in tests
  'is unrecognized in this browser', // R3F custom elements not recognized outside Canvas
  'for a non-boolean attribute', // R3F material props passed as booleans
  'React does not recognize the', // R3F material props like alphaToCoverage, depthTest
]

console.warn = (...args) => {
  if (typeof args[0] === 'string' && suppressedWarnPatterns.some(p => args[0].includes(p))) {
    return
  }
  originalWarn.apply(console, args)
}

console.error = (...args) => {
  if (typeof args[0] === 'string' && suppressedErrorPatterns.some(p => args[0].includes(p))) {
    return
  }
  originalError.apply(console, args)
}

// Mock ResizeObserver for Three.js components
class MockResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
;(globalThis as unknown as { ResizeObserver: typeof MockResizeObserver }).ResizeObserver = MockResizeObserver

// Mock canvas contexts for Three.js (WebGL) and UI components (2D)
const webglContextMock = {
  canvas: {},
  getExtension: vi.fn(),
  getParameter: vi.fn(),
  createShader: vi.fn(),
  shaderSource: vi.fn(),
  compileShader: vi.fn(),
  getShaderParameter: vi.fn(() => true),
  createProgram: vi.fn(),
  attachShader: vi.fn(),
  linkProgram: vi.fn(),
  getProgramParameter: vi.fn(() => true),
  useProgram: vi.fn(),
  viewport: vi.fn(),
  clearColor: vi.fn(),
  clear: vi.fn(),
}

const canvas2dContextMock = {
  canvas: {},
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  fillStyle: '',
  strokeStyle: '',
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  arc: vi.fn(),
  closePath: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  scale: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  measureText: vi.fn(() => ({ width: 0 })),
  getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
  putImageData: vi.fn(),
  createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  drawImage: vi.fn(),
}

HTMLCanvasElement.prototype.getContext = vi.fn((contextType: string) => {
  if (contextType === '2d') {
    return canvas2dContextMock
  }
  // webgl, webgl2, or experimental-webgl
  return webglContextMock
}) as unknown as typeof HTMLCanvasElement.prototype.getContext

// Cleanup after each test case
afterEach(() => {
  cleanup()
})

// Add custom matchers
expect.extend({})
