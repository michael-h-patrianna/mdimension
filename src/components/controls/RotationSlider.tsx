/**
 * Individual rotation slider component
 * Displays a slider for a single rotation plane with degree display
 */

import { useCallback, memo, type ChangeEvent } from 'react';

interface RotationSliderProps {
  plane: string; // e.g., "XY"
  value: number; // in radians
  onChange: (value: number) => void;
  onReset: () => void;
  axisBadgeColor: string; // e.g., "blue", "purple", "orange", "green"
}

/**
 * Converts radians to degrees
 */
function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Converts degrees to radians
 */
function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Gets Tailwind badge color classes based on axis type
 */
function getBadgeColorClasses(color: string): string {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500 text-white',
    purple: 'bg-purple-500 text-white',
    orange: 'bg-orange-500 text-white',
    green: 'bg-green-500 text-white',
  };
  return colorMap[color] || 'bg-gray-500 text-white';
}

export const RotationSlider = memo(function RotationSlider({
  plane,
  value,
  onChange,
  onReset,
  axisBadgeColor,
}: RotationSliderProps) {
  const degrees = radiansToDegrees(value);

  const handleSliderChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const newDegrees = parseFloat(e.target.value);
      const newRadians = degreesToRadians(newDegrees);
      onChange(newRadians);
    },
    [onChange]
  );

  const handleDoubleClick = useCallback(() => {
    onReset();
  }, [onReset]);

  return (
    <div className="flex items-center gap-3 py-2">
      {/* Plane label badge */}
      <div
        className={`px-2 py-1 rounded text-xs font-semibold min-w-[3rem] text-center ${getBadgeColorClasses(
          axisBadgeColor
        )}`}
      >
        {plane}
      </div>

      {/* Slider container */}
      <div className="flex-1 relative">
        <input
          type="range"
          min="0"
          max="360"
          step="1"
          value={degrees}
          onChange={handleSliderChange}
          onDoubleClick={handleDoubleClick}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-cyan"
          style={{
            background: `linear-gradient(to right, #00FFFF 0%, #00FFFF ${(degrees / 360) * 100}%, #374151 ${(degrees / 360) * 100}%, #374151 100%)`,
          }}
        />
      </div>

      {/* Degree value badge */}
      <div className="px-3 py-1 bg-gray-800 rounded text-sm font-mono min-w-[4rem] text-center text-cyan-400">
        {Math.round(degrees)}°
      </div>
    </div>
  );
});
