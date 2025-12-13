import { motion, PanInfo } from 'motion/react';
import React, { useCallback, useId } from 'react';

export interface KnobProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  label?: string;
  size?: number;
  className?: string;
  sensitivity?: number;
}

export const Knob: React.FC<KnobProps> = ({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  label,
  size = 64,
  className = '',
  sensitivity = 1, // Value change per pixel (approx)
}) => {
  const id = useId();

  // Constants for visual representation
  const minRotation = -145; // degrees
  const maxRotation = 145;

  // Normalize value to 0-1 range for visual rotation
  const normalizedValue = (Math.min(Math.max(value, min), max) - min) / (max - min);
  const rotation = minRotation + normalizedValue * (maxRotation - minRotation);

  // Calculate arc path
  const radius = 18;
  const center = 20;

  const valueAngle = (rotation - 90) * (Math.PI / 180);
  const startAngle = (minRotation - 90) * (Math.PI / 180);

  // Helper to get coordinates on circle
  const getCoords = (angle: number, r: number) => ({
    x: center + r * Math.cos(angle),
    y: center + r * Math.sin(angle)
  });

  const startPoint = getCoords(startAngle, radius);
  const endPoint = getCoords(valueAngle, radius);

  const largeArcFlag = valueAngle - startAngle <= Math.PI ? 0 : 1;

  const indicatorPath = `M ${startPoint.x} ${startPoint.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endPoint.x} ${endPoint.y}`;

  // Pan Handler (Motion)
  const handlePan = useCallback((_: PointerEvent, info: PanInfo) => {
    // Negative deltaY means moving up, which should increase value
    const deltaY = -info.delta.y;

    // Scale delta.
    // sensitivity determines how "fast" it moves.
    // Range = max - min.
    // 100 pixels drag = full range?
    const range = max - min;
    const pixelRange = 200; // Pixels to traverse full range
    const change = (deltaY / pixelRange) * range * sensitivity;

    let newValue = value + change;

    // Clamp
    newValue = Math.min(Math.max(newValue, min), max);

    // Step
    if (step) {
      newValue = Math.round(newValue / step) * step;
    }

    if (newValue !== value) {
      onChange(newValue);
    }
  }, [value, min, max, step, onChange, sensitivity]);

  // Double click reset
  const handleDoubleClick = useCallback(() => {
    onChange(min);
  }, [min, onChange]);

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <motion.div
        className={`relative select-none touch-none outline-hidden group cursor-grab active:cursor-grabbing`}
        style={{ width: size, height: size }}
        onPan={handlePan}
        onDoubleClick={handleDoubleClick}
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowRight') onChange(Math.min(value + step, max));
          if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') onChange(Math.max(value - step, min));
        }}
        whileTap={{ scale: 0.95 }}
      >
        <svg viewBox="0 0 40 40" className="w-full h-full overflow-visible">
          <defs>
            <filter id={`glow-${id}`}>
              <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Soft Shadow Gradient (Radial) */}
            <radialGradient id={`shadow-grad-${id}`} cx="0.5" cy="0.5" r="0.5">
               <stop offset="85%" stopColor="var(--color-background)" stopOpacity="0.4" />
               <stop offset="100%" stopColor="var(--color-background)" stopOpacity="0" />
            </radialGradient>

            {/* Base Body Gradient (Linear Vertical) */}
            <linearGradient id={`body-grad-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-text-secondary)" stopOpacity="0.3"/>
              <stop offset="100%" stopColor="var(--color-background)" stopOpacity="1"/>
            </linearGradient>

            {/* Highlight Gradient (Linear Vertical for reflection) */}
             <linearGradient id={`highlight-grad-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="white" stopOpacity="0.3"/>
              <stop offset="40%" stopColor="white" stopOpacity="0"/>
              <stop offset="100%" stopColor="white" stopOpacity="0.1"/>
            </linearGradient>
          </defs>

          {/* Background Ring */}
          <circle
            cx="20" cy="20" r="18"
            fill="var(--color-glass)"
            stroke="var(--color-border)"
            strokeWidth="2"
            strokeOpacity="0.1"
          />

          {/* Active Value Arc */}
          <path
            d={indicatorPath}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="2"
            strokeLinecap="round"
            filter={`url(#glow-${id})`}
            className="transition-all duration-75"
          />

          {/* Dial Group (Scales via Motion whileTap, so we don't need group-hover:scale CSS here, or we can keep it for hover) */}
          <motion.g
            className="origin-center"
            // We use whileTap on parent, but we can also animate this group if needed.
            // The CSS hover scale is still nice.
            whileHover={{ scale: 0.9 }}
            transition={{ duration: 0.2 }}
          >
             {/* Soft Shadow */}
             <circle cx="20" cy="20" r="16" fill={`url(#shadow-grad-${id})`} />

             {/* Depression Ellipse */}
             <ellipse cx="20" cy="22" rx="14" ry="14.5" fill="black" fillOpacity="0.2" />

             {/* Main Body */}
             <circle cx="20" cy="20" r="14" fill={`url(#body-grad-${id})`} stroke="var(--color-border)" strokeOpacity="0.2" strokeWidth="1.5" />

             {/* Inner Highlight Ring */}
             <circle cx="20" cy="20" r="13" fill="none" stroke={`url(#highlight-grad-${id})`} strokeWidth="1.5" />

             {/* Hover Highlight Overlay - managed by CSS for opacity */}
             <circle cx="20" cy="20" r="14" fill="white" className="opacity-0 group-hover:opacity-5 transition-opacity duration-200" />
          </motion.g>

          {/* Indicator Dot (Rotates) */}
          <motion.g
            animate={{ rotate: rotation }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }} // Smooth spring animation for rotation
            style={{ originX: "20px", originY: "20px" }} // SVG origin is tricky in Motion, usually handled by transformOrigin style
          >
             <circle cx="20" cy="8" r="1.5" fill="var(--color-accent)" filter={`url(#glow-${id})`} />
          </motion.g>
        </svg>

        {/* Focus Ring */}
        <div className="absolute inset-0 rounded-full ring-2 ring-accent opacity-0 group-focus:opacity-50 pointer-events-none transition-opacity" />
      </motion.div>

      {label && (
        <span className="text-xs font-medium text-text-secondary select-none tracking-wide uppercase">
          {label}
        </span>
      )}
    </div>
  );
};
