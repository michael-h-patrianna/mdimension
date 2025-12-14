/**
 * N-dimensional matrix operations
 * All operations are pure functions with no side effects
 */

import type { MatrixND, VectorND } from './types'
import { EPSILON } from './types'

/**
 * Creates an n×n identity matrix
 * Formula: I[i][j] = 1 if i === j, else 0
 * @param dimension - The size of the matrix (n×n)
 * @returns A new identity matrix
 * @throws {Error} If dimension is not a positive integer
 */
export function createIdentityMatrix(dimension: number): MatrixND {
  if (dimension <= 0 || !Number.isInteger(dimension)) {
    throw new Error('Dimension must be a positive integer')
  }

  const matrix: MatrixND = []
  for (let i = 0; i < dimension; i++) {
    const row: number[] = []
    for (let j = 0; j < dimension; j++) {
      row[j] = i === j ? 1 : 0
    }
    matrix[i] = row
  }
  return matrix
}

/**
 * Creates a matrix filled with zeros
 * @param rows - Number of rows
 * @param cols - Number of columns
 * @returns A new zero matrix
 * @throws {Error} If dimensions are not positive integers
 */
export function createZeroMatrix(rows: number, cols: number): MatrixND {
  if (rows <= 0 || cols <= 0 || !Number.isInteger(rows) || !Number.isInteger(cols)) {
    throw new Error('Matrix dimensions must be positive integers')
  }

  const matrix: MatrixND = []
  for (let i = 0; i < rows; i++) {
    matrix[i] = new Array(cols).fill(0)
  }
  return matrix
}

/**
 * Multiplies two matrices
 * Formula: C[i][j] = Σ(A[i][k] * B[k][j])
 * @param a - First matrix (m×n)
 * @param b - Second matrix (n×p)
 * @param out - Optional output matrix to avoid allocation (must be m×p)
 * @returns Product matrix (m×p)
 * @throws {Error} If matrix dimensions are incompatible
 */
export function multiplyMatrices(a: MatrixND, b: MatrixND, out?: MatrixND): MatrixND {
  if (a.length === 0 || b.length === 0) {
    throw new Error('Cannot multiply empty matrices')
  }

  const aRows = a.length
  const aCols = a[0]!.length
  const bRows = b.length
  const bCols = b[0]!.length

  if (aCols !== bRows) {
    throw new Error(
      `Matrix dimensions incompatible for multiplication: ${aRows}×${aCols} and ${bRows}×${bCols}`
    )
  }

  // Use provided output matrix or allocate new one
  const result = out ?? createZeroMatrix(aRows, bCols)

  for (let i = 0; i < aRows; i++) {
    for (let j = 0; j < bCols; j++) {
      let sum = 0
      for (let k = 0; k < aCols; k++) {
        sum += a[i]![k]! * b[k]![j]!
      }
      result[i]![j] = sum
    }
  }

  return result
}

/**
 * Multiplies a matrix by a vector
 * Formula: b[i] = Σ(M[i][j] * v[j])
 * @param m - Matrix (n×m)
 * @param v - Vector (m)
 * @param out
 * @returns Result vector (n)
 * @throws {Error} If dimensions are incompatible
 */
export function multiplyMatrixVector(m: MatrixND, v: VectorND, out?: VectorND): VectorND {
  if (m.length === 0) {
    throw new Error('Cannot multiply with empty matrix')
  }

  const rows = m.length
  const cols = m[0]!.length

  if (cols !== v.length) {
    throw new Error(`Matrix-vector dimensions incompatible: ${rows}×${cols} and ${v.length}`)
  }

  const result: VectorND = out ?? new Array(rows)

  // If reusing array, ensure it has correct length (caller should manage this for perf)
  if (out && out.length < rows) {
    // Output array is too small to hold all results
    if (import.meta.env.DEV) {
      console.warn(
        `multiplyMatrixVector: Output array length (${out.length}) is smaller than result rows (${rows}). Results may be truncated.`
      )
    }
  }

  for (let i = 0; i < rows; i++) {
    let sum = 0
    for (let j = 0; j < cols; j++) {
      sum += m[i]![j]! * v[j]!
    }
    result[i] = sum
  }

  return result
}

/**
 * Transposes a matrix (swap rows and columns)
 * Formula: B[j][i] = A[i][j]
 * @param m - Input matrix (m×n)
 * @returns Transposed matrix (n×m)
 */
export function transposeMatrix(m: MatrixND): MatrixND {
  if (m.length === 0) {
    return []
  }

  const rows = m.length
  const cols = m[0]!.length
  const result = createZeroMatrix(cols, rows)

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[j]![i] = m[i]![j]!
    }
  }

  return result
}

/**
 * Computes the determinant of a square matrix using recursive Laplace expansion
 * Formula: det(A) = Σ((-1)^(i+j) * A[i][j] * det(minor[i][j]))
 * @param m - Square matrix
 * @returns The determinant
 * @throws {Error} If matrix is not square
 */
export function determinant(m: MatrixND): number {
  if (m.length === 0) {
    throw new Error('Cannot compute determinant of empty matrix')
  }

  const n = m.length

  // Validate square matrix
  for (let i = 0; i < n; i++) {
    if (m[i]!.length !== n) {
      throw new Error(`Matrix must be square: row ${i} has ${m[i]!.length} columns, expected ${n}`)
    }
  }

  // Base cases
  if (n === 1) {
    return m[0]![0]!
  }

  if (n === 2) {
    return m[0]![0]! * m[1]![1]! - m[0]![1]! * m[1]![0]!
  }

  // Recursive case: Laplace expansion along first row
  let det = 0
  for (let j = 0; j < n; j++) {
    const minor = getMinor(m, 0, j)
    const cofactor = (j % 2 === 0 ? 1 : -1) * m[0]![j]! * determinant(minor)
    det += cofactor
  }

  return det
}

/**
 * Gets the minor matrix by removing specified row and column
 * @param m - Input matrix
 * @param row - Row to remove
 * @param col - Column to remove
 * @returns Minor matrix
 */
function getMinor(m: MatrixND, row: number, col: number): MatrixND {
  const n = m.length
  const minor: MatrixND = []

  for (let i = 0; i < n; i++) {
    if (i === row) continue

    const newRow: number[] = []
    for (let j = 0; j < n; j++) {
      if (j === col) continue
      newRow.push(m[i]![j]!)
    }
    minor.push(newRow)
  }

  return minor
}

/**
 * Checks if two matrices are approximately equal within epsilon
 * @param a - First matrix
 * @param b - Second matrix
 * @param epsilon - Tolerance for floating point comparison
 * @returns True if matrices are approximately equal
 */
export function matricesEqual(a: MatrixND, b: MatrixND, epsilon = EPSILON): boolean {
  if (a.length !== b.length) {
    return false
  }

  for (let i = 0; i < a.length; i++) {
    if (a[i]!.length !== b[i]!.length) {
      return false
    }
    for (let j = 0; j < a[i]!.length; j++) {
      if (Math.abs(a[i]![j]! - b[i]![j]!) >= epsilon) {
        return false
      }
    }
  }

  return true
}

/**
 * Creates a deep copy of a matrix
 * @param m - Input matrix
 * @param out - Optional output matrix to avoid allocation
 * @returns Matrix with the same values
 */
export function copyMatrix(m: MatrixND, out?: MatrixND): MatrixND {
  const rows = m.length
  if (rows === 0) return []
  const cols = m[0]!.length
  const result = out ?? new Array(rows)
  for (let i = 0; i < rows; i++) {
    if (!result[i]) {
      result[i] = new Array(cols)
    }
    for (let j = 0; j < cols; j++) {
      result[i]![j] = m[i]![j]!
    }
  }
  return result
}

/**
 * Gets the dimensions of a matrix
 * @param m - Input matrix
 * @returns [rows, cols]
 */
export function getMatrixDimensions(m: MatrixND): [number, number] {
  if (m.length === 0) {
    return [0, 0]
  }
  return [m.length, m[0]!.length]
}
