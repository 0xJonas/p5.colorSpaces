#version 100

precision highp float;

varying vec2 texCoords;

uniform sampler2D canvas;

const vec3 scaling = vec3(0.95047, 1.0, 1.08883);

const mat3 conversionMatrix = mat3(
    0.4123907992659594812888840055, 0.3575843393838779637292839034, 0.1804807884018342875046284426,
    0.2126390058715103575395808154, 0.7151686787677559274585678068, 0.07219231536073371500185137706,
    0.01933081871559185068541643776, 0.1191947797946259879097613012, 0.9505321522496605808577097982
);

vec3 srgbGamma(vec3 comps) {
    vec3 res1 = 1.055 * pow(comps, vec3(2.4)) - 0.055;
    vec3 res2 = comps * 12.92;
    return vec3(
        comps.r <= 0.0031308 ? res2.r : res1.r,
        comps.g <= 0.0031308 ? res2.g : res1.g,
        comps.b <= 0.0031308 ? res2.b : res1.b
    );
}

void main(void) {
    vec4 xyz = texture2D(canvas, texCoords) * scaling;
    vec3 linearRGB = conversionMatrix * xyz.xyz;
    vec3 srgb = srgbGamma(linearRGB);
    gl_FragColor = vec4(srgb, xyz.a);
}
