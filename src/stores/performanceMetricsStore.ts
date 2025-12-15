import { create } from 'zustand'

export interface GPUStats {
  calls: number
  triangles: number
  points: number
  lines: number
}

export interface MemoryStats {
  geometries: number
  textures: number
  programs: number
  heap: number
}

export interface VRAMStats {
  geometries: number
  textures: number
  total: number
}

export interface GraphData {
  fps: number[]
  cpu: number[]
  mem: number[]
}

export interface PerformanceMetricsState {
  fps: number
  minFps: number
  maxFps: number
  frameTime: number
  cpuTime: number
  gpu: GPUStats
  sceneGpu: GPUStats // Main scene geometry only (excludes post-processing passes)
  memory: MemoryStats
  vram: VRAMStats
  viewport: { width: number; height: number; dpr: number }
  history: GraphData
  gpuName: string

  // Actions
  updateMetrics: (metrics: Partial<PerformanceMetricsState>) => void
  setGpuName: (name: string) => void
}

export const GRAPH_POINTS = 40

export const usePerformanceMetricsStore = create<PerformanceMetricsState>((set) => ({
  fps: 60,
  minFps: Infinity,
  maxFps: 0,
  frameTime: 0,
  cpuTime: 0,
  gpu: { calls: 0, triangles: 0, points: 0, lines: 0 },
  sceneGpu: { calls: 0, triangles: 0, points: 0, lines: 0 },
  memory: { geometries: 0, textures: 0, programs: 0, heap: 0 },
  vram: { geometries: 0, textures: 0, total: 0 },
  viewport: { width: 0, height: 0, dpr: 1 },
  history: {
    fps: new Array(GRAPH_POINTS).fill(60),
    cpu: new Array(GRAPH_POINTS).fill(0),
    mem: new Array(GRAPH_POINTS).fill(0),
  },
  gpuName: 'Unknown GPU',

  updateMetrics: (metrics) => set((state) => ({ ...state, ...metrics })),
  setGpuName: (name) => set({ gpuName: name }),
}))
