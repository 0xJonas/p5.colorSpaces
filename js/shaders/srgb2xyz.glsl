#version 100

precision highp float;

varying vec2 texCoords;

uniform sampler2D canvas;

const vec3 scaling = 1.0 / vec3(0.95047, 1.0, 1.08883);

const mat3 conversionMatrix = mat3(
    3.240969941904521343773680225, -1.537383177570093457943925235, -0.4986107602930032836574892651,
    -0.9692436362808798261285146964, 1.875967501507720667721122882, 0.04155505740717561247596181202,
    0.05563007969699360845892843062, -0.2039769588889765643494042455, 1.056971514242878560719640180
);

vec3 srgbDigamma(vec3 comps) {
    vec3 res1 = pow((comps + 0.055) / 1.055, vec3(1.0 / 2.4));
    vec3 res2 = comps / 12.92;
    return vec3(
        comps.r <= 0.04045 ? res2.r : res1.r,
        comps.g <= 0.04045 ? res2.g : res1.g,
        comps.b <= 0.04045 ? res2.b : res1.b
    );
}

void main(void) {
    vec4 srgb = texture2D(canvas, texCoords);
    vec3 linearRGB = srgbDigamma(srgb.rgb);
    vec3 xyz = conversionMatrix * linearRGB;
    gl_FragColor = vec4(xyz * scaling, srgb.a);
}
