#version 100

attribute highp vec2 vertexCoords;

varying highp vec2 texCoords;

void main(void) {
    gl_Position = vec4(vertexCoords, 0.0, 1.0);
    texCoords = (vertexCoords + vec2(1.0, -1.0)) * vec2(0.5, -0.5);
}
