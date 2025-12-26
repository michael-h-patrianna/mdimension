import { useMemo, useState, type FC } from 'react';
import { useAnimationStore, MIN_SPEED, MAX_SPEED, type AnimationState } from '@/stores/animationStore';
import { useUIStore } from '@/stores/uiStore';
import { MIN_ANIMATION_BIAS, MAX_ANIMATION_BIAS } from '@/stores/defaults/visualDefaults';
import { useGeometryStore } from '@/stores/geometryStore';
import { useExtendedObjectStore, type ExtendedObjectState } from '@/stores/extendedObjectStore';
import { getRotationPlanes } from '@/lib/math';
import { useShallow } from 'zustand/react/shallow';
import { AnimatePresence, m } from 'motion/react';
import { Slider } from '@/components/ui/Slider';
import { BlackHoleAnimationDrawer } from './TimelineControls/BlackHoleAnimationDrawer';
import { JuliaAnimationDrawer } from './TimelineControls/JuliaAnimationDrawer';
import { MandelbulbAnimationDrawer } from './TimelineControls/MandelbulbAnimationDrawer';
import { PolytopeAnimationDrawer } from './TimelineControls/PolytopeAnimationDrawer';
import { SchroedingerAnimationDrawer } from './TimelineControls/SchroedingerAnimationDrawer';
import { hasTimelineControls, isPolytopeCategory, getConfigStoreKey } from '@/lib/geometry/registry';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { ToggleButton } from '@/components/ui/ToggleButton';

export const TimelineControls: FC = () => {
    const dimension = useGeometryStore((state) => state.dimension);
    const objectType = useGeometryStore((state) => state.objectType);
    
    // Animation Store
    const animationSelector = useShallow((state: AnimationState) => ({
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
    }));
    
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
    } = useAnimationStore(animationSelector);

    const animationBias = useUIStore((state) => state.animationBias);
    const setAnimationBias = useUIStore((state) => state.setAnimationBias);

    // Extended object configs for animation state checking
    const extendedObjectSelector = useShallow((state: ExtendedObjectState) => ({
        mandelbulbConfig: state.mandelbulb,
        quaternionJuliaConfig: state.quaternionJulia,
        polytopeConfig: state.polytope,
        schroedingerConfig: state.schroedinger,
        blackholeConfig: state.blackhole,
    }));

    const { mandelbulbConfig, polytopeConfig, schroedingerConfig, blackholeConfig } = useExtendedObjectStore(extendedObjectSelector);

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

    // Quaternion Julia: currently no animations (removed)
    const qjAnimating = false;

    // Polytope: facet offset animation
    const polytopeAnimating = polytopeConfig.facetOffsetEnabled;

    // Schroedinger: flow, drift, slice, spread
    const schroedingerAnimating = schroedingerConfig.curlEnabled ||
                                  schroedingerConfig.originDriftEnabled ||
                                  schroedingerConfig.sliceAnimationEnabled ||
                                  schroedingerConfig.spreadAnimationEnabled;

    // Black hole: swirl, pulse
    const blackholeAnimating = blackholeConfig.swirlAnimationEnabled ||
                               blackholeConfig.pulseEnabled;

    return mandelbulbAnimating || qjAnimating || polytopeAnimating || schroedingerAnimating || blackholeAnimating;
  }, [
    mandelbulbConfig.powerAnimationEnabled,
    mandelbulbConfig.alternatePowerEnabled,
    mandelbulbConfig.dimensionMixEnabled,
    mandelbulbConfig.originDriftEnabled,
    mandelbulbConfig.sliceAnimationEnabled,
    mandelbulbConfig.phaseShiftEnabled,
    polytopeConfig.facetOffsetEnabled,
    schroedingerConfig.curlEnabled,
    schroedingerConfig.originDriftEnabled,
    schroedingerConfig.sliceAnimationEnabled,
    schroedingerConfig.spreadAnimationEnabled,
    blackholeConfig.swirlAnimationEnabled,
    blackholeConfig.pulseEnabled,
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
                        className="absolute bottom-full left-0 right-0 glass-panel border-b-0 border-x-0 border-t border-white/10 z-20"
                    >
                        <div className="p-4 flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Rotation Planes</h3>
                                <div className="flex gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => animateAll(dimension)}
                                        className="text-[10px] uppercase font-bold text-accent hover:text-accent-glow px-2 py-1"
                                    >
                                        Select All
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => clearAllPlanes()}
                                        className="text-[10px] uppercase font-bold px-2 py-1"
                                    >
                                        Deselect All
                                    </Button>
                                </div>
                            </div>
                            
                            <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-panel-border">
                                {planes.map((plane) => {
                                    const isActive = animatingPlanes.has(plane.name);
                                    return (
                                        <ToggleButton
                                            key={plane.name}
                                            pressed={isActive}
                                            onToggle={() => togglePlane(plane.name)}
                                            ariaLabel={`Toggle ${plane.name} rotation`}
                                            className="flex-1 min-w-[60px] px-3 py-2 text-[10px] font-mono text-center uppercase tracking-wider"
                                        >
                                            {plane.name}
                                        </ToggleButton>
                                    );
                                })}
                            </div>
                        </div>
                    </m.div>
                )}


      {/* Quaternion Julia Animation Drawer */}
      {showFractalAnim && getConfigStoreKey(objectType) === 'quaternionJulia' && (
        <JuliaAnimationDrawer />
      )}

      {/* Mandelbulb/Mandelbulb Fractal Animation Drawer */}
      {showFractalAnim && getConfigStoreKey(objectType) === 'mandelbulb' && (
        <MandelbulbAnimationDrawer />
      )}

      {/* Polytope Animation Drawer */}
      {showFractalAnim && isPolytopeCategory(objectType) && (
        <PolytopeAnimationDrawer />
      )}

      {/* Schroedinger Animation Drawer */}
      {showFractalAnim && getConfigStoreKey(objectType) === 'schroedinger' && (
        <SchroedingerAnimationDrawer />
      )}

      {/* Black Hole Animation Drawer */}
      {showFractalAnim && getConfigStoreKey(objectType) === 'blackhole' && (
        <BlackHoleAnimationDrawer />
      )}
            </AnimatePresence>

            {/* Main Timeline Bar */}
            <div className="h-16 flex items-center px-6 gap-6 border-t border-white/5 shrink-0 overflow-x-auto no-scrollbar z-30 bg-panel-bg/80 backdrop-blur-md relative">
                {/* Playback Controls */}
                <div className="flex items-center gap-4 shrink-0">
                     <Button
                        variant={isPlaying ? 'primary' : 'secondary'}
                        size="icon"
                        onClick={toggle}
                        disabled={!hasAnythingToAnimate}
                        ariaLabel={isPlaying ? "Pause" : "Play"}
                        glow={isPlaying}
                        className={`
                            w-10 h-10 rounded-full shrink-0
                            ${isPlaying ? 'bg-accent text-black' : ''}
                        `}
                    >
                        {isPlaying ? (
                            <Icon name="pause" size={12} />
                        ) : (
                            <Icon name="play" size={12} className="ml-0.5" />
                        )}
                    </Button>
                </div>

                <div className="h-8 w-px bg-white/5 shrink-0" />

                {/* Speed & Direction */}
                <div className="flex items-center gap-6 shrink-0">
                    <div className="w-32 pt-3">
                         <Slider
                            label="SPEED"
                            min={MIN_SPEED}
                            max={MAX_SPEED}
                            step={0.1}
                            value={speed}
                            onChange={setSpeed}
                            showValue={true}
                            unit="x"
                        />
                    </div>

                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={toggleDirection}
                        ariaLabel={direction === 1 ? 'Forward' : 'Reverse'}
                        className="px-3 py-1 text-[10px] font-mono font-bold tracking-wider"
                    >
                        {direction === 1 ? (
                            <>
                                <span>FWD</span>
                                <Icon name="arrow-right" size={10} />
                            </>
                        ) : (
                            <>
                                <Icon name="arrow-left" size={10} />
                                <span>REV</span>
                            </>
                        )}
                    </Button>
                </div>

                 <div className="h-8 w-px bg-white/5 shrink-0" />
                 
                 {/* Bias Control */}
                  <div className="w-32 pt-3 shrink-0">
                        <Slider
                            label="BIAS"
                            min={MIN_ANIMATION_BIAS}
                            max={MAX_ANIMATION_BIAS}
                            step={0.05}
                            value={animationBias}
                            onChange={setAnimationBias}
                            showValue={true}
                        />
                  </div>

                 <div className="flex-1 min-w-[20px]" />

                 {/* Advanced Toggles */}
                 <div className="flex items-center gap-2 shrink-0">
                    {hasTimelineControls(objectType) && (
                         <ToggleButton
                            pressed={showFractalAnim}
                            onToggle={() => { setShowFractalAnim(!showFractalAnim); setShowRotation(false); }}
                            ariaLabel="Toggle animations drawer"
                            className="text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-full"
                         >
                            Animations
                         </ToggleButton>
                    )}

                     <ToggleButton
                        pressed={showRotation}
                        onToggle={() => { setShowRotation(!showRotation); setShowFractalAnim(false); }}
                        ariaLabel="Toggle rotation drawer"
                        className="text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-full"
                     >
                        Rotation
                         <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[9px] ${showRotation ? 'bg-accent text-black' : 'bg-white/10 text-text-tertiary'}`}>
                             {animatingPlanes.size}
                         </span>
                     </ToggleButton>
                 </div>
            </div>
        </div>
    );
};


