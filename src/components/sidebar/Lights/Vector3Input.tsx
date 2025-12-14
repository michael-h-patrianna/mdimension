/**
 * Vector3 Input Component
 *
 * Provides X, Y, Z number inputs in a compact row format.
 * Used for light position and rotation inputs.
 */

import React, { memo, useCallback, useState, useEffect } from 'react';

export interface Vector3InputProps {
  label: string;
  value: [number, number, number];
  onChange: (value: [number, number, number]) => void;
  step?: number;
  /** Multiplier for display (e.g., 180/Math.PI for radians to degrees) */
  displayMultiplier?: number;
  /** Unit label (e.g., "deg") */
  unit?: string;
  className?: string;
}

export const Vector3Input: React.FC<Vector3InputProps> = memo(function Vector3Input({
  label,
  value,
  onChange,
  step = 0.1,
  displayMultiplier = 1,
  unit = '',
  className = '',
}) {
  // Local state for input values (allows typing intermediate values)
  const [localValues, setLocalValues] = useState<[string, string, string]>([
    (value[0] * displayMultiplier).toFixed(1),
    (value[1] * displayMultiplier).toFixed(1),
    (value[2] * displayMultiplier).toFixed(1),
  ]);

  // Update local values when prop value changes
  useEffect(() => {
    setLocalValues([
      (value[0] * displayMultiplier).toFixed(1),
      (value[1] * displayMultiplier).toFixed(1),
      (value[2] * displayMultiplier).toFixed(1),
    ]);
  }, [value, displayMultiplier]);

  const handleChange = useCallback(
    (index: number, inputValue: string) => {
      // Update local value immediately
      const newLocal = [...localValues] as [string, string, string];
      newLocal[index] = inputValue;
      setLocalValues(newLocal);

      // Parse and update if valid
      const parsed = parseFloat(inputValue);
      if (!isNaN(parsed)) {
        const newValue = [...value] as [number, number, number];
        newValue[index] = parsed / displayMultiplier;
        onChange(newValue);
      }
    },
    [value, onChange, displayMultiplier, localValues]
  );

  const handleBlur = useCallback(
    (index: 0 | 1 | 2) => {
      // Reset to actual value on blur if invalid
      const localValue = localValues[index];
      const parsed = parseFloat(localValue);
      if (isNaN(parsed)) {
        const newLocal = [...localValues] as [string, string, string];
        newLocal[index] = (value[index] * displayMultiplier).toFixed(1);
        setLocalValues(newLocal);
      }
    },
    [localValues, value, displayMultiplier]
  );

  const axes = ['X', 'Y', 'Z'] as const;
  const colors = ['text-red-400', 'text-green-400', 'text-blue-400'];

  return (
    <div className={`space-y-1 ${className}`}>
      <label className="block text-xs font-medium text-text-secondary">
        {label} {unit && <span className="text-text-tertiary">({unit})</span>}
      </label>
      <div className="flex gap-1">
        {axes.map((axis, i) => (
          <div key={axis} className="flex-1 relative">
            <span className={`absolute left-2 top-1/2 -translate-y-1/2 text-xs font-mono ${colors[i]}`}>
              {axis}
            </span>
            <input
              type="number"
              value={localValues[i]}
              onChange={(e) => handleChange(i, e.target.value)}
              onBlur={() => handleBlur(i as 0 | 1 | 2)}
              step={step * displayMultiplier}
              className="w-full pl-6 pr-2 py-1.5 text-xs font-mono bg-panel-border/50 border border-panel-border rounded text-text-primary focus:outline-none focus:border-accent"
              aria-label={`${label} ${axis}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
});
