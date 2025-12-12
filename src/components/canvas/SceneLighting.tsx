/**
 * Scene Lighting Component
 *
 * Manages ambient and directional lighting for the 3D scene with dynamic positioning
 * based on spherical coordinates. The light position is calculated from horizontal
 * and vertical angles to provide intuitive control over light direction.
 *
 * Features:
 * - Ambient light with configurable intensity
 * - Directional light with spherical coordinate positioning
 * - Optional visual indicator for light direction
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
import { SphereGeometry, MeshBasicMaterial, Color } from 'three';
import { useVisualStore } from '@/stores/visualStore';

/**
 * Shared sphere geometry for the light indicator.
 * Created once and reused.
 */
const LIGHT_INDICATOR_GEOMETRY = new SphereGeometry(1, 16, 16);

/**
 * Renders ambient and directional lighting for the scene.
 *
 * @returns Three.js light components configured from visual store
 */
export const SceneLighting = memo(function SceneLighting() {
  const lightEnabled = useVisualStore((state) => state.lightEnabled);
  const lightColor = useVisualStore((state) => state.lightColor);
  const lightHorizontalAngle = useVisualStore((state) => state.lightHorizontalAngle);
  const lightVerticalAngle = useVisualStore((state) => state.lightVerticalAngle);
  const ambientIntensity = useVisualStore((state) => state.ambientIntensity);
  const showLightIndicator = useVisualStore((state) => state.showLightIndicator);

  /**
   * Calculate light position from spherical coordinates.
   *
   * Converts horizontal and vertical angles to Cartesian coordinates
   * for positioning the directional light in 3D space.
   *
   * @remarks
   * - Distance is fixed at 10 units from origin
   * - Uses standard spherical coordinate conversion:
   *   - x = r * cos(v) * cos(h)
   *   - y = r * sin(v)
   *   - z = r * cos(v) * sin(h)
   */
  const lightPosition = useMemo(() => {
    const h = (lightHorizontalAngle * Math.PI) / 180;
    const v = (lightVerticalAngle * Math.PI) / 180;
    const distance = 10;
    return [
      Math.cos(v) * Math.cos(h) * distance,
      Math.sin(v) * distance,
      Math.cos(v) * Math.sin(h) * distance,
    ] as [number, number, number];
  }, [lightHorizontalAngle, lightVerticalAngle]);

  // Create light indicator material only when color changes
  const indicatorMaterial = useMemo(() => {
    return new MeshBasicMaterial({ color: new Color(lightColor) });
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
        <directionalLight
          position={lightPosition}
          color={lightColor}
          intensity={1.0}
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
