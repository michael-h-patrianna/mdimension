import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import { m, LazyMotion, domMax, AnimatePresence } from 'motion/react';
import * as THREE from 'three';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useGeometryStore } from '@/stores/geometryStore';

/**
 * Custom Performance Monitor
 * A high-fidelity, "Wow" factor performance HUD.
 * 
 * Features:
 * - FPS/Frame Time/CPU Latency
 * - GPU Stats (Calls, Tris, Verts, Points)
 * - Memory (VRAM estimation, Geometries, Textures, Shaders)
 * - Hardware Info (GPU Tier, Resolution, Limits)
 * - Raymarching Metrics (Steps, Iterations)
 */

// --- Icons (Inline SVGs) ---
const Icons = {
  Activity: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
  ),
  Chip: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3"/><path d="M15 1v3"/><path d="M9 20v3"/><path d="M15 20v3"/><path d="M20 9h3"/><path d="M20 14h3"/><path d="M1 9h3"/><path d="M1 14h3"/></svg>
  ),
  Zap: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
  ),
  Database: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
  ),
  Clock: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
  ),
  Monitor: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
  ),
  Layers: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
  ),
  ChevronDown: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M6 9l6 6 6-6"/></svg>
  ),
  ChevronUp: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M18 15l-6-6-6 6"/></svg>
  ),
};

// --- Constants & Types ---
interface GraphData {
  fps: number[];
  cpu: number[];
  mem: number[];
}

const GRAPH_POINTS = 40;
const VRAM_UPDATE_INTERVAL = 2000; // ms

// --- Helper Functions ---
function formatMetric(value: number, unit = '', decimals = 1): string {
  if (value === 0) return `0${unit}`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(decimals)}M${unit}`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(decimals)}k${unit}`;
  return `${Math.round(value)}${unit}`;
}

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(decimals)} ${sizes[i]}`;
}

export function PerformanceMonitor() {
  const { gl, scene, size, viewport } = useThree((state) => ({ 
    gl: state.gl, 
    scene: state.scene,
    size: state.size,
    viewport: state.viewport 
  }));
  
  // -- Store Connectors --
  const objectType = useGeometryStore(state => state.objectType);
  const mandelbulbConfig = useExtendedObjectStore(state => state.mandelbrot);
  const mandelboxConfig = useExtendedObjectStore(state => state.mandelbox);
  
  // -- State --
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'perf' | 'sys'>('perf');
  const [gpuName, setGpuName] = useState<string>('Unknown GPU');
  
  // -- Stats State --
  const [stats, setStats] = useState({
    fps: 60,
    minFps: Infinity,
    maxFps: 0,
    frameTime: 0,
    cpuTime: 0,
    gpu: { calls: 0, triangles: 0, points: 0, lines: 0 },
    memory: { geometries: 0, textures: 0, programs: 0, heap: 0 },
    vram: { geometries: 0, textures: 0, total: 0 },
  });

  // -- Graph History --
  const [history, setHistory] = useState<GraphData>({
    fps: new Array(GRAPH_POINTS).fill(60),
    cpu: new Array(GRAPH_POINTS).fill(0),
    mem: new Array(GRAPH_POINTS).fill(0),
  });

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

  // Drag State (to prevent toggle on drag)
  const isDraggingRef = useRef(false);
  const lastVramUpdateRef = useRef(0);

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
  }, [gl]);

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

  // Hook: VRAM Estimation (Periodic)
  const updateVRAM = () => {
    let geomMem = 0;
    let texMem = 0;

    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        if (object.geometry) {
           // Estimate attributes
           const geom = object.geometry;
           if (geom.attributes) {
             Object.values(geom.attributes).forEach((attr: any) => {
               if (attr.array) geomMem += attr.array.byteLength;
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

      const heap = (performance as any).memory 
        ? Math.round((performance as any).memory.usedJSHeapSize / 1048576) 
        : 0;
      
      // Update VRAM periodically
      let vram = stats.vram;
      if (time - lastVramUpdateRef.current > VRAM_UPDATE_INTERVAL) {
        vram = updateVRAM();
        lastVramUpdateRef.current = time;
      }

      setStats({
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
        vram
      });

      // Graph History Update
      setHistory(prev => ({
        fps: [...prev.fps.slice(1), fps],
        cpu: [...prev.cpu.slice(1), avgCpuTime],
        mem: [...prev.mem.slice(1), heap],
      }));

      framesRef.current = 0;
      prevTimeRef.current = time;
      cpuAccumulatorRef.current = 0;
    }
  });

  const fpsColor = getHealthColor(stats.fps, 55, 30);
  const vertexCount = stats.gpu.triangles * 3 + stats.gpu.lines * 2 + stats.gpu.points;

  // -- Raymarching Info --
  const isRaymarching = ['mandelbrot', 'mandelbox', 'menger', 'hypercube'].includes(objectType);
  const raySteps = objectType === 'mandelbrot' ? mandelbulbConfig.maxIterations : 
                   objectType === 'mandelbox' ? mandelboxConfig.maxIterations : 0;

  return (
    <Html fullscreen className="pointer-events-none" style={{ zIndex: 999 }}>
      <LazyMotion features={domMax}>
        <m.div
          drag
          dragMomentum={false}
          onDragStart={() => { isDraggingRef.current = true; }}
          onDragEnd={() => { setTimeout(() => { isDraggingRef.current = false; }, 100); }}
          initial={{ scale: 0.95, opacity: 0.9 }}
          animate={{ scale: expanded ? 1 : 0.95, opacity: expanded ? 1 : 0.9 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="absolute bottom-4 left-4 pointer-events-auto origin-bottom-left"
        >
          <div className="
            bg-zinc-950/90 backdrop-blur-xl 
            border border-white/10 
            rounded-xl overflow-hidden shadow-2xl 
            text-xs font-mono text-zinc-400
            min-w-[300px] flex flex-col
          ">
            
            {/* --- Header --- */}
            <div 
              className="flex items-center justify-between p-3.5 bg-white/5 cursor-pointer hover:bg-white/10 transition-colors border-b border-white/5"
              onClick={() => { if (!isDraggingRef.current) setExpanded(!expanded); }}
            >
              <div className="flex items-center gap-4">
                {/* Status Dot */}
                <div className={`flex items-center justify-center w-2.5 h-2.5 rounded-full ${fpsColor.bg}`}>
                  <div className={`w-2 h-2 rounded-full ${fpsColor.bgPulse} animate-pulse`} />
                </div>
                
                {/* FPS Big Number */}
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-bold ${fpsColor.text} tracking-tighter leading-none`}>
                    {stats.fps}
                  </span>
                  <div className="flex flex-col text-[8px] font-bold uppercase tracking-widest leading-none gap-0.5 opacity-60">
                     <span>FPS</span>
                     <span>{stats.frameTime}ms</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 text-zinc-500">
                 {/* Mini CPU Graph */}
                 <div className="w-12 h-4 flex items-end gap-px">
                    {history.cpu.slice(-10).map((v, i) => (
                      <div key={i} className="w-full bg-emerald-500/50" style={{ height: `${Math.min(v * 5, 100)}%` }} />
                    ))}
                 </div>
                {expanded ? <Icons.ChevronDown className="opacity-70" /> : <Icons.ChevronUp className="opacity-70" />}
              </div>
            </div>

            {/* --- Expanded View --- */}
            {expanded && (
              <div className="animate-in slide-in-from-top-2 fade-in duration-200">
                
                {/* Tabs */}
                <div className="flex border-b border-white/5">
                  <button 
                     onClick={() => setActiveTab('perf')}
                     className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${activeTab === 'perf' ? 'text-accent bg-accent/5' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    Performance
                  </button>
                  <button 
                     onClick={() => setActiveTab('sys')}
                     className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${activeTab === 'sys' ? 'text-accent bg-accent/5' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    System
                  </button>
                </div>

                <div className="p-5 space-y-5">
                  <AnimatePresence mode="wait">
                    
                    {/* --- PERF TAB --- */}
                    {activeTab === 'perf' && (
                      <m.div 
                        key="perf"
                        initial={{ opacity: 0, x: -10 }} 
                        animate={{ opacity: 1, x: 0 }} 
                        exit={{ opacity: 0, x: 10 }}
                        className="space-y-5"
                      >
                         {/* FPS Graph */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] opacity-60 uppercase font-bold tracking-wider">
                            <span>FPS History</span>
                            <span>{stats.minFps} - {stats.maxFps}</span>
                          </div>
                          <div className="h-12 w-full flex items-end gap-0.5 opacity-80">
                            {history.fps.map((v, i) => (
                              <div 
                                key={i} 
                                className="w-full bg-current rounded-t-[1px] transition-all duration-300"
                                style={{ 
                                  height: `${Math.min((v / 70) * 100, 100)}%`,
                                  color: v < 30 ? '#ef4444' : v < 55 ? '#f59e0b' : '#10b981'
                                }}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                          {/* GPU Section */}
                          <div className="space-y-3">
                            <SectionHeader icon={<Icons.Zap />} label="GPU Pipeline" />
                            <div className="space-y-2.5">
                              <StatItem label="Draw Calls" value={stats.gpu.calls} />
                              <StatItem label="Triangles" value={formatMetric(stats.gpu.triangles)} />
                              <StatItem label="Vertices" value={formatMetric(vertexCount)} />
                              {stats.gpu.lines > 0 && <StatItem label="Lines" value={formatMetric(stats.gpu.lines)} />}
                            </div>
                          </div>

                          {/* Memory Section */}
                          <div className="space-y-3">
                            <SectionHeader icon={<Icons.Database />} label="Memory" />
                            <div className="space-y-2.5">
                              <StatItem label="Textures" value={stats.memory.textures} />
                              <StatItem label="Geometries" value={stats.memory.geometries} />
                              <StatItem label="Programs" value={stats.memory.programs} />
                              <StatItem label="JS Heap" value={`${stats.memory.heap} MB`} />
                            </div>
                          </div>
                        </div>

                         {/* Raymarching Specifics */}
                         {isRaymarching && (
                           <div className="pt-3 border-t border-white/10">
                              <SectionHeader icon={<Icons.Layers />} label="Raymarching" />
                              <div className="grid grid-cols-2 gap-4 mt-2">
                                <StatItem label="Steps" value={raySteps} highlight />
                                <StatItem label="Precision" value="High" />
                              </div>
                           </div>
                         )}

                         {/* CPU Latency Bar */}
                        <div className="pt-3 border-t border-white/10 space-y-1.5">
                           <div className="flex justify-between items-center text-[10px]">
                              <span className="flex items-center gap-1.5 opacity-70 font-semibold uppercase tracking-wider">
                                <Icons.Clock className="w-3 h-3" /> CPU Latency
                              </span>
                              <span className="font-mono text-zinc-300">{stats.cpuTime}ms</span>
                           </div>
                           <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min((stats.cpuTime/16.6)*100, 100)}%` }} />
                           </div>
                        </div>
                      </m.div>
                    )}

                    {/* --- SYSTEM TAB --- */}
                    {activeTab === 'sys' && (
                       <m.div 
                        key="sys"
                        initial={{ opacity: 0, x: 10 }} 
                        animate={{ opacity: 1, x: 0 }} 
                        exit={{ opacity: 0, x: -10 }}
                        className="space-y-5"
                      >
                         <div className="space-y-3">
                            <SectionHeader icon={<Icons.Chip />} label="Hardware" />
                            <div className="p-2 bg-white/5 rounded-lg border border-white/5">
                               <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Renderer</div>
                               <div className="text-xs text-zinc-200 font-mono leading-tight break-words">{gpuName}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                               <div className="p-2 bg-white/5 rounded-lg border border-white/5">
                                  <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Max Tex</div>
                                  <div className="text-xs text-zinc-200 font-mono">{gl.capabilities.maxTextureSize}px</div>
                               </div>
                               <div className="p-2 bg-white/5 rounded-lg border border-white/5">
                                  <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Anisotropy</div>
                                  <div className="text-xs text-zinc-200 font-mono">{gl.capabilities.getMaxAnisotropy()}x</div>
                               </div>
                            </div>
                         </div>

                         <div className="space-y-3">
                            <SectionHeader icon={<Icons.Monitor />} label="Viewport" />
                            <div className="space-y-2.5">
                               <StatItem label="Resolution" value={`${size.width} × ${size.height}`} />
                               <StatItem label="DPR" value={`${viewport.dpr.toFixed(1)}x`} />
                               <StatItem label="Aspect" value={(size.width / size.height).toFixed(2)} />
                            </div>
                         </div>

                         <div className="space-y-3">
                            <SectionHeader icon={<Icons.Database />} label="VRAM Estimate" />
                            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg space-y-3">
                               <div className="flex justify-between items-end">
                                  <span className="text-xs text-indigo-200 font-bold">Total Est.</span>
                                  <span className="text-lg font-bold text-indigo-400 font-mono">{formatBytes(stats.vram.total)}</span>
                               </div>
                               <div className="space-y-1">
                                  <div className="flex justify-between text-[10px] text-indigo-300/70">
                                    <span>Geometry</span>
                                    <span>{formatBytes(stats.vram.geometries)}</span>
                                  </div>
                                  <div className="w-full h-1 bg-indigo-500/20 rounded-full overflow-hidden">
                                     <div className="h-full bg-indigo-400" style={{ width: `${stats.vram.total > 0 ? (stats.vram.geometries / stats.vram.total) * 100 : 0}%` }} />
                                  </div>
                               </div>
                               <div className="space-y-1">
                                  <div className="flex justify-between text-[10px] text-indigo-300/70">
                                    <span>Textures</span>
                                    <span>{formatBytes(stats.vram.textures)}</span>
                                  </div>
                                  <div className="w-full h-1 bg-indigo-500/20 rounded-full overflow-hidden">
                                     <div className="h-full bg-pink-400" style={{ width: `${stats.vram.total > 0 ? (stats.vram.textures / stats.vram.total) * 100 : 0}%` }} />
                                  </div>
                               </div>
                            </div>
                            <p className="text-[9px] text-zinc-500 italic text-center">
                               * Estimation based on active geometry & texture buffers. Actual usage may vary by driver overhead.
                            </p>
                         </div>
                      </m.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>
        </m.div>
      </LazyMotion>
    </Html>
  );
}

// --- Subcomponents ---

function SectionHeader({ icon, label }: { icon: React.ReactNode, label: string }) {
  return (
    <div className="flex items-center gap-2 text-zinc-100 font-bold tracking-wide text-[10px] uppercase mb-1 opacity-90">
      <span className="text-accent">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function StatItem({ label, value, highlight = false }: { label: string, value: string | number, highlight?: boolean }) {

  return (

    <div className="flex justify-between items-center text-[11px] group">

      <span className="text-zinc-500 font-medium group-hover:text-zinc-400 transition-colors">{label}</span>

      <span className={`font-mono tabular-nums ${highlight ? 'text-accent font-bold' : 'text-zinc-200'}`}>{value}</span>

    </div>

  );

}



function getHealthColor(fps: number, high: number, low: number) {

  if (fps >= high) return { text: 'text-emerald-400', bg: 'bg-emerald-500', bgPulse: 'bg-emerald-400' };

  if (fps >= low) return { text: 'text-amber-400', bg: 'bg-amber-500', bgPulse: 'bg-amber-400' };

  return { text: 'text-rose-500', bg: 'bg-rose-500', bgPulse: 'bg-rose-400' };

}
