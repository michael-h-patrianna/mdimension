use nalgebra::{DVector, DMatrix};

// Threshold for linear independence (more robust than 1e-10)
const EPSILON: f64 = 1e-9;

/// Project points to their affine hull to handle degenerate cases (e.g. points in a plane in 3D).
///
/// Returns:
/// - Projected points (in the lower dimension basis)
/// - The actual dimension of the hull
pub fn project_to_affine_hull(vertices: &[Vec<f64>], original_dim: usize) -> (Vec<Vec<f64>>, usize) {
    if vertices.len() < 2 {
        return (vertices.to_vec(), vertices.get(0).map_or(0, |v| v.len()));
    }

    let n = vertices.len();
    let d = original_dim;

    // Origin is the first point
    let origin = DVector::from_vec(vertices[0].clone());

    // Compute difference vectors from origin
    let mut basis: Vec<DVector<f64>> = Vec::with_capacity(d);

    for i in 1..n {
        let v = DVector::from_vec(vertices[i].clone());
        let mut diff = &v - &origin;

        // Gram-Schmidt: Project out existing basis vectors
        for b in &basis {
            let dot = diff.dot(b);
            diff -= b * dot;
        }

        let norm = diff.norm();
        if norm > EPSILON {
            basis.push(diff / norm);
        }

        // If we found d linearly independent vectors, we span the full space
        if basis.len() >= d {
            break;
        }
    }

    let actual_dim = basis.len();

    // If full dimension, return original vertices
    if actual_dim >= d {
        return (vertices.to_vec(), d);
    }

    // Use Matrix multiplication for batch projection if possible,
    // but for now simple loop is clear.
    let mut projected_points = Vec::with_capacity(n);

    for v_raw in vertices {
        let v = DVector::from_vec(v_raw.clone());
        let centered = &v - &origin;
        let mut coords = Vec::with_capacity(actual_dim);

        for b in &basis {
            coords.push(centered.dot(b));
        }
        projected_points.push(coords);
    }

    (projected_points, actual_dim)
}

use std::collections::{HashSet, HashMap};

/// A Facet is a (d-1)-simplex defined by d vertices.
#[derive(Clone, Debug)]
struct Facet {
    /// Indices into the original vertex array
    vertices: Vec<usize>,
    /// Normal vector (length 1)
    normal: DVector<f64>,
    /// Plane offset (normal . p = offset)
    offset: f64,
}

impl Facet {
    /// Compute normal and offset for a facet defined by d vertices.
    /// Also orients the normal so that `centroid` is on the negative side (inside).
    fn new(vertex_indices: &[usize], all_points: &[Vec<f64>], centroid: &DVector<f64>) -> Option<Self> {
        let dim = all_points[0].len();
        if vertex_indices.len() != dim {
             return None;
        }

        let p0_slice = &all_points[vertex_indices[0]];
        let p0 = DVector::from_column_slice(p0_slice);

        // Special case for 3D: use cross product (more robust and faster)
        // For 3D, a facet has 3 vertices defining a plane, and we need the normal
        if dim == 3 {
            let p1 = &all_points[vertex_indices[1]];
            let p2 = &all_points[vertex_indices[2]];
            
            // Edge vectors
            let e1 = [p1[0] - p0_slice[0], p1[1] - p0_slice[1], p1[2] - p0_slice[2]];
            let e2 = [p2[0] - p0_slice[0], p2[1] - p0_slice[1], p2[2] - p0_slice[2]];
            
            // Cross product: e1 × e2
            let cross = [
                e1[1] * e2[2] - e1[2] * e2[1],
                e1[2] * e2[0] - e1[0] * e2[2],
                e1[0] * e2[1] - e1[1] * e2[0],
            ];
            
            let len = (cross[0]*cross[0] + cross[1]*cross[1] + cross[2]*cross[2]).sqrt();
            if len < EPSILON {
                return None; // Degenerate (collinear points)
            }
            
            let mut normal = DVector::from_vec(vec![cross[0]/len, cross[1]/len, cross[2]/len]);
            
            // Orient normal outward (away from centroid)
            let to_centroid = centroid - &p0;
            if to_centroid.dot(&normal) > 0.0 {
                normal = -normal;
            }

            let offset = normal.dot(&p0);

            return Some(Facet {
                vertices: vertex_indices.to_vec(),
                normal,
                offset,
            });
        }

        // General case for dim > 3: use SVD to find null space
        // Construct matrix (dim-1 rows, dim cols) where rows are edges (p_i - p_0)
        let mut matrix_data = Vec::with_capacity((dim - 1) * dim);
        for i in 1..dim {
            let pi = &all_points[vertex_indices[i]];
            for j in 0..dim {
                matrix_data.push(pi[j] - p0_slice[j]);
            }
        }

        // Create matrix from row-major data.
        let mat = DMatrix::from_row_slice(dim - 1, dim, &matrix_data);

        // Compute SVD to find null space (normal vector)
        // We need V^T. For a (m,n) matrix with m < n, thin SVD gives V^T of shape (m, n).
        // The null space has dimension n - m = 1, so we need the last column of V,
        // which we compute by finding a vector orthogonal to all rows of mat.
        // 
        // More iterations for high dimensions (200 vs 100), slightly looser tolerance (1e-8 vs 1e-9)
        let svd = mat.try_svd(false, true, 1e-8, 200)?;
        let v_t = svd.v_t?;

        // The thin SVD gives V^T with shape (min(m,n), n) = (dim-1, dim).
        // We need a vector orthogonal to all the rows of V^T (the row space).
        // This is done by finding the null space of V^T, which is a vector
        // orthogonal to all singular vectors.
        // 
        // For the null space, we compute: the vector orthogonal to the (dim-1) rows.
        // We use Gram-Schmidt to find a vector orthogonal to all rows of V^T.
        let mut normal = DVector::zeros(dim);
        
        // Start with a random-ish vector and orthogonalize against all rows of V^T
        // We try each basis vector until we find one that isn't in the row space
        for start_idx in 0..dim {
            let mut candidate = DVector::zeros(dim);
            candidate[start_idx] = 1.0;
            
            // Project out all rows of V^T
            for row_idx in 0..v_t.nrows() {
                let row: DVector<f64> = v_t.row(row_idx).transpose().into();
                let dot = candidate.dot(&row);
                candidate -= &row * dot;
            }
            
            let len = candidate.norm();
            if len > EPSILON {
                normal = candidate / len;
                break;
            }
        }
        
        if normal.norm() < EPSILON {
            return None; // Failed to find normal (degenerate case)
        }

        // Orient normal outward (away from centroid)
        // If (centroid - p0) . normal > 0, normal points IN. Flip it.
        let to_centroid = centroid - &p0;
        if to_centroid.dot(&normal) > 0.0 {
            normal = -normal;
        }

        let offset = normal.dot(&p0);

        Some(Facet {
            vertices: vertex_indices.to_vec(),
            normal,
            offset,
        })
    }

    /// Check if a point is "visible" form this facet (i.e., in front of it)
    fn is_visible(&self, point: &[f64]) -> bool {
        let p = DVector::from_column_slice(point);
        let dist = self.normal.dot(&p) - self.offset;
        dist > 1e-9 // Epsilon for robustness
    }
}

/// Computes the convex hull using the Incremental Algorithm (process points one by one).
pub fn convex_hull(vertices: &[Vec<f64>], dim: usize) -> Vec<usize> {
    if vertices.len() <= dim {
        // Degenerate
        return (0..vertices.len()).collect();
    }

    // 0. Compute Centroid (for orientation)
    let mut centroid = DVector::zeros(dim);
    for v in vertices {
        for i in 0..dim {
            centroid[i] += v[i];
        }
    }
    centroid /= vertices.len() as f64;

    // 1. Initial Simplex
    // Take first d+1 points
    let initial_indices: Vec<usize> = (0..=dim).collect();
    let mut facets: Vec<Facet> = Vec::new();

    // Create faces for the initial simplex
    // A simplex has d+1 faces. Each face discards one vertex.
    for i in 0..=dim {
        let mut face_indices = initial_indices.clone();
        face_indices.remove(i); // The face is formed by all points except i

        if let Some(facet) = Facet::new(&face_indices, vertices, &centroid) {
            facets.push(facet);
        }
    }

    // 2. Iterate remaining points
    for i in (dim + 1)..vertices.len() {
        let point = &vertices[i];

        // Find visible facets
        let mut visible_indices = Vec::new();
        for (idx, facet) in facets.iter().enumerate() {
            if facet.is_visible(point) {
                visible_indices.push(idx);
            }
        }

        // If inside hull (no faces visible), skip
        if visible_indices.is_empty() {
            continue;
        }

        // Find Horizon: Ridges between visible and invisible faces
        // Logic: A ridge is a boundary. If a ridge belongs to 1 visible and 1 invisible facet, it's on horizon.
        // If 2 visible, it's internal (delete). If 2 invisible, it's not touched.

        // We need to count ridge occurrences in the visible set.
        // A ridge is determined by a set of indices (sorted).
        // For N-D, a ridge has D-1 vertices.
        let mut ridge_counts: HashMap<Vec<usize>, usize> = HashMap::new();

        for &facet_idx in &visible_indices {
             let facet = &facets[facet_idx];
             // Generate all ridges of this facet
             // A facet has D vertices. Ridges are subsets of size D-1.
             for j in 0..dim {
                 let mut ridge = facet.vertices.clone();
                 ridge.remove(j);
                 ridge.sort(); // Normalize key
                 *ridge_counts.entry(ridge).or_insert(0) += 1;
             }
        }

        // Horizon ridges are those shared by EXACTLY ONE visible facet
        // (the other side must be an invisible facet, because the ridge exists in the polytope).
        // Wait, if we only scan visible facets, ridges with count=1 are on the boundary of the visible patch.
        // Ridges with count=2 are internal to the visible patch (between two visible facets).
        let horizon: Vec<Vec<usize>> = ridge_counts.into_iter()
            .filter(|(_, count)| *count == 1)
            .map(|(k, _)| k)
            .collect();

        // Remove visible facets
        // We process in reverse index order to avoid shifting issues if we used swap_remove
        // But scanning visible_indices (sorted) is safer.
        // Actually, just build a new list or filter.
        let visible_set: HashSet<usize> = visible_indices.iter().cloned().collect();
        facets = facets.into_iter().enumerate()
            .filter(|(idx, _)| !visible_set.contains(idx))
            .map(|(_, f)| f)
            .collect();

        // Add new facets connecting horizon to point
        for ridge in horizon {
            let mut new_indices = ridge.clone();
            new_indices.push(i); // Add current point

            if let Some(new_facet) = Facet::new(&new_indices, vertices, &centroid) {
                facets.push(new_facet);
            }
        }
    }

    // 3. Extract Triangles with Deduplication
    // The facets are (d-1)-simplices. We need to convert them to triangles (3 vertices).
    // For 3D, facets ARE triangles.
    // For 4D+, facets are higher-order simplices -> C(d,3) triangles each.
    // Adjacent facets share triangles, so we must deduplicate.
    let mut seen: HashSet<[usize; 3]> = HashSet::new();
    let mut triangles = Vec::new();

    for facet in facets {
        let n = facet.vertices.len(); // Should be dim
        for i in 0..n {
            for j in (i+1)..n {
                for k in (j+1)..n {
                    // Create sorted triangle key for deduplication
                    let mut tri = [facet.vertices[i], facet.vertices[j], facet.vertices[k]];
                    tri.sort();

                    // Only add if not already seen
                    if seen.insert(tri) {
                        triangles.push(tri[0]);
                        triangles.push(tri[1]);
                        triangles.push(tri[2]);
                    }
                }
            }
        }
    }

    triangles
}
