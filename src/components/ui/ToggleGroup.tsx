import React from 'react';

export interface ToggleOption {
  value: string;
  label: string;
}

export interface ToggleGroupProps {
  options: ToggleOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

export const ToggleGroup: React.FC<ToggleGroupProps> = ({
  options,
  value,
  onChange,
  className = '',
  disabled = false,
  ariaLabel,
}) => {
  return (
    <div
      className={`flex p-1 bg-black/20 rounded-lg  ${className}`}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            onClick={() => !disabled && onChange(option.value)}
            disabled={disabled}
            className={`
              flex-1 relative px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-300
              disabled:opacity-50 disabled:cursor-not-allowed
              ${isSelected ? 'text-accent' : 'text-text-secondary hover:text-text-primary'}
            `}
            role="radio"
            aria-checked={isSelected}
          >
            {isSelected && (
              <div className="absolute inset-0 bg-white/5 rounded-md border border-white/5 shadow-inner" />
            )}
            <span className="relative z-10">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
};
