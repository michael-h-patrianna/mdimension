import { Tabs } from '@/components/ui/Tabs';
import { usePanelCollision } from '@/hooks/usePanelCollision';
import { getConfigStoreKey, isRaymarchingType } from '@/lib/geometry/registry';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useGeometryStore } from '@/stores/geometryStore';
import { usePerformanceMetricsStore, type BufferStats } from '@/stores/performanceMetricsStore';
import { usePerformanceStore } from '@/stores/performanceStore';
import { useUIStore } from '@/stores/uiStore';
import { LazyMotion, domMax, m, useMotionValue } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Custom Performance Monitor UI
 *
 * Features:
 * - Reads from usePerformanceMetricsStore (populated by PerformanceStatsCollector)
 * - Pure UI component (no R3F hooks)
 * - Draggable, Expandable
 * - Smart collision with sidebars/panels (pushes away when UI opens)
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
  RefreshCw: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
  ),
  Square: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
  ),
};

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

/**
 *
 */
export function PerformanceMonitor() {
  // -- Store Connectors --
  const objectType = useGeometryStore(state => state.objectType);
  const mandelbulbConfig = useExtendedObjectStore(state => state.mandelbulb);
  const quaternionJuliaConfig = useExtendedObjectStore(state => state.quaternionJulia);

  // -- Perf Stats --
  const stats = usePerformanceMetricsStore();
  const shaderDebugInfos = usePerformanceStore((state) => state.shaderDebugInfos);
  const shaderOverrides = usePerformanceStore((state) => state.shaderOverrides);
  const toggleShaderModule = usePerformanceStore((state) => state.toggleShaderModule);

  // -- UI Store for buffer toggles --
  const showDepthBuffer = useUIStore((state) => state.showDepthBuffer);
  const setShowDepthBuffer = useUIStore((state) => state.setShowDepthBuffer);
  const showNormalBuffer = useUIStore((state) => state.showNormalBuffer);
  const setShowNormalBuffer = useUIStore((state) => state.setShowNormalBuffer);
  const showTemporalDepthBuffer = useUIStore((state) => state.showTemporalDepthBuffer);
  const setShowTemporalDepthBuffer = useUIStore((state) => state.setShowTemporalDepthBuffer);

  // Safe modules that can be toggled without breaking the shader compilation
  const SAFE_MODULES = ['Shadows', 'Ambient Occlusion', 'Temporal Features'];

  // -- State --
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'perf' | 'sys' | 'shader' | 'buffers'>('perf');
  const [bufferStats, setBufferStats] = useState<BufferStats | null>(null);
  const [selectedShaderKey, setSelectedShaderKey] = useState<string | null>(null);

  // Refresh buffer stats from store
  const refreshBufferStats = useCallback(() => {
    const currentStats = usePerformanceMetricsStore.getState().buffers;
    setBufferStats({ ...currentStats });
  }, []);

  // Auto-refresh when switching to buffers tab
  useEffect(() => {
    if (activeTab === 'buffers') {
      refreshBufferStats();
    }
  }, [activeTab, refreshBufferStats]);

  // Auto-select first shader if none selected or invalid
  useEffect(() => {
    const keys = Object.keys(shaderDebugInfos);
    if (keys.length > 0) {
      if (!selectedShaderKey || !shaderDebugInfos[selectedShaderKey]) {
        // Prioritize 'object' if available, otherwise first
        if (keys.includes('object')) setSelectedShaderKey('object');
        else setSelectedShaderKey(keys[0]!);
      }
    } else {
        setSelectedShaderKey(null);
    }
  }, [shaderDebugInfos, selectedShaderKey]);

  const [isDragging, setIsDragging] = useState(false);

  // -- Dimensions & Positioning --
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(300); // Default min-width
  const [height, setHeight] = useState(60); // Default min-height

  // Motion values for Position
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Track size for collision
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
        setHeight(entry.contentRect.height);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // -- Collision Hook --
  // Pushes the monitor away when UI panels open
  usePanelCollision(x, y, width, height, isDragging);

  const toggleExpanded = () => {
    if (!isDragging) {
      setExpanded(!expanded);
    }
  };

  const fpsColor = getHealthColor(stats.fps, 55, 30);

  // Use scene-only stats for accurate geometry counts (excludes post-processing passes)
  const sceneStats = stats.sceneGpu;
  // Processed vertices = triangles*3 + lines*2 (what GPU vertex shader processes)
  const processedVertices = sceneStats.triangles * 3 + sceneStats.lines * 2 + sceneStats.points;
  // Unique vertices = actual vertex buffer count (shows indexed geometry savings)
  const uniqueVertices = sceneStats.uniqueVertices ?? processedVertices;

  // -- Raymarching Info (data-driven via registry) --
  const isRaymarching = isRaymarchingType(objectType);
  const configKey = getConfigStoreKey(objectType);
  const raySteps = configKey === 'mandelbulb' ? mandelbulbConfig.maxIterations :
                   configKey === 'quaternionJulia' ? quaternionJuliaConfig.maxIterations : 0;
  
  // Get currently selected shader info
  const activeShaderInfo = selectedShaderKey ? shaderDebugInfos[selectedShaderKey] : null;

  // -- Tab Content --
  const tabs = [
    {
      id: 'perf',
      label: 'Performance',
      content: (
        <m.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-5 p-5"
        >
           {/* FPS Graph */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] opacity-60 uppercase font-bold tracking-wider">
              <span>FPS History</span>
              <span>{stats.minFps} - {stats.maxFps}</span>
            </div>
            <div className="h-12 w-full flex items-end gap-0.5 opacity-80">
              {stats.history.fps.map((v, i) => (
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
            {/* GPU Section - Shows scene geometry only (excludes post-processing) */}
            <div className="space-y-3">
              <SectionHeader icon={<Icons.Zap />} label="Scene Geometry" />
              <div className="space-y-2.5">
                <StatItem label="Draw Calls" value={sceneStats.calls} />
                <StatItem label="Triangles" value={formatMetric(sceneStats.triangles)} />
                <StatItem label="Unique Verts" value={formatMetric(uniqueVertices)} />
                <StatItem label="Processed" value={formatMetric(processedVertices)} />
                {sceneStats.lines > 0 && <StatItem label="Lines" value={formatMetric(sceneStats.lines)} />}
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
      )
    },
    {
      id: 'sys',
      label: 'System',
      content: (
        <m.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-5 p-5"
        >
           <div className="space-y-3">
              <SectionHeader icon={<Icons.Chip />} label="Hardware" />
              <div className="p-2 bg-white/5 rounded-lg border border-white/5">
                 <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Renderer</div>
                 <div className="text-xs text-zinc-200 font-mono leading-tight break-all">{stats.gpuName}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                 {/* Capabilities can be added here */}
              </div>
           </div>

           <div className="space-y-3">
              <SectionHeader icon={<Icons.Monitor />} label="Viewport" />
              <div className="space-y-2.5">
                 <StatItem label="Resolution" value={`${stats.viewport.width} × ${stats.viewport.height}`} />
                 <StatItem label="DPR" value={`${stats.viewport.dpr.toFixed(1)}x`} />
                 <StatItem label="Aspect" value={(stats.viewport.width / stats.viewport.height || 1).toFixed(2)} />
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
      )
    },
    {
      id: 'shader',
      label: 'Shader',
      content: (
        <m.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-5 p-5"
        >
           {Object.keys(shaderDebugInfos).length === 0 ? (
             <div className="text-zinc-500 italic text-center p-4">No shader info available</div>
           ) : (
             <>
               {/* Netflix-style Shader Selection */}
               <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                  {Object.keys(shaderDebugInfos).map(key => (
                    <button
                      key={key}
                      onClick={() => setSelectedShaderKey(key)}
                      className={`
                        flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all
                        ${selectedShaderKey === key
                          ? 'bg-accent text-black shadow-lg shadow-accent/20'
                          : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200'
                        }
                      `}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50" />
                      {key}
                    </button>
                  ))}
               </div>

               {activeShaderInfo && (
                 <div key={selectedShaderKey} className="animate-in fade-in slide-in-from-right-4 duration-200 space-y-5">
                   <div className="space-y-3">
                      <SectionHeader icon={<Icons.Layers />} label="Program Info" />
                      <div className="p-2 bg-white/5 rounded-lg border border-white/5">
                         <div className="text-xs text-zinc-200 font-bold mb-1">{activeShaderInfo.name}</div>
                         <div className="grid grid-cols-2 gap-2 mt-2">
                           <StatItem label="Vertex Size" value={formatBytes(activeShaderInfo.vertexShaderLength)} />
                           <StatItem label="Fragment Size" value={formatBytes(activeShaderInfo.fragmentShaderLength)} />
                         </div>
                      </div>
                   </div>

                   {activeShaderInfo.features.length > 0 && (
                     <div className="space-y-3">
                        <SectionHeader icon={<Icons.Zap />} label="Active Features" />
                        <div className="flex flex-wrap gap-1.5">
                          {activeShaderInfo.features.map(f => (
                            <span key={f} className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded text-[9px] font-mono uppercase tracking-wide">
                              {f}
                            </span>
                          ))}
                        </div>
                     </div>
                   )}

                   <div className="space-y-3">
                      <SectionHeader icon={<Icons.Database />} label="Compiled Modules" />
                      <div className="border border-white/10 rounded-lg overflow-hidden bg-black/20">
                        <table className="w-full text-left border-collapse">
                          <tbody className="divide-y divide-white/5">
                            {activeShaderInfo.activeModules.map((mod, i) => {
                              const isSafe = SAFE_MODULES.includes(mod);
                              const isEnabled = !shaderOverrides.includes(mod);

                              return (
                                <tr key={i} className="hover:bg-white/5 transition-colors">
                                  <td className="p-2 text-[10px] font-mono text-zinc-400 border-r border-white/5 w-8 text-center opacity-50">{i+1}</td>
                                  <td className="p-2 text-[10px] text-zinc-300 flex items-center justify-between">
                                    <span className={!isEnabled ? 'opacity-50 line-through' : ''}>{mod}</span>
                                    {isSafe && (
                                      <input
                                        type="checkbox"
                                        checked={isEnabled}
                                        onChange={() => toggleShaderModule(mod)}
                                        className="w-3 h-3 rounded bg-white/10 border-white/20 checked:bg-accent focus:ring-accent/50 cursor-pointer"
                                        title="Toggle Module"
                                      />
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                   </div>
                 </div>
               )}
             </>
           )}
        </m.div>
      )
    },
    {
      id: 'buffers',
      label: 'Buffers',
      content: (
        <m.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-5 p-5"
        >
          {/* Header with refresh button */}
          <div className="flex items-center justify-between">
            <SectionHeader icon={<Icons.Square />} label="Render Buffers" />
            <button
              onClick={refreshBufferStats}
              className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-zinc-400 hover:text-zinc-200"
              title="Refresh buffer dimensions"
            >
              <Icons.RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {!bufferStats ? (
            <div className="text-zinc-500 italic text-center p-4">Loading buffer info...</div>
          ) : (
            <>
              {/* Buffer Dimensions Table */}
              <div className="border border-white/10 rounded-lg overflow-hidden bg-black/20">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="p-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Buffer</th>
                      <th className="p-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wider text-right">Dimensions</th>
                      <th className="p-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wider text-right">Scale</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    <tr className="hover:bg-white/5 transition-colors">
                      <td className="p-2 text-[11px] text-zinc-300">Screen</td>
                      <td className="p-2 text-[11px] text-zinc-200 font-mono text-right">{bufferStats.screen.width} × {bufferStats.screen.height}</td>
                      <td className="p-2 text-[11px] text-zinc-400 font-mono text-right">1.0x</td>
                    </tr>
                    <tr className="hover:bg-white/5 transition-colors">
                      <td className="p-2 text-[11px] text-zinc-300">Depth</td>
                      <td className="p-2 text-[11px] text-zinc-200 font-mono text-right">{bufferStats.depth.width} × {bufferStats.depth.height}</td>
                      <td className="p-2 text-[11px] text-zinc-400 font-mono text-right">
                        {bufferStats.screen.width > 0 ? (bufferStats.depth.width / bufferStats.screen.width).toFixed(2) : '-'}x
                      </td>
                    </tr>
                    <tr className="hover:bg-white/5 transition-colors">
                      <td className="p-2 text-[11px] text-zinc-300">Normal</td>
                      <td className="p-2 text-[11px] text-zinc-200 font-mono text-right">{bufferStats.normal.width} × {bufferStats.normal.height}</td>
                      <td className="p-2 text-[11px] text-zinc-400 font-mono text-right">
                        {bufferStats.screen.width > 0 ? (bufferStats.normal.width / bufferStats.screen.width).toFixed(2) : '-'}x
                      </td>
                    </tr>
                    <tr className={`hover:bg-white/5 transition-colors ${
                      bufferStats.screen.width > 0 && bufferStats.temporal.width !== bufferStats.screen.width * 0.5
                        ? 'bg-amber-500/10'
                        : ''
                    }`}>
                      <td className="p-2 text-[11px] text-zinc-300">Temporal</td>
                      <td className="p-2 text-[11px] text-zinc-200 font-mono text-right">{bufferStats.temporal.width} × {bufferStats.temporal.height}</td>
                      <td className="p-2 text-[11px] text-zinc-400 font-mono text-right">
                        {bufferStats.screen.width > 0 ? (bufferStats.temporal.width / bufferStats.screen.width).toFixed(2) : '-'}x
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* DPR Info */}
              <div className="p-2 bg-white/5 rounded-lg border border-white/5">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-zinc-500">Device Pixel Ratio</span>
                  <span className="text-zinc-200 font-mono">{stats.viewport.dpr.toFixed(1)}x</span>
                </div>
                <div className="flex justify-between items-center text-[11px] mt-1">
                  <span className="text-zinc-500">Expected Temporal</span>
                  <span className="text-zinc-200 font-mono">
                    {Math.floor(bufferStats.screen.width * 0.5)} × {Math.floor(bufferStats.screen.height * 0.5)}
                  </span>
                </div>
              </div>

              {/* Debug Buffer Visualization */}
              <div className="space-y-2">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Debug Visualization</div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setShowDepthBuffer(!showDepthBuffer)}
                    className={`flex-1 px-2 py-1.5 text-[10px] font-medium rounded-md transition-all duration-200 border ${
                      showDepthBuffer
                        ? 'bg-accent/20 text-accent border-accent/50'
                        : 'bg-white/5 text-zinc-400 border-white/10 hover:text-zinc-200 hover:bg-white/10'
                    }`}
                  >
                    Depth
                  </button>
                  <button
                    onClick={() => setShowNormalBuffer(!showNormalBuffer)}
                    className={`flex-1 px-2 py-1.5 text-[10px] font-medium rounded-md transition-all duration-200 border ${
                      showNormalBuffer
                        ? 'bg-accent/20 text-accent border-accent/50'
                        : 'bg-white/5 text-zinc-400 border-white/10 hover:text-zinc-200 hover:bg-white/10'
                    }`}
                  >
                    Normal
                  </button>
                  <button
                    onClick={() => setShowTemporalDepthBuffer(!showTemporalDepthBuffer)}
                    className={`flex-1 px-2 py-1.5 text-[10px] font-medium rounded-md transition-all duration-200 border ${
                      showTemporalDepthBuffer
                        ? 'bg-accent/20 text-accent border-accent/50'
                        : 'bg-white/5 text-zinc-400 border-white/10 hover:text-zinc-200 hover:bg-white/10'
                    }`}
                  >
                    Temporal
                  </button>
                </div>
              </div>
            </>
          )}
        </m.div>
      )
    }
  ];

  return (
    <LazyMotion features={domMax}>
      <m.div
        layout
        ref={containerRef}
        drag
        dragMomentum={false}
        // Sync drag with motion values
        style={{ x, y }}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={() => setTimeout(() => setIsDragging(false), 100)}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="absolute top-20 left-4 z-[50] pointer-events-auto"
      >
        <m.div 
          layout="position"
          className={`
            bg-zinc-950/80 backdrop-blur-xl
            border border-white/10
            rounded-xl overflow-hidden shadow-2xl
            text-xs font-mono text-zinc-400
            flex flex-col
            ${expanded ? 'w-96' : 'w-64'}
          `}
        >

          {/* --- Header --- */}
          <div
            className="flex items-center justify-between p-3.5 bg-white/5 cursor-pointer hover:bg-white/10 transition-colors border-b border-white/5"
            onClick={toggleExpanded}
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
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 text-zinc-500">
               <span className="text-xs font-medium">{stats.frameTime}ms</span>
              {expanded ? <Icons.ChevronDown className="opacity-70" /> : <Icons.ChevronUp className="opacity-70" />}
            </div>
          </div>

          {/* --- Expanded View --- */}
          {expanded && (
            <div className="animate-in slide-in-from-top-2 fade-in duration-200">
              <Tabs
                variant="minimal"
                fullWidth
                value={activeTab}
                onChange={(id) => setActiveTab(id as 'perf' | 'sys' | 'shader' | 'buffers')}
                tabs={tabs}
                className="h-[400px]"
              />
            </div>
          )}
        </m.div>
      </m.div>
    </LazyMotion>
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
