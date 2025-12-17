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
            w-10 h-6 rounded-full border shadow-inner transition-colors duration-200
            ${checked ? 'bg-accent border-accent shadow-[0_0_15px_var(--color-accent)]' : 'bg-white/10 border-white/10'}
          `}
        />
        {/* Thumb */}
        <m.div
          layout
          transition={{
            type: "spring",
            stiffness: 500,
            damping: 30
          }}
          animate={{
            x: checked ? 20 : 4,
          }}
          className={`
            absolute top-1 left-0 w-4 h-4 rounded-full shadow-md z-10 transition-colors duration-200
            ${checked ? 'bg-white' : 'bg-text-secondary'}
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
