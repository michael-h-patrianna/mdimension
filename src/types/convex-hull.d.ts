/**
 * Type declarations for convex-hull module
 * @see https://github.com/mikolalysenko/convex-hull
 */
declare module 'convex-hull' {
  /**
   * Computes the convex hull of a set of n-dimensional points
   *
   * @param points - Array of n-dimensional points, each point is an array of coordinates
   * @returns Array of facets, where each facet is an array of vertex indices
   *
   * For d-dimensional points, returns (d-1)-dimensional simplices as boundary facets.
   * - 2D: returns edges (pairs of indices)
   * - 3D: returns triangular faces (triples of indices)
   * - 4D+: returns (d-1)-simplices (d-tuples of indices)
   */
  function convexHull(points: number[][]): number[][]

  export default convexHull
}
