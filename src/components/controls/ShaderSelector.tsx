/**
 * Shader Selector Component
 *
 * Provides a visual interface for selecting shader types for polytope rendering.
 * Each shader option is displayed as a button with a color indicator, making it
 * easy for users to identify and switch between different visual styles.
 *
 * Features:
 * - Button-based selection UI with visual indicators
 * - Color-coded shader identification
 * - Active state highlighting
 * - Tooltip descriptions for each shader type
 * - Integration with visual store for shader type management
 *
 * @example
 * ```tsx
 * <ShaderSelector className="mb-4" />
 * ```
 *
 * @see {@link useVisualStore} for shader state management
 * @see docs/prd/enhanced-visuals-rendering-pipeline.md for shader details
 */

import React from 'react';
import { useVisualStore } from '@/stores/visualStore';
import type { ShaderType } from '@/lib/shaders/types';
import { SHADER_DISPLAY_NAMES, SHADER_DESCRIPTIONS } from '@/lib/shaders/types';

/**
 * Color indicators for each shader type, used for visual identification
 */
const SHADER_COLORS: Record<ShaderType, string> = {
  wireframe: '#00D4FF',
  dualOutline: '#FFAA00',
  surface: '#8888FF',
};

/**
 * Ordered list of available shader options
 */
const SHADER_OPTIONS: ShaderType[] = [
  'wireframe',
  'dualOutline',
  'surface',
];

/**
 * Props for ShaderSelector component
 */
export interface ShaderSelectorProps {
  /** Optional CSS class name for styling */
  className?: string;
}

/**
 * Shader Selector Component
 *
 * Allows users to select between different shader types for polytope rendering.
 * Displays all available shaders as interactive buttons with color indicators.
 *
 * @param props - Component props
 * @param props.className - Optional CSS class name for custom styling
 *
 * @returns A vertically-stacked list of shader selection buttons
 *
 * @example
 * Basic usage:
 * ```tsx
 * <ShaderSelector />
 * ```
 *
 * @example
 * With custom styling:
 * ```tsx
 * <ShaderSelector className="mb-4" />
 * ```
 *
 * @remarks
 * - Reads current shader type from useVisualStore
 * - Updates shader type on button click
 * - Highlights currently selected shader
 * - Shows tooltips with shader descriptions on hover
 */
export const ShaderSelector: React.FC<ShaderSelectorProps> = ({ className = '' }) => {
  const shaderType = useVisualStore((state) => state.shaderType);
  const setShaderType = useVisualStore((state) => state.setShaderType);

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="block text-sm font-medium text-text-secondary">
        Shader
      </label>
      <div className="space-y-1">
        {SHADER_OPTIONS.map((shader) => (
          <button
            key={shader}
            onClick={() => setShaderType(shader)}
            className={`
              w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors
              ${
                shaderType === shader
                  ? 'bg-accent/20 text-accent border border-accent/50'
                  : 'bg-panel-border text-text-primary hover:bg-panel-border/80 border border-transparent'
              }
            `}
            title={SHADER_DESCRIPTIONS[shader]}
            aria-label={`Select ${SHADER_DISPLAY_NAMES[shader]} shader`}
            data-testid={`shader-option-${shader}`}
          >
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: SHADER_COLORS[shader] }}
              aria-hidden="true"
            />
            <span>{SHADER_DISPLAY_NAMES[shader]}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
