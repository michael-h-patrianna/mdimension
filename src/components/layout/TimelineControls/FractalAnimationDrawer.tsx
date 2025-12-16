/**
 * FractalAnimationDrawer Component
 *
 * Registry-driven animation drawer that generates animation panels
 * from the object type registry. Replaces hardcoded per-type sections.
 *
 * Features:
 * - Reads available animation systems from registry
 * - Generates AnimationSystemPanel for each available system
 * - Handles dimension-specific availability (e.g., sliceAnimation for 4D+)
 * - Bridges registry schema to store actions
 *
 * @example
 * ```tsx
 * {showFractalAnim && <FractalAnimationDrawer />}
 * ```
 */

import {
  getAvailableAnimationSystems,
  getConfigStoreKey,
} from '@/lib/geometry/registry';
import type { AnimationSystemDef } from '@/lib/geometry/registry';
import type { ObjectType } from '@/lib/geometry/types';
import { useGeometryStore } from '@/stores/geometryStore';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useShallow } from 'zustand/react/shallow';
import { m } from 'motion/react';
import React, { useMemo, useCallback } from 'react';
import { AnimationSystemPanel } from './AnimationSystemPanel';

/**
 * Gets a value from a nested path in an object
 * Supports paths like 'powerAnimation.minPower' and 'originDriftEnabled'
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Maps animation system parameters to store values
 *
 * The registry defines parameter keys which may be:
 * - Flat keys like 'originDriftAmplitude'
 * - Nested paths like 'powerAnimation.minPower'
 *
 * This function extracts current values from the config store.
 */
function extractParamValues(
  config: Record<string, unknown>,
  system: AnimationSystemDef
): Record<string, number> {
  const values: Record<string, number> = {};

  for (const paramKey of Object.keys(system.params)) {
    // Try nested path first (e.g., 'powerAnimation.minPower')
    const value = getNestedValue(config, paramKey);
    if (typeof value === 'number') {
      values[paramKey] = value;
    }
  }

  return values;
}

/**
 * Gets the enabled state for an animation system from config
 * Supports both flat keys (e.g., 'originDriftEnabled')
 * and nested paths (e.g., 'juliaConstantAnimation.enabled')
 */
function getSystemEnabled(
  config: Record<string, unknown>,
  system: AnimationSystemDef
): boolean {
  const enabledKey = system.enabledKey;
  const value = getNestedValue(config, enabledKey);
  return typeof value === 'boolean' ? value : system.enabledByDefault;
}

/**
 * FractalAnimationDrawer renders animation controls for the current object type.
 *
 * It reads the available animation systems from the registry and generates
 * AnimationSystemPanel components for each one. This eliminates the need
 * for hardcoded per-type UI sections.
 */
export const FractalAnimationDrawer: React.FC = React.memo(() => {
  const objectType = useGeometryStore((state) => state.objectType);
  const dimension = useGeometryStore((state) => state.dimension);

  // Get the config store key from registry
  const configKey = useMemo(() => getConfigStoreKey(objectType), [objectType]);

  // Get available animation systems from registry
  const systems = useMemo(
    () => getAvailableAnimationSystems(objectType, dimension),
    [objectType, dimension]
  );

  // Get config from store based on object type
  const config = useExtendedObjectStore(
    useShallow((state) => {
      if (configKey && configKey in state) {
        return state[configKey as keyof typeof state] as Record<string, unknown>;
      }
      return {};
    })
  );

  // Handler to update config in store
  const updateConfig = useCallback(
    (updates: Record<string, unknown>) => {
      const state = useExtendedObjectStore.getState();

      for (const [key, value] of Object.entries(updates)) {
        // Determine setter name based on object type and parameter key format
        let setterName: string;

        if (objectType === 'mandelbrot') {
          // Mandelbrot uses flat keys: 'powerMin' → 'setMandelbrotPowerMin'
          setterName = `setMandelbrot${key.charAt(0).toUpperCase()}${key.slice(1)}`;
        } else if (objectType === 'quaternion-julia') {
          // Quaternion Julia has both flat and nested keys
          // Nested: 'juliaConstantAnimation.enabled' → 'setQuaternionJuliaConstantAnimationEnabled'
          // Nested: 'powerAnimation.minPower' → 'setQuaternionJuliaPowerAnimationMinPower'
          // Flat: 'originDriftEnabled' → 'setQuaternionJuliaOriginDriftEnabled'

          if (key.includes('.')) {
            // Nested path - convert 'powerAnimation.minPower' to 'PowerAnimationMinPower'
            const parts = key.split('.');
            const camelParts = parts.map(
              (part) => part.charAt(0).toUpperCase() + part.slice(1)
            );
            setterName = `setQuaternionJulia${camelParts.join('')}`;
          } else {
            // Flat key
            setterName = `setQuaternionJulia${key.charAt(0).toUpperCase()}${key.slice(1)}`;
          }
        } else if (objectType === 'kali') {
          // Kali has both flat and nested keys (same pattern as quaternion-julia)
          // Nested: 'constantAnimation.enabled' → 'setKaliConstantAnimationEnabled'
          // Nested: 'gainAnimation.minGain' → 'setKaliGainAnimationMinGain'
          // Flat: 'originDriftEnabled' → 'setKaliOriginDriftEnabled'

          if (key.includes('.')) {
            // Nested path - convert 'constantAnimation.amplitude' to 'ConstantAnimationAmplitude'
            const parts = key.split('.');
            const camelParts = parts.map(
              (part) => part.charAt(0).toUpperCase() + part.slice(1)
            );
            setterName = `setKali${camelParts.join('')}`;
          } else {
            // Flat key
            setterName = `setKali${key.charAt(0).toUpperCase()}${key.slice(1)}`;
          }
        } else {
          // Default fallback (shouldn't happen for fractals)
          continue;
        }

        const setter = state[setterName as keyof typeof state];
        if (typeof setter === 'function') {
          (setter as (v: unknown) => void)(value);
        }
      }
    },
    [objectType]
  );

  // If no animation systems available, don't render anything
  if (Object.keys(systems).length === 0) {
    return null;
  }

  return (
    <m.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.2 }}
      className="absolute bottom-full left-0 right-0 bg-panel-bg/95 backdrop-blur-xl border-t border-b border-panel-border z-20 shadow-2xl max-h-[400px] overflow-y-auto"
      data-testid="fractal-animation-drawer"
    >
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(systems).map(([systemKey, system]) => (
          <AnimationSystemPanel
            key={systemKey}
            systemKey={systemKey}
            system={system}
            enabled={getSystemEnabled(config, system)}
            values={extractParamValues(config, system)}
            onToggle={(enabled) => updateConfig({ [system.enabledKey]: enabled })}
            onParamChange={(paramKey, value) => updateConfig({ [paramKey]: value })}
          />
        ))}
      </div>
    </m.div>
  );
});

FractalAnimationDrawer.displayName = 'FractalAnimationDrawer';

export default FractalAnimationDrawer;
