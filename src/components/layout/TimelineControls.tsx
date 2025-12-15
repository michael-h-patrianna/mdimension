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

    // Menger Settings (origin drift only)
    const {
        mengerConfig,
        setMengerOriginDriftEnabled,
        setMengerDriftAmplitude,
        setMengerDriftBaseFrequency,
    } = useExtendedObjectStore(
        useShallow((state) => ({
          mengerConfig: state.menger,
          setMengerOriginDriftEnabled: state.setMengerOriginDriftEnabled,
          setMengerDriftAmplitude: state.setMengerDriftAmplitude,
          setMengerDriftBaseFrequency: state.setMengerDriftBaseFrequency,
        }))
    );

    // Hyperbulb Settings (power animation only)
    const {
        hyperbulbConfig,
        setMandelbrotPowerAnimationEnabled,
        setMandelbrotPowerMin,
        setMandelbrotPowerMax,
        setMandelbrotPowerSpeed,
    } = useExtendedObjectStore(
        useShallow((state) => ({
          hyperbulbConfig: state.mandelbrot,
          setMandelbrotPowerAnimationEnabled: state.setMandelbrotPowerAnimationEnabled,
          setMandelbrotPowerMin: state.setMandelbrotPowerMin,
          setMandelbrotPowerMax: state.setMandelbrotPowerMax,
          setMandelbrotPowerSpeed: state.setMandelbrotPowerSpeed,
        }))
    );

    const planes = useMemo(() => getRotationPlanes(dimension), [dimension]);
    const hasAnimatingPlanes = animatingPlanes.size > 0;

    // Check if any fractal animation is enabled
    const hasAnyFractalAnimation = useMemo(() => {
        // Menger: origin drift only
        const mengerAnimating = mengerConfig.originDriftEnabled;

        // Hyperbulb: power animation only
        const hyperbulbAnimating = hyperbulbConfig.powerAnimationEnabled;

        return mengerAnimating || hyperbulbAnimating;
    }, [mengerConfig.originDriftEnabled, hyperbulbConfig.powerAnimationEnabled]);

    // Animation should only be paused when NOTHING is animating
    const hasAnythingToAnimate = hasAnimatingPlanes || hasAnyFractalAnimation;

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


                {/* Menger Fractal Animation Drawer */}
                {showFractalAnim && objectType === 'menger' && (
                    <m.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ duration: 0.2 }}
                        className="absolute bottom-full left-0 right-0 bg-panel-bg/95 backdrop-blur-xl border-t border-b border-panel-border z-20 shadow-2xl"
                    >
                        <div className="p-4">
                            {/* Origin Drift */}
                            <div className="space-y-3 max-w-md">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">Origin Drift</label>
                                    <ToggleButton
                                        pressed={mengerConfig.originDriftEnabled}
                                        onToggle={() => setMengerOriginDriftEnabled(!mengerConfig.originDriftEnabled)}
                                        className="text-xs px-2 py-1 h-auto"
                                        ariaLabel="Toggle origin drift"
                                    >
                                        {mengerConfig.originDriftEnabled ? 'ON' : 'OFF'}
                                    </ToggleButton>
                                </div>

                                <div className={`space-y-3 ${!mengerConfig.originDriftEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-text-secondary w-16">Amplitude</span>
                                        <input type="range" min={0.01} max={0.5} step={0.01} value={mengerConfig.driftAmplitude} onChange={(e) => setMengerDriftAmplitude(parseFloat(e.target.value))} className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer" />
                                        <span className="text-xs font-mono w-8 text-right">{mengerConfig.driftAmplitude.toFixed(2)}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-text-secondary w-16">Frequency</span>
                                        <input type="range" min={0.05} max={0.5} step={0.01} value={mengerConfig.driftBaseFrequency} onChange={(e) => setMengerDriftBaseFrequency(parseFloat(e.target.value))} className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer" />
                                        <span className="text-xs font-mono w-8 text-right">{mengerConfig.driftBaseFrequency.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </m.div>
                )}

                {/* Mandelbrot/Hyperbulb Fractal Animation Drawer */}
                {showFractalAnim && objectType === 'mandelbrot' && (
                    <m.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ duration: 0.2 }}
                        className="absolute bottom-full left-0 right-0 bg-panel-bg/95 backdrop-blur-xl border-t border-b border-panel-border z-20 shadow-2xl"
                    >
                        <div className="p-4">
                            {/* Power Animation */}
                            <div className="space-y-3 max-w-md">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">Power Animation</label>
                                    <ToggleButton
                                        pressed={hyperbulbConfig.powerAnimationEnabled}
                                        onToggle={() => setMandelbrotPowerAnimationEnabled(!hyperbulbConfig.powerAnimationEnabled)}
                                        className="text-xs px-2 py-1 h-auto"
                                        ariaLabel="Toggle power animation"
                                    >
                                        {hyperbulbConfig.powerAnimationEnabled ? 'ON' : 'OFF'}
                                    </ToggleButton>
                                </div>

                                <div className={`space-y-3 ${!hyperbulbConfig.powerAnimationEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-text-secondary w-16">Min</span>
                                        <input type="range" min={2} max={16} step={0.5} value={hyperbulbConfig.powerMin} onChange={(e) => setMandelbrotPowerMin(parseFloat(e.target.value))} className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer" />
                                        <span className="text-xs font-mono w-8 text-right">{hyperbulbConfig.powerMin.toFixed(1)}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-text-secondary w-16">Max</span>
                                        <input type="range" min={3} max={24} step={0.5} value={hyperbulbConfig.powerMax} onChange={(e) => setMandelbrotPowerMax(parseFloat(e.target.value))} className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer" />
                                        <span className="text-xs font-mono w-8 text-right">{hyperbulbConfig.powerMax.toFixed(1)}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-text-secondary w-16">Speed</span>
                                        <input type="range" min={0.01} max={0.2} step={0.01} value={hyperbulbConfig.powerSpeed} onChange={(e) => setMandelbrotPowerSpeed(parseFloat(e.target.value))} className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer" />
                                        <span className="text-xs font-mono w-10 text-right">{hyperbulbConfig.powerSpeed.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
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
                    {(objectType === 'menger' || objectType === 'mandelbrot') && (
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


