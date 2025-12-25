//! Root System Polytope Generators
//!
//! Generates vertices for root system polytopes:
//! - Type A_{n-1}: e_i - e_j for i != j → n(n-1) roots
//! - Type D_n: ±e_i ± e_j for i < j → 2n(n-1) roots (requires n >= 4)
//! - Type E_8: 240 roots in 8D (requires n = 8)
//!
//! Combined with edge generation for maximum performance.

use crate::edges::build_short_edges;

/// Generates Type A_{n-1} root system in R^n
///
/// A_{n-1} roots are vectors e_i - e_j for all i != j
/// Produces n(n-1) roots of length sqrt(2), normalized to unit length
///
/// # Arguments
/// * `dimension` - Ambient dimension n
/// * `scale` - Scale factor for the roots
///
/// # Returns
/// Flat array of vertex coordinates
pub fn generate_a_roots(dimension: usize, scale: f64) -> Vec<f64> {
    let n = dimension;
    let normalizer = (2.0_f64).sqrt();
    let mut vertices = Vec::with_capacity(n * (n - 1) * n);

    for i in 0..n {
        for j in 0..n {
            if i == j {
                continue;
            }

            let mut v = vec![0.0; n];
            v[i] = scale / normalizer;
            v[j] = -scale / normalizer;
            vertices.extend(v);
        }
    }

    vertices
}

/// Generates Type D_n root system in R^n
///
/// D_n roots are vectors ±e_i ± e_j for i < j
/// Produces 2n(n-1) roots of length sqrt(2), normalized to unit length
///
/// # Arguments
/// * `dimension` - Ambient dimension n (must be >= 4)
/// * `scale` - Scale factor for the roots
///
/// # Returns
/// Flat array of vertex coordinates
///
/// # Panics
/// Panics if dimension < 4
pub fn generate_d_roots(dimension: usize, scale: f64) -> Vec<f64> {
    if dimension < 4 {
        panic!("D_n root system requires dimension >= 4");
    }

    let n = dimension;
    let normalizer = (2.0_f64).sqrt();
    let mut vertices = Vec::with_capacity(2 * n * (n - 1) * n);

    let sign_pairs: [(f64, f64); 4] = [
        (1.0, 1.0),
        (1.0, -1.0),
        (-1.0, 1.0),
        (-1.0, -1.0),
    ];

    for i in 0..n {
        for j in (i + 1)..n {
            for (si, sj) in sign_pairs.iter() {
                let mut v = vec![0.0; n];
                v[i] = si * scale / normalizer;
                v[j] = sj * scale / normalizer;
                vertices.extend(v);
            }
        }
    }

    vertices
}

/// Counts the number of set bits in an integer
#[inline]
fn popcount(mut n: u32) -> u32 {
    let mut count = 0;
    while n > 0 {
        count += n & 1;
        n >>= 1;
    }
    count
}

/// Generates E8 root system in R^8
///
/// E8 has exactly 240 roots consisting of:
/// 1. D8-style roots (112): ±e_i ± e_j for i < j (28 pairs × 4 signs)
/// 2. Half-integer roots (128): (±½)^8 with even number of minus signs
///
/// # Arguments
/// * `scale` - Scale factor for the roots
///
/// # Returns
/// Flat array of 240 * 8 = 1920 coordinates
pub fn generate_e8_roots(scale: f64) -> Vec<f64> {
    const DIM: usize = 8;
    let normalizer = (2.0_f64).sqrt();
    let half_int_normalizer = (2.0_f64).sqrt(); // sqrt(8 * 0.25) = sqrt(2)

    // Pre-allocate for 240 roots * 8 dimensions
    let mut vertices = Vec::with_capacity(240 * DIM);

    // Part 1: D8-style roots (112 vectors)
    // ±e_i ± e_j for i < j
    let sign_pairs: [(f64, f64); 4] = [
        (1.0, 1.0),
        (1.0, -1.0),
        (-1.0, 1.0),
        (-1.0, -1.0),
    ];

    for i in 0..DIM {
        for j in (i + 1)..DIM {
            for (si, sj) in sign_pairs.iter() {
                let mut v = vec![0.0; DIM];
                v[i] = si * scale / normalizer;
                v[j] = sj * scale / normalizer;
                vertices.extend(v);
            }
        }
    }

    // Part 2: Half-integer roots (128 vectors)
    // All (±½)^8 with even number of minus signs
    for mask in 0u32..256 {
        // Even popcount = even number of minus signs
        if popcount(mask) % 2 == 0 {
            let mut v = Vec::with_capacity(DIM);
            for i in 0..DIM {
                let sign = if (mask & (1 << i)) != 0 { -1.0 } else { 1.0 };
                v.push(sign * 0.5 * scale / half_int_normalizer);
            }
            vertices.extend(v);
        }
    }

    vertices
}

/// Result structure for root system generation
#[derive(Clone)]
pub struct RootSystemResult {
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

/// Generates a complete root system with vertices and edges
///
/// This is the main entry point for root system generation.
/// Combines vertex generation with short-edge detection for maximum performance.
///
/// # Arguments
/// * `root_type` - Type of root system: "A", "D", or "E8"
/// * `dimension` - Ambient dimension
/// * `scale` - Scale factor
///
/// # Returns
/// Complete root system result with vertices and edges
pub fn generate_root_system(root_type: &str, dimension: usize, scale: f64) -> RootSystemResult {
    // Generate vertices based on root type
    let (vertices, actual_dim) = match root_type {
        "E8" => {
            if dimension != 8 {
                panic!("E8 root system requires dimension = 8");
            }
            (generate_e8_roots(scale), 8)
        }
        "D" => {
            if dimension < 4 {
                panic!("D_n root system requires dimension >= 4");
            }
            (generate_d_roots(dimension, scale), dimension)
        }
        "A" | _ => (generate_a_roots(dimension, scale), dimension),
    };

    let vertex_count = vertices.len() / actual_dim;

    // Generate edges using short-edge algorithm with 1% tolerance
    let edges = build_short_edges(&vertices, actual_dim, 0.01);
    let edge_count = edges.len() / 2;

    RootSystemResult {
        vertices,
        edges,
        dimension: actual_dim,
        vertex_count,
        edge_count,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_a_roots_count() {
        // A_3 should have 4*3 = 12 roots
        let vertices = generate_a_roots(4, 1.0);
        assert_eq!(vertices.len() / 4, 12);
    }

    #[test]
    fn test_d_roots_count() {
        // D_4 should have 2*4*3 = 24 roots
        let vertices = generate_d_roots(4, 1.0);
        assert_eq!(vertices.len() / 4, 24);
    }

    #[test]
    fn test_e8_roots_count() {
        // E8 should have exactly 240 roots
        let vertices = generate_e8_roots(1.0);
        assert_eq!(vertices.len() / 8, 240);
    }

    #[test]
    fn test_a_roots_unit_length() {
        let vertices = generate_a_roots(4, 1.0);
        for chunk in vertices.chunks(4) {
            let length_sq: f64 = chunk.iter().map(|x| x * x).sum();
            // Should be approximately 1.0 (unit length)
            assert!((length_sq - 1.0).abs() < 1e-10);
        }
    }

    #[test]
    fn test_d_roots_unit_length() {
        let vertices = generate_d_roots(5, 1.0);
        for chunk in vertices.chunks(5) {
            let length_sq: f64 = chunk.iter().map(|x| x * x).sum();
            // Should be approximately 1.0 (unit length)
            assert!((length_sq - 1.0).abs() < 1e-10);
        }
    }

    #[test]
    fn test_e8_roots_unit_length() {
        let vertices = generate_e8_roots(1.0);
        for chunk in vertices.chunks(8) {
            let length_sq: f64 = chunk.iter().map(|x| x * x).sum();
            // Should be approximately 1.0 (unit length)
            assert!((length_sq - 1.0).abs() < 1e-10);
        }
    }

    #[test]
    fn test_generate_root_system_a() {
        let result = generate_root_system("A", 4, 1.0);
        assert_eq!(result.vertex_count, 12); // A_3 has 12 roots
        assert_eq!(result.dimension, 4);
        assert!(result.edge_count > 0); // Should have edges
    }

    #[test]
    fn test_generate_root_system_d() {
        let result = generate_root_system("D", 4, 1.0);
        assert_eq!(result.vertex_count, 24); // D_4 has 24 roots
        assert_eq!(result.dimension, 4);
        assert!(result.edge_count > 0);
    }

    #[test]
    fn test_generate_root_system_e8() {
        let result = generate_root_system("E8", 8, 1.0);
        assert_eq!(result.vertex_count, 240);
        assert_eq!(result.dimension, 8);
        assert!(result.edge_count > 0);
    }
}
