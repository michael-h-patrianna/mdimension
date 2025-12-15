import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';

/**
 * Custom Performance Monitor
 * A high-fidelity, "Wow" factor performance HUD.
 */

// --- Icons (Inline SVGs for zero-dep) ---
const Icons = {
  Activity: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
  ),
  Cpu: (props: any) => (
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
  ChevronDown: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M6 9l6 6 6-6"/></svg>
  ),
  ChevronUp: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M18 15l-6-6-6 6"/></svg>
  ),
  Minimize: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>
  ),
};

interface GraphData {
  fps: number[];
  cpu: number[];
  mem: number[];
}

const GRAPH_POINTS = 30;

export function PerformanceMonitor() {
  const gl = useThree((state) => state.gl);
  const [expanded, setExpanded] = useState(false);
  
  // Real-time stats
  const [stats, setStats] = useState({
    fps: 60,
    minFps: Infinity,
    maxFps: 0,
    frameTime: 0,
    cpuTime: 0,
    gpu: { calls: 0, triangles: 0, points: 0, lines: 0 },
    memory: { geometries: 0, textures: 0, programs: 0, heap: 0 },
  });

  // History for graphs
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

  // Instrumentation: gl.render
  useEffect(() => {
    const originalRender = gl.render;
    gl.render = function (...args) {
      const start = performance.now();
      originalRender.apply(this, args);
      const end = performance.now();
      cpuAccumulatorRef.current += (end - start);
    };
    return () => { gl.render = originalRender; };
  }, [gl]);

  // Frame Loop
  useFrame(() => {
    framesRef.current++;
    const time = performance.now();
    const delta = time - prevTimeRef.current;

    // Update at 2Hz (every 500ms) to keep UI readable but responsive enough
    if (delta >= 500) {
      const fps = Math.round((framesRef.current * 1000) / delta);
      const avgCpuTime = cpuAccumulatorRef.current / framesRef.current;
      const frameTime = delta / framesRef.current;

      // Stats Update
      minFpsRef.current = Math.min(minFpsRef.current, fps);
      if (time > 3000) maxFpsRef.current = Math.max(maxFpsRef.current, fps);

      const heap = (performance as any).memory 
        ? Math.round((performance as any).memory.usedJSHeapSize / 1048576) 
        : 0;

      setStats({
        fps,
        minFps: minFpsRef.current === Infinity ? fps : minFpsRef.current,
        maxFps: maxFpsRef.current,
        frameTime: parseFloat(frameTime.toFixed(1)),
        cpuTime: parseFloat(avgCpuTime.toFixed(2)),
        gpu: {
          calls: gl.info.render.calls,
          triangles: gl.info.render.triangles,
          points: gl.info.render.points,
          lines: gl.info.render.lines,
        },
        memory: {
          geometries: gl.info.memory.geometries,
          textures: gl.info.memory.textures,
          programs: gl.info.programs?.length ?? 0,
          heap,
        },
      });

      // Graph History Update
      setHistory(prev => ({
        fps: [...prev.fps.slice(1), fps],
        cpu: [...prev.cpu.slice(1), avgCpuTime],
        mem: [...prev.mem.slice(1), heap],
      }));

      // Reset
      framesRef.current = 0;
      prevTimeRef.current = time;
      cpuAccumulatorRef.current = 0;
    }
  });

  const fpsColor = getHealthColor(stats.fps, 55, 30);
  
  return (
    <Html fullscreen className="pointer-events-none" style={{ zIndex: 999 }}>
      <div className={`
        absolute bottom-4 left-4 pointer-events-auto 
        transition-all duration-300 ease-out origin-bottom-left
        ${expanded ? 'scale-100 opacity-100' : 'scale-95 opacity-90'}
      `}>
        <div className="
          bg-zinc-950/90 backdrop-blur-xl 
          border border-white/10 
          rounded-xl overflow-hidden shadow-2xl 
          text-xs font-mono text-zinc-400
          min-w-[280px]
        ">
          
          {/* Header / Main Bar */}
          <div 
            className="flex items-center justify-between p-3.5 bg-white/5 cursor-pointer hover:bg-white/10 transition-colors"
            onClick={() => setExpanded(!expanded)}
          >
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-2.5 h-2.5 rounded-full ${fpsColor.bg}`}>
                <div className={`w-2 h-2 rounded-full ${fpsColor.bgPulse} animate-pulse`} />
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-xl font-bold ${fpsColor.text} tracking-tight`}>
                  {stats.fps}
                </span>
                <span className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">FPS</span>
              </div>
            </div>
            
            <div className="flex items-center gap-3 text-zinc-400">
              <span className="text-xs font-medium">{stats.frameTime}ms</span>
              {expanded ? <Icons.ChevronDown className="opacity-70" /> : <Icons.ChevronUp className="opacity-70" />}
            </div>
          </div>

          {/* Expanded Content */}
          {expanded && (
            <div className="p-5 space-y-5 animate-in slide-in-from-top-2 fade-in duration-200">
              
              {/* Graphs Section */}
              <div className="h-10 w-full flex items-end gap-0.5 opacity-60 mb-2">
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

              {/* Grid Metrics */}
              <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                
                {/* GPU Section */}
                <div className="space-y-3">
                  <SectionHeader icon={<Icons.Zap />} label="GPU" />
                  <div className="space-y-2">
                    <ProgressBar label="Calls" value={stats.gpu.calls} max={1000} color="bg-blue-500" />
                    <ProgressBar label="Tris" value={stats.gpu.triangles} max={500000} unit="k" divisor={1000} color="bg-purple-500" />
                    {stats.gpu.points > 0 && (
                      <ProgressBar label="Points" value={stats.gpu.points} max={100000} unit="k" divisor={1000} color="bg-indigo-500" />
                    )}
                    {stats.gpu.lines > 0 && (
                      <ProgressBar label="Lines" value={stats.gpu.lines} max={100000} unit="k" divisor={1000} color="bg-cyan-500" />
                    )}
                  </div>
                </div>

                {/* Memory Section */}
                <div className="space-y-3">
                  <SectionHeader icon={<Icons.Database />} label="Memory" />
                  <div className="space-y-2">
                    <StatRow label="Geometries" value={stats.memory.geometries} />
                    <StatRow label="Textures" value={stats.memory.textures} />
                    <StatRow label="Shaders" value={stats.memory.programs} />
                    {stats.memory.heap > 0 && (
                      <StatRow label="Heap" value={`${stats.memory.heap} MB`} />
                    )}
                  </div>
                </div>

                {/* CPU Section */}
                <div className="space-y-2 col-span-2 pt-3 border-t border-white/10">
                  <div className="flex justify-between items-center text-[10px] text-zinc-400 mb-1">
                    <span className="flex items-center gap-1.5 uppercase tracking-wider font-semibold">
                      <Icons.Clock className="w-3 h-3" /> Timing
                    </span>
                    <span className="text-zinc-300">{stats.cpuTime}ms <span className="text-zinc-600 ml-1">CPU Render</span></span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden flex relative">
                    {/* Background tick marks */}
                    <div className="absolute inset-0 flex justify-between px-px">
                      {[...Array(4)].map((_, i) => <div key={i} className="w-px h-full bg-black/20" />)}
                    </div>
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-300 relative z-10" 
                      style={{ width: `${Math.min((stats.cpuTime / 16.6) * 100, 100)}%` }} 
                    />
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      </div>
    </Html>
  );
}

// --- Subcomponents ---

function SectionHeader({ icon, label }: { icon: React.ReactNode, label: string }) {
  return (
    <div className="flex items-center gap-2 text-zinc-200 font-bold tracking-wide text-[10px] uppercase mb-1">
      <span className="opacity-70 text-zinc-400">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function StatRow({ label, value }: { label: string, value: string | number }) {
  return (
    <div className="flex justify-between items-center text-[11px]">
      <span className="text-zinc-500 font-medium">{label}</span>
      <span className="text-zinc-200 font-mono tabular-nums">{value}</span>
    </div>
  );
}

function ProgressBar({ label, value, max, unit = '', divisor = 1, color }: { label: string, value: number, max: number, unit?: string, divisor?: number, color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  const displayValue = divisor > 1 ? (value / divisor).toFixed(1) : value;
  
  return (
    <div className="group relative">
      <div className="flex justify-between text-[11px] mb-1">
        <span className="text-zinc-500 font-medium group-hover:text-zinc-300 transition-colors">{label}</span>
        <span className="text-zinc-200 font-mono tabular-nums">{displayValue}{unit}</span>
      </div>
      <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full ${color} transition-all duration-500 ease-out`} 
          style={{ width: `${pct}%` }} 
        />
      </div>
    </div>
  );
}

// --- Utils ---

function getHealthColor(fps: number, high: number, low: number) {
  if (fps >= high) return { text: 'text-emerald-400', bg: 'bg-emerald-500', bgPulse: 'bg-emerald-400' };
  if (fps >= low) return { text: 'text-amber-400', bg: 'bg-amber-500', bgPulse: 'bg-amber-400' };
  return { text: 'text-rose-500', bg: 'bg-rose-500', bgPulse: 'bg-rose-400' };
}