/**
 * Scene Fog Component
 *
 * Applies fog to the scene based on environment store settings.
 * Supports two modes:
 * - Linear: Fog with defined near/far distances
 * - Volumetric: Exponential fog with density (more atmospheric)
 */

import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import { useEnvironmentStore } from '@/stores/environmentStore';
import React from 'react';
import { useShallow } from 'zustand/react/shallow';

export const SceneFog: React.FC = () => {
  const { scene } = useThree();

  const { fogEnabled, fogType, fogDensity, fogNear, fogFar, fogColor } = useEnvironmentStore(
    useShallow((state) => ({
      fogEnabled: state.fogEnabled,
      fogType: state.fogType,
      fogDensity: state.fogDensity,
      fogNear: state.fogNear,
      fogFar: state.fogFar,
      fogColor: state.fogColor,
    }))
  );

  useEffect(() => {
    if (!fogEnabled || fogType === 'physical') {
      scene.fog = null;
      return;
    }

    const color = new THREE.Color(fogColor);

    if (fogType === 'volumetric') {
      // Exponential fog - creates volumetric atmospheric effect
      scene.fog = new THREE.FogExp2(color, fogDensity);
    } else {
      // Linear fog - fog with defined start/end distances
      scene.fog = new THREE.Fog(color, fogNear, fogFar);
    }

    return () => {
      scene.fog = null;
    };
  }, [scene, fogEnabled, fogType, fogDensity, fogNear, fogFar, fogColor]);

  return null;
};
