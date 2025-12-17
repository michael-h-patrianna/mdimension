import React, { useEffect, useId, useState } from 'react';

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
  /** Tooltip text shown on hover (currently display via title attribute) */
  tooltip?: string;
  /** Custom value formatter function (overrides default formatting) */
  formatValue?: (value: number) => string;
  /** Test ID for E2E testing */
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
  minLabel,
  maxLabel,
  tooltip,
  'data-testid': dataTestId,
}) => {
  const id = useId();
  const percentage = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const decimals = step >= 1 ? 0 : Math.max(0, Math.ceil(-Math.log10(step)));
  
  // Local state for input interaction
  const [inputValue, setInputValue] = useState(value.toString());
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setInputValue(value.toFixed(decimals));
  }, [value, decimals]);

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

  return (
    <div 
      className={`group/slider relative ${className} ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-testid={dataTestId}
    >
      {/* Header: Label and Value */}
      <div className="flex items-center justify-between mb-1.5 min-h-[1.25rem]">
        <label
          htmlFor={id}
          className="text-[11px] font-medium text-text-secondary group-hover/slider:text-text-primary transition-colors cursor-pointer select-none tracking-wide"
          title={tooltip}
        >
          {label}
        </label>
        
        {showValue && (
          <div className="flex items-center gap-1.5 shrink-0">
             {onReset && value !== min && ( // Only show reset if changed from min/default - simplification for UI cleanliness
              <button
                type="button"
                onClick={onReset}
                disabled={disabled}
                className={`
                  text-[10px] text-accent transition-all duration-200 
                  ${isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'}
                `}
                title="Reset to default"
                aria-label="Reset value"
                data-testid={dataTestId ? `${dataTestId}-reset` : undefined}
              >
                reset
              </button>
            )}
            <input
              type="number"
              value={inputValue}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              onKeyDown={handleKeyDown}
              step={step}
              min={min}
              max={max}
              disabled={disabled}
              className="
                bg-transparent border-none p-0 text-[11px] font-mono font-medium text-right text-accent 
                w-[6ch] focus:ring-0 focus:outline-none focus:text-text-primary
                selection:bg-accent/30 selection:text-white
                [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
              "
              data-testid={dataTestId ? `${dataTestId}-input` : undefined}
            />
            {unit && <span className="text-[10px] text-text-tertiary font-medium select-none">{unit}</span>}
          </div>
        )}
      </div>

      {/* Slider Track Area */}
      <div className="relative h-5 flex items-center select-none touch-none">
        
        {/* Track Background - Glassy & Thin */}
        <div className="absolute w-full h-[2px] bg-white/10 rounded-full overflow-hidden transition-colors duration-300 group-hover/slider:bg-white/15">
           {/* Active Fill Track */}
           <div
             className="h-full bg-accent shadow-[0_0_8px_var(--color-accent)] opacity-80 group-hover/slider:opacity-100 transition-all duration-100 ease-out"
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
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          onTouchStart={() => setIsDragging(true)}
          onTouchEnd={() => setIsDragging(false)}
          disabled={disabled}
          className="absolute w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-20"
          style={{ WebkitAppearance: 'none' }}
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          data-testid={dataTestId ? `${dataTestId}-slider` : undefined}
        />

        {/* Custom Thumb - The "Jewel" */}
        <div
          className={`
            absolute h-3 w-3 rounded-full 
            bg-background border border-accent 
            shadow-[0_0_10px_var(--color-accent-glow)] 
            pointer-events-none z-10 
            transition-transform duration-100 ease-out
            flex items-center justify-center
            ${isDragging || isHovered ? 'scale-125 bg-accent' : 'scale-100'}
          `}
          style={{ left: `calc(${percentage}% - 6px)` }}
        >
          {/* Inner Dot (visible when not filled) */}
           <div className={`w-1 h-1 rounded-full bg-white transition-opacity duration-200 ${isDragging || isHovered ? 'opacity-100' : 'opacity-0'}`} />
        </div>
      </div>

      {/* Min/Max Labels (Optional - often clutter but good for scale context) */}
      {(minLabel || maxLabel) && (
        <div className="flex justify-between -mt-1 px-0.5 opacity-0 group-hover/slider:opacity-40 transition-opacity duration-300">
          <span className="text-[9px] text-text-tertiary font-mono">{minLabel}</span>
          <span className="text-[9px] text-text-tertiary font-mono">{maxLabel}</span>
        </div>
      )}
    </div>
  );
};
