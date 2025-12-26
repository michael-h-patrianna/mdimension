use nalgebra::{DVector, Vector3};
use std::collections::HashSet;
use std::f64::consts::PI;

/// Build adjacency list from flat edges
fn build_adjacency_list(num_vertices: usize, edges: &[u32]) -> Vec<Vec<usize>> {
    let mut adj = vec![Vec::new(); num_vertices];
    for chunk in edges.chunks(2) {
        if let [u, v] = chunk {
            let u = *u as usize;
            let v = *v as usize;
            // self-loops or out of bounds check? assuming valid input for speed
            if u < num_vertices && v < num_vertices && u != v {
                 // Check if already added to avoid dupes?
                 // For standard polytopes, edges are unique.
                 // Vector is faster than HashSet for small neighbor counts.
                 if !adj[u].contains(&v) { adj[u].push(v); }
                 if !adj[v].contains(&u) { adj[v].push(u); }
            }
        }
    }
    // Sort neighbors to allow binary search or quicker intersection
    for neighbors in &mut adj {
        neighbors.sort_unstable();
    }
    adj
}

/// Project N-D point to 3D for winding check
fn to_3d(v: &DVector<f64>) -> Vector3<f64> {
    let x = v.get(0).cloned().unwrap_or(0.0);
    let y = v.get(1).cloned().unwrap_or(0.0);
    let z = v.get(2).cloned().unwrap_or(0.0);
    Vector3::new(x, y, z)
}

/// Find all triangular faces (3-cycles)
pub fn find_triangles(vertices: &[DVector<f64>], edges: &[u32]) -> Vec<u32> {
    let num_vertices = vertices.len();
    if num_vertices < 3 { return vec![]; }

    let adj = build_adjacency_list(num_vertices, edges);
    let mut faces = Vec::new(); // Flattened faces [v0, v1, v2, ...]

    // Iterate v1
    for v1 in 0..num_vertices {
        let neighbors = &adj[v1];
        if neighbors.len() < 2 { continue; }

        for i in 0..neighbors.len() {
            let v2 = neighbors[i];
            // Enforce v1 < v2 < v3 order for uniqueness during search
            if v2 <= v1 { continue; }

            for j in (i + 1)..neighbors.len() {
                let v3 = neighbors[j];
                if v3 <= v2 { continue; }

                // Check if v2 and v3 are connected
                if adj[v2].binary_search(&v3).is_ok() {
                    // Found triangle (v1, v2, v3)

                    // Winding Order Check (Heuristic: Outward facing from centroid)
                    // Assume centroid is origin (0,0,0) for centered polytopes
                    // Normal = (v2 - v1) x (v3 - v1)
                    // If dot(Normal, Center) > 0, strict winding.

                    let p1 = to_3d(&vertices[v1]);
                    let p2 = to_3d(&vertices[v2]);
                    let p3 = to_3d(&vertices[v3]);

                    let u = p2 - p1;
                    let v = p3 - p1;
                    let normal = u.cross(&v);

                    // Center of triangle (approx)
                    let center = (p1 + p2 + p3) / 3.0;

                    // Check alignment with outward vector (center position)
                    let is_outward = normal.dot(&center) > 0.0;

                    if is_outward {
                        faces.extend_from_slice(&[v1 as u32, v2 as u32, v3 as u32]);
                    } else {
                        faces.extend_from_slice(&[v1 as u32, v3 as u32, v2 as u32]);
                    }
                }
            }
        }
    }

    faces
}

// ============================================================================
// Edge-Walking Face Detection (handles non-triangular faces)
// ============================================================================

/// Find the next vertex in a face walk using angular ordering.
///
/// At vertex `curr`, coming from `prev`, find the neighbor that makes
/// the smallest counter-clockwise angle from the incoming direction.
/// This traces the face boundary correctly for convex polytopes.
fn find_next_vertex(
    adj: &[Vec<usize>],
    vertices: &[DVector<f64>],
    prev: usize,
    curr: usize,
) -> Option<usize> {
    let neighbors = &adj[curr];
    if neighbors.len() < 2 {
        return None;
    }

    // Get 3D projections for angle computation
    let p_prev = to_3d(&vertices[prev]);
    let p_curr = to_3d(&vertices[curr]);

    // Incoming direction (from prev to curr)
    let d_in = p_curr - p_prev;
    let d_in_len = d_in.norm();
    if d_in_len < 1e-10 {
        return None;
    }
    let d_in = d_in / d_in_len;

    // Reference "up" direction (from origin through curr vertex)
    // This defines the plane for angle measurement
    let up = p_curr;
    let up_len = up.norm();
    let up = if up_len > 1e-10 { up / up_len } else { Vector3::new(0.0, 0.0, 1.0) };

    // "Right" direction = d_in × up (perpendicular to both)
    let right = d_in.cross(&up);
    let right_len = right.norm();
    let right = if right_len > 1e-10 {
        right / right_len
    } else {
        // Fallback: use a different up vector
        let alt_up = if up.x.abs() < 0.9 { Vector3::new(1.0, 0.0, 0.0) } else { Vector3::new(0.0, 1.0, 0.0) };
        let right = d_in.cross(&alt_up);
        let right_len = right.norm();
        if right_len > 1e-10 { right / right_len } else { return None; }
    };

    let mut best_angle = f64::MAX;
    let mut best_next: Option<usize> = None;

    for &cand in neighbors {
        if cand == prev {
            continue;
        }

        let p_cand = to_3d(&vertices[cand]);
        let d_out = p_cand - p_curr;
        let d_out_len = d_out.norm();
        if d_out_len < 1e-10 {
            continue;
        }
        let d_out = d_out / d_out_len;

        // Compute angle using atan2(right component, forward component)
        // Forward is opposite of incoming direction
        let forward = -d_in.dot(&d_out);
        let sideways = right.dot(&d_out);
        let mut angle = sideways.atan2(forward);

        // Normalize to [0, 2π) - we want smallest positive angle (CCW)
        if angle < 1e-10 {
            angle += 2.0 * PI;
        }

        if angle < best_angle {
            best_angle = angle;
            best_next = Some(cand);
        }
    }

    best_next
}

/// Walk a face starting from a directed edge (start → second).
/// Returns the face as a list of vertex indices, or empty if invalid.
fn walk_face(
    adj: &[Vec<usize>],
    vertices: &[DVector<f64>],
    start: usize,
    second: usize,
) -> Vec<usize> {
    let mut face = vec![start, second];
    let mut prev = start;
    let mut curr = second;

    // Maximum face size (prevents infinite loops)
    const MAX_FACE_SIZE: usize = 20;

    loop {
        // Find next vertex using angular ordering
        let next = match find_next_vertex(adj, vertices, prev, curr) {
            Some(n) => n,
            None => return vec![], // Invalid face
        };

        if next == start {
            // Completed the cycle - valid face
            break;
        }

        if face.contains(&next) {
            // Hit a vertex we've seen (not start) - invalid
            return vec![];
        }

        if face.len() >= MAX_FACE_SIZE {
            // Face too large - probably invalid
            return vec![];
        }

        face.push(next);
        prev = curr;
        curr = next;
    }

    face
}

/// Normalize a face by rotating to start with the smallest vertex index.
/// This allows deduplication of faces found from different starting edges.
fn normalize_face(mut face: Vec<usize>) -> Vec<usize> {
    if face.is_empty() {
        return face;
    }

    // Find position of minimum element
    let min_pos = face
        .iter()
        .enumerate()
        .min_by_key(|(_, &v)| v)
        .map(|(i, _)| i)
        .unwrap_or(0);

    // Rotate so minimum is first
    face.rotate_left(min_pos);
    face
}

/// Triangulate a convex polygon using fan triangulation.
/// For a polygon [v0, v1, v2, v3, ...], creates triangles:
/// (v0, v1, v2), (v0, v2, v3), (v0, v3, v4), ...
fn triangulate_face(face: &[usize], vertices: &[DVector<f64>]) -> Vec<[usize; 3]> {
    if face.len() < 3 {
        return vec![];
    }

    if face.len() == 3 {
        return vec![[face[0], face[1], face[2]]];
    }

    let mut triangles = Vec::with_capacity(face.len() - 2);
    let v0 = face[0];

    for i in 1..(face.len() - 1) {
        triangles.push([v0, face[i], face[i + 1]]);
    }

    // Check winding order for the first triangle and apply to all
    let p0 = to_3d(&vertices[triangles[0][0]]);
    let p1 = to_3d(&vertices[triangles[0][1]]);
    let p2 = to_3d(&vertices[triangles[0][2]]);

    let edge1 = p1 - p0;
    let edge2 = p2 - p0;
    let normal = edge1.cross(&edge2);
    let center = (p0 + p1 + p2) / 3.0;

    let is_outward = normal.dot(&center) > 0.0;

    if !is_outward {
        // Flip winding for all triangles
        for tri in &mut triangles {
            tri.swap(1, 2);
        }
    }

    triangles
}

/// Find all polygon faces using edge-walking algorithm.
///
/// This handles faces of any size (triangles, squares, pentagons, etc.)
/// by walking around face boundaries using angular ordering.
///
/// For convex uniform polytopes, each edge belongs to exactly 2 faces.
/// We find both faces by walking from each direction of each edge.
pub fn find_polygon_faces(vertices: &[DVector<f64>], edges: &[u32]) -> Vec<u32> {
    let num_vertices = vertices.len();
    if num_vertices < 3 {
        return vec![];
    }

    let adj = build_adjacency_list(num_vertices, edges);

    // Collect unique faces (normalized to avoid duplicates)
    let mut unique_faces: HashSet<Vec<usize>> = HashSet::new();

    // For each edge, walk both directions to find both adjacent faces
    for chunk in edges.chunks(2) {
        if let [a, b] = chunk {
            let a = *a as usize;
            let b = *b as usize;

            if a >= num_vertices || b >= num_vertices {
                continue;
            }

            // Walk face from edge a → b
            let face1 = walk_face(&adj, vertices, a, b);
            if face1.len() >= 3 {
                unique_faces.insert(normalize_face(face1));
            }

            // Walk face from edge b → a (the other face)
            let face2 = walk_face(&adj, vertices, b, a);
            if face2.len() >= 3 {
                unique_faces.insert(normalize_face(face2));
            }
        }
    }

    // Triangulate all faces and flatten to output
    let mut result = Vec::new();

    for face in unique_faces {
        let triangles = triangulate_face(&face, vertices);
        for [v0, v1, v2] in triangles {
            result.push(v0 as u32);
            result.push(v1 as u32);
            result.push(v2 as u32);
        }
    }

    result
}
