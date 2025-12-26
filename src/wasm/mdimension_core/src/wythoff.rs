use serde::{Serialize, Deserialize};
use nalgebra::DVector;
use std::collections::{HashSet, HashMap};
use itertools::Itertools;

use crate::hull;

#[derive(Serialize, Deserialize, Debug)]
pub struct WythoffConfig {
    pub symmetry_group: String, // 'A', 'B', 'D'
    pub preset: String,         // 'regular', 'omnitruncated', etc.
    pub dimension: usize,
    pub scale: f64,
    pub custom_symbol: Option<Vec<bool>>,
    /// Maximum vertices to generate (prevents O(n²) edge computation from blocking)
    #[serde(default = "default_max_vertices")]
    pub max_vertices: usize,
}

fn default_max_vertices() -> usize {
    5000
}

#[derive(Serialize)]
pub struct PolytopeResult {
    pub vertices: Vec<f64>,   // Flattened vertices
    pub edges: Vec<u32>,      // Flattened edge indices
    pub faces: Vec<u32>,      // Flattened face indices (triangulated)
    pub dimension: usize,
    pub warnings: Vec<String>,
}

/// Helper to hash vertices for deduplication (simple string key for now, could be improved)
fn vertex_key(v: &DVector<f64>) -> String {
    // Round for stability
    v.iter().map(|c| format!("{:.4}", c)).collect::<Vec<_>>().join(",")
}

/// Center and scale vertices in place
fn center_and_scale(vertices: &mut Vec<DVector<f64>>, target_scale: f64) {
    if vertices.is_empty() { return; }
    let dim = vertices[0].len();
    let n = vertices.len();

    // 1. Centroid
    let mut centroid = DVector::zeros(dim);
    for v in vertices.iter() {
        centroid += v;
    }
    centroid /= n as f64;

    // 2. Center and find extent
    let mut max_extent: f64 = 0.0;
    for v in vertices.iter_mut() {
        *v -= &centroid;
        for c in v.iter() {
            max_extent = max_extent.max(c.abs());
        }
    }

    // 3. Scale
    if max_extent > 1e-9 {
        let s = target_scale / max_extent;
        for v in vertices.iter_mut() {
            *v *= s;
        }
    }
}

/// Generate Hypercube {4,3,...,3}
fn generate_hypercube(dim: usize) -> (Vec<DVector<f64>>, Vec<[usize; 2]>) {
    let num_vertices = 1 << dim; // 2^dim
    let mut vertices = Vec::with_capacity(num_vertices);

    for i in 0..num_vertices {
        let mut v = DVector::zeros(dim);
        for j in 0..dim {
            v[j] = if (i & (1 << j)) != 0 { 1.0 } else { -1.0 };
        }
        vertices.push(v);
    }

    // Edges: connect vertices that differ in exactly one bit
    let mut edges = Vec::new();
    for i in 0..num_vertices {
        for j in (i + 1)..num_vertices {
            let diff = i ^ j;
            if (diff != 0) && ((diff & (diff - 1)) == 0) {
                 edges.push([i, j]);
            }
        }
    }

    (vertices, edges)
}

/// Generate Cross Polytope {3,3,...,4}
fn generate_cross_polytope(dim: usize) -> (Vec<DVector<f64>>, Vec<[usize; 2]>) {
    let mut vertices = Vec::with_capacity(2 * dim);
    for i in 0..dim {
        let mut v_pos = DVector::zeros(dim);
        v_pos[i] = 1.0;
        vertices.push(v_pos);

        let mut v_neg = DVector::zeros(dim);
        v_neg[i] = -1.0;
        vertices.push(v_neg);
    }

    // Edges: Connect every pair except opposites (v_i and v_{i+1} where i is even)
    // Indices: 0,1 are x, -x; 2,3 are y, -y
    let mut edges = Vec::new();
    let n = vertices.len();
    for i in 0..n {
        for j in (i + 1)..n {
            // Check if they are opposites (same axis index if we divide by 2)
            if i / 2 != j / 2 {
                edges.push([i, j]);
            }
        }
    }

    (vertices, edges)
}

/// Generate Simplex {3,3,...,3}
fn generate_simplex(dim: usize) -> (Vec<DVector<f64>>, Vec<[usize; 2]>) {
    let n = dim;
    let num_vertices = n + 1;
    let mut vertices = Vec::with_capacity(num_vertices);

    // v0
    let mut v0 = DVector::zeros(n);
    for i in 0..n {
        v0[i] = -1.0 / (2.0 * ((i + 1) as f64) * ((i + 2) as f64)).sqrt();
    }
    vertices.push(v0);

    // v1..vn
    for k in 0..n {
        let mut v = DVector::zeros(n);
        for i in 0..n {
            if i < k {
                v[i] = -1.0 / (2.0 * ((i + 1) as f64) * ((i + 2) as f64)).sqrt();
            } else if i == k {
                v[i] = ((k + 1) as f64) / (2.0 * ((k + 1) as f64) * ((k + 2) as f64)).sqrt();
            } else {
                v[i] = -1.0 / (2.0 * ((i + 1) as f64) * ((i + 2) as f64)).sqrt();
            }
        }
        vertices.push(v);
    }

    // Edges: All pairs connected
    let mut edges = Vec::new();
    for i in 0..num_vertices {
        for j in (i + 1)..num_vertices {
            edges.push([i, j]);
        }
    }

    (vertices, edges)
}

/// Generate Omnitruncated Hypercube (Permutations + Sign flipping)
///
/// Uses combinatorial edge generation: O(V × n) instead of O(V²)
///
/// Mathematical insight: Two signed permutation vertices are adjacent iff:
/// 1. They differ by swapping adjacent positions where values differ by 1, OR
/// 2. They differ by flipping the sign of the coordinate with value ±1
fn generate_omnitruncated(dim: usize, max_vertices: usize) -> (Vec<DVector<f64>>, Vec<[usize; 2]>) {
    // Step 1: Generate all vertices with their canonical keys
    let mut vertices = Vec::new();
    let mut vertex_to_index: HashMap<String, usize> = HashMap::new();

    let coords: Vec<f64> = (1..=dim).map(|i| i as f64).collect();
    let num_signs = 1 << dim;

    // Iterate permutations
    for perm in coords.iter().permutations(dim) {
        // Iterate sign configs
        for sign_config in 0..num_signs {
            let mut v = DVector::zeros(dim);
            for j in 0..dim {
                let sign = if (sign_config & (1 << j)) != 0 { 1.0 } else { -1.0 };
                v[j] = sign * perm[j];
            }

            let key = vertex_key(&v);
            if !vertex_to_index.contains_key(&key) {
                let idx = vertices.len();
                vertex_to_index.insert(key, idx);
                vertices.push(v);

                if vertices.len() >= max_vertices {
                    // Truncated - fall back to distance-based for partial set
                    let edges = generate_edges_by_distance(&vertices, f64::MAX);
                    return (vertices, edges);
                }
            }
        }
    }

    // Step 2: Generate edges combinatorially in O(V × n)
    // For omnitruncated hypercube (B_n group), edges connect vertices differing by:
    // - Adjacent transposition of positions with adjacent-ranked values
    // - Sign flip of the ±1 coordinate
    let edges = generate_omnitruncated_edges_combinatorial(&vertices, &vertex_to_index, dim);

    (vertices, edges)
}

/// Generate edges for omnitruncated polytope using combinatorial rules
///
/// Complexity: O(V × n) instead of O(V²)
///
/// For each vertex (signed permutation), potential neighbors are:
/// 1. Swap positions i, i+1 if |rank[i] - rank[i+1]| == 1
/// 2. Flip sign of the coordinate with absolute value 1
fn generate_omnitruncated_edges_combinatorial(
    vertices: &[DVector<f64>],
    vertex_to_index: &HashMap<String, usize>,
    dim: usize
) -> Vec<[usize; 2]> {
    let mut edges = Vec::new();
    let mut seen_edges: HashSet<(usize, usize)> = HashSet::new();

    for (idx, v) in vertices.iter().enumerate() {
        // Type 1: Adjacent transpositions where values differ by 1
        for i in 0..(dim - 1) {
            let val_i = v[i].abs();
            let val_j = v[i + 1].abs();

            // Check if absolute values are adjacent (differ by 1)
            if (val_i - val_j).abs() < 1.5 && (val_i - val_j).abs() > 0.5 {
                // Create neighbor by swapping positions i and i+1
                let mut neighbor = v.clone();
                neighbor.swap((i, 0), (i + 1, 0));

                let neighbor_key = vertex_key(&neighbor);
                if let Some(&neighbor_idx) = vertex_to_index.get(&neighbor_key) {
                    let edge = if idx < neighbor_idx { (idx, neighbor_idx) } else { (neighbor_idx, idx) };
                    if !seen_edges.contains(&edge) {
                        seen_edges.insert(edge);
                        edges.push([edge.0, edge.1]);
                    }
                }
            }
        }

        // Type 2: Sign flip of coordinate with absolute value 1
        for i in 0..dim {
            if (v[i].abs() - 1.0).abs() < 0.01 {
                // Flip sign of coordinate with value ±1
                let mut neighbor = v.clone();
                neighbor[i] = -neighbor[i];

                let neighbor_key = vertex_key(&neighbor);
                if let Some(&neighbor_idx) = vertex_to_index.get(&neighbor_key) {
                    let edge = if idx < neighbor_idx { (idx, neighbor_idx) } else { (neighbor_idx, idx) };
                    if !seen_edges.contains(&edge) {
                        seen_edges.insert(edge);
                        edges.push([edge.0, edge.1]);
                    }
                }
            }
        }
    }

    edges
}

/// Generate Rectified Hypercube (n-dimensional cuboctahedron analog)
/// Vertices at midpoints of hypercube edges: exactly (dim-1) non-zero coords = ±1, one coord = 0
fn generate_rectified(dim: usize) -> (Vec<DVector<f64>>, Vec<[usize; 2]>) {
    let mut vertices = Vec::new();
    let mut seen = HashSet::new();

    for zero_idx in 0..dim {
        let num_configs = 1 << (dim - 1);
        for config in 0..num_configs {
            let mut v = DVector::zeros(dim);
            let mut bit_idx = 0;
            for j in 0..dim {
                if j == zero_idx {
                    v[j] = 0.0;
                } else {
                    v[j] = if (config & (1 << bit_idx)) != 0 { 1.0 } else { -1.0 };
                    bit_idx += 1;
                }
            }

            let key = vertex_key(&v);
            if !seen.contains(&key) {
                seen.insert(key);
                vertices.push(v);
            }
        }
    }

    // Edges by min distance (simple for rectified)
    let edges = generate_edges_by_distance(&vertices, 1.5);
    (vertices, edges)
}

/// Generate Truncated Hypercube
/// One coord at ±(√2-1), rest at ±1
fn generate_truncated(dim: usize) -> (Vec<DVector<f64>>, Vec<[usize; 2]>) {
    let mut vertices = Vec::new();
    let mut seen = HashSet::new();
    let t = 2.0_f64.sqrt() - 1.0;

    for trunc_idx in 0..dim {
        let num_configs = 1 << dim;
        for config in 0..num_configs {
            let mut v = DVector::zeros(dim);
            for j in 0..dim {
                let sign = if (config & (1 << j)) != 0 { 1.0 } else { -1.0 };
                v[j] = if j == trunc_idx { sign * t } else { sign };
            }

            let key = vertex_key(&v);
            if !seen.contains(&key) {
                seen.insert(key);
                vertices.push(v);
            }
        }
    }

    let edges = generate_edges_by_distance(&vertices, 2.0 * t + 0.1);
    (vertices, edges)
}

/// Generate Cantellated Hypercube (rhombicuboctahedron analog)
/// One coord at ±(1+√2), rest at ±1
fn generate_cantellated(dim: usize) -> (Vec<DVector<f64>>, Vec<[usize; 2]>) {
    let mut vertices = Vec::new();
    let mut seen = HashSet::new();
    let phi = 1.0 + 2.0_f64.sqrt();

    for large_idx in 0..dim {
        let num_configs = 1 << dim;
        for config in 0..num_configs {
            let mut v = DVector::zeros(dim);
            for j in 0..dim {
                let sign = if (config & (1 << j)) != 0 { 1.0 } else { -1.0 };
                v[j] = if j == large_idx { sign * phi } else { sign };
            }

            let key = vertex_key(&v);
            if !seen.contains(&key) {
                seen.insert(key);
                vertices.push(v);
            }
        }
    }

    let edges = generate_edges_by_distance(&vertices, 2.1);
    (vertices, edges)
}

/// Generate Runcinated Hypercube (hypercube + scaled cross-polytope)
fn generate_runcinated(dim: usize) -> (Vec<DVector<f64>>, Vec<[usize; 2]>) {
    let mut vertices = Vec::new();
    let mut seen = HashSet::new();

    // Hypercube vertices
    let (hc, _) = generate_hypercube(dim);
    for v in hc {
        let key = vertex_key(&v);
        if !seen.contains(&key) {
            seen.insert(key);
            vertices.push(v);
        }
    }

    // Scaled cross-polytope vertices
    let scale = 1.0 + 2.0_f64.sqrt();
    let (cp, _) = generate_cross_polytope(dim);
    for v in cp {
        let scaled = v * scale;
        let key = vertex_key(&scaled);
        if !seen.contains(&key) {
            seen.insert(key);
            vertices.push(scaled);
        }
    }

    let edges = generate_edges_by_distance(&vertices, 2.1);
    (vertices, edges)
}

/// Generate Demihypercube (half-hypercube, D_n symmetry)
/// Takes hypercube vertices with even parity (even number of +1 coords)
fn generate_demihypercube(dim: usize) -> (Vec<DVector<f64>>, Vec<[usize; 2]>) {
    let mut vertices = Vec::new();
    let num_verts = 1 << dim;

    for i in 0..num_verts {
        // Count bits (positive coords)
        let count = (i as u32).count_ones();

        // Only even parity
        if count % 2 == 0 {
            let mut v = DVector::zeros(dim);
            for j in 0..dim {
                v[j] = if (i & (1 << j)) != 0 { 1.0 } else { -1.0 };
            }
            vertices.push(v);
        }
    }

    // Demihypercube edges: vertices differ in exactly 2 coordinates
    let mut edges = Vec::new();
    let n = vertices.len();
    for i in 0..n {
        for j in (i + 1)..n {
            let diff: usize = (0..dim).filter(|&k| {
                let delta: f64 = vertices[i][k] - vertices[j][k];
                delta.abs() > 0.1
            }).count();
            if diff == 2 {
                edges.push([i, j]);
            }
        }
    }

    (vertices, edges)
}

/// Helper: Generate edges by minimum distance threshold
fn generate_edges_by_distance(vertices: &[DVector<f64>], max_dist: f64) -> Vec<[usize; 2]> {
    let n = vertices.len();
    let mut edges = Vec::new();
    let mut min_dist = f64::MAX;

    // First pass: find minimum distance
    for i in 0..n {
        for j in (i + 1)..n {
            let d = (&vertices[i] - &vertices[j]).norm();
            if d > 1e-9 && d < min_dist {
                min_dist = d;
            }
        }
    }

    // Second pass: collect edges within threshold of min
    let threshold = min_dist * 1.01; // Small tolerance
    for i in 0..n {
        for j in (i + 1)..n {
            let d = (&vertices[i] - &vertices[j]).norm();
            if d <= threshold.min(max_dist) {
                edges.push([i, j]);
            }
        }
    }

    edges
}

/// Count bits set in a number
#[inline]
fn count_bits(mut n: usize) -> usize {
    let mut count = 0;
    while n > 0 {
        count += n & 1;
        n >>= 1;
    }
    count
}

/// Generate faces for a hypercube analytically.
///
/// A hypercube face is formed by varying exactly 2 coordinates while keeping
/// the others fixed. Returns triangulated quads (2 triangles per face).
///
/// # Arguments
/// * `dim` - Dimensionality of the hypercube
///
/// # Returns
/// Flattened triangle indices [v0, v1, v2, v0, v1, v2, ...]
fn generate_hypercube_faces(dim: usize) -> Vec<u32> {
    let mut faces = Vec::new();

    // Iterate over all pairs of dimensions that define the face plane
    for d1 in 0..dim {
        for d2 in (d1 + 1)..dim {
            // Iterate over all combinations of the other (fixed) dimensions
            // There are 2^(dimension - 2) faces for each plane orientation
            let fixed_count = 1 << (dim - 2);

            for i in 0..fixed_count {
                // Construct the base vertex index.
                // Map bits of 'i' to dimensions that are NOT d1 or d2.
                let mut base_index = 0;
                let mut current_bit = 0;

                for bit in 0..dim {
                    if bit == d1 || bit == d2 {
                        continue;
                    }

                    if (i >> current_bit) & 1 != 0 {
                        base_index |= 1 << bit;
                    }
                    current_bit += 1;
                }

                // The 4 vertices of the face are formed by varying bits d1 and d2.
                let v1 = base_index;
                let v2 = base_index | (1 << d1);
                let v3 = base_index | (1 << d1) | (1 << d2);
                let v4 = base_index | (1 << d2);

                // Calculate winding order adjustment
                // 1. Permutation parity of (d1, d2, ...fixedDims)
                let mut perm_indices = vec![d1, d2];
                for k in 0..dim {
                    if k != d1 && k != d2 {
                        perm_indices.push(k);
                    }
                }

                let mut inversions = 0;
                for a in 0..perm_indices.len() {
                    for b in (a + 1)..perm_indices.len() {
                        if perm_indices[a] > perm_indices[b] {
                            inversions += 1;
                        }
                    }
                }
                let is_even_perm = inversions % 2 == 0;

                // 2. Count "negative" fixed coordinates (bits of i that are 0)
                let set_bit_count = count_bits(i);
                let zero_count = (dim - 2) - set_bit_count;

                // 3. Determine flip
                let flip = if is_even_perm {
                    zero_count % 2 != 0
                } else {
                    zero_count % 2 == 0
                };

                // Triangulate quad (split into 2 triangles)
                if flip {
                    // Quad: v1, v4, v3, v2 → Triangles: (v1, v4, v3), (v1, v3, v2)
                    faces.push(v1 as u32);
                    faces.push(v4 as u32);
                    faces.push(v3 as u32);

                    faces.push(v1 as u32);
                    faces.push(v3 as u32);
                    faces.push(v2 as u32);
                } else {
                    // Quad: v1, v2, v3, v4 → Triangles: (v1, v2, v3), (v1, v3, v4)
                    faces.push(v1 as u32);
                    faces.push(v2 as u32);
                    faces.push(v3 as u32);

                    faces.push(v1 as u32);
                    faces.push(v3 as u32);
                    faces.push(v4 as u32);
                }
            }
        }
    }

    faces
}

/// Generate triangle faces via 3-cycle detection in edge graph
fn generate_triangle_faces(vertices: &[DVector<f64>], edges: &[[usize; 2]]) -> Vec<u32> {
    use std::collections::{HashMap, HashSet};

    // Build adjacency map
    let mut adj: HashMap<usize, HashSet<usize>> = HashMap::new();
    for [a, b] in edges {
        adj.entry(*a).or_default().insert(*b);
        adj.entry(*b).or_default().insert(*a);
    }

    let mut faces = Vec::new();
    let mut seen: HashSet<(usize, usize, usize)> = HashSet::new();

    for (&v1, neighbors) in &adj {
        for &v2 in neighbors {
            if v2 <= v1 {
                continue;
            }

            if let Some(v2_neighbors) = adj.get(&v2) {
                for &v3 in v2_neighbors {
                    if v3 <= v2 {
                        continue;
                    }

                    if neighbors.contains(&v3) {
                        let key = (v1, v2, v3);
                        if !seen.contains(&key) {
                            seen.insert(key);

                            // Check winding order using centroid direction
                            let p0 = &vertices[v1];
                            let p1 = &vertices[v2];
                            let p2 = &vertices[v3];

                            // Get first 3 coords for cross product
                            let get_3d = |v: &DVector<f64>| -> [f64; 3] {
                                [
                                    *v.get(0).unwrap_or(&0.0),
                                    *v.get(1).unwrap_or(&0.0),
                                    *v.get(2).unwrap_or(&0.0),
                                ]
                            };

                            let a = get_3d(p0);
                            let b = get_3d(p1);
                            let c = get_3d(p2);

                            // Edge vectors
                            let edge1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
                            let edge2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];

                            // Cross product for normal
                            let normal = [
                                edge1[1] * edge2[2] - edge1[2] * edge2[1],
                                edge1[2] * edge2[0] - edge1[0] * edge2[2],
                                edge1[0] * edge2[1] - edge1[1] * edge2[0],
                            ];

                            // Triangle centroid
                            let centroid = [
                                (a[0] + b[0] + c[0]) / 3.0,
                                (a[1] + b[1] + c[1]) / 3.0,
                                (a[2] + b[2] + c[2]) / 3.0,
                            ];

                            // Dot product
                            let dot = normal[0] * centroid[0]
                                + normal[1] * centroid[1]
                                + normal[2] * centroid[2];

                            if dot >= 0.0 {
                                faces.push(v1 as u32);
                                faces.push(v2 as u32);
                                faces.push(v3 as u32);
                            } else {
                                faces.push(v1 as u32);
                                faces.push(v3 as u32);
                                faces.push(v2 as u32);
                            }
                        }
                    }
                }
            }
        }
    }

    faces
}

/// Generate faces using convex hull algorithm
/// 
/// This properly handles non-triangular faces (squares, hexagons, etc.)
/// by computing the actual convex hull of the polytope.
/// 
/// Performance: O(V × F) where F can be O(V^⌊d/2⌋) worst case
/// Best for polytopes with <1000 vertices
fn generate_convex_hull_faces(vertices: &[DVector<f64>], dim: usize) -> Vec<u32> {
    // Need at least dim+1 vertices for a non-degenerate simplex in dim-D
    // and dim must be at least 3 for meaningful face generation
    if vertices.len() < dim + 1 || dim < 3 {
        return vec![];
    }
    
    // Convert DVector to Vec<f64> for hull module
    let vec_vertices: Vec<Vec<f64>> = vertices.iter()
        .map(|v| v.iter().cloned().collect())
        .collect();
    
    // Project to affine hull (handles degenerate cases)
    let (projected, actual_dim) = hull::project_to_affine_hull(&vec_vertices, dim);
    
    // Need at least 3D for triangular faces and enough points
    if actual_dim < 3 || projected.len() < actual_dim + 1 {
        return vec![];
    }
    
    // Use catch_unwind to gracefully handle any edge cases in convex hull
    let result = std::panic::catch_unwind(|| {
        hull::convex_hull(&projected, actual_dim)
    });
    
    match result {
        Ok(hull_indices) => hull_indices.into_iter().map(|idx| idx as u32).collect(),
        Err(_) => {
            // Convex hull failed - return empty faces rather than crashing
            vec![]
        }
    }
}

/// Main entry point for generation (to be exposed via lib.rs)
pub fn generate_wythoff(config: &WythoffConfig) -> PolytopeResult {
    let dim = config.dimension;
    let mut warnings = Vec::new();

    // Use config max_vertices to prevent O(n²) edge computation from blocking too long
    let max_verts = config.max_vertices;

    let (mut vertices, edges) = match (config.symmetry_group.as_str(), config.preset.as_str()) {
        ("B", "regular") => generate_hypercube(dim),
        ("B", "cross") => generate_cross_polytope(dim),
        ("B", "orthoplex") => generate_cross_polytope(dim),
        ("A", "regular") => generate_simplex(dim),
        ("B", "omnitruncated") => generate_omnitruncated(dim, max_verts),
        ("B", "rectified") => generate_rectified(dim),
        ("B", "truncated") => generate_truncated(dim),
        ("B", "cantellated") => generate_cantellated(dim),
        ("B", "runcinated") => generate_runcinated(dim),
        ("D", "regular") | ("D", _) => generate_demihypercube(dim),
        _ => {
            warnings.push(format!("Unsupported config: {} {}", config.symmetry_group, config.preset));
            (vec![], vec![])
        }
    };

    // Scale
    center_and_scale(&mut vertices, config.scale);

    // Generate faces based on preset type
    let faces = match (config.symmetry_group.as_str(), config.preset.as_str()) {
        ("B", "regular") => {
            // Regular hypercube: use analytical quad face generation
            generate_hypercube_faces(dim)
        }
        ("A", "regular") | ("B", "cross") | ("B", "orthoplex") => {
            // Simplex and cross-polytope: use triangle face detection
            generate_triangle_faces(&vertices, &edges)
        }
        ("B", "rectified") | ("B", "truncated") | ("B", "runcinated") => {
            // Use convex hull for proper face detection on these convex polytopes
            // These have manageable vertex counts (<1000 in most dimensions)
            if !vertices.is_empty() {
                generate_convex_hull_faces(&vertices, dim)
            } else {
                vec![]
            }
        }
        _ => {
            // Other presets (cantellated, omnitruncated): use triangle face detection
            // Convex hull would be too slow for high vertex counts
            if !vertices.is_empty() && !edges.is_empty() {
                generate_triangle_faces(&vertices, &edges)
            } else {
                vec![]
            }
        }
    };

    // Flatten logic
    let mut flat_vertices = Vec::with_capacity(vertices.len() * dim);
    for v in &vertices {
        flat_vertices.extend(v.iter());
    }

    let mut flat_edges = Vec::with_capacity(edges.len() * 2);
    for e in &edges {
        flat_edges.push(e[0] as u32);
        flat_edges.push(e[1] as u32);
    }

    PolytopeResult {
        vertices: flat_vertices,
        edges: flat_edges,
        faces,
        dimension: dim,
        warnings,
    }
}
