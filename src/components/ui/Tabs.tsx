/**
 * Tabs Component
 *
 * A reusable tab component for organizing content into switchable panels.
 * Follows the project's premium aesthetic with subtle motion and glass effects.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { m } from 'motion/react';
import { soundManager } from '@/lib/audio/SoundManager';

export interface Tab {
  /** Unique identifier for the tab */
  id: string;
  /** Label displayed on the tab button */
  label: React.ReactNode;
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
  variant?: 'default' | 'minimal' | 'pills';
  /** Whether tabs should expand to fill the container width */
  fullWidth?: boolean;
  /** Test ID for testing */
  'data-testid'?: string;
}

const ChevronLeft = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="12"
    height="12"
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
    width="12"
    height="12"
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

  // Track direction for slide animation
  const [direction, setDirection] = useState(0);
  const prevValue = useRef(value);

  const activeTab = tabs.find((tab) => tab.id === value);
  const activeIndex = tabs.findIndex((tab) => tab.id === value);
  const prevIndex = tabs.findIndex((tab) => tab.id === prevValue.current);

  useEffect(() => {
    if (activeIndex !== prevIndex) {
        setDirection(activeIndex > prevIndex ? 1 : -1);
        prevValue.current = value;
    }
  }, [value, activeIndex, prevIndex]);

  const checkScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
    }
  }, []);

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [checkScroll]);

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

  const handleTabChange = (id: string) => {
    if (id !== value) {
        soundManager.playClick();
        onChange(id);
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
        handleTabChange(targetTab.id);
        tabRefs.current[newIndex]?.focus();
      }
    },
    [tabs, handleTabChange]
  );

  // Styling logic
  const listContainerStyles = variant === 'pills' 
    ? 'bg-black/20 rounded-lg p-1 gap-1' 
    : 'border-b border-white/5 pb-[1px]'; // Slight padding for border visibility
    
  const widthStyles = fullWidth ? 'w-full' : 'min-w-full w-max';

  return (
    <div className={`flex flex-col ${className}`} data-testid={testId}>
      {/* Header Area */}
      <div className="relative shrink-0 z-10">
        
        {/* Scroll Indicators */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scroll('left')}
            className="absolute left-0 top-0 bottom-0 z-20 px-1 bg-gradient-to-r from-panel-bg to-transparent flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
          >
            <ChevronLeft />
          </button>
        )}

        {/* Tab List */}
        <div
          ref={scrollContainerRef}
          onScroll={checkScroll}
          className={`overflow-x-auto scrollbar-none ${fullWidth ? 'w-full' : ''}`}
        >
          <div
            className={`flex items-center ${listContainerStyles} ${widthStyles} ${tabListClassName}`}
            role="tablist"
          >
            {tabs.map((tab, index) => {
              const isActive = tab.id === value;
              
              return (
                <button
                  key={tab.id}
                  ref={(el) => { tabRefs.current[index] = el; }}
                  type="button"
                  role="tab"
                  id={`tab-${tab.id}`}
                  aria-selected={isActive}
                  aria-controls={`panel-${tab.id}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => handleTabChange(tab.id)}
                  onMouseEnter={() => !isActive && soundManager.playHover()}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  className={`
                    relative px-4 py-2 text-[10px] uppercase tracking-widest font-bold whitespace-nowrap outline-none select-none transition-colors duration-200 cursor-pointer
                    ${fullWidth ? 'flex-1' : ''}
                    ${isActive ? 'text-accent text-glow-subtle' : 'text-text-secondary hover:text-text-primary'}
                    ${variant === 'pills' && isActive ? 'bg-white/5 rounded shadow-sm' : ''}
                    ${variant === 'pills' && !isActive ? 'hover:bg-white/5 rounded' : ''}
                  `}
                  data-testid={testId ? `${testId}-tab-${tab.id}` : undefined}
                >
                  {/* Active Indicator for Default/Minimal Variants */}
                  {isActive && variant !== 'pills' && (
                    <m.div
                      layoutId={`activeTab-${testId || 'default'}`} // Scoped layoutId to prevent conflicts if multiple Tabs instances
                      className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-accent shadow-[0_0_8px_var(--color-accent)]"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                    />
                  )}
                  
                  {/* Background Highlight for Active State (Subtle) */}
                  {isActive && variant !== 'pills' && (
                     <m.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 bg-gradient-to-t from-accent/5 to-transparent pointer-events-none"
                     />
                  )}

                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Scroll Indicator */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scroll('right')}
            className="absolute right-0 top-0 bottom-0 z-20 px-1 bg-gradient-to-l from-panel-bg to-transparent flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
          >
            <ChevronRight />
          </button>
        )}
      </div>

      {/* Content Panel */}
      <div className={`flex-1 min-h-0 relative overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent ${contentClassName}`}>
        {activeTab && (
            <div
              key={activeTab.id}
              className="w-full animate-fade-in"
              role="tabpanel"
              aria-labelledby={`tab-${activeTab.id}`}
              data-testid={testId ? `${testId}-panel-${activeTab.id}` : undefined}
            >
              {activeTab.content}
            </div>
        )}
      </div>
    </div>
  );
};

