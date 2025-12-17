import React from 'react';
import { m, HTMLMotionProps } from 'motion/react';
import { LoadingSpinner } from './LoadingSpinner';

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "ref"> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  children: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
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
  loading = false,
  className = '',
  type = 'button',
  ariaLabel,
  'data-testid': testId,
  glow = false,
  ...props
}) => {

  const baseStyles = 'relative overflow-hidden font-medium rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors gap-2';

  // We rely on our new CSS utilities for the heavy lifting of gradients and shadows
  const variantStyles = {
    primary: 'glass-button-primary text-white',
    secondary: 'glass-button text-text-primary',
    ghost: 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-white/5 border border-transparent hover:border-white/5',
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
      onClick={!loading ? onClick : undefined}
      disabled={disabled || loading}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${glowStyle} ${className}`}
      aria-label={ariaLabel}
      data-testid={testId}
      whileHover={!disabled && !loading ? { scale: 1.02, y: -1, filter: 'brightness(1.1)' } : undefined}
      whileTap={!disabled && !loading ? { scale: 0.96, y: 0 } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      {...props}
    >
      {/* Loading State Overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-inherit backdrop-blur-[1px]">
          <LoadingSpinner size={size === 'sm' ? 12 : 16} />
        </div>
      )}
      
      {/* Content - faded when loading */}
      <div className={`flex items-center justify-center gap-2 ${loading ? 'opacity-0' : 'opacity-100'} transition-opacity`}>
        {children}
      </div>

      {/* Subtle shine effect on top for primary (kept for extra pop) */}
      {variant === 'primary' && (
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-50 pointer-events-none" />
      )}
    </m.button>
  );
};
