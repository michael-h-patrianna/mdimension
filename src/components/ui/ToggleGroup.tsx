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
      className={`flex p-1 bg-black/20 rounded-lg  ${className}`}
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
              flex-1 relative px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-300
              disabled:opacity-50 disabled:cursor-not-allowed bg-panel-border
              ${isSelected ? 'text-accent' : 'text-text-secondary hover:text-text-primary'}
            `}
            role="radio"
            aria-checked={isSelected}
            data-testid={testId ? `${testId}-${option.value}` : undefined}
          >
            {isSelected && (
              <div className="absolute inset-0 bg-white/5 rounded-md border border-white/5 shadow-inner" />
            )}
            <span className="relative z-10">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
};
