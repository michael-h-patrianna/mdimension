import { useMemo, useState, type FC } from 'react';
import { useAnimationStore, MIN_SPEED, MAX_SPEED } from '@/stores/animationStore';
import { useUIStore } from '@/stores/uiStore';
import { MIN_ANIMATION_BIAS, MAX_ANIMATION_BIAS } from '@/stores/defaults/visualDefaults'; // Constants can stay for now or move to defaults
import { useGeometryStore } from '@/stores/geometryStore';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { getRotationPlanes } from '@/lib/math';
import { useShallow } from 'zustand/react/shallow';
import { ToggleButton } from '@/components/ui/ToggleButton';
import { AnimatePresence, m } from 'motion/react';

export const TimelineControls: FC = () => {
    const dimension = useGeometryStore((state) => state.dimension);
    const objectType = useGeometryStore((state) => state.objectType);
    
    // Animation Store
    const {
        isPlaying,
        speed,
        direction,
        animatingPlanes,
        toggle,
        setSpeed,
        toggleDirection,
        togglePlane,
        animateAll,
        clearAllPlanes
    } = useAnimationStore(
        useShallow((state) => ({
            isPlaying: state.isPlaying,
            speed: state.speed,
            direction: state.direction,
            animatingPlanes: state.animatingPlanes,
            toggle: state.toggle,
            setSpeed: state.setSpeed,
            toggleDirection: state.toggleDirection,
            togglePlane: state.togglePlane,
            animateAll: state.animateAll,
            clearAllPlanes: state.clearAllPlanes,
        }))
    );

    const animationBias = useUIStore((state) => state.animationBias);
    const setAnimationBias = useUIStore((state) => state.setAnimationBias);

    // Quaternion Julia Settings
    const {
        quaternionJuliaConfig,
        setQuaternionJuliaOriginDriftEnabled,
        setQuaternionJuliaOriginDriftAmplitude,
        setQuaternionJuliaOriginDriftBaseFrequency,
    } = useExtendedObjectStore(
        useShallow((state) => ({
          quaternionJuliaConfig: state.quaternionJulia,
          setQuaternionJuliaOriginDriftEnabled: state.setQuaternionJuliaOriginDriftEnabled,
          setQuaternionJuliaOriginDriftAmplitude: state.setQuaternionJuliaOriginDriftAmplitude,
          setQuaternionJuliaOriginDriftBaseFrequency: state.setQuaternionJuliaOriginDriftBaseFrequency,
        }))
    );

    // Hyperbulb Settings (power animation, slice animation, Julia morphing, phase shifts)
    const {
        mandelbrotConfig,
        setMandelbrotPowerAnimationEnabled,
        setMandelbrotPowerMin,
        setMandelbrotPowerMax,
        setMandelbrotPowerSpeed,
        // Slice Animation (4D+ only)
        setMandelbrotSliceAnimationEnabled,
        setMandelbrotSliceSpeed,
        setMandelbrotSliceAmplitude,
        // Julia Morphing
        setMandelbrotJuliaModeEnabled,
        setMandelbrotJuliaOrbitSpeed,
        setMandelbrotJuliaOrbitRadius,
        // Phase Shifts
        setMandelbrotPhaseShiftEnabled,
        setMandelbrotPhaseSpeed,
        setMandelbrotPhaseAmplitude,
    } = useExtendedObjectStore(
        useShallow((state) => ({
          mandelbrotConfig: state.mandelbrot,
          setMandelbrotPowerAnimationEnabled: state.setMandelbrotPowerAnimationEnabled,
          setMandelbrotPowerMin: state.setMandelbrotPowerMin,
          setMandelbrotPowerMax: state.setMandelbrotPowerMax,
          setMandelbrotPowerSpeed: state.setMandelbrotPowerSpeed,
          // Slice Animation
          setMandelbrotSliceAnimationEnabled: state.setMandelbrotSliceAnimationEnabled,
          setMandelbrotSliceSpeed: state.setMandelbrotSliceSpeed,
          setMandelbrotSliceAmplitude: state.setMandelbrotSliceAmplitude,
          // Julia Morphing
          setMandelbrotJuliaModeEnabled: state.setMandelbrotJuliaModeEnabled,
          setMandelbrotJuliaOrbitSpeed: state.setMandelbrotJuliaOrbitSpeed,
          setMandelbrotJuliaOrbitRadius: state.setMandelbrotJuliaOrbitRadius,
          // Phase Shifts
          setMandelbrotPhaseShiftEnabled: state.setMandelbrotPhaseShiftEnabled,
          setMandelbrotPhaseSpeed: state.setMandelbrotPhaseSpeed,
          setMandelbrotPhaseAmplitude: state.setMandelbrotPhaseAmplitude,
        }))
    );

    const planes = useMemo(() => getRotationPlanes(dimension), [dimension]);
    const hasAnimatingPlanes = animatingPlanes.size > 0;

  // Check if any animation is active
  const isAnimating = useMemo(() => {
    // Hyperbulb: any of its animations
    const hyperbulbAnimating = mandelbrotConfig.powerAnimationEnabled ||
                               mandelbrotConfig.alternatePowerEnabled ||
                               mandelbrotConfig.dimensionMixEnabled ||
                               mandelbrotConfig.originDriftEnabled ||
                               mandelbrotConfig.sliceAnimationEnabled ||
                               mandelbrotConfig.juliaModeEnabled ||
                               mandelbrotConfig.phaseShiftEnabled;
    
    // Quaternion Julia: any of its animations
    const qjAnimating = quaternionJuliaConfig.juliaConstantAnimation.enabled ||
                        quaternionJuliaConfig.powerAnimation.enabled ||
                        quaternionJuliaConfig.originDriftEnabled ||
                        quaternionJuliaConfig.dimensionMixEnabled;

    return hyperbulbAnimating || qjAnimating;
  }, [
    mandelbrotConfig.powerAnimationEnabled,
    mandelbrotConfig.alternatePowerEnabled,
    mandelbrotConfig.dimensionMixEnabled,
    mandelbrotConfig.originDriftEnabled,
    mandelbrotConfig.sliceAnimationEnabled,
    mandelbrotConfig.juliaModeEnabled,
    mandelbrotConfig.phaseShiftEnabled,
    quaternionJuliaConfig.juliaConstantAnimation.enabled,
    quaternionJuliaConfig.powerAnimation.enabled,
    quaternionJuliaConfig.originDriftEnabled,
    quaternionJuliaConfig.dimensionMixEnabled
  ]);

    // Animation should only be paused when NOTHING is animating
    const hasAnythingToAnimate = hasAnimatingPlanes || isAnimating;

    const [showRotation, setShowRotation] = useState(false);
    const [showFractalAnim, setShowFractalAnim] = useState(false);

    return (
        <div className="flex flex-col w-full h-full bg-panel-bg relative">
            <AnimatePresence>
                {/* Rotation Drawer */}
                {showRotation && (
                    <m.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ duration: 0.2 }}
                        className="absolute bottom-full left-0 right-0 bg-panel-bg/95 backdrop-blur-xl border-t border-b border-panel-border z-20 shadow-2xl"
                    >
                        <div className="p-4 flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest">Rotation Planes</h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => animateAll(dimension)}
                                        className="text-[10px] uppercase font-bold text-accent hover:bg-accent/10 px-2 py-1 rounded transition-colors"
                                    >
                                        Select All
                                    </button>
                                    <button
                                        onClick={() => clearAllPlanes()}
                                        className="text-[10px] uppercase font-bold text-text-secondary hover:text-text-primary hover:bg-white/10 px-2 py-1 rounded transition-colors"
                                    >
                                        Deselect All
                                    </button>
                                </div>
                            </div>
                            
                            <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-panel-border">
                                {planes.map((plane) => {
                                    const isActive = animatingPlanes.has(plane.name);
                                    return (
                                        <button
                                            key={plane.name}
                                            onClick={() => togglePlane(plane.name)}
                                            className={`
                                                flex-1 min-w-[60px] px-3 py-2 rounded-md text-xs font-mono border transition-all text-center
                                                ${isActive 
                                                    ? 'bg-accent/20 border-accent text-accent shadow-[0_0_10px_color-mix(in_oklch,var(--color-accent)_20%,transparent)]' 
                                                    : 'bg-white/5 border-transparent text-text-secondary hover:bg-white/10 hover:text-text-primary'}
                                            `}
                                        >
                                            {plane.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </m.div>
                )}


      {/* Quaternion Julia Animation Drawer */}
      {showFractalAnim && objectType === 'quaternion-julia' && (
        <div className="bg-zinc-900/90 border-t border-white/10 p-3 animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center gap-4">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest min-w-[80px]">Origin Drift</div>
            
            <ToggleButton
              pressed={quaternionJuliaConfig.originDriftEnabled}
              onToggle={() => setQuaternionJuliaOriginDriftEnabled(!quaternionJuliaConfig.originDriftEnabled)}
              className="h-6 text-[10px] px-2 py-0"
            >
              {quaternionJuliaConfig.originDriftEnabled ? 'ON' : 'OFF'}
            </ToggleButton>

            <div className={`space-y-3 ${!quaternionJuliaConfig.originDriftEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="flex items-center gap-2 w-64">
                <span className="text-[10px] text-zinc-400 w-16">Amplitude</span>
                <input type="range" min={0.01} max={0.5} step={0.01} value={quaternionJuliaConfig.originDriftAmplitude} onChange={(e) => setQuaternionJuliaOriginDriftAmplitude(parseFloat(e.target.value))} className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer" />
                <span className="text-xs font-mono w-8 text-right">{quaternionJuliaConfig.originDriftAmplitude.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2 w-64">
                <span className="text-[10px] text-zinc-400 w-16">Frequency</span>
                <input type="range" min={0.05} max={0.5} step={0.01} value={quaternionJuliaConfig.originDriftBaseFrequency} onChange={(e) => setQuaternionJuliaOriginDriftBaseFrequency(parseFloat(e.target.value))} className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer" />
                <span className="text-xs font-mono w-8 text-right">{quaternionJuliaConfig.originDriftBaseFrequency.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mandelbrot/Hyperbulb Fractal Animation Drawer */}
      {showFractalAnim && objectType === 'mandelbrot' && (
                    <m.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ duration: 0.2 }}
                        className="absolute bottom-full left-0 right-0 bg-panel-bg/95 backdrop-blur-xl border-t border-b border-panel-border z-20 shadow-2xl max-h-[400px] overflow-y-auto"
                    >
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Power Animation */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">Power Animation</label>
                                    <ToggleButton
                                        pressed={mandelbrotConfig.powerAnimationEnabled}
                                        onToggle={() => setMandelbrotPowerAnimationEnabled(!mandelbrotConfig.powerAnimationEnabled)}
                                        className="text-xs px-2 py-1 h-auto"
                                        ariaLabel="Toggle power animation"
                                    >
                                        {mandelbrotConfig.powerAnimationEnabled ? 'ON' : 'OFF'}
                                    </ToggleButton>
                                </div>

                                <div className={`space-y-3 ${!mandelbrotConfig.powerAnimationEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-text-secondary w-16">Min</span>
                                        <input type="range" min={2} max={16} step={0.5} value={mandelbrotConfig.powerMin} onChange={(e) => setMandelbrotPowerMin(parseFloat(e.target.value))} className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer" />
                                        <span className="text-xs font-mono w-8 text-right">{mandelbrotConfig.powerMin.toFixed(1)}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-text-secondary w-16">Max</span>
                                        <input type="range" min={3} max={24} step={0.5} value={mandelbrotConfig.powerMax} onChange={(e) => setMandelbrotPowerMax(parseFloat(e.target.value))} className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer" />
                                        <span className="text-xs font-mono w-8 text-right">{mandelbrotConfig.powerMax.toFixed(1)}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-text-secondary w-16">Speed</span>
                                        <input type="range" min={0.01} max={0.2} step={0.01} value={mandelbrotConfig.powerSpeed} onChange={(e) => setMandelbrotPowerSpeed(parseFloat(e.target.value))} className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer" />
                                        <span className="text-xs font-mono w-10 text-right">{mandelbrotConfig.powerSpeed.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Phase Shifts */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">Phase Shifts</label>
                                    <ToggleButton
                                        pressed={mandelbrotConfig.phaseShiftEnabled}
                                        onToggle={() => setMandelbrotPhaseShiftEnabled(!mandelbrotConfig.phaseShiftEnabled)}
                                        className="text-xs px-2 py-1 h-auto"
                                        ariaLabel="Toggle phase shifts"
                                    >
                                        {mandelbrotConfig.phaseShiftEnabled ? 'ON' : 'OFF'}
                                    </ToggleButton>
                                </div>

                                <div className={`space-y-3 ${!mandelbrotConfig.phaseShiftEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-text-secondary w-16">Amplitude</span>
                                        <input type="range" min={0} max={0.785} step={0.01} value={mandelbrotConfig.phaseAmplitude} onChange={(e) => setMandelbrotPhaseAmplitude(parseFloat(e.target.value))} className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer" />
                                        <span className="text-xs font-mono w-10 text-right">{mandelbrotConfig.phaseAmplitude.toFixed(2)}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-text-secondary w-16">Speed</span>
                                        <input type="range" min={0.01} max={0.2} step={0.01} value={mandelbrotConfig.phaseSpeed} onChange={(e) => setMandelbrotPhaseSpeed(parseFloat(e.target.value))} className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer" />
                                        <span className="text-xs font-mono w-10 text-right">{mandelbrotConfig.phaseSpeed.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Julia Morphing */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">Julia Morphing</label>
                                    <ToggleButton
                                        pressed={mandelbrotConfig.juliaModeEnabled}
                                        onToggle={() => setMandelbrotJuliaModeEnabled(!mandelbrotConfig.juliaModeEnabled)}
                                        className="text-xs px-2 py-1 h-auto"
                                        ariaLabel="Toggle Julia morphing"
                                    >
                                        {mandelbrotConfig.juliaModeEnabled ? 'ON' : 'OFF'}
                                    </ToggleButton>
                                </div>

                                <div className={`space-y-3 ${!mandelbrotConfig.juliaModeEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-text-secondary w-16">Radius</span>
                                        <input type="range" min={0.1} max={1.5} step={0.05} value={mandelbrotConfig.juliaOrbitRadius} onChange={(e) => setMandelbrotJuliaOrbitRadius(parseFloat(e.target.value))} className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer" />
                                        <span className="text-xs font-mono w-10 text-right">{mandelbrotConfig.juliaOrbitRadius.toFixed(2)}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-text-secondary w-16">Speed</span>
                                        <input type="range" min={0.01} max={0.1} step={0.01} value={mandelbrotConfig.juliaOrbitSpeed} onChange={(e) => setMandelbrotJuliaOrbitSpeed(parseFloat(e.target.value))} className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer" />
                                        <span className="text-xs font-mono w-10 text-right">{mandelbrotConfig.juliaOrbitSpeed.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Slice Animation (4D+ only) */}
                            {dimension >= 4 && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">Slice Animation</label>
                                        <ToggleButton
                                            pressed={mandelbrotConfig.sliceAnimationEnabled}
                                            onToggle={() => setMandelbrotSliceAnimationEnabled(!mandelbrotConfig.sliceAnimationEnabled)}
                                            className="text-xs px-2 py-1 h-auto"
                                            ariaLabel="Toggle slice animation"
                                        >
                                            {mandelbrotConfig.sliceAnimationEnabled ? 'ON' : 'OFF'}
                                        </ToggleButton>
                                    </div>

                                    <div className={`space-y-3 ${!mandelbrotConfig.sliceAnimationEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-text-secondary w-16">Amplitude</span>
                                            <input type="range" min={0.1} max={1.0} step={0.05} value={mandelbrotConfig.sliceAmplitude} onChange={(e) => setMandelbrotSliceAmplitude(parseFloat(e.target.value))} className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer" />
                                            <span className="text-xs font-mono w-10 text-right">{mandelbrotConfig.sliceAmplitude.toFixed(2)}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-text-secondary w-16">Speed</span>
                                            <input type="range" min={0.01} max={0.1} step={0.01} value={mandelbrotConfig.sliceSpeed} onChange={(e) => setMandelbrotSliceSpeed(parseFloat(e.target.value))} className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer" />
                                            <span className="text-xs font-mono w-10 text-right">{mandelbrotConfig.sliceSpeed.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </m.div>
                )}
            </AnimatePresence>

            {/* Main Timeline Bar */}
            <div className="h-12 flex items-center px-4 gap-4 border-t border-panel-border shrink-0 overflow-x-auto no-scrollbar z-30 bg-panel-bg/80 backdrop-blur-md relative">
                {/* Playback Controls */}
                <div className="flex items-center gap-2 shrink-0">
                     <button
                        onClick={toggle}
                        disabled={!hasAnythingToAnimate}
                        className={`
                            flex items-center justify-center w-10 h-10 rounded-full transition-all shrink-0
                            ${isPlaying
                                ? 'bg-accent text-black hover:bg-accent/90 shadow-[0_0_15px_var(--color-accent)]'
                                : 'bg-panel-border hover:bg-white/20 text-text-primary'
                            }
                            ${!hasAnythingToAnimate ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                        title={isPlaying ? "Pause" : "Play"}
                    >
                        {isPlaying ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                        ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="ml-1"><path d="M5 3l14 9-14 9V3z" /></svg>
                        )}
                    </button>
                </div>

                <div className="h-6 w-px bg-panel-border shrink-0" />

                {/* Speed & Direction */}
                <div className="flex items-center gap-4 shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-text-secondary w-8 text-right">SPD</span>
                         <input
                            type="range"
                            min={MIN_SPEED}
                            max={MAX_SPEED}
                            step={0.1}
                            value={speed}
                            onChange={(e) => setSpeed(parseFloat(e.target.value))}
                            className="w-24 accent-accent h-1.5 bg-panel-border rounded-lg appearance-none cursor-pointer"
                        />
                         <span className="text-xs font-mono text-accent w-8">{speed.toFixed(1)}x</span>
                    </div>

                    <button
                        onClick={toggleDirection}
                        className="p-1.5 rounded hover:bg-white/10 text-text-secondary hover:text-text-primary transition-colors font-mono text-xs"
                        title={direction === 1 ? 'Forward' : 'Reverse'}
                    >
                        {direction === 1 ? 'FWD' : 'REV'}
                    </button>
                </div>

                 <div className="h-6 w-px bg-panel-border shrink-0" />
                 
                 {/* Bias Control */}
                  <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-mono text-text-secondary w-8 text-right">BIAS</span>
                         <input
                            type="range"
                            min={MIN_ANIMATION_BIAS}
                            max={MAX_ANIMATION_BIAS}
                            step={0.05}
                            value={animationBias}
                            onChange={(e) => setAnimationBias(parseFloat(e.target.value))}
                            className="w-24 accent-accent h-1.5 bg-panel-border rounded-lg appearance-none cursor-pointer"
                        />
                  </div>

                 <div className="flex-1 min-w-[20px]" />

                 {/* Advanced Toggles */}
                 <div className="flex items-center gap-2 shrink-0">
                    {(objectType === 'mandelbrot' || objectType === 'quaternion-julia') && (
                         <button
                            onClick={() => { setShowFractalAnim(!showFractalAnim); setShowRotation(false); }}
                            className={`
                                text-xs font-medium uppercase tracking-wider px-3 py-1.5 rounded transition-colors
                                ${showFractalAnim ? 'bg-accent/20 text-accent' : 'hover:bg-white/5 text-text-secondary'}
                            `}
                         >
                            Fractal Parameters
                         </button>
                    )}
                    
                     <button 
                        onClick={() => { setShowRotation(!showRotation); setShowFractalAnim(false); }}
                        className={`
                            text-xs font-medium uppercase tracking-wider px-3 py-1.5 rounded transition-colors
                            ${showRotation ? 'bg-accent/20 text-accent' : 'hover:bg-white/5 text-text-secondary'}
                            `}
                     >
                        Rotation ({animatingPlanes.size})
                     </button>
                 </div>
            </div>
        </div>
    );
};


