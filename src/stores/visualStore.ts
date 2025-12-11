/**
 * Visual state management using Zustand
 * Manages visual styling for the polytope rendering
 */

import { create } from 'zustand';

/** Default visual settings */
export const DEFAULT_EDGE_COLOR = '#00D4FF';
export const DEFAULT_EDGE_THICKNESS = 2;
export const DEFAULT_VERTEX_VISIBLE = true;
export const DEFAULT_VERTEX_SIZE = 4;
export const DEFAULT_VERTEX_COLOR = '#FF00FF';
export const DEFAULT_FACE_OPACITY = 0;
export const DEFAULT_BACKGROUND_COLOR = '#0F0F1A';

/** Visual presets */
export const VISUAL_PRESETS = {
  neon: {
    edgeColor: '#00FF88',
    edgeThickness: 3,
    vertexColor: '#FF00FF',
    vertexSize: 5,
    backgroundColor: '#0A0A12',
  },
  blueprint: {
    edgeColor: '#4488FF',
    edgeThickness: 1,
    vertexColor: '#88AAFF',
    vertexSize: 3,
    backgroundColor: '#0A1628',
  },
  hologram: {
    edgeColor: '#00FFFF',
    edgeThickness: 2,
    vertexColor: '#00FFFF',
    vertexSize: 4,
    backgroundColor: '#000011',
  },
  scientific: {
    edgeColor: '#FFFFFF',
    edgeThickness: 1,
    vertexColor: '#FF4444',
    vertexSize: 3,
    backgroundColor: '#1A1A2E',
  },
} as const;

export type VisualPreset = keyof typeof VISUAL_PRESETS;

interface VisualState {
  /** Color of polytope edges (hex string) */
  edgeColor: string;

  /** Thickness of edges in pixels (1-5) */
  edgeThickness: number;

  /** Whether vertices are visible */
  vertexVisible: boolean;

  /** Size of vertex points (1-10) */
  vertexSize: number;

  /** Color of vertices (hex string) */
  vertexColor: string;

  /** Opacity of faces (0-1, 0 = wireframe) */
  faceOpacity: number;

  /** Background color (hex string) */
  backgroundColor: string;

  // Actions
  setEdgeColor: (color: string) => void;
  setEdgeThickness: (thickness: number) => void;
  setVertexVisible: (visible: boolean) => void;
  setVertexSize: (size: number) => void;
  setVertexColor: (color: string) => void;
  setFaceOpacity: (opacity: number) => void;
  setBackgroundColor: (color: string) => void;
  applyPreset: (preset: VisualPreset) => void;
  reset: () => void;
}

export const useVisualStore = create<VisualState>((set) => ({
  edgeColor: DEFAULT_EDGE_COLOR,
  edgeThickness: DEFAULT_EDGE_THICKNESS,
  vertexVisible: DEFAULT_VERTEX_VISIBLE,
  vertexSize: DEFAULT_VERTEX_SIZE,
  vertexColor: DEFAULT_VERTEX_COLOR,
  faceOpacity: DEFAULT_FACE_OPACITY,
  backgroundColor: DEFAULT_BACKGROUND_COLOR,

  setEdgeColor: (color: string) => {
    set({ edgeColor: color });
  },

  setEdgeThickness: (thickness: number) => {
    set({ edgeThickness: Math.max(1, Math.min(5, thickness)) });
  },

  setVertexVisible: (visible: boolean) => {
    set({ vertexVisible: visible });
  },

  setVertexSize: (size: number) => {
    set({ vertexSize: Math.max(1, Math.min(10, size)) });
  },

  setVertexColor: (color: string) => {
    set({ vertexColor: color });
  },

  setFaceOpacity: (opacity: number) => {
    set({ faceOpacity: Math.max(0, Math.min(1, opacity)) });
  },

  setBackgroundColor: (color: string) => {
    set({ backgroundColor: color });
  },

  applyPreset: (preset: VisualPreset) => {
    const settings = VISUAL_PRESETS[preset];
    set({
      edgeColor: settings.edgeColor,
      edgeThickness: settings.edgeThickness,
      vertexColor: settings.vertexColor,
      vertexSize: settings.vertexSize,
      backgroundColor: settings.backgroundColor,
    });
  },

  reset: () => {
    set({
      edgeColor: DEFAULT_EDGE_COLOR,
      edgeThickness: DEFAULT_EDGE_THICKNESS,
      vertexVisible: DEFAULT_VERTEX_VISIBLE,
      vertexSize: DEFAULT_VERTEX_SIZE,
      vertexColor: DEFAULT_VERTEX_COLOR,
      faceOpacity: DEFAULT_FACE_OPACITY,
      backgroundColor: DEFAULT_BACKGROUND_COLOR,
    });
  },
}));
