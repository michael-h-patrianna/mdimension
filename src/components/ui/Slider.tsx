import React, { useId } from 'react';

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
  minLabel,
  maxLabel,
}) => {
  const id = useId();
  const percentage = max > min ? ((value - min) / (max - min)) * 100 : 0;

  // Determine decimal places based on step
  const decimals = step < 1 ? 2 : 0;

  return (
    <div className={`group ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <label 
          htmlFor={id}
          className="text-xs font-medium text-text-secondary group-hover:text-text-primary transition-colors cursor-pointer"
        >
          {label}
        </label>
        {showValue && (
          <button
            type="button"
            onDoubleClick={onReset}
            disabled={disabled || !onReset}
            className="text-[10px] font-mono text-accent bg-accent/10 px-1.5 py-0.5 rounded border border-accent/20 hover:bg-accent/20 transition-colors disabled:opacity-50 disabled:cursor-default"
            title={onReset ? 'Double-click to reset' : undefined}
          >
            {value.toFixed(decimals)}{unit}
          </button>
        )}
      </div>
      
      <div className="relative h-4 flex items-center">
        {/* Track Background */}
        <div className="absolute w-full h-1 bg-white/10 rounded-full overflow-hidden">
           {/* Fill Track */}
           <div 
             className="h-full bg-accent shadow-[0_0_10px_var(--color-accent)]" 
             style={{ width: `${percentage}%` }}
           />
        </div>

        {/* Thumb (Invisible native input on top) */}
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className="absolute w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
        />
        
        {/* Custom Thumb Indicator */}
        <div 
          className="absolute h-3 w-3 bg-white rounded-full shadow-[0_0_10px_var(--color-accent)] pointer-events-none transition-transform duration-100 ease-out group-hover:scale-125"
          style={{ left: `calc(${percentage}% - 6px)` }}
        />
      </div>

      {/* Min/Max Labels */}
      <div className="flex justify-between mt-1 px-1">
        <span className="text-[10px] text-text-tertiary select-none">{minLabel ?? `${min}${unit}`}</span>
        <span className="text-[10px] text-text-tertiary select-none">{maxLabel ?? `${max}${unit}`}</span>
      </div>
    </div>
  );
};