import React from 'react';

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  ariaLabel?: string;
  'data-testid'?: string;
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
}) => {
  
  const baseStyles = 'relative overflow-hidden font-medium rounded-lg transition-all duration-300 focus:outline-hidden focus:ring-1 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed';

  const variantStyles = {
    primary: 'bg-accent text-black hover:bg-accent/90 shadow-[0_0_15px_color-mix(in_oklch,var(--color-accent)_40%,transparent)] hover:shadow-[0_0_25px_color-mix(in_oklch,var(--color-accent)_60%,transparent)]',
    secondary: 'bg-panel-bg border border-panel-border text-text-primary hover:bg-panel-border/50',
    ghost: 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-white/5',
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      aria-label={ariaLabel}
      data-testid={testId}
    >
      {children}
    </button>
  );
};
