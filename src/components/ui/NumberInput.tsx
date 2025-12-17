import React, { useState, useEffect } from 'react';
import { Input, InputProps } from './Input';

export interface NumberInputProps extends Omit<InputProps, 'onChange' | 'value'> {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
}

export const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  precision = 3,
  onBlur,
  ...props
}) => {
  const [localValue, setLocalValue] = useState(value.toString());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only update local value if it's vastly different (to allow typing 1.0 without it snapping to 1)
    if (document.activeElement !== document.querySelector(`[value="${localValue}"]`)) {
       setLocalValue(Number(value).toFixed(precision).replace(/\.?0+$/, ''));
    }
  }, [value, precision]);

  const parseExpression = (expression: string): number | null => {
    try {
      // Basic safe math parser
      // Replace constants
      let expr = expression.toLowerCase()
        .replace(/pi/g, Math.PI.toString())
        .replace(/tau/g, (Math.PI * 2).toString())
        .replace(/e/g, Math.E.toString());
      
      // Basic arithmetic only for safety (no eval if possible, but for this demo eval is easiest)
      // We will allow: 0-9 . + - * / ( ) %
      if (!/^[0-9.+\-*/()% e\s]+$/.test(expr)) return null;

      // eslint-disable-next-line no-new-func
      const result = new Function(`return ${expr}`)();
      if (!isFinite(result) || isNaN(result)) return null;
      return result;
    } catch {
      return null;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
    setError(null);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const parsed = parseExpression(localValue);
    
    if (parsed !== null) {
      const clamped = Math.min(Math.max(parsed, min), max);
      onChange(clamped);
      setLocalValue(Number(clamped).toFixed(precision).replace(/\.?0+$/, ''));
    } else {
      // Revert or show error
      if (localValue.trim() === '') {
         // handle empty?
      } else {
         setError("Invalid expression");
         // Shake effect trigger via prop? Input handles error prop.
      }
    }
    
    if (onBlur) onBlur(e);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
    props.onKeyDown?.(e);
  };

  return (
    <Input
      {...props}
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      error={error || props.error}
      rightIcon={
        <div className="flex flex-col gap-[1px]">
           <button 
             className="h-2 w-3 hover:bg-white/20 rounded-sm flex items-center justify-center"
             onClick={() => onChange(Math.min(value + step, max))}
             tabIndex={-1}
           >
             <svg width="6" height="4" viewBox="0 0 8 4" fill="currentColor"><path d="M4 0L8 4H0L4 0Z"/></svg>
           </button>
           <button 
             className="h-2 w-3 hover:bg-white/20 rounded-sm flex items-center justify-center"
             onClick={() => onChange(Math.max(value - step, min))}
             tabIndex={-1}
           >
             <svg width="6" height="4" viewBox="0 0 8 4" fill="currentColor"><path d="M4 4L0 0H8L4 4Z"/></svg>
           </button>
        </div>
      }
    />
  );
};
