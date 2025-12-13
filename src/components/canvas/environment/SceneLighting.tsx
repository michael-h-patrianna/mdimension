/**
 * Scene Lighting Component
 *
 * Manages ambient and point lighting for the 3D scene with dynamic positioning
 * based on spherical coordinates. The light position is calculated from horizontal
 * and vertical angles to provide intuitive control over light position.
 *
 * Features:
 * - Ambient light with configurable intensity
 * - Point light with spherical coordinate positioning
 * - Optional visual indicator for light position
 * - Reactive to visual store state changes
 *
 * @example
 * ```tsx
 * <Canvas>
 *   <SceneLighting />
 *   <PolytopeRenderer />
 * </Canvas>
 * ```
 *
 * @remarks
 * - Light position is calculated at a fixed distance of 10 units from origin
 * - Spherical coordinates use standard mathematical convention:
 *   - Horizontal angle: 0-360 degrees (rotation around Y-axis)
 *   - Vertical angle: -90 to 90 degrees (elevation from XZ plane)
 * - Light indicator is only visible when both lightEnabled and showLightIndicator are true
 *
 * @see {@link useVisualStore} for lighting configuration state
 */

import { useMemo, useRef, useEffect, memo } from 'react';
import { SphereGeometry, MeshBasicMaterial } from 'three';
import { useVisualStore } from '@/stores/visualStore';

/**
 * Shared sphere geometry for the light indicator.
 * Created once and reused.
 */
const LIGHT_INDICATOR_GEOMETRY = new SphereGeometry(1, 16, 16);

/**
 * Default distance for the point light from the origin.
 * PointLight has distance falloff, so this affects the scene uniformly.
 */
const LIGHT_DISTANCE = 10;

/**
 * Renders ambient and point lighting for the scene.
 *
 * @returns Three.js light components configured from visual store
 */
export const SceneLighting = memo(function SceneLighting() {
  const lightEnabled = useVisualStore((state) => state.lightEnabled);
  const lightColor = useVisualStore((state) => state.lightColor);
  const lightHorizontalAngle = useVisualStore((state) => state.lightHorizontalAngle);
  const lightVerticalAngle = useVisualStore((state) => state.lightVerticalAngle);
  const ambientIntensity = useVisualStore((state) => state.ambientIntensity);
  const diffuseIntensity = useVisualStore((state) => state.diffuseIntensity);
  const lightStrength = useVisualStore((state) => state.lightStrength);
  const showLightIndicator = useVisualStore((state) => state.showLightIndicator);

  /**
   * Calculate light position from spherical coordinates.
   *
   * Converts horizontal and vertical angles to Cartesian coordinates
   * for positioning the point light in 3D space.
   *
   * @remarks
   * - Distance is fixed at LIGHT_DISTANCE units from origin
   * - Uses standard spherical coordinate conversion:
   *   - x = r * cos(v) * cos(h)
   *   - y = r * sin(v)
   *   - z = r * cos(v) * sin(h)
   */
  const lightPosition = useMemo(() => {
    const h = (lightHorizontalAngle * Math.PI) / 180;
    const v = (lightVerticalAngle * Math.PI) / 180;
    return [
      Math.cos(v) * Math.cos(h) * LIGHT_DISTANCE,
      Math.sin(v) * LIGHT_DISTANCE,
      Math.cos(v) * Math.sin(h) * LIGHT_DISTANCE,
    ] as [number, number, number];
  }, [lightHorizontalAngle, lightVerticalAngle]);

  // Create light indicator material only when color changes
  // Note: MeshBasicMaterial accepts string color directly, no need for Color object
  const indicatorMaterial = useMemo(() => {
    return new MeshBasicMaterial({ color: lightColor });
  }, [lightColor]);

  // Dispose material on change or unmount
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

  return (
    <>
      <ambientLight intensity={ambientIntensity} />
      {lightEnabled && (
        <pointLight
          position={lightPosition}
          color={lightColor}
          intensity={diffuseIntensity * (lightStrength ?? 1.0) * 10}
          distance={0}
          decay={0}
        />
      )}
      {showLightIndicator && lightEnabled && (
        <mesh
          position={lightPosition}
          scale={0.2}
          geometry={LIGHT_INDICATOR_GEOMETRY}
          material={indicatorMaterial}
        />
      )}
    </>
  );
});
