import { useMemo, useState, type FC } from 'react';
import { useAnimationStore, MIN_SPEED, MAX_SPEED } from '@/stores/animationStore';
import { useUIStore } from '@/stores/uiStore';
import { MIN_ANIMATION_BIAS, MAX_ANIMATION_BIAS } from '@/stores/defaults/visualDefaults'; // Constants can stay for now or move to defaults
import { useGeometryStore } from '@/stores/geometryStore';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { getRotationPlanes } from '@/lib/math';
import { useShallow } from 'zustand/react/shallow';
import { AnimatePresence, m } from 'motion/react';
import { JuliaAnimationDrawer } from './TimelineControls/JuliaAnimationDrawer';
import { MandelbulbAnimationDrawer } from './TimelineControls/MandelbulbAnimationDrawer';
import { PolytopeAnimationDrawer } from './TimelineControls/PolytopeAnimationDrawer';
import { isPolytopeType } from '@/lib/geometry/types';

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

    // Extended object configs for animation state checking
    const { mandelbulbConfig, quaternionJuliaConfig, polytopeConfig } = useExtendedObjectStore(
        useShallow((state) => ({
          mandelbulbConfig: state.mandelbulb,
          quaternionJuliaConfig: state.quaternionJulia,
          polytopeConfig: state.polytope,
        }))
    );

    const planes = useMemo(() => getRotationPlanes(dimension), [dimension]);
    const hasAnimatingPlanes = animatingPlanes.size > 0;

  // Check if any animation is active
  const isAnimating = useMemo(() => {
    // Mandelbulb: any of its animations
    const mandelbulbAnimating = mandelbulbConfig.powerAnimationEnabled ||
                               mandelbulbConfig.alternatePowerEnabled ||
                               mandelbulbConfig.dimensionMixEnabled ||
                               mandelbulbConfig.originDriftEnabled ||
                               mandelbulbConfig.sliceAnimationEnabled ||
                               mandelbulbConfig.phaseShiftEnabled;
    
    // Quaternion Julia: any of its animations
    const qjAnimating = quaternionJuliaConfig.juliaConstantAnimation.enabled ||
                        quaternionJuliaConfig.powerAnimation.enabled ||
                        quaternionJuliaConfig.originDriftEnabled ||
                        quaternionJuliaConfig.dimensionMixEnabled;

    // Polytope: any of its animations (breathing, twist, explode)
    const polytopeAnimating = polytopeConfig.facetOffsetEnabled ||
                              polytopeConfig.dualMorphEnabled ||
                              polytopeConfig.explodeEnabled;

    return mandelbulbAnimating || qjAnimating || polytopeAnimating;
  }, [
    mandelbulbConfig.powerAnimationEnabled,
    mandelbulbConfig.alternatePowerEnabled,
    mandelbulbConfig.dimensionMixEnabled,
    mandelbulbConfig.originDriftEnabled,
    mandelbulbConfig.sliceAnimationEnabled,
    mandelbulbConfig.phaseShiftEnabled,
    quaternionJuliaConfig.juliaConstantAnimation.enabled,
    quaternionJuliaConfig.powerAnimation.enabled,
    quaternionJuliaConfig.originDriftEnabled,
    quaternionJuliaConfig.dimensionMixEnabled,
    polytopeConfig.facetOffsetEnabled,
    polytopeConfig.dualMorphEnabled,
    polytopeConfig.explodeEnabled,
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
        <JuliaAnimationDrawer />
      )}

      {/* Mandelbulb/Mandelbulb Fractal Animation Drawer */}
      {showFractalAnim && objectType === 'mandelbulb' && (
        <MandelbulbAnimationDrawer />
      )}

      {/* Polytope Animation Drawer */}
      {showFractalAnim && isPolytopeType(objectType) && (
        <PolytopeAnimationDrawer />
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
                    {(objectType === 'mandelbulb' || objectType === 'quaternion-julia' || isPolytopeType(objectType)) && (
                         <button
                            onClick={() => { setShowFractalAnim(!showFractalAnim); setShowRotation(false); }}
                            className={`
                                text-xs font-medium uppercase tracking-wider px-3 py-1.5 rounded transition-colors
                                ${showFractalAnim ? 'bg-accent/20 text-accent' : 'hover:bg-white/5 text-text-secondary'}
                            `}
                         >
                            Animations
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


