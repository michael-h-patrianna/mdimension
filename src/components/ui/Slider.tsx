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

  // Determine decimal places based on step
  const decimals = step >= 1 ? 0 : Math.max(0, Math.ceil(-Math.log10(step)));

  // Local state for input to allow typing without jitter
  const [inputValue, setInputValue] = useState(value.toString());

  useEffect(() => {
    setInputValue(value.toFixed(decimals));
  }, [value, decimals]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only update local display state - propagate on blur or Enter
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
    <div className={`group ${className}`} data-testid={dataTestId}>
      <div className="flex items-center justify-between mb-2">
        <label
          htmlFor={id}
          className="text-xs font-medium text-text-secondary group-hover:text-text-primary transition-colors cursor-pointer select-none"
          title={tooltip}
        >
          {label}
        </label>
        {showValue && (
          <div className="flex items-center gap-1 shrink-0">
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
              className="glass-input min-w-[3.5ch] px-1.5 py-0.5 text-[10px] font-mono text-right text-accent rounded transition-all appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:w-[5ch]"
              data-testid={dataTestId ? `${dataTestId}-input` : undefined}
            />
            {onReset && (
              <button
                type="button"
                onClick={onReset}
                disabled={disabled}
                className="text-[10px] text-text-tertiary hover:text-accent transition-colors opacity-0 group-hover:opacity-100"
                title="Reset to default"
                data-testid={dataTestId ? `${dataTestId}-reset` : undefined}
              >
                ↺
              </button>
            )}
          </div>
        )}
      </div>

      {/* Increased hit area for better touch/click interaction */}
      <div className="relative h-6 flex items-center select-none touch-none">
        {/* Track Background */}
        <div className="absolute w-full h-1.5 bg-black/40 rounded-full overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] border-b border-white/5">
           {/* Fill Track */}
           <div
             className="h-full bg-accent opacity-90 transition-all duration-75 ease-out shadow-[0_0_10px_var(--color-accent)]"
             style={{ width: `${percentage}%` }}
           />
        </div>

        {/* Thumb (Invisible native input on top) - Full height for easier clicking */}
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          onDragStart={(e) => e.preventDefault()}
          onMouseDown={(e) => e.stopPropagation()}
          disabled={disabled}
          className="absolute w-full h-full opacity-0 cursor-ew-resize disabled:cursor-not-allowed z-10"
          style={{ WebkitAppearance: 'none' }}
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          data-testid={dataTestId ? `${dataTestId}-slider` : undefined}
        />

        {/* Custom Thumb Indicator - Larger visual target */}
        <div
          className="absolute h-3.5 w-3.5 bg-white rounded-full shadow-[0_0_10px_var(--color-accent),0_2px_4px_rgba(0,0,0,0.5)] pointer-events-none transition-transform duration-100 ease-out group-hover:scale-125 z-0 flex items-center justify-center ring-2 ring-accent/30"
          style={{ left: `calc(${percentage}% - 7px)` }}
        >
          <div className="w-1 h-1 bg-accent rounded-full opacity-50" />
        </div>
      </div>

      {/* Min/Max Labels */}
      <div className="flex justify-between mt-0.5 px-1 opacity-50 group-hover:opacity-100 transition-opacity">
        <span className="text-[9px] text-text-tertiary select-none font-mono tracking-tight">{minLabel ?? `${min}${unit}`}</span>
        <span className="text-[9px] text-text-tertiary select-none font-mono tracking-tight">{maxLabel ?? `${max}${unit}`}</span>
      </div>
    </div>
  );
};
