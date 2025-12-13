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
 * @see {@link useVisualStore} for lighting configuration state
 */

import { useMemo, useRef, useEffect, memo } from 'react';
import { SphereGeometry, MeshBasicMaterial, Vector3 } from 'three';
import { useVisualStore } from '@/stores/visualStore';
import { rotationToDirection } from '@/lib/lights/types';
import type { LightSource } from '@/lib/lights/types';

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
}

const LightRenderer = memo(function LightRenderer({ light, showIndicator }: LightRendererProps) {
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
          distance={0}
          decay={0}
        />
      )}
      {light.type === 'directional' && (
        <directionalLight
          position={position}
          color={light.color}
          intensity={light.intensity}
          target-position={targetPosition}
        />
      )}
      {light.type === 'spot' && (
        <spotLight
          position={position}
          color={light.color}
          intensity={light.intensity * 10}
          distance={0}
          angle={(light.coneAngle * Math.PI) / 180}
          penumbra={light.penumbra}
          decay={0}
          target-position={targetPosition}
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
  const lights = useVisualStore((state) => state.lights);
  const showLightGizmos = useVisualStore((state) => state.showLightGizmos);

  // Legacy single-light state (for backward compatibility)
  const lightEnabled = useVisualStore((state) => state.lightEnabled);
  const lightColor = useVisualStore((state) => state.lightColor);
  const lightHorizontalAngle = useVisualStore((state) => state.lightHorizontalAngle);
  const lightVerticalAngle = useVisualStore((state) => state.lightVerticalAngle);
  const ambientIntensity = useVisualStore((state) => state.ambientIntensity);
  const diffuseIntensity = useVisualStore((state) => state.diffuseIntensity);
  const lightStrength = useVisualStore((state) => state.lightStrength);
  const showLightIndicator = useVisualStore((state) => state.showLightIndicator);

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
      <ambientLight intensity={ambientIntensity} />

      {useMultiLight ? (
        // Multi-light system
        <>
          {lights.map((light) => (
            <LightRenderer
              key={light.id}
              light={light}
              showIndicator={showLightGizmos}
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
