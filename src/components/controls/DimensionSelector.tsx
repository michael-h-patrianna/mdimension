/**
 * Dimension Selector Component
 * Allows users to select the number of dimensions (3D, 4D, 5D, 6D)
 */

import { ToggleGroup } from '@/components/ui/ToggleGroup';
import { MAX_DIMENSION, MIN_DIMENSION, useGeometryStore } from '@/stores/geometryStore';
import React, { useEffect, useRef, useState } from 'react';

export interface DimensionSelectorProps {
  className?: string;
  disabled?: boolean;
}

/** Generate dimension options from MIN to MAX */
function getDimensionOptions() {
  const options = [];
  for (let d = MIN_DIMENSION; d <= MAX_DIMENSION; d++) {
    options.push({
      value: String(d),
      label: `${d}D`,
    });
  }
  return options;
}

const ChevronLeft = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

const ChevronRight = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 18l6-6-6-6" />
  </svg>
);

export const DimensionSelector: React.FC<DimensionSelectorProps> = ({
  className = '',
  disabled = false,
}) => {
  const { dimension, setDimension } = useGeometryStore();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      // Use a small tolerance for float/rounding issues
      setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, []);

  // Re-check scroll availability when dimension changes (though options are static, good practice)
  useEffect(() => {
    checkScroll();
  }, [dimension]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 150;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
      // checkScroll will be called by onScroll event
    }
  };

  const handleChange = (value: string) => {
    const newDimension = parseInt(value, 10);
    if (!isNaN(newDimension)) {
      setDimension(newDimension);
    }
  };

  return (
    <div className={`${className}`}>
      <div className="relative group">
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scroll('left')}
            className="absolute left-0 top-0 bottom-0 z-10 px-1 bg-gradient-to-r from-panel-bg via-panel-bg/90 to-transparent flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors rounded-l-lg"
            aria-label="Scroll left"
          >
            <ChevronLeft />
          </button>
        )}

        <div
          ref={scrollContainerRef}
          onScroll={checkScroll}
          className="overflow-x-auto [&::-webkit-scrollbar]:hidden"
        >
          <ToggleGroup
            options={getDimensionOptions()}
            value={String(dimension)}
            onChange={handleChange}
            disabled={disabled}
            ariaLabel="Select dimension"
            className="min-w-full w-max"
            data-testid="dimension-selector"
          />
        </div>

        {canScrollRight && (
          <button
            type="button"
            onClick={() => scroll('right')}
            className="absolute right-0 top-0 bottom-0 z-10 px-1 bg-gradient-to-l from-panel-bg via-panel-bg/90 to-transparent flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors rounded-r-lg"
            aria-label="Scroll right"
          >
            <ChevronRight />
          </button>
        )}
      </div>

    </div>
  );
};
