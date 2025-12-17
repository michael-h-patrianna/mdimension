import React from 'react';
import { m, HTMLMotionProps } from 'motion/react';

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "ref"> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  ariaLabel?: string;
  'data-testid'?: string;
  glow?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  onClick,
  disabled = false,
  className = '',
  type = 'button',
  ariaLabel,
  'data-testid': testId,
  glow = false,
  ...props
}) => {

  const baseStyles = 'relative overflow-hidden font-medium rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors';

  const variantStyles = {
    primary: 'bg-gradient-to-b from-accent to-[color-mix(in_oklch,var(--color-accent)_90%,black)] text-black shadow-[0_0_20px_color-mix(in_oklch,var(--color-accent)_20%,transparent),inset_0_1px_1px_rgba(255,255,255,0.3)] border border-white/10',
    secondary: 'bg-panel-bg border border-panel-border text-text-primary hover:bg-panel-border/80 shadow-sm backdrop-blur-sm',
    ghost: 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-white/5',
    danger: 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]'
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
    icon: 'p-2'
  };

  const glowStyle = glow ? 'shadow-[0_0_25px_var(--color-accent)] ring-1 ring-accent/50' : '';

  return (
    <m.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${glowStyle} ${className}`}
      aria-label={ariaLabel}
      data-testid={testId}
      whileHover={{ scale: disabled ? 1 : 1.02, filter: 'brightness(1.05)' }}
      whileTap={{ scale: disabled ? 1 : 0.96 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      {...props}
    >
      {/* Subtle shine effect on top for primary */}
      {variant === 'primary' && (
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-50" />
      )}
      {children}
    </m.button>
  );
};
