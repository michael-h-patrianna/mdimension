declare module 'mdimension-core' {
  /**
   * Initialize the WASM module
   */
  export default function init(): Promise<void>;

  /**
   * Initialize panic hook for better error logging
   */
  export function start(): void;

  /**
   * Log a greeting to the console
   */
  export function greet(name: string): void;

  /**
   * Add two numbers (sanity check)
   */
  export function add_wasm(a: number, b: number): number;

  /**
   * Compute convex hull of N-dimensional points.
   * Returns flat array of triangle vertex indices.
   * @param flat_vertices Flat array of coordinates
   * @param dimension Dimension of points
   */
  export function compute_convex_hull_wasm(flat_vertices: Float64Array, dimension: number): Uint32Array;

  /**
   * Wythoff configuration object
   */
  export interface WythoffConfigWasm {
    symmetry_group: string;
    preset: string;
    dimension: number;
    scale: number;
    custom_symbol?: boolean[];
  }

  /**
   * Result from Wythoff generation.
   * Note: serde_wasm_bindgen returns plain JS arrays, not TypedArrays.
   * The worker wraps these in TypedArrays for zero-copy transfer.
   */
  export interface PolytopeResultWasm {
    /** Flat array of vertex coordinates (plain JS array from serde) */
    vertices: number[];
    /** Flat array of edge indices [v0, v1, v0, v1, ...] (plain JS array from serde) */
    edges: number[];
    /** Flat array of face indices (triangulated) [v0, v1, v2, ...] (plain JS array from serde) */
    faces: number[];
    /** Dimension of the polytope */
    dimension: number;
    /** Warning messages from generation */
    warnings: string[];
  }

  /**
   * Result from root system generation.
   */
  export interface RootSystemResultWasm {
    /** Flat array of vertex coordinates */
    vertices: number[];
    /** Flat array of edge indices [v0, v1, v0, v1, ...] */
    edges: number[];
    /** Dimension of the root system */
    dimension: number;
    /** Number of vertices generated */
    vertex_count: number;
    /** Number of edges generated */
    edge_count: number;
  }

  /**
   * Generate Wythoff polytope geometry in WASM.
   */
  export function generate_wythoff_wasm(config: WythoffConfigWasm): PolytopeResultWasm;

  /**
   * Detect faces of a polytope in WASM.
   * @param flat_vertices Flat array of vertex coordinates
   * @param flat_edges Flat array of edge indices (required for 'triangles' method)
   * @param dimension Dimension of vertices
   * @param method Detection method: 'convex-hull' or 'triangles'
   * @returns Flat array of triangle indices [v0, v1, v2, v0, v1, v2, ...]
   */
  export function detect_faces_wasm(
    flat_vertices: Float64Array,
    flat_edges: Uint32Array,
    dimension: number,
    method: string
  ): Uint32Array;

  /**
   * Build KNN edges connecting each point to its k nearest neighbors.
   * @param flat_points Flat array of point coordinates [p0_d0, p0_d1, ..., p1_d0, ...]
   * @param dimension Dimensionality of each point
   * @param k Number of nearest neighbors to connect
   * @returns Flat array of edge indices [e0_v0, e0_v1, e1_v0, e1_v1, ...]
   */
  export function build_knn_edges_wasm(
    flat_points: Float64Array,
    dimension: number,
    k: number
  ): Uint32Array;

  /**
   * Build edges connecting vertices at minimum nonzero distance.
   * Used for root systems and mathematically structured point sets.
   * @param flat_vertices Flat array of vertex coordinates
   * @param dimension Dimensionality of each vertex
   * @param epsilon_factor Tolerance factor for distance matching (e.g., 0.01 for 1%)
   * @returns Flat array of edge indices [e0_v0, e0_v1, e1_v0, e1_v1, ...]
   */
  export function build_short_edges_wasm(
    flat_vertices: Float64Array,
    dimension: number,
    epsilon_factor: number
  ): Uint32Array;

  /**
   * Generate a complete root system with vertices and edges.
   * @param root_type Type of root system: "A", "D", or "E8"
   * @param dimension Ambient dimension
   * @param scale Scale factor for the roots
   * @returns Complete root system result with vertices and edges
   */
  export function generate_root_system_wasm(
    root_type: string,
    dimension: number,
    scale: number
  ): RootSystemResultWasm;
}
