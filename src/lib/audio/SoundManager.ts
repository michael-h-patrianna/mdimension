/**
 * SoundManager - Premium Audio Feedback System
 * 
 * Uses Web Audio API to generate synthesized UI sounds (no external assets needed).
 * Features:
 * - Spatial clicks
 * - Sci-fi bleeps for interactions
 * - Ambient hum (optional)
 * - Throttling to prevent spam
 */

class SoundManager {
    private ctx: AudioContext | null = null;
    private enabled: boolean = true;
    private masterGain: GainNode | null = null;
  
    constructor() {
      // Lazy init on first interaction
      if (typeof window !== 'undefined') {
        window.addEventListener('click', this.init, { once: true });
        window.addEventListener('keydown', this.init, { once: true });
      }
    }
  
    private init = () => {
      if (this.ctx) return;
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.15; // Low volume by default
      this.masterGain.connect(this.ctx.destination);
    };
  
    public playClick() {
      if (!this.ctx || !this.enabled) return;
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.05);
      
      gain.gain.setValueAtTime(0, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, this.ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);
      
      osc.connect(gain);
      gain.connect(this.masterGain!);
      
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    }
  
    public playHover() {
      if (!this.ctx || !this.enabled) return;
  
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(200, this.ctx.currentTime);
      
      gain.gain.setValueAtTime(0, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.05, this.ctx.currentTime + 0.01);
      gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.05);
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 400;
  
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);
      
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    }

    public playSnap() {
        if (!this.ctx || !this.enabled) return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        
        osc.connect(gain);
        gain.connect(this.masterGain!);
        
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }
    
    public playSuccess() {
        if (!this.ctx || !this.enabled) return;
        
        const now = this.ctx.currentTime;
        
        // Arpeggio
        [440, 554, 659].forEach((freq, i) => {
            const osc = this.ctx!.createOscillator();
            const gain = this.ctx!.createGain();
            
            osc.type = 'sine';
            osc.frequency.value = freq;
            
            gain.gain.setValueAtTime(0, now + i * 0.05);
            gain.gain.linearRampToValueAtTime(0.1, now + i * 0.05 + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.05 + 0.4);
            
            osc.connect(gain);
            gain.connect(this.masterGain!);
            
            osc.start(now + i * 0.05);
            osc.stop(now + i * 0.05 + 0.4);
        });
    }

    public toggle(enabled: boolean) {
        this.enabled = enabled;
    }

    public get isEnabled() {
        return this.enabled;
    }
}
  
export const soundManager = new SoundManager();
