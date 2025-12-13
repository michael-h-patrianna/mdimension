import { useState } from 'react';
import { Envelope } from './Envelope';
import { Knob } from './Knob';

export const KnobEnvelopeDemo = () => {
  const [adsr, setAdsr] = useState({
    delay: 0,
    attack: 0.2,
    hold: 0.1,
    decay: 0.3,
    sustain: 0.5,
    release: 0.4
  });

  const update = (key: keyof typeof adsr) => (val: number) => {
    setAdsr(prev => ({ ...prev, [key]: val }));
  };

  return (
    <div className="p-8 bg-black/90 space-y-8 rounded-xl border border-white/10 w-full max-w-2xl mx-auto">
      <div className="flex justify-between items-center">
        <h2 className="text-xl text-white font-mono">Envelope Generator</h2>
        <div className="text-xs text-white/50">AHDSR Mode</div>
      </div>

      <div className="bg-black/50 p-4 rounded-lg border border-white/5 h-48 flex items-center justify-center">
        <Envelope
          mode="AHDSR"
          {...adsr}
          height="100%"
        />
      </div>

      <div className="grid grid-cols-6 gap-4">
        <Knob
          label="Delay"
          value={adsr.delay}
          min={0} max={2} step={0.01}
          onChange={update('delay')}
          size={50}
        />
        <Knob
          label="Attack"
          value={adsr.attack}
          min={0.01} max={2} step={0.01}
          onChange={update('attack')}
          size={50}
        />
        <Knob
          label="Hold"
          value={adsr.hold}
          min={0} max={2} step={0.01}
          onChange={update('hold')}
          size={50}
        />
        <Knob
          label="Decay"
          value={adsr.decay}
          min={0} max={2} step={0.01}
          onChange={update('decay')}
          size={50}
        />
        <Knob
          label="Sustain"
          value={adsr.sustain}
          min={0} max={1} step={0.01}
          onChange={update('sustain')}
          size={50}
        />
        <Knob
          label="Release"
          value={adsr.release}
          min={0.01} max={5} step={0.01}
          onChange={update('release')}
          size={50}
        />
      </div>
    </div>
  );
};
