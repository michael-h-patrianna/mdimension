import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { usePerformanceMetricsStore } from '@/stores/performanceMetricsStore';

const VRAM_UPDATE_INTERVAL = 2000; // ms

/**
 *
 */
export function PerformanceStatsCollector() {
  const { gl, scene, size, viewport } = useThree((state) => ({ 
    gl: state.gl, 
    scene: state.scene,
    size: state.size,
    viewport: state.viewport
  }));
  
  const updateMetrics = usePerformanceMetricsStore((state) => state.updateMetrics);
  const setGpuName = usePerformanceMetricsStore((state) => state.setGpuName);
  const currentHistory = usePerformanceMetricsStore((state) => state.history);
  
  // Accumulators
  const framesRef = useRef(0);
  const prevTimeRef = useRef(performance.now());
  const cpuAccumulatorRef = useRef(0);
  const minFpsRef = useRef(Infinity);
  const maxFpsRef = useRef(0);
  
  // Store render stats from the most recent completed frame
  const lastFrameStatsRef = useRef({ calls: 0, triangles: 0, points: 0, lines: 0 });
  // Accumulate stats for the current frame (resets every frame)
  const activeFrameStatsRef = useRef({ calls: 0, triangles: 0, points: 0, lines: 0 });

  const lastVramUpdateRef = useRef(0);
  const currentVramRef = useRef({ geometries: 0, textures: 0, total: 0 });

  // Initialization: Hardware Detection
  useEffect(() => {
    // Attempt to get GPU renderer name
    const debugInfo = gl.getContext().getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const renderer = gl.getContext().getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      // Clean up strings like "ANGLE (Apple, Apple M1 Pro, OpenGL 4.1)"
      const cleanName = renderer.replace(/angle\s*\((.+)\)/i, '$1').split(',')[1]?.trim() || renderer;
      setGpuName(cleanName);
    }
  }, [gl, setGpuName]);

  // Hook: Render Instrumentation
  useEffect(() => {
    const originalRender = gl.render;
    gl.render = function (...args) {
      const start = performance.now();
      originalRender.apply(this, args);
      const end = performance.now();
      cpuAccumulatorRef.current += (end - start);
      
      // Accumulate stats from this render pass
      // gl.info.render resets automatically at start of render(), so we can safely add its values
      activeFrameStatsRef.current.calls += gl.info.render.calls;
      activeFrameStatsRef.current.triangles += gl.info.render.triangles;
      activeFrameStatsRef.current.points += gl.info.render.points;
      activeFrameStatsRef.current.lines += gl.info.render.lines;
    };
    return () => { gl.render = originalRender; };
  }, [gl]);

  // VRAM Estimation Logic
  const updateVRAM = () => {
    let geomMem = 0;
    let texMem = 0;

    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        if (object.geometry) {
           // Estimate attributes
           const geom = object.geometry;
           if (geom.attributes) {
             Object.values(geom.attributes).forEach((attr) => {
                const bufferAttr = attr as THREE.BufferAttribute;
                if (bufferAttr.array) {
                  // Approximate memory: bytes per element * count
                  geomMem += bufferAttr.array.byteLength;
                }
             });
           }
           if (geom.index && geom.index.array) {
             geomMem += geom.index.array.byteLength;
           }
        }
        if (object.material) {
           const mats = Array.isArray(object.material) ? object.material : [object.material];
           mats.forEach((mat) => {
             Object.values(mat).forEach((prop) => {
               if (prop && prop instanceof THREE.Texture && prop.image) {
                 const w = prop.image.width || 0;
                 const h = prop.image.height || 0;
                 // RGBA = 4 bytes, estimate mips * 1.33
                 texMem += (w * h * 4) * 1.33;
               }
             });
           });
        }
      }
    });

    return { geometries: geomMem, textures: texMem, total: geomMem + texMem };
  };

  // Frame Loop
  useFrame(() => {
    // 1. Snapshot accumulated stats from previous frame
    lastFrameStatsRef.current = { ...activeFrameStatsRef.current };
    
    // 2. Reset accumulator for the current frame
    activeFrameStatsRef.current = { calls: 0, triangles: 0, points: 0, lines: 0 };

    framesRef.current++;
    const time = performance.now();
    const delta = time - prevTimeRef.current;

    // Update at 2Hz (every 500ms)
    if (delta >= 500) {
      const fps = Math.round((framesRef.current * 1000) / delta);
      const avgCpuTime = cpuAccumulatorRef.current / framesRef.current;
      const frameTime = delta / framesRef.current;

      minFpsRef.current = Math.min(minFpsRef.current, fps);
      if (time > 3000) maxFpsRef.current = Math.max(maxFpsRef.current, fps);

      const heap = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory 
        ? Math.round((performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize / 1048576) 
        : 0;
      
      // Update VRAM periodically
      if (time - lastVramUpdateRef.current > VRAM_UPDATE_INTERVAL) {
        currentVramRef.current = updateVRAM();
        lastVramUpdateRef.current = time;
      }

      updateMetrics({
        fps,
        minFps: minFpsRef.current === Infinity ? fps : minFpsRef.current,
        maxFps: maxFpsRef.current,
        frameTime: parseFloat(frameTime.toFixed(1)),
        cpuTime: parseFloat(avgCpuTime.toFixed(2)),
        gpu: lastFrameStatsRef.current,
        memory: {
          geometries: gl.info.memory.geometries,
          textures: gl.info.memory.textures,
          programs: gl.info.programs?.length ?? 0,
          heap,
        },
        vram: currentVramRef.current,
        viewport: { width: size.width, height: size.height, dpr: viewport.dpr },
        history: {
          fps: [...currentHistory.fps.slice(1), fps],
          cpu: [...currentHistory.cpu.slice(1), avgCpuTime],
          mem: [...currentHistory.mem.slice(1), heap],
        }
      });

      framesRef.current = 0;
      prevTimeRef.current = time;
      cpuAccumulatorRef.current = 0;
    }
  });

  return null;
}
