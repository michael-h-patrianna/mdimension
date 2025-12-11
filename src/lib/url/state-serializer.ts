/**
 * URL State Serializer
 * Serializes and deserializes app state to/from URL parameters
 */

import type { PolytopeType } from '@/lib/geometry/types';

export interface ShareableState {
  dimension: number;
  objectType: PolytopeType;
  rotationAngles?: Map<string, number>;
  projectionDistance?: number;
  uniformScale?: number;
  isPlaying?: boolean;
  speed?: number;
}

/**
 * Serializes state to URL search params
 */
export function serializeState(state: ShareableState): string {
  const params = new URLSearchParams();

  params.set('d', state.dimension.toString());
  params.set('t', state.objectType);

  if (state.projectionDistance !== undefined) {
    params.set('pd', state.projectionDistance.toFixed(2));
  }

  if (state.uniformScale !== undefined && state.uniformScale !== 1) {
    params.set('s', state.uniformScale.toFixed(2));
  }

  if (state.rotationAngles && state.rotationAngles.size > 0) {
    const rotations: string[] = [];
    state.rotationAngles.forEach((angle, plane) => {
      if (angle !== 0) {
        rotations.push(`${plane}:${angle.toFixed(3)}`);
      }
    });
    if (rotations.length > 0) {
      params.set('r', rotations.join(','));
    }
  }

  if (state.isPlaying) {
    params.set('p', '1');
  }

  if (state.speed !== undefined && state.speed !== 1) {
    params.set('sp', state.speed.toFixed(2));
  }

  return params.toString();
}

/**
 * Deserializes state from URL search params
 */
export function deserializeState(searchParams: string): Partial<ShareableState> {
  const params = new URLSearchParams(searchParams);
  const state: Partial<ShareableState> = {};

  const dimension = params.get('d');
  if (dimension) {
    const dim = parseInt(dimension, 10);
    if (dim >= 3 && dim <= 6) {
      state.dimension = dim;
    }
  }

  const objectType = params.get('t');
  if (objectType && ['hypercube', 'simplex', 'cross-polytope'].includes(objectType)) {
    state.objectType = objectType as PolytopeType;
  }

  const projectionDistance = params.get('pd');
  if (projectionDistance) {
    const pd = parseFloat(projectionDistance);
    if (!isNaN(pd) && pd > 0) {
      state.projectionDistance = pd;
    }
  }

  const uniformScale = params.get('s');
  if (uniformScale) {
    const s = parseFloat(uniformScale);
    if (!isNaN(s) && s > 0) {
      state.uniformScale = s;
    }
  }

  const rotations = params.get('r');
  if (rotations) {
    const rotationAngles = new Map<string, number>();
    rotations.split(',').forEach((pair) => {
      const [plane, angleStr] = pair.split(':');
      if (plane && angleStr) {
        const angle = parseFloat(angleStr);
        if (!isNaN(angle)) {
          rotationAngles.set(plane, angle);
        }
      }
    });
    if (rotationAngles.size > 0) {
      state.rotationAngles = rotationAngles;
    }
  }

  const isPlaying = params.get('p');
  if (isPlaying === '1') {
    state.isPlaying = true;
  }

  const speed = params.get('sp');
  if (speed) {
    const sp = parseFloat(speed);
    if (!isNaN(sp) && sp > 0) {
      state.speed = sp;
    }
  }

  return state;
}

/**
 * Generates a shareable URL with current state
 */
export function generateShareUrl(state: ShareableState): string {
  const serialized = serializeState(state);
  const baseUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
  return serialized ? `${baseUrl}?${serialized}` : baseUrl;
}

/**
 * Parses the current URL to extract state
 */
export function parseCurrentUrl(): Partial<ShareableState> {
  if (typeof window === 'undefined') {
    return {};
  }
  return deserializeState(window.location.search);
}
