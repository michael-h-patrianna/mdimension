/**
 * Test to debug Wythoff polytope face detection in higher dimensions
 */

import { describe, it, expect } from 'vitest'
import { generateGeometry } from '@/lib/geometry'
import { detectFaces, getFaceDetectionMethod } from '@/lib/geometry'

describe('Wythoff polytope face detection', () => {
  it('should detect faces for wythoff-polytope in 4D', () => {
    const geo = generateGeometry('wythoff-polytope', 4, {
      wythoffPolytope: {
        symmetryGroup: 'B',
        preset: 'regular',
        scale: 1.0,
        snub: false,
      }
    })

    console.log('=== 4D Wythoff Regular (Tesseract) ===')
    console.log('Vertices:', geo.vertices.length)
    console.log('Edges:', geo.edges.length)
    console.log('Metadata:', JSON.stringify(geo.metadata, null, 2))

    const faceMethod = getFaceDetectionMethod('wythoff-polytope')
    console.log('Face detection method:', faceMethod)

    const faces = detectFaces(geo.vertices, geo.edges, 'wythoff-polytope', geo.metadata)
    console.log('Detected faces:', faces.length)

    // Tesseract has 24 square 2-faces, should detect some faces
    expect(faces.length).toBeGreaterThan(0)
  })

  it('should detect faces for wythoff-polytope in 6D', () => {
    const geo = generateGeometry('wythoff-polytope', 6, {
      wythoffPolytope: {
        symmetryGroup: 'B',
        preset: 'regular',
        scale: 1.0,
        snub: false,
      }
    })

    console.log('=== 6D Wythoff Regular ===')
    console.log('Vertices:', geo.vertices.length)
    console.log('Edges:', geo.edges.length)
    console.log('analyticalFaces in metadata:', geo.metadata?.properties?.analyticalFaces?.length ?? 'MISSING')

    const faceMethod = getFaceDetectionMethod('wythoff-polytope')
    console.log('Face detection method:', faceMethod)

    const faces = detectFaces(geo.vertices, geo.edges, 'wythoff-polytope', geo.metadata)
    console.log('Detected faces:', faces.length)

    expect(faces.length).toBeGreaterThan(0)
  })

  it('should detect faces for wythoff-polytope rectified preset', () => {
    const geo = generateGeometry('wythoff-polytope', 4, {
      wythoffPolytope: {
        symmetryGroup: 'B',
        preset: 'rectified',
        scale: 1.0,
        snub: false,
      }
    })

    console.log('=== 4D Wythoff Rectified ===')
    console.log('Vertices:', geo.vertices.length)
    console.log('Edges:', geo.edges.length)
    console.log('analyticalFaces in metadata:', geo.metadata?.properties?.analyticalFaces?.length ?? 'MISSING')

    const faceMethod = getFaceDetectionMethod('wythoff-polytope')
    console.log('Face detection method:', faceMethod)

    const faces = detectFaces(geo.vertices, geo.edges, 'wythoff-polytope', geo.metadata)
    console.log('Detected faces:', faces.length)

    // Even for rectified, should have faces
    expect(faces.length).toBeGreaterThan(0)
  })

  it('should detect faces for root-system in 6D', () => {
    const geo = generateGeometry('root-system', 6, {
      rootSystem: {
        rootType: 'D',
        rank: 6,
        scale: 1.0,
        showPositive: true,
        showNegative: true,
      }
    })

    console.log('=== 6D Root System D_6 ===')
    console.log('Vertices:', geo.vertices.length)
    console.log('Edges:', geo.edges.length)

    const faceMethod = getFaceDetectionMethod('root-system')
    console.log('Face detection method:', faceMethod)

    const faces = detectFaces(geo.vertices, geo.edges, 'root-system', geo.metadata)
    console.log('Detected faces:', faces.length)

    // D_6 should have many faces
    expect(faces.length).toBeGreaterThan(0)
  })
})
