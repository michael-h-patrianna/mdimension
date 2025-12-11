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
  'data-testid'?: string;
}

export const ToggleGroup: React.FC<ToggleGroupProps> = ({
  options,
  value,
  onChange,
  className = '',
  disabled = false,
  ariaLabel,
  'data-testid': testId,
}) => {
  return (
    <div
      className={`inline-flex items-center gap-1 p-1 bg-panel-bg border border-panel-border rounded-lg ${className}`}
      role="radiogroup"
      aria-label={ariaLabel}
      data-testid={testId}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => !disabled && onChange(option.value)}
            disabled={disabled}
            className={`
              px-4 py-2 text-sm font-medium rounded-md transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-accent-cyan focus:ring-offset-2 focus:ring-offset-panel-bg
              disabled:opacity-50 disabled:cursor-not-allowed
              ${isSelected
                ? 'bg-accent-cyan text-app-bg shadow-md'
                : 'bg-transparent text-text-primary hover:bg-panel-border active:bg-panel-border/80'
              }
            `}
            role="radio"
            aria-checked={isSelected}
            aria-label={option.label}
            data-testid={testId ? `${testId}-${option.value}` : undefined}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};
