/**
 * Light List Item Component
 *
 * Displays a single light entry in the light list with:
 * - Light name and type icon
 * - Enable/disable toggle
 * - Selection highlight
 * - Delete button
 */

import React, { memo } from 'react';
import type { LightSource } from '@/rendering/lights/types';

export interface LightListItemProps {
  light: LightSource;
  isSelected: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onRemove: () => void;
}

/** Icon for point light (circle) */
const PointIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="6" />
  </svg>
);

/** Icon for directional light (sun) */
const DirectionalIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
  </svg>
);

/** Icon for spot light (cone) */
const SpotIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 4L6 20h12L12 4z" />
  </svg>
);

/** Get icon component for light type */
const getLightIcon = (type: LightSource['type']) => {
  switch (type) {
    case 'point':
      return <PointIcon />;
    case 'directional':
      return <DirectionalIcon />;
    case 'spot':
      return <SpotIcon />;
  }
};

export const LightListItem: React.FC<LightListItemProps> = memo(function LightListItem({
  light,
  isSelected,
  onSelect,
  onToggle,
  onRemove,
}) {
  return (
    <div
      className={`
        flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors
        ${isSelected
          ? 'bg-accent/20 border border-accent/50'
          : 'bg-panel-border/50 border border-transparent hover:bg-panel-border'
        }
      `}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      aria-pressed={isSelected}
    >
      {/* Light type icon with color */}
      <span
        className={`flex-shrink-0 ${light.enabled ? '' : 'opacity-40'}`}
        style={{ color: light.color }}
      >
        {getLightIcon(light.type)}
      </span>

      {/* Light name */}
      <span
        className={`flex-1 text-sm truncate ${
          light.enabled ? 'text-text-primary' : 'text-text-secondary'
        }`}
      >
        {light.name}
      </span>

      {/* Enable/disable toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={`
          p-1 rounded transition-colors
          ${light.enabled
            ? 'text-accent hover:text-accent/80'
            : 'text-text-tertiary hover:text-text-secondary'
          }
        `}
        aria-label={light.enabled ? 'Disable light' : 'Enable light'}
        title={light.enabled ? 'Disable light' : 'Enable light'}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {light.enabled ? (
            <path d="M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          ) : (
            <>
              <circle cx="12" cy="12" r="5" />
              <path d="M3 3l18 18" strokeLinecap="round" />
            </>
          )}
        </svg>
      </button>

      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="p-1 rounded text-text-tertiary hover:text-error transition-colors"
        aria-label="Remove light"
        title="Remove light (Delete key)"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
        </svg>
      </button>
    </div>
  );
});
