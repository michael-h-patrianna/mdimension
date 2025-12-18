import React from 'react';
import { ControlGroup } from '@/components/ui/ControlGroup';
import { BloomControls } from './BloomControls';
import { BokehControls } from './BokehControls';
import { CinematicControls } from './CinematicControls';
import { MiscControls } from './MiscControls';
import { RefractionControls } from './RefractionControls';
import { SSRControls } from './SSRControls';
import { Switch } from '@/components/ui/Switch';
import { usePostProcessingStore } from '@/stores/postProcessingStore';
import { useShallow } from 'zustand/react/shallow';

export const PostProcessingControls: React.FC = () => {
  const {
    bloomEnabled, setBloomEnabled,
    cinematicEnabled, setCinematicEnabled,
    bokehEnabled, setBokehEnabled,
    ssrEnabled, setSsrEnabled,
    refractionEnabled, setRefractionEnabled,
  } = usePostProcessingStore(
    useShallow((state) => ({
      bloomEnabled: state.bloomEnabled,
      setBloomEnabled: state.setBloomEnabled,
      cinematicEnabled: state.cinematicEnabled,
      setCinematicEnabled: state.setCinematicEnabled,
      bokehEnabled: state.bokehEnabled,
      setBokehEnabled: state.setBokehEnabled,
      ssrEnabled: state.ssrEnabled,
      setSsrEnabled: state.setSsrEnabled,
      refractionEnabled: state.refractionEnabled,
      setRefractionEnabled: state.setRefractionEnabled,
    }))
  );

  return (
    <div className="space-y-4">
      {/* Bloom */}
      <ControlGroup 
        title="Bloom" 
        collapsible 
        defaultOpen={bloomEnabled}
        rightElement={
            <Switch checked={bloomEnabled} onCheckedChange={setBloomEnabled} />
        }
      >
        <div className={!bloomEnabled ? 'opacity-50 pointer-events-none' : ''}>
            <BloomControls />
        </div>
      </ControlGroup>

      {/* Cinematic */}
      <ControlGroup 
        title="Cinematic" 
        collapsible 
        defaultOpen={cinematicEnabled}
        rightElement={
            <Switch checked={cinematicEnabled} onCheckedChange={setCinematicEnabled} />
        }
      >
        <div className={!cinematicEnabled ? 'opacity-50 pointer-events-none' : ''}>
            <CinematicControls />
        </div>
      </ControlGroup>

      {/* Bokeh / DoF */}
      <ControlGroup 
        title="Depth of Field" 
        collapsible 
        defaultOpen={bokehEnabled}
        rightElement={
            <Switch checked={bokehEnabled} onCheckedChange={setBokehEnabled} />
        }
      >
        <div className={!bokehEnabled ? 'opacity-50 pointer-events-none' : ''}>
            <BokehControls />
        </div>
      </ControlGroup>

      {/* SSR */}
      <ControlGroup 
        title="Reflections (SSR)" 
        collapsible 
        defaultOpen={ssrEnabled}
        rightElement={
            <Switch checked={ssrEnabled} onCheckedChange={setSsrEnabled} />
        }
      >
        <div className={!ssrEnabled ? 'opacity-50 pointer-events-none' : ''}>
            <SSRControls />
        </div>
      </ControlGroup>

      {/* Refraction */}
      <ControlGroup 
        title="Refraction" 
        collapsible 
        defaultOpen={refractionEnabled}
        rightElement={
            <Switch checked={refractionEnabled} onCheckedChange={setRefractionEnabled} />
        }
      >
        <div className={!refractionEnabled ? 'opacity-50 pointer-events-none' : ''}>
            <RefractionControls />
        </div>
      </ControlGroup>

      {/* Misc */}
      <ControlGroup title="Misc" collapsible defaultOpen={false}>
        <MiscControls />
      </ControlGroup>
    </div>
  );
};
