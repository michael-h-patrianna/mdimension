use nalgebra::{DVector, Vector3};

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
