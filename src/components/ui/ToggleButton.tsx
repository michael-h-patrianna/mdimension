import React from 'react';

export interface ToggleButtonProps {
  pressed: boolean;
  onToggle: (pressed: boolean) => void;
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

export const ToggleButton: React.FC<ToggleButtonProps> = ({
  pressed,
  onToggle,
  children,
  className = '',
  ariaLabel,
  disabled = false,
}) => {
  return (
    <button
      onClick={() => !disabled && onToggle(!pressed)}
      disabled={disabled}
      className={`
        flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors border
        ${pressed
          ? 'bg-accent/20 text-accent border-accent/50 shadow-[0_0_10px_rgb(var(--color-accent)/0.2)]'
          : 'bg-panel-border text-text-secondary border-panel-border hover:text-text-primary hover:bg-panel-border/80'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      aria-pressed={pressed}
      aria-label={ariaLabel}
      type="button"
    >
      {children}
    </button>
  );
};
