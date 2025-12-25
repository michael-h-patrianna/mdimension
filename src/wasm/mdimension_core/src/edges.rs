//! Edge Builder Utilities
//!
//! Various algorithms for building edges from point sets.
//! - Short edges: connects vertices at minimum nonzero distance
//! - Used for root systems and other mathematically structured point sets.

/// Computes squared Euclidean distance between two n-dimensional points
#[inline]
fn distance_squared(a: &[f64], b: &[f64]) -> f64 {
    a.iter()
        .zip(b.iter())
        .map(|(ai, bi)| {
            let d = ai - bi;
            d * d
        })
        .sum()
}

/// Builds edges connecting vertices at minimum nonzero distance
///
/// Algorithm:
/// 1. Find minimum nonzero distance among all pairs
/// 2. Connect all pairs within (minDist * (1 + epsilon)) threshold
///
/// This reveals the natural connectivity of root systems and similar
/// mathematically structured point sets.
///
/// # Arguments
/// * `flat_vertices` - Flattened array of vertex coordinates
/// * `dimension` - Dimensionality of each vertex
/// * `epsilon_factor` - Tolerance factor for distance matching (e.g., 0.01)
///
/// # Returns
/// Flattened edge indices [e0_v0, e0_v1, e1_v0, e1_v1, ...]
pub fn build_short_edges(flat_vertices: &[f64], dimension: usize, epsilon_factor: f64) -> Vec<u32> {
    if dimension == 0 || flat_vertices.len() < dimension * 2 {
        return vec![];
    }

    let n = flat_vertices.len() / dimension;
    if n < 2 {
        return vec![];
    }

    // Reconstruct vertices from flat array
    let vertices: Vec<&[f64]> = flat_vertices.chunks(dimension).collect();

    const EPSILON_SQ: f64 = 1e-9;

    // First pass: find minimum nonzero distance
    let mut min_dist_sq = f64::MAX;

    for i in 0..n {
        for j in (i + 1)..n {
            let d2 = distance_squared(vertices[i], vertices[j]);
            if d2 > EPSILON_SQ && d2 < min_dist_sq {
                min_dist_sq = d2;
            }
        }
    }

    if min_dist_sq == f64::MAX {
        return vec![];
    }

    // Threshold with tolerance
    let threshold = min_dist_sq.sqrt() * (1.0 + epsilon_factor);
    let threshold_sq = threshold * threshold;

    // Second pass: add edges under threshold
    let mut edges = Vec::new();

    for i in 0..n {
        for j in (i + 1)..n {
            let d2 = distance_squared(vertices[i], vertices[j]);
            if d2 <= threshold_sq {
                edges.push(i as u32);
                edges.push(j as u32);
            }
        }
    }

    edges
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_short_edges_basic() {
        // 4 points in 2D forming a unit square
        let vertices = vec![
            0.0, 0.0,  // v0
            1.0, 0.0,  // v1
            1.0, 1.0,  // v2
            0.0, 1.0,  // v3
        ];

        let edges = build_short_edges(&vertices, 2, 0.01);

        // Minimum distance is 1.0 (sides), diagonal is sqrt(2) ≈ 1.414
        // With 1% tolerance, only sides should be connected
        assert_eq!(edges.len(), 8); // 4 edges * 2 indices
    }

    #[test]
    fn test_short_edges_empty() {
        let edges = build_short_edges(&[], 3, 0.01);
        assert!(edges.is_empty());
    }

    #[test]
    fn test_short_edges_single_vertex() {
        let edges = build_short_edges(&[1.0, 2.0, 3.0], 3, 0.01);
        assert!(edges.is_empty());
    }

    #[test]
    fn test_short_edges_equidistant() {
        // 3 points forming equilateral triangle
        let vertices = vec![
            0.0, 0.0,
            1.0, 0.0,
            0.5, 0.866025403784,
        ];

        let edges = build_short_edges(&vertices, 2, 0.01);

        // All sides equal, should connect all pairs
        assert_eq!(edges.len(), 6); // 3 edges * 2 indices
    }
}
