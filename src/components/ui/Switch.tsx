import React from 'react';
import { m } from 'motion/react';

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
        flex items-center gap-3 cursor-pointer select-none group/switch relative
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
            w-9 h-5 rounded-full border transition-all duration-300 ease-out
            ${checked 
              ? 'bg-accent border-accent/50 shadow-[0_0_12px_var(--color-accent-glow)]' 
              : 'bg-white/5 border-white/10 group-hover/switch:bg-white/10'
            }
          `}
        />

        {/* Thumb */}
        <m.div
          layout
          transition={{
            type: "spring",
            stiffness: 700,
            damping: 30
          }}
          animate={{
            x: checked ? 18 : 3,
          }}
          className={`
            absolute top-1 left-0 w-3 h-3 rounded-full shadow-sm z-10 
            transition-colors duration-200 pointer-events-none
            ${checked ? 'bg-white' : 'bg-text-secondary group-hover/switch:bg-text-primary'}
          `}
        />
      </div>
      
      {label && (
        <span className="text-xs font-medium text-text-secondary group-hover/switch:text-text-primary transition-colors tracking-wide">
          {label}
        </span>
      )}
    </label>
  );
};
