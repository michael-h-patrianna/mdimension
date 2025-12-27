//! K-Nearest Neighbor Edge Builder
//!
//! Connects each point to its k nearest neighbors to create a wireframe
//! structure from a point cloud.
//!
//! OPT-WASM-RUST-5: Performance O(n² log k) using BinaryHeap instead of full sort

use std::collections::{BinaryHeap, HashSet};
use std::cmp::Ordering;

/// Wrapper for distance comparison (max-heap, so we can pop the largest)
#[derive(PartialEq)]
struct DistEntry {
    idx: usize,
    dist_sq: f64,
}

impl Eq for DistEntry {}

impl PartialOrd for DistEntry {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        // Reverse ordering for max-heap behavior (largest distance at top)
        self.dist_sq.partial_cmp(&other.dist_sq)
    }
}

impl Ord for DistEntry {
    fn cmp(&self, other: &Self) -> Ordering {
        self.partial_cmp(other).unwrap_or(Ordering::Equal)
    }
}

/// Computes squared Euclidean distance between two n-dimensional points
#[inline]
fn distance_squared(a: &[f64], b: &[f64]) -> f64 {
    let mut sum = 0.0;
    for (ai, bi) in a.iter().zip(b.iter()) {
        let d = ai - bi;
        sum += d * d;
    }
    sum
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
        // Use max-heap to maintain k smallest distances (O(n log k) instead of O(n log n))
        let mut heap: BinaryHeap<DistEntry> = BinaryHeap::with_capacity(effective_k + 1);

        for j in 0..n {
            if j == i {
                continue;
            }
            let d2 = distance_squared(points[i], points[j]);
            
            if heap.len() < effective_k {
                heap.push(DistEntry { idx: j, dist_sq: d2 });
            } else if let Some(top) = heap.peek() {
                if d2 < top.dist_sq {
                    heap.pop();
                    heap.push(DistEntry { idx: j, dist_sq: d2 });
                }
            }
        }

        // Extract k nearest neighbors from heap
        for entry in heap {
            let j = entry.idx;
            let (min_idx, max_idx) = if i < j { (i as u32, j as u32) } else { (j as u32, i as u32) };
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
