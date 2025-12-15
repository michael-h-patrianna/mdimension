// ============================================
// Menger Sponge Vertex Shader
// Standard pass-through for raymarching
// ============================================

out vec3 vPosition;
out vec2 vUv;

void main() {
    vPosition = position;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
