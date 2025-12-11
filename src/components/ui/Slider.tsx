import React, { useRef } from 'react';

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
}) => {
  const sliderRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value));
  };

  const handleDoubleClick = () => {
    if (onReset && !disabled) {
      onReset();
    }
  };

  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-text-primary">
          {label}
        </label>
        {showValue && (
          <span
            className="px-2 py-0.5 text-xs font-mono bg-accent-cyan/20 text-accent-cyan rounded cursor-pointer select-none"
            onDoubleClick={handleDoubleClick}
            title={onReset ? 'Double-click to reset' : undefined}
          >
            {value.toFixed(step < 1 ? 2 : 0)}
            {unit}
          </span>
        )}
      </div>
      <div className="relative">
        <input
          ref={sliderRef}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          className="slider w-full h-2 bg-panel-border rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-accent-cyan focus:ring-offset-2 focus:ring-offset-panel-bg"
          style={{
            background: `linear-gradient(to right, #00D4FF 0%, #00D4FF ${percentage}%, #2A2A4E ${percentage}%, #2A2A4E 100%)`,
          }}
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-text-secondary">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
};
