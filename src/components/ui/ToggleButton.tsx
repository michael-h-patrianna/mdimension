import React from 'react';

export interface ToggleButtonProps extends Omit<React.ComponentPropsWithoutRef<'button'>, 'onToggle'> {
  pressed: boolean;
  onToggle: (pressed: boolean) => void;
  ariaLabel: string;
  className?: string;
  children: React.ReactNode;
}

export const ToggleButton = React.forwardRef<HTMLButtonElement, ToggleButtonProps>(
  ({ pressed, onToggle, ariaLabel, className = '', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        aria-pressed={pressed}
        onClick={() => onToggle(!pressed)}
        className={`
          px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-300 border
          ${pressed
            ? 'bg-accent/20 text-accent border-accent/50 shadow-[0_0_10px_color-mix(in_oklch,var(--color-accent)_20%,transparent)]'
            : 'bg-panel-border text-text-secondary border-panel-border hover:text-text-primary hover:bg-panel-border/80'
          }
          ${className}
        `}
        aria-label={ariaLabel}
        {...props}
      >
        {children}
      </button>
    );
  }
);

ToggleButton.displayName = 'ToggleButton';
