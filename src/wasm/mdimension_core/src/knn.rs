//! K-Nearest Neighbor Edge Builder
//!
//! Connects each point to its k nearest neighbors to create a wireframe
//! structure from a point cloud.
//!
//! Performance: O(n² log k) - computes pairwise distances and maintains k-smallest

use std::collections::HashSet;

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

/// Builds edges connecting each point to its k nearest neighbors
///
/// # Arguments
/// * `flat_points` - Flattened array of point coordinates [p0_d0, p0_d1, ..., p1_d0, ...]
/// * `dimension` - Dimensionality of each point
/// * `k` - Number of nearest neighbors to connect
///
/// # Returns
/// Flattened edge indices [e0_v0, e0_v1, e1_v0, e1_v1, ...]
pub fn build_knn_edges(flat_points: &[f64], dimension: usize, k: usize) -> Vec<u32> {
    if dimension == 0 || flat_points.len() < dimension {
        return vec![];
    }

    let n = flat_points.len() / dimension;
    if n == 0 || k == 0 {
        return vec![];
    }

    // Cap k to n-1 (can't have more neighbors than other points)
    let effective_k = k.min(n - 1);
    if effective_k == 0 {
        return vec![];
    }

    // Reconstruct points from flat array
    let points: Vec<&[f64]> = flat_points.chunks(dimension).collect();

    // Use HashSet for edge deduplication (store as (min, max) pairs)
    let mut edge_set: HashSet<(u32, u32)> = HashSet::new();

    for i in 0..n {
        // Compute distances to all other points
        let mut distances: Vec<(usize, f64)> = Vec::with_capacity(n - 1);

        for j in 0..n {
            if j == i {
                continue;
            }
            let d2 = distance_squared(points[i], points[j]);
            distances.push((j, d2));
        }

        // Partial sort to find k smallest - O(n log k) using selection
        // For simplicity, we sort fully (O(n log n)) which is fine for moderate n
        distances.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));

        // Take k nearest neighbors
        for (j, _) in distances.iter().take(effective_k) {
            let (min_idx, max_idx) = if i < *j { (i as u32, *j as u32) } else { (*j as u32, i as u32) };
            edge_set.insert((min_idx, max_idx));
        }
    }

    // Flatten edges
    let mut edges = Vec::with_capacity(edge_set.len() * 2);
    for (v0, v1) in edge_set {
        edges.push(v0);
        edges.push(v1);
    }

    edges
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_knn_edges_basic() {
        // 4 points in 2D forming a square
        let points = vec![
            0.0, 0.0,  // p0
            1.0, 0.0,  // p1
            1.0, 1.0,  // p2
            0.0, 1.0,  // p3
        ];

        let edges = build_knn_edges(&points, 2, 2);

        // Each point connects to 2 nearest neighbors
        // Should have at least 4 edges (each edge counted once due to dedup)
        assert!(edges.len() >= 8); // 4 edges * 2 indices each
    }

    #[test]
    fn test_knn_edges_empty() {
        let edges = build_knn_edges(&[], 3, 4);
        assert!(edges.is_empty());
    }

    #[test]
    fn test_knn_edges_single_point() {
        let edges = build_knn_edges(&[1.0, 2.0, 3.0], 3, 4);
        assert!(edges.is_empty()); // Can't have neighbors with 1 point
    }

    #[test]
    fn test_knn_edges_k_larger_than_n() {
        // 3 points, k=10 should cap to k=2
        let points = vec![
            0.0, 0.0,
            1.0, 0.0,
            0.5, 0.866,
        ];

        let edges = build_knn_edges(&points, 2, 10);

        // With 3 points and k capped to 2, all pairs should be connected
        assert_eq!(edges.len(), 6); // 3 edges * 2 indices
    }
}
