/**
 * Schrödinger-specific uniforms for quantum wavefunction visualization
 *
 * These uniforms define the quantum state configuration:
 * - Superposition terms (coefficients, energies)
 * - Per-dimension frequencies
 * - Quantum numbers for each term
 * - Volume rendering parameters
 */

// Constants for array sizes (must match TypeScript constants)
export const MAX_DIM = 11;
export const MAX_TERMS = 8;

export const schroedingerUniformsBlock = `
// ============================================
// Schrödinger Quantum Configuration Uniforms
// ============================================

// Array size constants
#define MAX_DIM 11
#define MAX_TERMS 8

// Quantum state configuration
uniform int uTermCount;                      // Number of superposition terms (1-8)
uniform float uOmega[MAX_DIM];               // Per-dimension frequencies
uniform int uQuantum[MAX_TERMS * MAX_DIM];   // Quantum numbers n[k][j] (flattened)
uniform vec2 uCoeff[MAX_TERMS];              // Complex coefficients c_k = (re, im)
uniform float uEnergy[MAX_TERMS];            // Precomputed energies E_k

// Volume rendering parameters
uniform float uTimeScale;      // Time evolution speed (0.1-2.0)
uniform float uFieldScale;     // Coordinate scale into HO basis (0.5-2.0)
uniform float uDensityGain;    // Absorption coefficient (0.1-5.0)
uniform int uColorMode;        // 0=density, 1=phase, 2=mixed

// Animation time (from global uTime, but scaled by uTimeScale)
uniform float uTime;

// Optional: Isosurface mode
uniform bool uIsoEnabled;      // Enable isosurface mode
uniform float uIsoThreshold;   // Log-density threshold for isosurface
`;
