import React, { useEffect, useRef, useState } from 'react';
import { ToggleButton } from '@/components/ui/ToggleButton';
import { useGeometryStore } from '@/stores/geometryStore';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { useUIStore } from '@/stores/uiStore';
import { useAnimationStore } from '@/stores/animationStore';
import { useLayoutStore } from '@/stores/layoutStore';
import { useShallow } from 'zustand/react/shallow';
import { useToast } from '@/contexts/ToastContext';

// Icons
const Icons = {
  Perf: () => (
    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2 14h14v2h-16v-16h2zM4.5 13c-0.828 0-1.5-0.672-1.5-1.5s0.672-1.5 1.5-1.5c0.044 0 0.088 0.002 0.131 0.006l1.612-2.687c-0.154-0.235-0.243-0.517-0.243-0.819 0-0.828 0.672-1.5 1.5-1.5s1.5 0.672 1.5 1.5c0 0.302-0.090 0.583-0.243 0.819l1.612 2.687c0.043-0.004 0.087-0.006 0.131-0.006 0.033 0 0.066 0.001 0.099 0.004l2.662-4.658c-0.165-0.241-0.261-0.532-0.261-0.845 0-0.828 0.672-1.5 1.5-1.5s1.5 0.672 1.5 1.5c0 0.828-0.672 1.5-1.5 1.5-0.033 0-0.066-0.001-0.099-0.004l-2.662 4.658c0.165 0.241 0.261 0.532 0.261 0.845 0 0.828-0.672 1.5-1.5 1.5s-1.5-0.672-1.5-1.5c0-0.302 0.090-0.583 0.243-0.819l-1.612-2.687c-0.043 0.004-0.087 0.006-0.131 0.006s-0.088-0.002-0.131-0.006l-1.612 2.687c0.154 0.235 0.243 0.517 0.243 0.819 0 0.828-0.672 1.5-1.5 1.5z"></path>
    </svg>
  ),
  Fullscreen: () => (
    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M16 0h-6.5l2.5 2.5-3 3 1.5 1.5 3-3 2.5 2.5z"></path>
      <path d="M16 16v-6.5l-2.5 2.5-3-3-1.5 1.5 3 3-2.5 2.5z"></path>
      <path d="M0 16h6.5l-2.5-2.5 3-3-1.5-1.5-3 3-2.5-2.5z"></path>
      <path d="M0 0v6.5l2.5-2.5 3 3 1.5-1.5-3-3 2.5-2.5z"></path>
    </svg>
  ),
  Cinematic: () => (
    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M0 2v12h16v-12h-16zM3 13h-2v-2h2v2zM3 9h-2v-2h2v2zM3 5h-2v-2h2v2zM12 13h-8v-10h8v10zM15 13h-2v-2h2v2zM15 9h-2v-2h2v2zM15 5h-2v-2h2v2zM6 5v6l4-3z"></path>
    </svg>
  ),
};

// Helper functions (copied from RenderModeToggles.tsx)
function canRenderFaces(objectType: string): boolean {
  const polytopeTypes = ['hypercube', 'simplex', 'cross-polytope'];
  return (
    polytopeTypes.includes(objectType) ||
    objectType === 'root-system' ||
    objectType === 'mandelbrot' ||
    objectType === 'mandelbox' ||
    objectType === 'menger' ||
    objectType === 'clifford-torus' ||
    objectType === 'nested-torus'
  );
}

function canRenderEdges(_objectType: string): boolean {
  return true;
}

function isRaymarchedFractal(objectType: string, dimension: number): boolean {
  return (
    (objectType === 'mandelbrot' && dimension >= 3) ||
    (objectType === 'mandelbox' && dimension >= 3) ||
    (objectType === 'menger' && dimension >= 3)
  );
}

export const TopBarControls: React.FC = () => {
  const { addToast } = useToast();
  
  // Visual Store
  const {
    edgesVisible,
    facesVisible,
    setEdgesVisible,
    setFacesVisible,
  } = useAppearanceStore(
    useShallow((state) => ({
      edgesVisible: state.edgesVisible,
      facesVisible: state.facesVisible,
      setEdgesVisible: state.setEdgesVisible,
      setFacesVisible: state.setFacesVisible,
    }))
  );

  const {
    showPerfMonitor,
    setShowPerfMonitor
  } = useUIStore(
    useShallow((state) => ({
      showPerfMonitor: state.showPerfMonitor,
      setShowPerfMonitor: state.setShowPerfMonitor
    }))
  );

  // Geometry Store
  const { objectType, dimension } = useGeometryStore(
    useShallow((state) => ({
      objectType: state.objectType,
      dimension: state.dimension,
    }))
  );

  // Logic for Cinematic Mode
  const { isCinematicMode, toggleCinematicMode } = useLayoutStore(
    useShallow((state) => ({
      isCinematicMode: state.isCinematicMode,
      toggleCinematicMode: state.toggleCinematicMode,
    }))
  );

  // Local State
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Effects
  useEffect(() => {
      const handleFullscreenChange = () => {
          setIsFullscreen(!!document.fullscreenElement);
      };
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Logic for Render Modes (Edges/Faces)
  const previousFacesState = useRef(false);
  const previousEdgesState = useRef(false);

  const facesSupported = canRenderFaces(objectType);
  const edgesSupported = canRenderEdges(objectType);
  const isRaymarched = isRaymarchedFractal(objectType, dimension);

  const handleEdgeToggle = (visible: boolean) => {
    if (visible && isRaymarched) {
      setEdgesVisible(true);
      setFacesVisible(true);
    } else {
      setEdgesVisible(visible);
    }
  };

  const handleFaceToggle = (visible: boolean) => {
    if (!visible && isRaymarched && edgesVisible) {
      return;
    }
    setFacesVisible(visible);
  };

  useEffect(() => {
    if (!facesSupported && facesVisible) {
      previousFacesState.current = true;
      setFacesVisible(false);
    } else if (facesSupported && previousFacesState.current && !facesVisible) {
      setFacesVisible(true);
      previousFacesState.current = false;
    }
  }, [facesSupported, facesVisible, setFacesVisible]);

  useEffect(() => {
    if (!edgesSupported && edgesVisible) {
      previousEdgesState.current = true;
      setEdgesVisible(false);
    } else if (edgesSupported && previousEdgesState.current && !edgesVisible) {
      setEdgesVisible(true);
      previousEdgesState.current = false;
    }
  }, [edgesSupported, edgesVisible, setEdgesVisible]);

  useEffect(() => {
    if (isRaymarched && edgesVisible && !facesVisible) {
      setFacesVisible(true);
    }
  }, [isRaymarched, facesVisible, edgesVisible, setFacesVisible]);

  useEffect(() => {
    const noModeActive = !edgesVisible && !facesVisible;
    if (noModeActive) {
      setEdgesVisible(true);
    }
  }, [edgesVisible, facesVisible, setEdgesVisible]);

  const toggleCinematic = () => {
    if (isCinematicMode) {
        toggleCinematicMode();
    } else {
        toggleCinematicMode();
        useAnimationStore.getState().play();
        addToast('Cinematic Mode Enabled', 'info');
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
  };

  // Helper for Icon Buttons
  const IconButton = ({ 
    icon: Icon, 
    active, 
    onClick, 
    label,
    className = "" 
  }: { 
    icon: React.FC, 
    active: boolean, 
    onClick: () => void, 
    label: string,
    className?: string
  }) => (
    <button
      onClick={onClick}
      title={label}
      className={`
        p-1.5 rounded-md transition-all duration-300 border
        ${active
          ? 'bg-accent/20 text-accent border-accent/50 shadow-[0_0_10px_color-mix(in_oklch,var(--color-accent)_20%,transparent)]'
          : 'bg-transparent text-text-secondary border-transparent hover:text-text-primary hover:bg-white/5'
        }
        ${className}
      `}
      data-testid={`control-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <Icon />
    </button>
  );

  return (
    <div className="flex items-center gap-1 bg-black/20 p-1 rounded-lg border border-white/5 backdrop-blur-sm">
      {/* Render Mode Toggles */}
      <div className="flex gap-1 mr-2">
        <div title={!edgesSupported ? 'Edges not available' : undefined}>
            <ToggleButton
                pressed={edgesVisible}
                onToggle={handleEdgeToggle}
                ariaLabel="Toggle edges"
                disabled={!edgesSupported}
                className="!text-xs !py-1 !px-2"
            >
                Edges
            </ToggleButton>
        </div>
        <div title={!facesSupported ? 'Faces not available' : undefined}>
            <ToggleButton
                pressed={facesVisible}
                onToggle={handleFaceToggle}
                ariaLabel="Toggle faces"
                disabled={!facesSupported}
                className="!text-xs !py-1 !px-2"
            >
                Faces
            </ToggleButton>
        </div>
      </div>

      <div className="w-px h-4 bg-white/10 mx-1" />

      {/* App Controls */}
      <IconButton 
        icon={Icons.Perf} 
        active={showPerfMonitor} 
        onClick={() => setShowPerfMonitor(!showPerfMonitor)} 
        label="Performance Monitor" 
      />
      <IconButton 
        icon={Icons.Fullscreen} 
        active={isFullscreen} 
        onClick={toggleFullscreen} 
        label="Fullscreen" 
      />
      <IconButton 
        icon={Icons.Cinematic} 
        active={isCinematicMode} 
        onClick={toggleCinematic} 
        label="Cinematic Mode" 
      />
    </div>
  );
};