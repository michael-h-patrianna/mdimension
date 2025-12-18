/**
 * Scene Lighting Component
 *
 * Manages ambient and multi-light system for the 3D scene. Supports up to 4 lights
 * of type Point, Directional, or Spot with full configuration.
 *
 * Features:
 * - Ambient light with configurable intensity
 * - Multi-light system with up to 4 lights (Point, Directional, Spot)
 * - Per-light enable/disable, color, intensity, position, rotation
 * - Spot light cone angle and penumbra
 * - Optional visual indicators for light positions
 * - Backward compatible with legacy single-light system
 *
 * @example
 * ```tsx
 * <Canvas>
 *   <SceneLighting />
 *   <PolytopeRenderer />
 * </Canvas>
 * ```
 *
 * @see {@link useLightingStore} for lighting configuration state
 */

import type { LightSource } from '@/rendering/lights/types';
import { rotationToDirection } from '@/rendering/lights/types';
import type { ShadowQuality } from '@/rendering/shadows/types';
import { useLightingStore } from '@/stores/lightingStore';
import { memo, useEffect, useMemo, useRef } from 'react';
import { MeshBasicMaterial, SphereGeometry, Vector3 } from 'three';

/**
 * Shadow map size for each quality level.
 * Higher resolution = sharper shadows but more GPU memory.
 */
const SHADOW_MAP_SIZES: Record<ShadowQuality, number> = {
  low: 512,
  medium: 1024,
  high: 2048,
  ultra: 4096,
};

/**
 * Convert shadow softness (0-2) to shadow radius for PCFSoftShadowMap.
 * Higher radius = softer shadow edges.
 * @param softness
 */
function getShadowRadius(softness: number): number {
  // Scale softness (0-2) to radius (0-8)
  return softness * 4;
}

/**
 * Shared sphere geometry for the light indicator.
 * Created once and reused.
 */
const LIGHT_INDICATOR_GEOMETRY = new SphereGeometry(1, 16, 16);

/**
 * Default distance for the legacy point light from the origin.
 */
const LIGHT_DISTANCE = 10;

/**
 * Individual light renderer component for the multi-light system.
 * Renders the appropriate Three.js light based on light type.
 */
interface LightRendererProps {
  light: LightSource;
  showIndicator: boolean;
  shadowEnabled: boolean;
  shadowMapSize: number;
  shadowRadius: number;
  shadowBias: number;
}

const LightRenderer = memo(function LightRenderer({
  light,
  showIndicator,
  shadowEnabled,
  shadowMapSize,
  shadowRadius,
  shadowBias,
}: LightRendererProps) {
  const position = light.position as [number, number, number];
  const direction = useMemo(() => {
    const dir = rotationToDirection(light.rotation);
    return new Vector3(dir[0], dir[1], dir[2]);
  }, [light.rotation]);

  // For directional/spot lights, calculate target position from direction
  const targetPosition = useMemo((): [number, number, number] => {
    // Target is position + direction
    return [
      light.position[0] + direction.x * 10,
      light.position[1] + direction.y * 10,
      light.position[2] + direction.z * 10,
    ];
  }, [light.position, direction]);

  // Create light indicator material
  const indicatorMaterial = useMemo(() => {
    return new MeshBasicMaterial({
      color: light.color,
      transparent: !light.enabled,
      opacity: light.enabled ? 1.0 : 0.3,
    });
  }, [light.color, light.enabled]);

  // Dispose material on change
  const materialRef = useRef<MeshBasicMaterial | null>(null);
  useEffect(() => {
    if (materialRef.current && materialRef.current !== indicatorMaterial) {
      materialRef.current.dispose();
    }
    materialRef.current = indicatorMaterial;

    return () => {
      if (materialRef.current) {
        materialRef.current.dispose();
        materialRef.current = null;
      }
    };
  }, [indicatorMaterial]);

  if (!light.enabled) {
    // Only render indicator for disabled lights
    return showIndicator ? (
      <mesh
        position={position}
        scale={0.15}
        geometry={LIGHT_INDICATOR_GEOMETRY}
        material={indicatorMaterial}
      />
    ) : null;
  }

  return (
    <>
      {light.type === 'point' && (
        <pointLight
          position={position}
          color={light.color}
          intensity={light.intensity * 10}
          distance={light.range}
          decay={light.decay}
        />
      )}
      {light.type === 'directional' && (
        <directionalLight
          position={position}
          color={light.color}
          intensity={light.intensity}
          target-position={targetPosition}
          castShadow={shadowEnabled}
          shadow-mapSize-width={shadowMapSize}
          shadow-mapSize-height={shadowMapSize}
          shadow-camera-near={0.5}
          shadow-camera-far={50}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
          shadow-bias={-shadowBias}
          shadow-radius={shadowRadius}
        />
      )}
      {light.type === 'spot' && (
        <spotLight
          position={position}
          color={light.color}
          intensity={light.intensity * 10}
          distance={light.range}
          angle={(light.coneAngle * Math.PI) / 180}
          penumbra={light.penumbra}
          decay={light.decay}
          target-position={targetPosition}
          castShadow={shadowEnabled}
          shadow-mapSize-width={shadowMapSize}
          shadow-mapSize-height={shadowMapSize}
          shadow-camera-near={0.5}
          shadow-camera-far={light.range || 50}
          shadow-bias={-shadowBias}
          shadow-radius={shadowRadius}
        />
      )}
      {showIndicator && (
        <mesh
          position={position}
          scale={0.2}
          geometry={LIGHT_INDICATOR_GEOMETRY}
          material={indicatorMaterial}
        />
      )}
    </>
  );
});

/**
 * Renders ambient and multi-light system for the scene.
 *
 * @returns Three.js light components configured from visual store
 */
export const SceneLighting = memo(function SceneLighting() {
  // Multi-light system state
  const lights = useLightingStore((state) => state.lights);
  const showLightGizmos = useLightingStore((state) => state.showLightGizmos);

  // Shadow system state
  const shadowEnabled = useLightingStore((state) => state.shadowEnabled);
  const shadowQuality = useLightingStore((state) => state.shadowQuality);
  const shadowSoftness = useLightingStore((state) => state.shadowSoftness);
  const shadowMapBias = useLightingStore((state) => state.shadowMapBias);
  const shadowMapBlur = useLightingStore((state) => state.shadowMapBlur);

  // Compute shadow map size and radius from settings
  const shadowMapSize = SHADOW_MAP_SIZES[shadowQuality];
  // Use shadowMapBlur for polytopes (mesh-based objects) which supports PCF radius
  // shadowSoftness is used for SDF raymarched shadows
  const shadowRadiusValue = shadowMapBlur > 0 ? shadowMapBlur : getShadowRadius(shadowSoftness);

  // Legacy single-light state (for backward compatibility)
  const lightEnabled = useLightingStore((state) => state.lightEnabled);
  const lightColor = useLightingStore((state) => state.lightColor);
  const lightHorizontalAngle = useLightingStore((state) => state.lightHorizontalAngle);
  const lightVerticalAngle = useLightingStore((state) => state.lightVerticalAngle);
  const ambientIntensity = useLightingStore((state) => state.ambientIntensity);
  const ambientColor = useLightingStore((state) => state.ambientColor);
  const diffuseIntensity = useLightingStore((state) => state.diffuseIntensity);
  const lightStrength = useLightingStore((state) => state.lightStrength);
  const showLightIndicator = useLightingStore((state) => state.showLightIndicator);

  /**
   * Legacy light position from spherical coordinates (backward compatibility)
   */
  const legacyLightPosition = useMemo(() => {
    const h = (lightHorizontalAngle * Math.PI) / 180;
    const v = (lightVerticalAngle * Math.PI) / 180;
    return [
      Math.cos(v) * Math.cos(h) * LIGHT_DISTANCE,
      Math.sin(v) * LIGHT_DISTANCE,
      Math.cos(v) * Math.sin(h) * LIGHT_DISTANCE,
    ] as [number, number, number];
  }, [lightHorizontalAngle, lightVerticalAngle]);

  // Create legacy light indicator material
  const legacyIndicatorMaterial = useMemo(() => {
    return new MeshBasicMaterial({ color: lightColor });
  }, [lightColor]);

  // Dispose legacy material on change or unmount
  const materialRef = useRef<MeshBasicMaterial | null>(null);
  useEffect(() => {
    if (materialRef.current && materialRef.current !== legacyIndicatorMaterial) {
      materialRef.current.dispose();
    }
    materialRef.current = legacyIndicatorMaterial;

    return () => {
      if (materialRef.current) {
        materialRef.current.dispose();
        materialRef.current = null;
      }
    };
  }, [legacyIndicatorMaterial]);

  // Determine if we should use multi-light or legacy
  const useMultiLight = lights.length > 0;

  return (
    <>
      <ambientLight intensity={ambientIntensity} color={ambientColor} />

      {useMultiLight ? (
        // Multi-light system
        <>
          {lights.map((light) => (
            <LightRenderer
              key={light.id}
              light={light}
              showIndicator={showLightGizmos}
              shadowEnabled={shadowEnabled}
              shadowMapSize={shadowMapSize}
              shadowRadius={shadowRadiusValue}
              shadowBias={shadowMapBias}
            />
          ))}
        </>
      ) : (
        // Legacy single-light (backward compatibility)
        <>
          {lightEnabled && (
            <pointLight
              position={legacyLightPosition}
              color={lightColor}
              intensity={diffuseIntensity * (lightStrength ?? 1.0) * 10}
              distance={0}
              decay={0}
            />
          )}
          {showLightIndicator && lightEnabled && (
            <mesh
              position={legacyLightPosition}
              scale={0.2}
              geometry={LIGHT_INDICATOR_GEOMETRY}
              material={legacyIndicatorMaterial}
            />
          )}
        </>
      )}
    </>
  );
});
