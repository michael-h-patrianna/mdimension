import { useGeometryStore } from '@/stores/geometryStore';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { usePostProcessingStore } from '@/stores/postProcessingStore';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useAnimationStore } from '@/stores/animationStore';

// Interesting configurations for the visualization
export const PRESETS = [
  {
    id: 'tesseract',
    label: '4D Tesseract',
    description: 'Classic 4D Hypercube with rotation',
    apply: () => {
      useGeometryStore.getState().setDimension(4);
      useGeometryStore.getState().setObjectType('hypercube');
      useAppearanceStore.getState().setFacesVisible(true);
      // Enable standard 4D rotations
      useAnimationStore.getState().stopAll();
      useAnimationStore.getState().setPlaneAnimating('XW', true);
      useAnimationStore.getState().setPlaneAnimating('YW', true);
      useAnimationStore.getState().setSpeed(0.5);
      useAnimationStore.getState().play();
    }
  },
  {
    id: 'simplex-5d',
    label: '5D Simplex',
    description: '5D Simplex with multi-axis rotation',
    apply: () => {
      useGeometryStore.getState().setDimension(5);
      useGeometryStore.getState().setObjectType('simplex');
      useAnimationStore.getState().animateAll(5);
      useAnimationStore.getState().setSpeed(0.3);
      useAnimationStore.getState().play();
    }
  },
  {
    id: 'mandelbulb',
    label: 'Mandelbulb',
    description: '3D Raymarched Fractal',
    apply: () => {
      useGeometryStore.getState().setDimension(3);
      useGeometryStore.getState().setObjectType('mandelbrot');
      useAppearanceStore.getState().setFacesVisible(true); // Needed for raymarching
      useExtendedObjectStore.getState().setMandelbrotConfig({ mandelbulbPower: 8, maxIterations: 5 });
    }
  },
  {
    id: 'hyperbulb',
    label: 'Hyperbulb (4D)',
    description: '4D Raymarched Fractal',
    apply: () => {
      useGeometryStore.getState().setDimension(4);
      useGeometryStore.getState().setObjectType('mandelbrot');
      useAppearanceStore.getState().setFacesVisible(true);
      useAnimationStore.getState().stopAll();
      useAnimationStore.getState().setPlaneAnimating('XW', true); // Rotate in 4th dim
      useAnimationStore.getState().setSpeed(0.2);
      useAnimationStore.getState().play();
    }
  },
  {
    id: 'neon-cross',
    label: 'Neon Cross-Polytope',
    description: 'Glowing 4D Cross-Polytope',
    apply: () => {
      useGeometryStore.getState().setDimension(4);
useAppearanceStore.getState().setFacesVisible(true);
      usePostProcessingStore.getState().setBloomEnabled(true);
      usePostProcessingStore.getState().setBloomIntensity(2.5);
      useAppearanceStore.getState().setEdgeColor('#00ffcc');
    }
  }
];
