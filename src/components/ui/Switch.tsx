import React from 'react';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
  'data-testid'?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onCheckedChange,
  label,
  disabled = false,
  className = '',
  'data-testid': dataTestId,
}) => {
  return (
    <label
      className={`
        flex items-center gap-3 cursor-pointer select-none group
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
      data-testid={dataTestId}
    >
      <div className="relative isolate">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => !disabled && onCheckedChange(e.target.checked)}
          disabled={disabled}
          role="switch"
          aria-checked={checked}
        />
        {/* Track */}
        <div
          className={`
            w-10 h-6 rounded-full transition-colors duration-200 ease-in-out border
            ${checked 
              ? 'bg-accent border-accent' 
              : 'bg-panel-border border-panel-border group-hover:bg-panel-border/80'
            }
          `}
        />
        {/* Thumb */}
        <div
          className={`
            absolute top-1 left-1 w-4 h-4 rounded-full shadow transition-transform duration-200 ease-in-out
            ${checked ? 'translate-x-4 bg-white' : 'translate-x-0 bg-text-secondary'}
          `}
        />
      </div>
      {label && (
        <span className="text-sm font-medium text-text-secondary group-hover:text-text-primary transition-colors">
          {label}
        </span>
      )}
    </label>
  );
};
