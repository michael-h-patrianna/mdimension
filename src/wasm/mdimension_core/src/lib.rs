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

// Export a function that can be called by JavaScript.
#[wasm_bindgen]
pub fn greet(name: &str) {
    log(&format!("Hello, {}! This is Rust running in WASM.", name));
}

// Simple math function to verify typed bindings
#[wasm_bindgen]
pub fn add_wasm(a: i32, b: i32) -> i32 {
    a + b
}

mod hull;
mod knn;
mod edges;
mod roots;

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
