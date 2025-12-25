use wasm_bindgen::prelude::*;

// Import the `window.console.log` function from the Web.
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

// Initialize the panic hook to get nice error messages in the console
#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
    log("WASM Module Initialized (with panic hook)");
}

mod hull;
mod knn;
mod edges;
mod roots;
mod animation;

#[wasm_bindgen]
pub fn compute_convex_hull_wasm(flat_vertices: &[f64], dimension: usize) -> Vec<usize> {
    // 1. Reconstruct vectors from flat array
    let chunk_size = dimension;
    let mut vertices = Vec::with_capacity(flat_vertices.len() / dimension);
    for chunk in flat_vertices.chunks(chunk_size) {
        vertices.push(chunk.to_vec());
    }

    // 2. Project to Affine Hull
    let (projected, dim) = hull::project_to_affine_hull(&vertices, dimension);

    // 3. Compute Hull
    hull::convex_hull(&projected, dim)
}

mod wythoff;

#[wasm_bindgen]
pub fn generate_wythoff_wasm(val: JsValue) -> Result<JsValue, JsValue> {
    let config: wythoff::WythoffConfig = serde_wasm_bindgen::from_value(val)?;
    let result = wythoff::generate_wythoff(&config);
    Ok(serde_wasm_bindgen::to_value(&result)?)
}

mod faces;

use nalgebra::DVector;

#[wasm_bindgen]
pub fn detect_faces_wasm(flat_vertices: &[f64], flat_edges: &[u32], dimension: usize, method: &str) -> Vec<u32> {
    // Reconstruct vertices
    let chunk_size = dimension;
    let mut vertices = Vec::with_capacity(flat_vertices.len() / dimension);
    for chunk in flat_vertices.chunks(chunk_size) {
        vertices.push(DVector::from_row_slice(chunk));
    }

    match method {
        "convex-hull" => {
             // 1. Vector of Vectors expected by hull::project_to_affine_hull
             let vec_vertices: Vec<Vec<f64>> = vertices.iter()
                .map(|v| v.iter().cloned().collect())
                .collect();

             let (projected, dim) = hull::project_to_affine_hull(&vec_vertices, dimension);
             let hull_indices = hull::convex_hull(&projected, dim);

             // Convert usize to u32
             hull_indices.into_iter().map(|idx| idx as u32).collect()
        },
        "triangles" => {
            faces::find_triangles(&vertices, flat_edges)
        },
        _ => vec![]
    }
}

// ============================================================================
// KNN Edge Builder
// ============================================================================

/// Builds edges connecting each point to its k nearest neighbors.
///
/// # Arguments
/// * `flat_points` - Flattened array of point coordinates [p0_d0, p0_d1, ..., p1_d0, ...]
/// * `dimension` - Dimensionality of each point
/// * `k` - Number of nearest neighbors to connect
///
/// # Returns
/// Flattened edge indices [e0_v0, e0_v1, e1_v0, e1_v1, ...]
#[wasm_bindgen]
pub fn build_knn_edges_wasm(flat_points: &[f64], dimension: usize, k: usize) -> Vec<u32> {
    knn::build_knn_edges(flat_points, dimension, k)
}

// ============================================================================
// Short Edges Builder
// ============================================================================

/// Builds edges connecting vertices at minimum nonzero distance.
///
/// Used for root systems and mathematically structured point sets.
///
/// # Arguments
/// * `flat_vertices` - Flattened array of vertex coordinates
/// * `dimension` - Dimensionality of each vertex
/// * `epsilon_factor` - Tolerance factor for distance matching (e.g., 0.01)
///
/// # Returns
/// Flattened edge indices [e0_v0, e0_v1, e1_v0, e1_v1, ...]
#[wasm_bindgen]
pub fn build_short_edges_wasm(flat_vertices: &[f64], dimension: usize, epsilon_factor: f64) -> Vec<u32> {
    edges::build_short_edges(flat_vertices, dimension, epsilon_factor)
}

// ============================================================================
// Root System Generator
// ============================================================================

use serde::Serialize;

/// Result structure for root system generation (serializable)
#[derive(Serialize)]
pub struct RootSystemResultWasm {
    /// Flat array of vertex coordinates
    pub vertices: Vec<f64>,
    /// Flat array of edge indices [v0, v1, v0, v1, ...]
    pub edges: Vec<u32>,
    /// Dimension of the root system
    pub dimension: usize,
    /// Number of vertices generated
    pub vertex_count: usize,
    /// Number of edges generated
    pub edge_count: usize,
}

/// Generates a complete root system with vertices and edges.
///
/// # Arguments
/// * `root_type` - Type of root system: "A", "D", or "E8"
/// * `dimension` - Ambient dimension
/// * `scale` - Scale factor
///
/// # Returns
/// Complete root system result as JsValue
#[wasm_bindgen]
pub fn generate_root_system_wasm(root_type: &str, dimension: usize, scale: f64) -> Result<JsValue, JsValue> {
    let result = roots::generate_root_system(root_type, dimension, scale);

    let wasm_result = RootSystemResultWasm {
        vertices: result.vertices,
        edges: result.edges,
        dimension: result.dimension,
        vertex_count: result.vertex_count,
        edge_count: result.edge_count,
    };

    Ok(serde_wasm_bindgen::to_value(&wasm_result)?)
}

// ============================================================================
// Animation Operations (Hot Path - 60 FPS)
// ============================================================================

/// Composes multiple rotations from plane names and angles.
///
/// # Arguments
/// * `dimension` - The dimensionality of the space
/// * `plane_names` - Array of plane names (e.g., ["XY", "XW", "ZW"])
/// * `angles` - Array of rotation angles in radians (same length as plane_names)
///
/// # Returns
/// Flat rotation matrix (dimension × dimension) as Float64Array
#[wasm_bindgen]
pub fn compose_rotations_wasm(dimension: usize, plane_names: Vec<String>, angles: Vec<f64>) -> Vec<f64> {
    animation::compose_rotations(dimension, &plane_names, &angles)
}

/// Projects n-dimensional vertices to 3D positions using perspective projection.
///
/// # Arguments
/// * `flat_vertices` - Flat array of vertex coordinates
/// * `dimension` - Dimensionality of each vertex
/// * `projection_distance` - Distance from projection plane
///
/// # Returns
/// Flat array of 3D positions as Float32Array [x0, y0, z0, x1, y1, z1, ...]
#[wasm_bindgen]
pub fn project_vertices_wasm(flat_vertices: &[f64], dimension: usize, projection_distance: f64) -> Vec<f32> {
    animation::project_vertices_to_positions(flat_vertices, dimension, projection_distance)
}

/// Projects edge pairs to 3D positions for LineSegments2 geometry.
///
/// # Arguments
/// * `flat_vertices` - Flat array of vertex coordinates
/// * `dimension` - Dimensionality of each vertex
/// * `flat_edges` - Flat array of edge indices [start0, end0, start1, end1, ...]
/// * `projection_distance` - Distance from projection plane
///
/// # Returns
/// Flat array of edge positions [e0_x1, e0_y1, e0_z1, e0_x2, e0_y2, e0_z2, ...]
#[wasm_bindgen]
pub fn project_edges_wasm(flat_vertices: &[f64], dimension: usize, flat_edges: &[u32], projection_distance: f64) -> Vec<f32> {
    animation::project_edges_to_positions(flat_vertices, dimension, flat_edges, projection_distance)
}

/// Multiplies a matrix by a vector.
///
/// # Arguments
/// * `matrix` - Flat n×n matrix (row-major)
/// * `vector` - Input vector of length n
/// * `dimension` - Matrix/vector dimension
///
/// # Returns
/// Result vector of length n
#[wasm_bindgen]
pub fn multiply_matrix_vector_wasm(matrix: &[f64], vector: &[f64], dimension: usize) -> Vec<f64> {
    animation::multiply_matrix_vector(matrix, vector, dimension)
}

// ============================================================================
// Phase 2: Matrix and Vector Operations
// ============================================================================

/// Multiplies two square matrices: C = A × B
///
/// # Arguments
/// * `a` - First matrix (n×n, row-major)
/// * `b` - Second matrix (n×n, row-major)
/// * `dimension` - Matrix dimension
///
/// # Returns
/// Result matrix (n×n, row-major)
#[wasm_bindgen]
pub fn multiply_matrices_wasm(a: &[f64], b: &[f64], dimension: usize) -> Vec<f64> {
    animation::multiply_matrices(a, b, dimension)
}

/// Computes the dot product of two vectors
///
/// # Arguments
/// * `a` - First vector
/// * `b` - Second vector
///
/// # Returns
/// The scalar dot product
#[wasm_bindgen]
pub fn dot_product_wasm(a: &[f64], b: &[f64]) -> f64 {
    animation::dot_product(a, b)
}

/// Computes the magnitude (length) of a vector
///
/// # Arguments
/// * `v` - Input vector
///
/// # Returns
/// The magnitude of the vector
#[wasm_bindgen]
pub fn magnitude_wasm(v: &[f64]) -> f64 {
    animation::magnitude(v)
}

/// Normalizes a vector to unit length
///
/// # Arguments
/// * `v` - Input vector
///
/// # Returns
/// Unit vector in the same direction
#[wasm_bindgen]
pub fn normalize_vector_wasm(v: &[f64]) -> Vec<f64> {
    animation::normalize_vector(v)
}

/// Subtracts two vectors element-wise: c = a - b
///
/// # Arguments
/// * `a` - First vector
/// * `b` - Second vector
///
/// # Returns
/// The difference vector
#[wasm_bindgen]
pub fn subtract_vectors_wasm(a: &[f64], b: &[f64]) -> Vec<f64> {
    animation::subtract_vectors(a, b)
}
