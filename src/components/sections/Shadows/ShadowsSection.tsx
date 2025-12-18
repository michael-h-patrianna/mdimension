/**
 * Shadows Section Component
 *
 * Centralized shadow controls for all object types:
 * - SDF Fractals (Mandelbulb, Julia): Raymarched soft shadows
 * - Volumetric (Schrödinger): Self-shadowing with volumetric integration
 * - Mesh-based (Polytopes): Three.js shadow maps
 */

import { ControlGroup } from '@/components/ui/ControlGroup';
import { Section } from '@/components/sections/Section';
import { Select, type SelectOption } from '@/components/ui/Select';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { isPolytopeCategory } from '@/lib/geometry/registry/helpers';
import type { ObjectType } from '@/lib/geometry/types';
import {
  SHADOW_ANIMATION_MODE_LABELS,
  SHADOW_ANIMATION_MODE_OPTIONS,
  SHADOW_ANIMATION_MODE_TOOLTIPS,
  SHADOW_QUALITY_LABELS,
  SHADOW_QUALITY_OPTIONS,
  SHADOW_QUALITY_TOOLTIPS,
  SHADOW_SOFTNESS_RANGE,
} from '@/rendering/shadows/constants';
import type { ShadowAnimationMode, ShadowQuality } from '@/rendering/shadows/types';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useGeometryStore } from '@/stores/geometryStore';
import { useLightingStore } from '@/stores/lightingStore';
import React from 'react';
import { useShallow } from 'zustand/react/shallow';

export interface ShadowsSectionProps {
  defaultOpen?: boolean;
}

/**
 * Helper to determine if object type uses raymarched shadows (SDF fractals)
 */
function isRaymarchingFractal(objectType: ObjectType, dimension: number): boolean {
  return objectType === 'mandelbulb' || objectType === 'quaternion-julia' ||
    (objectType === 'schroedinger' && dimension >= 3);
}

/**
 * Shadow animation mode options for select dropdown
 */
const SHADOW_ANIMATION_OPTIONS: SelectOption<ShadowAnimationMode>[] =
  SHADOW_ANIMATION_MODE_OPTIONS.map((mode: ShadowAnimationMode) => ({
    value: mode,
    label: SHADOW_ANIMATION_MODE_LABELS[mode],
  }));

/**
 * Shadow quality options for select dropdown
 */
const SHADOW_QUALITY_SELECT_OPTIONS: SelectOption<ShadowQuality>[] =
  SHADOW_QUALITY_OPTIONS.map((quality: ShadowQuality) => ({
    value: quality,
    label: SHADOW_QUALITY_LABELS[quality],
  }));

/**
 * Shadow steps options for Schrödinger
 */
const SHADOW_STEPS_OPTIONS: SelectOption<string>[] = [
  { value: '2', label: '2 steps (Fast)' },
  { value: '4', label: '4 steps (Balanced)' },
  { value: '6', label: '6 steps (Quality)' },
  { value: '8', label: '8 steps (High)' },
];

export const ShadowsSection: React.FC<ShadowsSectionProps> = ({
  defaultOpen = false,
}) => {
  // Get current object type and dimension
  const objectType = useGeometryStore((state) => state.objectType);
  const dimension = useGeometryStore((state) => state.dimension);

  // Get global lighting state
  const {
    lights,
    shadowEnabled,
    shadowQuality,
    shadowSoftness,
    shadowAnimationMode,
    shadowMapBias,
    shadowMapBlur,
    setShadowEnabled,
    setShadowQuality,
    setShadowSoftness,
    setShadowAnimationMode,
    setShadowMapBias,
    setShadowMapBlur,
  } = useLightingStore(
    useShallow((state) => ({
      lights: state.lights,
      shadowEnabled: state.shadowEnabled,
      shadowQuality: state.shadowQuality,
      shadowSoftness: state.shadowSoftness,
      shadowAnimationMode: state.shadowAnimationMode,
      shadowMapBias: state.shadowMapBias,
      shadowMapBlur: state.shadowMapBlur,
      setShadowEnabled: state.setShadowEnabled,
      setShadowQuality: state.setShadowQuality,
      setShadowSoftness: state.setShadowSoftness,
      setShadowAnimationMode: state.setShadowAnimationMode,
      setShadowMapBias: state.setShadowMapBias,
      setShadowMapBlur: state.setShadowMapBlur,
    }))
  );

  // Get Schrödinger-specific shadow settings
  const {
    schroedingerShadowsEnabled,
    schroedingerShadowStrength,
    schroedingerShadowSteps,
    setSchroedingerShadowsEnabled,
    setSchroedingerShadowStrength,
    setSchroedingerShadowSteps,
  } = useExtendedObjectStore(
    useShallow((state) => ({
      schroedingerShadowsEnabled: state.schroedinger.shadowsEnabled,
      schroedingerShadowStrength: state.schroedinger.shadowStrength,
      schroedingerShadowSteps: state.schroedinger.shadowSteps,
      setSchroedingerShadowsEnabled: state.setSchroedingerShadowsEnabled,
      setSchroedingerShadowStrength: state.setSchroedingerShadowStrength,
      setSchroedingerShadowSteps: state.setSchroedingerShadowSteps,
    }))
  );

  // Determine object category
  const isSchroedinger = objectType === 'schroedinger';
  const isPolytope = isPolytopeCategory(objectType);
  const isSdfFractal = isRaymarchingFractal(objectType, dimension) && !isSchroedinger;

  // Check if there are any enabled lights (shadows require lights)
  const hasEnabledLights = lights.some((light) => light.enabled);

  // For Schrödinger, use its own shadow toggle; for others, use global shadowEnabled
  const effectiveShadowEnabled = isSchroedinger ? schroedingerShadowsEnabled : shadowEnabled;
  const handleShadowToggle = isSchroedinger
    ? (enabled: boolean) => setSchroedingerShadowsEnabled(enabled)
    : setShadowEnabled;

  // Get object type label for description
  const getObjectTypeLabel = () => {
    if (isSchroedinger) return 'Volumetric (Schrödinger)';
    if (isSdfFractal) return 'SDF Raymarched';
    if (isPolytope) return 'Shadow Maps';
    return 'Standard';
  };

  return (
    <Section title="Shadows" defaultOpen={defaultOpen} data-testid="section-shadows">
      {hasEnabledLights ? (
        <div className="space-y-4">
          {/* Main Shadow Toggle */}
          <ControlGroup
            title="Enable Shadows"
            rightElement={
              <Switch
                checked={effectiveShadowEnabled}
                onCheckedChange={handleShadowToggle}
                data-testid="shadow-enabled-toggle"
              />
            }
          >
            <p className="text-[10px] text-text-secondary">
              Shadow type: {getObjectTypeLabel()}
            </p>
          </ControlGroup>

          {/* Shadow Settings - conditionally rendered based on shadow enabled */}
          <div className={`space-y-4 ${!effectiveShadowEnabled ? 'opacity-50 pointer-events-none' : ''}`}>

            {/* Animation Mode - Shared across all types */}
            <div className="space-y-1">
              <Select<ShadowAnimationMode>
                label="Animation Quality"
                options={SHADOW_ANIMATION_OPTIONS}
                value={shadowAnimationMode}
                onChange={setShadowAnimationMode}
                data-testid="shadow-animation-mode-select"
              />
              <p className="text-[10px] text-text-secondary">
                {SHADOW_ANIMATION_MODE_TOOLTIPS[shadowAnimationMode]}
              </p>
            </div>

            {/* SDF Fractal Controls (Mandelbulb, Julia) */}
            {isSdfFractal && (
              <ControlGroup title="Raymarched Shadows">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Select<ShadowQuality>
                      label="Quality"
                      options={SHADOW_QUALITY_SELECT_OPTIONS}
                      value={shadowQuality}
                      onChange={setShadowQuality}
                      data-testid="shadow-quality-select"
                    />
                    <p className="text-[10px] text-text-secondary">
                      {SHADOW_QUALITY_TOOLTIPS[shadowQuality]}
                    </p>
                  </div>
                  <Slider
                    label="Softness"
                    min={SHADOW_SOFTNESS_RANGE.min}
                    max={SHADOW_SOFTNESS_RANGE.max}
                    step={SHADOW_SOFTNESS_RANGE.step}
                    value={shadowSoftness}
                    onChange={setShadowSoftness}
                    showValue
                    tooltip="Higher values create softer shadow edges"
                    data-testid="shadow-softness-slider"
                  />
                </div>
              </ControlGroup>
            )}

            {/* Schrödinger Volumetric Shadow Controls */}
            {isSchroedinger && (
              <ControlGroup title="Volumetric Self-Shadowing">
                <p className="text-[10px] text-text-secondary mb-2">
                  Expensive volumetric light integration for realistic cloud-like shadows.
                </p>
                <div className="space-y-3">
                  <Slider
                    label="Strength"
                    min={0}
                    max={2}
                    step={0.1}
                    value={schroedingerShadowStrength}
                    onChange={setSchroedingerShadowStrength}
                    showValue
                    tooltip="Shadow darkness intensity"
                    data-testid="schroedinger-shadow-strength"
                  />
                  <div className="space-y-1">
                    <Select<string>
                      label="Steps"
                      options={SHADOW_STEPS_OPTIONS}
                      value={String(schroedingerShadowSteps)}
                      onChange={(val) => setSchroedingerShadowSteps(parseInt(val, 10))}
                      data-testid="schroedinger-shadow-steps"
                    />
                    <p className="text-[10px] text-text-secondary">
                      More steps = softer shadows, higher GPU cost
                    </p>
                  </div>
                </div>
              </ControlGroup>
            )}

            {/* Polytope Shadow Map Controls */}
            {isPolytope && (
              <ControlGroup title="Shadow Map Settings">
                <p className="text-[10px] text-text-secondary mb-2">
                  Three.js PCF soft shadow maps for mesh-based objects.
                </p>
                <div className="space-y-3">
                  <Slider
                    label="Bias"
                    min={0}
                    max={0.01}
                    step={0.001}
                    value={shadowMapBias}
                    onChange={setShadowMapBias}
                    showValue
                    tooltip="Adjust to prevent shadow acne artifacts"
                    data-testid="shadow-map-bias"
                  />
                  <Slider
                    label="Blur"
                    min={0}
                    max={10}
                    step={0.5}
                    value={shadowMapBlur}
                    onChange={setShadowMapBlur}
                    showValue
                    tooltip="Higher values create softer shadow edges"
                    data-testid="shadow-map-blur"
                  />
                </div>
              </ControlGroup>
            )}
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-lg bg-black/20 border border-white/5 border-dashed text-center">
          <p className="text-xs text-text-secondary italic">
            Add lights to enable shadows.
          </p>
        </div>
      )}
    </Section>
  );
};
