import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export interface TooltipProps {
  content: string | React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 300,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();

      let x = 0;
      let y = 0;

      switch (position) {
        case 'top':
          x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
          y = triggerRect.top - tooltipRect.height - 10;
          break;
        case 'bottom':
          x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
          y = triggerRect.bottom + 10;
          break;
        case 'left':
          x = triggerRect.left - tooltipRect.width - 10;
          y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
          break;
        case 'right':
          x = triggerRect.right + 10;
          y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
          break;
      }

      setCoords({ x, y });
    }
  }, [isVisible, position]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const arrowStyles = {
    top: 'bottom-[-4px] left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-panel-border',
    bottom: 'top-[-4px] left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-panel-border',
    left: 'right-[-4px] top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-panel-border',
    right: 'left-[-4px] top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-panel-border',
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
      >
        {children}
      </div>
      <AnimatePresence>
        {isVisible && (
          <motion.div
            ref={tooltipRef}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className="fixed z-50 px-3 py-2 text-xs font-medium text-text-primary bg-panel-bg/90 backdrop-blur-md border border-panel-border rounded-lg shadow-xl pointer-events-none max-w-xs break-words"
            style={{
              left: `${coords.x}px`,
              top: `${coords.y}px`,
            }}
            role="tooltip"
          >
            {content}
            {/* Arrow (Visual only, color matched to border for 'glass' look) */}
            <div
              className={`absolute w-0 h-0 border-4 ${arrowStyles[position]}`}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
