import { describe, expect, test } from 'vitest'

import { float, uniform, vec3 } from 'three/tsl'

import { createBendRay } from '@/rendering/tsl/raymarching/blackhole/gravity/lensing'

describe('BlackHole TSL lensing', () => {
  test('createBendRay does not depend on uRayBendingMode (WebGL parity)', () => {
    const uGravityStrength = uniform(1.0)
    const uDistanceFalloff = uniform(2.0)
    const uEpsilonMul = uniform(0.1)
    const uDimPower = uniform(1.0)
    const uHorizonRadius = uniform(1.0)
    const uOriginOffsetLengthSq = uniform(0.0)
    const uSpin = uniform(0.0)
    const uBendScale = uniform(1.0)
    const uBendMaxPerStep = uniform(0.5)
    const uLensingClamp = uniform(10.0)

    // Present but MUST NOT affect the node graph (WebGL declares it but bendRay doesn't use it)
    const uRayBendingMode = uniform(0.0)

    const bendRay = createBendRay({
      uGravityStrength,
      uDistanceFalloff,
      uEpsilonMul,
      uDimPower,
      uHorizonRadius,
      uOriginOffsetLengthSq,
      uSpin,
      uBendScale,
      uBendMaxPerStep,
      uLensingClamp,
      uRayBendingMode,
    })

    const node = bendRay(vec3(0, 0, -1), vec3(1, 0, 0), float(0.1), float(1.0))

    // Sanity: serializable (ensures node graph is buildable)
    const json = node.toJSON()
    const jsonText = JSON.stringify(json)

    // Best-effort: assert the uniform node isn't referenced in the graph JSON
    // (if Three.js changes JSON shape, this still remains a safety net)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rayBendingUuid = (uRayBendingMode as any).uuid as string | undefined
    if (rayBendingUuid) {
      expect(jsonText).not.toContain(rayBendingUuid)
    }
  })
})


