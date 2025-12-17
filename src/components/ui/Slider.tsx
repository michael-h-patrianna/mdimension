import React, { useEffect, useId, useState } from 'react';
import { m, AnimatePresence } from 'motion/react';
import { soundManager } from '@/lib/audio/SoundManager';

export interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  onReset?: () => void;
  unit?: string;
  showValue?: boolean;
  className?: string;
  disabled?: boolean;
  minLabel?: string;
  maxLabel?: string;
  tooltip?: string;
  formatValue?: (value: number) => string;
  'data-testid'?: string;
}

export const Slider: React.FC<SliderProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  onReset,
  unit = '',
  showValue = true,
  className = '',
  disabled = false,
  tooltip,
  formatValue,
  'data-testid': dataTestId,
}) => {
  const id = useId();
  const percentage = max > min ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)) : 0;
  const decimals = step >= 1 ? 0 : Math.max(0, Math.ceil(-Math.log10(step)));
  
  const [inputValue, setInputValue] = useState(value.toString());
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isLabelDragging, setIsLabelDragging] = useState(false);

  useEffect(() => {
    setInputValue(value.toFixed(decimals));
  }, [value, decimals]);

  // Label Drag Logic
  const handleLabelMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    setIsLabelDragging(true);
    soundManager.playClick();
    e.preventDefault();
    document.body.style.cursor = 'ew-resize';
    
    const startX = e.clientX;
    const startValue = value;
    const range = max - min;
    const sensitivity = e.shiftKey ? 0.05 : 0.2; // Shift for precision

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      // Map pixels to value
      // Assume 200px = full range? No, use sensitivity.
      // 1px = 1% of range? 
      const change = delta * (range / 200) * sensitivity; // Arbitrary but usable scale
      let newValue = startValue + change;
      
      // Step snapping
      if (step) {
        newValue = Math.round(newValue / step) * step;
      }
      
      newValue = Math.min(Math.max(newValue, min), max);
      onChange(newValue);
    };

    const handleMouseUp = () => {
      setIsLabelDragging(false);
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    let newValue = parseFloat(inputValue);
    if (isNaN(newValue)) {
      newValue = value;
    } else {
      newValue = Math.min(Math.max(newValue, min), max);
    }
    onChange(newValue);
    setInputValue(newValue.toFixed(decimals));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleInputBlur();
      (e.target as HTMLInputElement).blur();
    }
  };
  
  const handleReset = () => {
    if (onReset) {
        onReset();
        soundManager.playSnap();
    }
  };

  const displayValue = formatValue ? formatValue(value) : value.toFixed(decimals);

  return (
    <div 
      className={`group/slider relative select-none ${className} ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
      onMouseEnter={() => { setIsHovered(true); soundManager.playHover(); }}
      onMouseLeave={() => setIsHovered(false)}
      data-testid={dataTestId}
    >
      {/* Header: Label and Value */}
      <div className="flex items-center justify-between mb-2 min-h-[1.25rem]">
        <label
          htmlFor={id}
          className={`
            text-[11px] font-medium transition-colors tracking-wide flex items-center gap-1
            ${isLabelDragging ? 'text-accent cursor-ew-resize' : 'text-text-secondary group-hover/slider:text-text-primary cursor-ew-resize'}
          `}
          title={tooltip || "Drag label to adjust value, Double-click to reset"}
          onMouseDown={handleLabelMouseDown}
          onDoubleClick={handleReset}
        >
          {label}
        </label>
        
        {showValue && (
          <div className="flex items-center gap-1.5 shrink-0 relative">
             {onReset && value !== min && (
              <button
                type="button"
                onClick={handleReset}
                disabled={disabled}
                className={`
                  text-[10px] text-accent transition-all duration-200 
                  ${isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'}
                `}
                title="Reset"
                aria-label="Reset value"
              >
                ↺
              </button>
            )}
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              className="
                glass-input
                w-[6ch] px-1 py-0.5 text-right font-mono text-[10px] h-auto
                focus:w-[8ch] transition-all duration-200
              "
              data-testid={dataTestId ? `${dataTestId}-input` : undefined}
            />
            {unit && <span className="text-[10px] text-text-tertiary font-medium">{unit}</span>}
          </div>
        )}
      </div>

      {/* Slider Track Area */}
      <div className="relative h-5 flex items-center touch-none">
        
        {/* Track Background */}
        <div className="absolute w-full h-[3px] bg-white/5 rounded-full overflow-hidden transition-colors duration-300 group-hover/slider:bg-white/10 backdrop-blur-sm shadow-inner">
           {/* Active Fill Track - Gradient */}
           <div
             className="h-full bg-gradient-to-r from-accent/50 to-accent shadow-[0_0_10px_var(--color-accent-glow)] opacity-80 group-hover/slider:opacity-100 transition-all duration-100 ease-out"
             style={{ width: `${percentage}%` }}
           />
        </div>

        {/* Native Input - Invisible but clickable */}
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          onMouseDown={() => { setIsDragging(true); soundManager.playClick(); }}
          onMouseUp={() => setIsDragging(false)}
          onTouchStart={() => { setIsDragging(true); soundManager.playClick(); }}
          onTouchEnd={() => setIsDragging(false)}
          disabled={disabled}
          className="absolute w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-20"
          style={{ WebkitAppearance: 'none' }}
          aria-label={label}
        />

        {/* Custom Thumb */}
        <div
          className={`
            absolute h-3.5 w-3.5 rounded-full 
            bg-background border border-accent 
            shadow-[0_0_12px_var(--color-accent-glow)] 
            pointer-events-none z-10 
            transition-transform duration-100 ease-out
            flex items-center justify-center
            ${isDragging || isLabelDragging ? 'scale-125 bg-accent' : 'scale-100'}
          `}
          style={{ left: `calc(${percentage}% - 7px)` }}
        >
           <div className={`w-1 h-1 rounded-full bg-white transition-opacity duration-200 ${isDragging || isHovered ? 'opacity-100' : 'opacity-50'}`} />
        </div>

        {/* Tooltip while dragging */}
        <AnimatePresence>
          {(isDragging || isLabelDragging) && (
             <m.div
               initial={{ opacity: 0, y: 10, scale: 0.8 }}
               animate={{ opacity: 1, y: -20, scale: 1 }}
               exit={{ opacity: 0, y: 10, scale: 0.8 }}
               className="absolute top-0 -translate-x-1/2 px-2 py-1 bg-black/90 backdrop-blur-xl border border-white/10 rounded text-[10px] font-mono text-accent pointer-events-none shadow-xl z-30"
               style={{ left: `${percentage}%` }}
             >
               {displayValue}{unit}
             </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
