import React from 'react';
import { motion, HTMLMotionProps } from 'motion/react';

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

  const baseStyles = 'relative overflow-hidden font-medium rounded-lg focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center';

  const variantStyles = {
    primary: 'bg-accent text-black shadow-[0_0_15px_color-mix(in_oklch,var(--color-accent)_40%,transparent)]',
    secondary: 'bg-panel-bg border border-panel-border text-text-primary hover:bg-panel-border/50',
    ghost: 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-white/5',
    danger: 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30'
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
    icon: 'p-2'
  };

  const glowStyle = glow ? 'shadow-[0_0_20px_var(--color-accent)]' : '';

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${glowStyle} ${className}`}
      aria-label={ariaLabel}
      data-testid={testId}
      whileHover={{ scale: disabled ? 1 : 1.02, filter: 'brightness(1.1)' }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      {...props}
    >
      {children}
    </motion.button>
  );
};
