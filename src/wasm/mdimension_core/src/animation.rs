//! High-performance animation operations for real-time rendering
//!
//! These functions are optimized for the animation loop (60 FPS):
//! - Matrix composition for rotations
//! - Perspective projection to 3D
//! - Matrix-vector multiplication
//!
//! All functions operate on flat arrays for efficient WASM<->JS transfer.

/// Default projection distance for perspective projection
const DEFAULT_PROJECTION_DISTANCE: f64 = 4.0;

/// Minimum safe distance from projection plane to avoid division issues
const MIN_SAFE_DISTANCE: f64 = 0.01;

// ============================================================================
// Matrix Operations
// ============================================================================

/// Multiplies a matrix by a vector: result[i] = Σ(M[i][j] * v[j])
///
/// # Arguments
/// * `matrix` - Flat n×n matrix (row-major)
/// * `vector` - Input vector of length n
/// * `dimension` - Matrix/vector dimension
///
/// # Returns
/// Result vector of length n
pub fn multiply_matrix_vector(matrix: &[f64], vector: &[f64], dimension: usize) -> Vec<f64> {
    let mut result = vec![0.0; dimension];

    for i in 0..dimension {
        let row_offset = i * dimension;
        let mut sum = 0.0;
        for j in 0..dimension {
            sum += matrix[row_offset + j] * vector[j];
        }
        result[i] = sum;
    }

    result
}

/// Multiplies two square matrices: C = A × B
///
/// # Arguments
/// * `a` - First matrix (n×n, row-major)
/// * `b` - Second matrix (n×n, row-major)
/// * `dimension` - Matrix dimension
///
/// # Returns
/// Result matrix (n×n, row-major)
pub fn multiply_matrices(a: &[f64], b: &[f64], dimension: usize) -> Vec<f64> {
    let matrix_size = dimension * dimension;
    let mut result = vec![0.0; matrix_size];
    multiply_matrices_into(&mut result, a, b, dimension);
    result
}

/// Multiplies two square matrices into an output buffer
///
/// out[i][j] = Σ(A[i][k] * B[k][j])
///
/// # Arguments
/// * `out` - Output buffer (dimension × dimension)
/// * `a` - First matrix (row-major)
/// * `b` - Second matrix (row-major)
/// * `dimension` - Matrix dimension
fn multiply_matrices_into(out: &mut [f64], a: &[f64], b: &[f64], dimension: usize) {
    for i in 0..dimension {
        let row_offset = i * dimension;
        for j in 0..dimension {
            let mut sum = 0.0;
            for k in 0..dimension {
                sum += a[row_offset + k] * b[k * dimension + j];
            }
            out[row_offset + j] = sum;
        }
    }
}

/// Resets a matrix to identity in-place
fn reset_to_identity(matrix: &mut [f64], dimension: usize) {
    matrix.fill(0.0);
    for i in 0..dimension {
        matrix[i * dimension + i] = 1.0;
    }
}

/// Creates a rotation matrix for a specific plane
///
/// # Arguments
/// * `out` - Output buffer (dimension × dimension)
/// * `dimension` - Matrix dimension
/// * `plane_index1` - First axis of rotation plane
/// * `plane_index2` - Second axis of rotation plane
/// * `angle_radians` - Rotation angle
fn create_rotation_matrix_into(
    out: &mut [f64],
    dimension: usize,
    plane_index1: usize,
    plane_index2: usize,
    angle_radians: f64,
) {
    reset_to_identity(out, dimension);

    let cos = angle_radians.cos();
    let sin = angle_radians.sin();

    // Set rotation plane elements
    out[plane_index1 * dimension + plane_index1] = cos;
    out[plane_index2 * dimension + plane_index2] = cos;
    out[plane_index1 * dimension + plane_index2] = -sin;
    out[plane_index2 * dimension + plane_index1] = sin;
}

/// Axis names for plane parsing
const AXIS_NAMES: [char; 6] = ['X', 'Y', 'Z', 'W', 'V', 'U'];

/// Parses an axis name to its index
/// Returns None for invalid names
fn parse_axis_name_to_index(name: &str) -> Option<usize> {
    if name.len() == 1 {
        let c = name.chars().next()?;
        for (i, &axis) in AXIS_NAMES.iter().enumerate() {
            if c == axis {
                return Some(i);
            }
        }
    }
    // Handle A6, A7, A8... format for dimensions > 6
    if name.starts_with('A') {
        if let Ok(num) = name[1..].parse::<usize>() {
            if num >= AXIS_NAMES.len() {
                return Some(num);
            }
        }
    }
    None
}

/// Parses a plane name (e.g., "XY", "XW") into axis indices
/// Returns (index1, index2) where index1 < index2
fn parse_plane_name(plane_name: &str) -> Option<(usize, usize)> {
    let chars: Vec<char> = plane_name.chars().collect();

    // Two-character format (XY, XZ, etc.)
    if chars.len() == 2 {
        let name1 = chars[0].to_string();
        let name2 = chars[1].to_string();
        let idx1 = parse_axis_name_to_index(&name1)?;
        let idx2 = parse_axis_name_to_index(&name2)?;
        if idx1 == idx2 {
            return None;
        }
        return Some(if idx1 < idx2 { (idx1, idx2) } else { (idx2, idx1) });
    }

    // Handle formats like "A6A7", "XA6", etc.
    // Split by capital letter
    let mut parts = Vec::new();
    let mut current = String::new();
    for c in chars {
        if c.is_ascii_uppercase() && !current.is_empty() {
            parts.push(current);
            current = String::new();
        }
        current.push(c);
    }
    if !current.is_empty() {
        parts.push(current);
    }

    if parts.len() == 2 {
        let idx1 = parse_axis_name_to_index(&parts[0])?;
        let idx2 = parse_axis_name_to_index(&parts[1])?;
        if idx1 == idx2 {
            return None;
        }
        return Some(if idx1 < idx2 { (idx1, idx2) } else { (idx2, idx1) });
    }

    None
}

/// Composes multiple rotations from plane names and angles.
///
/// This is the main function called from the animation loop.
///
/// # Arguments
/// * `dimension` - The dimensionality of the space
/// * `plane_names` - Array of plane names (e.g., ["XY", "XW", "ZW"])
/// * `angles` - Array of rotation angles in radians (same length as plane_names)
///
/// # Returns
/// Flat rotation matrix (dimension × dimension) as row-major array
pub fn compose_rotations(dimension: usize, plane_names: &[String], angles: &[f64]) -> Vec<f64> {
    let matrix_size = dimension * dimension;

    // Handle empty rotations
    if plane_names.is_empty() || angles.is_empty() {
        let mut result = vec![0.0; matrix_size];
        reset_to_identity(&mut result, dimension);
        return result;
    }

    // Allocate scratch buffers
    let mut rotation = vec![0.0; matrix_size];
    let mut result_a = vec![0.0; matrix_size];
    let mut result_b = vec![0.0; matrix_size];

    // Start with identity
    reset_to_identity(&mut result_a, dimension);

    let mut current = &mut result_a;
    let mut next = &mut result_b;

    // Apply each rotation
    for (plane_name, &angle) in plane_names.iter().zip(angles.iter()) {
        // Parse plane name to get indices
        let (idx1, idx2) = match parse_plane_name(plane_name) {
            Some(indices) => indices,
            None => continue, // Skip invalid plane names
        };

        // Validate indices
        if idx1 >= dimension || idx2 >= dimension {
            continue;
        }

        // Create rotation matrix
        create_rotation_matrix_into(&mut rotation, dimension, idx1, idx2, angle);

        // Multiply: next = current * rotation
        multiply_matrices_into(next, current, &rotation, dimension);

        // Swap references
        std::mem::swap(&mut current, &mut next);
    }

    // Copy result to output
    current.clone()
}

// ============================================================================
// Projection Operations
// ============================================================================

/// Projects n-dimensional vertices to 3D positions using perspective projection.
///
/// This writes directly into a Float32Array for Three.js buffer updates.
///
/// # Arguments
/// * `flat_vertices` - Flat array of vertex coordinates [v0_x, v0_y, v0_z, v0_w, ..., v1_x, ...]
/// * `dimension` - Dimensionality of each vertex
/// * `projection_distance` - Distance from projection plane (default: 4.0)
///
/// # Returns
/// Flat array of 3D positions [x0, y0, z0, x1, y1, z1, ...]
pub fn project_vertices_to_positions(
    flat_vertices: &[f64],
    dimension: usize,
    projection_distance: f64,
) -> Vec<f32> {
    if dimension < 3 || flat_vertices.is_empty() {
        return vec![];
    }

    let vertex_count = flat_vertices.len() / dimension;
    let mut positions = vec![0.0f32; vertex_count * 3];

    let num_higher_dims = dimension - 3;
    let normalization_factor = if num_higher_dims > 0 {
        (num_higher_dims as f64).sqrt()
    } else {
        1.0
    };

    for i in 0..vertex_count {
        let offset = i * dimension;
        let x = flat_vertices[offset];
        let y = flat_vertices[offset + 1];
        let z = flat_vertices[offset + 2];

        // Calculate effective depth from higher dimensions
        let mut effective_depth = 0.0;
        if num_higher_dims > 0 {
            for d in 3..dimension {
                effective_depth += flat_vertices[offset + d];
            }
            effective_depth /= normalization_factor;
        }

        // Apply perspective division
        let mut denominator = projection_distance - effective_depth;
        if denominator.abs() < MIN_SAFE_DISTANCE {
            denominator = if denominator >= 0.0 { MIN_SAFE_DISTANCE } else { -MIN_SAFE_DISTANCE };
        }
        let scale = 1.0 / denominator;

        let out_idx = i * 3;
        positions[out_idx] = (x * scale) as f32;
        positions[out_idx + 1] = (y * scale) as f32;
        positions[out_idx + 2] = (z * scale) as f32;
    }

    positions
}

/// Projects edge pairs directly into positions for LineSegments2 geometry.
/// Each edge is 6 floats: [x1, y1, z1, x2, y2, z2].
///
/// # Arguments
/// * `flat_vertices` - Flat array of vertex coordinates
/// * `dimension` - Dimensionality of each vertex
/// * `flat_edges` - Flat array of edge indices [start0, end0, start1, end1, ...]
/// * `projection_distance` - Distance from projection plane
///
/// # Returns
/// Flat array of edge positions [e0_x1, e0_y1, e0_z1, e0_x2, e0_y2, e0_z2, ...]
pub fn project_edges_to_positions(
    flat_vertices: &[f64],
    dimension: usize,
    flat_edges: &[u32],
    projection_distance: f64,
) -> Vec<f32> {
    if dimension < 3 || flat_vertices.is_empty() || flat_edges.is_empty() {
        return vec![];
    }

    let vertex_count = flat_vertices.len() / dimension;
    let edge_count = flat_edges.len() / 2;
    let mut positions = vec![0.0f32; edge_count * 6];

    let num_higher_dims = dimension - 3;
    let normalization_factor = if num_higher_dims > 0 {
        (num_higher_dims as f64).sqrt()
    } else {
        1.0
    };

    for e in 0..edge_count {
        let start_idx = flat_edges[e * 2] as usize;
        let end_idx = flat_edges[e * 2 + 1] as usize;

        let out_idx = e * 6;

        // Validate indices
        if start_idx >= vertex_count || end_idx >= vertex_count {
            // Write zeros for invalid edges
            for i in 0..6 {
                positions[out_idx + i] = 0.0;
            }
            continue;
        }

        // Project first vertex
        let v1_offset = start_idx * dimension;
        let x1 = flat_vertices[v1_offset];
        let y1 = flat_vertices[v1_offset + 1];
        let z1 = flat_vertices[v1_offset + 2];

        let mut depth1 = 0.0;
        if num_higher_dims > 0 {
            for d in 3..dimension {
                depth1 += flat_vertices[v1_offset + d];
            }
            depth1 /= normalization_factor;
        }

        let mut denom1 = projection_distance - depth1;
        if denom1.abs() < MIN_SAFE_DISTANCE {
            denom1 = if denom1 >= 0.0 { MIN_SAFE_DISTANCE } else { -MIN_SAFE_DISTANCE };
        }
        let scale1 = 1.0 / denom1;

        positions[out_idx] = (x1 * scale1) as f32;
        positions[out_idx + 1] = (y1 * scale1) as f32;
        positions[out_idx + 2] = (z1 * scale1) as f32;

        // Project second vertex
        let v2_offset = end_idx * dimension;
        let x2 = flat_vertices[v2_offset];
        let y2 = flat_vertices[v2_offset + 1];
        let z2 = flat_vertices[v2_offset + 2];

        let mut depth2 = 0.0;
        if num_higher_dims > 0 {
            for d in 3..dimension {
                depth2 += flat_vertices[v2_offset + d];
            }
            depth2 /= normalization_factor;
        }

        let mut denom2 = projection_distance - depth2;
        if denom2.abs() < MIN_SAFE_DISTANCE {
            denom2 = if denom2 >= 0.0 { MIN_SAFE_DISTANCE } else { -MIN_SAFE_DISTANCE };
        }
        let scale2 = 1.0 / denom2;

        positions[out_idx + 3] = (x2 * scale2) as f32;
        positions[out_idx + 4] = (y2 * scale2) as f32;
        positions[out_idx + 5] = (z2 * scale2) as f32;
    }

    positions
}

/// Applies a rotation matrix to vertices in-place.
///
/// # Arguments
/// * `flat_vertices` - Flat array of vertex coordinates (modified in-place)
/// * `dimension` - Dimensionality of each vertex
/// * `rotation_matrix` - Flat rotation matrix (dimension × dimension)
///
/// # Returns
/// The modified vertices array
pub fn apply_rotation_to_vertices(
    flat_vertices: &[f64],
    dimension: usize,
    rotation_matrix: &[f64],
) -> Vec<f64> {
    if flat_vertices.is_empty() || rotation_matrix.len() != dimension * dimension {
        return flat_vertices.to_vec();
    }

    let vertex_count = flat_vertices.len() / dimension;
    let mut result = vec![0.0; flat_vertices.len()];

    for i in 0..vertex_count {
        let offset = i * dimension;

        // Apply matrix multiplication for this vertex
        for row in 0..dimension {
            let mut sum = 0.0;
            let row_offset = row * dimension;
            for col in 0..dimension {
                sum += rotation_matrix[row_offset + col] * flat_vertices[offset + col];
            }
            result[offset + row] = sum;
        }
    }

    result
}

// ============================================================================
// Vector Operations
// ============================================================================

/// Computes the dot product of two vectors: a · b = Σ(a[i] * b[i])
///
/// # Arguments
/// * `a` - First vector
/// * `b` - Second vector (must have same length as a)
///
/// # Returns
/// The scalar dot product
pub fn dot_product(a: &[f64], b: &[f64]) -> f64 {
    let len = a.len().min(b.len());
    let mut sum = 0.0;
    for i in 0..len {
        sum += a[i] * b[i];
    }
    sum
}

/// Computes the magnitude (length) of a vector: ||v|| = √(Σ(v[i]²))
///
/// # Arguments
/// * `v` - Input vector
///
/// # Returns
/// The magnitude of the vector
pub fn magnitude(v: &[f64]) -> f64 {
    let mut sum_squares = 0.0;
    for val in v {
        sum_squares += val * val;
    }
    sum_squares.sqrt()
}

/// Normalizes a vector to unit length: v̂ = v / ||v||
///
/// # Arguments
/// * `v` - Input vector
///
/// # Returns
/// Unit vector in the same direction (or zeros if input has zero magnitude)
pub fn normalize_vector(v: &[f64]) -> Vec<f64> {
    let mag = magnitude(v);
    if mag < 1e-10 {
        return vec![0.0; v.len()];
    }
    let scale = 1.0 / mag;
    v.iter().map(|x| x * scale).collect()
}

/// Subtracts two vectors element-wise: c[i] = a[i] - b[i]
///
/// # Arguments
/// * `a` - First vector
/// * `b` - Second vector
///
/// # Returns
/// The difference vector
pub fn subtract_vectors(a: &[f64], b: &[f64]) -> Vec<f64> {
    let len = a.len().min(b.len());
    let mut result = vec![0.0; len];
    for i in 0..len {
        result[i] = a[i] - b[i];
    }
    result
}

/// Computes the squared distance between two points
/// This is faster than distance() when you only need to compare distances.
///
/// # Arguments
/// * `a` - First point
/// * `b` - Second point
///
/// # Returns
/// The squared Euclidean distance
pub fn distance_squared(a: &[f64], b: &[f64]) -> f64 {
    let len = a.len().min(b.len());
    let mut sum = 0.0;
    for i in 0..len {
        let diff = a[i] - b[i];
        sum += diff * diff;
    }
    sum
}

/// Computes the Euclidean distance between two points
///
/// # Arguments
/// * `a` - First point
/// * `b` - Second point
///
/// # Returns
/// The Euclidean distance
pub fn distance(a: &[f64], b: &[f64]) -> f64 {
    distance_squared(a, b).sqrt()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_plane_name() {
        assert_eq!(parse_plane_name("XY"), Some((0, 1)));
        assert_eq!(parse_plane_name("XZ"), Some((0, 2)));
        assert_eq!(parse_plane_name("YZ"), Some((1, 2)));
        assert_eq!(parse_plane_name("XW"), Some((0, 3)));
        assert_eq!(parse_plane_name("ZW"), Some((2, 3)));
        assert_eq!(parse_plane_name("XX"), None); // Same axis
    }

    #[test]
    fn test_compose_rotations_identity() {
        let result = compose_rotations(4, &[], &[]);
        assert_eq!(result.len(), 16);
        // Check identity
        assert!((result[0] - 1.0).abs() < 1e-10);
        assert!((result[5] - 1.0).abs() < 1e-10);
        assert!((result[10] - 1.0).abs() < 1e-10);
        assert!((result[15] - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_compose_rotations_single() {
        let plane_names = vec!["XY".to_string()];
        let angles = vec![std::f64::consts::FRAC_PI_2]; // 90 degrees
        let result = compose_rotations(3, &plane_names, &angles);

        // For XY rotation by 90°:
        // cos(90°) = 0, sin(90°) = 1
        // Matrix should have [0, -1, 0] and [1, 0, 0] in top-left 2x2
        assert!((result[0] - 0.0).abs() < 1e-10);
        assert!((result[1] - (-1.0)).abs() < 1e-10);
        assert!((result[3] - 1.0).abs() < 1e-10);
        assert!((result[4] - 0.0).abs() < 1e-10);
    }

    #[test]
    fn test_project_vertices_3d() {
        // 3D vertices should pass through unchanged (no higher dims)
        let vertices = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0];
        let positions = project_vertices_to_positions(&vertices, 3, 4.0);

        assert_eq!(positions.len(), 6);
        // Scale = 1/4 for projection distance 4
        assert!((positions[0] - 0.25).abs() < 1e-5);
        assert!((positions[1] - 0.5).abs() < 1e-5);
        assert!((positions[2] - 0.75).abs() < 1e-5);
    }

    #[test]
    fn test_project_vertices_4d() {
        // 4D vertex at origin with w=2 should have effective depth = 2/sqrt(1) = 2
        // denominator = 4 - 2 = 2, scale = 0.5
        let vertices = vec![2.0, 4.0, 6.0, 2.0];
        let positions = project_vertices_to_positions(&vertices, 4, 4.0);

        assert_eq!(positions.len(), 3);
        assert!((positions[0] - 1.0).abs() < 1e-5); // 2 * 0.5
        assert!((positions[1] - 2.0).abs() < 1e-5); // 4 * 0.5
        assert!((positions[2] - 3.0).abs() < 1e-5); // 6 * 0.5
    }

    #[test]
    fn test_multiply_matrix_vector() {
        // 2x2 identity
        let matrix = vec![1.0, 0.0, 0.0, 1.0];
        let vector = vec![3.0, 4.0];
        let result = multiply_matrix_vector(&matrix, &vector, 2);

        assert_eq!(result, vec![3.0, 4.0]);
    }

    #[test]
    fn test_apply_rotation_to_vertices() {
        // 90° rotation in XY plane
        let angle = std::f64::consts::FRAC_PI_2;
        let cos = angle.cos();
        let sin = angle.sin();

        // 2D rotation matrix
        let rotation = vec![cos, -sin, sin, cos];
        let vertices = vec![1.0, 0.0]; // Point at (1, 0)

        let result = apply_rotation_to_vertices(&vertices, 2, &rotation);

        // After 90° rotation, (1, 0) -> (0, 1)
        assert!((result[0] - 0.0).abs() < 1e-10);
        assert!((result[1] - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_multiply_matrices() {
        // 2x2 identity × 2x2 other = 2x2 other
        let identity = vec![1.0, 0.0, 0.0, 1.0];
        let other = vec![1.0, 2.0, 3.0, 4.0];
        let result = multiply_matrices(&identity, &other, 2);
        assert_eq!(result, vec![1.0, 2.0, 3.0, 4.0]);

        // Test actual multiplication
        let a = vec![1.0, 2.0, 3.0, 4.0];
        let b = vec![5.0, 6.0, 7.0, 8.0];
        let result = multiply_matrices(&a, &b, 2);
        // [1,2] [5,6]   [1*5+2*7, 1*6+2*8]   [19, 22]
        // [3,4] [7,8] = [3*5+4*7, 3*6+4*8] = [43, 50]
        assert!((result[0] - 19.0).abs() < 1e-10);
        assert!((result[1] - 22.0).abs() < 1e-10);
        assert!((result[2] - 43.0).abs() < 1e-10);
        assert!((result[3] - 50.0).abs() < 1e-10);
    }

    #[test]
    fn test_dot_product() {
        let a = vec![1.0, 2.0, 3.0];
        let b = vec![4.0, 5.0, 6.0];
        // 1*4 + 2*5 + 3*6 = 4 + 10 + 18 = 32
        assert!((dot_product(&a, &b) - 32.0).abs() < 1e-10);
    }

    #[test]
    fn test_magnitude() {
        let v = vec![3.0, 4.0];
        // sqrt(9 + 16) = sqrt(25) = 5
        assert!((magnitude(&v) - 5.0).abs() < 1e-10);
    }

    #[test]
    fn test_normalize_vector() {
        let v = vec![3.0, 4.0];
        let normalized = normalize_vector(&v);
        // Length should be 1
        assert!((magnitude(&normalized) - 1.0).abs() < 1e-10);
        // Direction should be preserved: (0.6, 0.8)
        assert!((normalized[0] - 0.6).abs() < 1e-10);
        assert!((normalized[1] - 0.8).abs() < 1e-10);
    }

    #[test]
    fn test_subtract_vectors() {
        let a = vec![5.0, 3.0, 1.0];
        let b = vec![1.0, 2.0, 3.0];
        let result = subtract_vectors(&a, &b);
        assert_eq!(result, vec![4.0, 1.0, -2.0]);
    }

    #[test]
    fn test_distance() {
        let a = vec![0.0, 0.0];
        let b = vec![3.0, 4.0];
        // sqrt(9 + 16) = 5
        assert!((distance(&a, &b) - 5.0).abs() < 1e-10);
    }
}
