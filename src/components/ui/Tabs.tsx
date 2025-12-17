/**
 * Tabs Component
 *
 * A reusable tab component for organizing content into switchable panels.
 * Follows the project's glass panel aesthetic with accent color highlights.
 *
 * Features:
 * - Controlled state via value/onChange props
 * - Full keyboard navigation (Arrow keys, Home, End)
 * - ARIA-compliant accessibility
 * - Smooth transition animations
 * - Scrollable tab list with overflow indicators
 * - Compact styling suitable for sidebars
 *
 * @example
 * ```tsx
 * const [activeTab, setActiveTab] = useState('bloom');
 *
 * <Tabs
 *   value={activeTab}
 *   onChange={setActiveTab}
 *   tabs={[
 *     { id: 'bloom', label: 'Bloom', content: <BloomControls /> },
 *     { id: 'tone', label: 'Tone Mapping', content: <ToneMappingControls /> },
 *   ]}
 * />
 * ```
 *
 * @see {@link Section} for collapsible container
 * @see {@link ToggleGroup} for similar toggle-style controls
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { m } from 'motion/react';

export interface Tab {
  /** Unique identifier for the tab */
  id: string;
  /** Label displayed on the tab button */
  label: string;
  /** Content rendered when tab is active */
  content: React.ReactNode;
}

export interface TabsProps {
  /** Array of tab definitions */
  tabs: Tab[];
  /** Currently active tab id */
  value: string;
  /** Callback when active tab changes */
  onChange: (id: string) => void;
  /** Optional class name for the container */
  className?: string;
  /** Optional class name for the tab list */
  tabListClassName?: string;
  /** Optional class name for the content panel */
  contentClassName?: string;
  /** Visual variant of the tabs */
  variant?: 'default' | 'minimal';
  /** Whether tabs should expand to fill the container width */
  fullWidth?: boolean;
  /** Test ID for testing */
  'data-testid'?: string;
}

const ChevronLeft = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
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
    width="14"
    height="14"
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

/**
 * Tabs component for switching between content panels.
 * @param props - Component props
 * @param props.tabs
 * @param props.value
 * @param props.onChange
 * @param props.className
 * @param props.tabListClassName
 * @param props.contentClassName
 * @param props.variant - 'default' (glass panel, underline) or 'minimal' (border-b, bg tint)
 * @param props.fullWidth - If true, tabs expand to fill available width
 * @param props.'data-testid'
 */
export const Tabs: React.FC<TabsProps> = ({
  tabs,
  value,
  onChange,
  className = '',
  tabListClassName = '',
  contentClassName = '',
  variant = 'default',
  fullWidth = false,
  'data-testid': testId,
}) => {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const activeTab = tabs.find((tab) => tab.id === value);

  const checkScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      // Use a small tolerance for float/rounding issues
      setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
    }
  }, []);

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [checkScroll]);

  // Re-check scroll when tabs change
  useEffect(() => {
    checkScroll();
  }, [tabs, value, checkScroll]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 100;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, index: number) => {
      let newIndex = index;

      switch (event.key) {
        case 'ArrowLeft':
          newIndex = index === 0 ? tabs.length - 1 : index - 1;
          break;
        case 'ArrowRight':
          newIndex = index === tabs.length - 1 ? 0 : index + 1;
          break;
        case 'Home':
          newIndex = 0;
          break;
        case 'End':
          newIndex = tabs.length - 1;
          break;
        default:
          return;
      }

      event.preventDefault();
      const targetTab = tabs[newIndex];
      if (targetTab) {
        onChange(targetTab.id);
        tabRefs.current[newIndex]?.focus();
      }
    },
    [tabs, onChange]
  );

  // Styling based on variant
  const containerStyles = variant === 'default' 
    ? 'bg-black/20 rounded-t-lg border-b border-white/5' 
    : 'border-b border-white/5';
    
  const widthStyles = fullWidth ? 'w-full' : 'min-w-full w-max';

  return (
    <div className={className} data-testid={testId}>
      {/* Tab List Container with scroll indicators */}
      <div className="relative">
        {/* Left scroll indicator */}
        {canScrollLeft && !fullWidth && (
          <button
            type="button"
            onClick={() => scroll('left')}
            className="absolute left-0 top-0 bottom-0 z-10 px-1 bg-gradient-to-r from-black/50 via-black/40 to-transparent flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors rounded-tl-md"
            aria-label="Scroll tabs left"
            data-testid={testId ? `${testId}-scroll-left` : undefined}
          >
            <ChevronLeft />
          </button>
        )}

        {/* Scrollable Tab List */}
        <div
          ref={scrollContainerRef}
          onScroll={checkScroll}
          className={`overflow-x-auto [&::-webkit-scrollbar]:hidden ${fullWidth ? 'w-full' : ''}`}
        >
          <div
            className={`flex ${containerStyles} ${widthStyles} ${tabListClassName}`}
            role="tablist"
            aria-label="Tabs"
          >
            {tabs.map((tab, index) => {
              const isActive = tab.id === value;
              
              // Dynamic styling for active/inactive states
              const activeTextClass = variant === 'minimal' ? 'text-accent bg-accent/5' : 'text-accent text-glow font-bold';
              const inactiveTextClass = variant === 'minimal' ? 'text-zinc-500 hover:text-zinc-300' : 'text-text-secondary hover:text-text-primary hover:bg-white/5';
              
              return (
                <m.button
                  key={tab.id}
                  ref={(el) => {
                    tabRefs.current[index] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`tab-${tab.id}`}
                  aria-selected={isActive}
                  aria-controls={`panel-${tab.id}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => onChange(tab.id)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  className={`
                    relative flex-1 px-3 py-2.5 text-xs tracking-wider whitespace-nowrap
                    transition-colors duration-200
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-inset
                    ${isActive ? activeTextClass : inactiveTextClass}
                  `}
                  data-testid={testId ? `${testId}-tab-${tab.id}` : undefined}
                  whileHover={{ y: -1 }}
                  whileTap={{ y: 0 }}
                >
                  {isActive && variant === 'default' && (
                    <m.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent z-20 shadow-[0_0_10px_var(--color-accent)]"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                </m.button>
              );
            })}
          </div>
        </div>

        {/* Right scroll indicator */}
        {canScrollRight && !fullWidth && (
          <button
            type="button"
            onClick={() => scroll('right')}
            className="absolute right-0 top-0 bottom-0 z-10 px-1 bg-gradient-to-l from-black/50 via-black/40 to-transparent flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors rounded-tr-md"
            aria-label="Scroll tabs right"
            data-testid={testId ? `${testId}-scroll-right` : undefined}
          >
            <ChevronRight />
          </button>
        )}
      </div>

      {/* Tab Panel */}
      {activeTab && (
        <m.div
          id={`panel-${activeTab.id}`}
          role="tabpanel"
          key={activeTab.id}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 5 }}
          transition={{ duration: 0.2 }}
          aria-labelledby={`tab-${activeTab.id}`}
          tabIndex={0}
          className={`pt-4 pb-4 ${contentClassName}`}
          data-testid={testId ? `${testId}-panel-${activeTab.id}` : undefined}
        >
          {activeTab.content}
        </m.div>
      )}
    </div>
  );
};
