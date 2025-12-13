export interface ToggleOption<T extends string = string> {
  value: T;
  label: string;
}

export interface ToggleGroupProps<T extends string = string> {
  options: ToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
  'data-testid'?: string;
}

export const ToggleGroup = <T extends string = string>({
  options,
  value,
  onChange,
  className = '',
  disabled = false,
  ariaLabel,
  'data-testid': testId,
}: ToggleGroupProps<T>) => {
  return (
    <div
      className={`flex p-1 gap-1 bg-black/20 rounded-lg ${className}`}
      role="radiogroup"
      aria-label={ariaLabel}
      data-testid={testId}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            onClick={() => !disabled && onChange(option.value)}
            disabled={disabled}
            className={`
              flex-1 relative px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-300 border
              disabled:opacity-50 disabled:cursor-not-allowed
              ${isSelected
                ? 'bg-accent/20 text-accent border-accent/50 shadow-[0_0_10px_color-mix(in_oklch,var(--color-accent)_20%,transparent)]'
                : 'bg-panel-border text-text-secondary border-panel-border hover:text-text-primary hover:bg-panel-border/80'
              }
            `}
            role="radio"
            aria-checked={isSelected}
            data-testid={testId ? `${testId}-${option.value}` : undefined}
          >
            <span className="relative z-10">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
};
