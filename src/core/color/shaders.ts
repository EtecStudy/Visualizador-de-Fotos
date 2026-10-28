export const VERTEX_SHADER = /* glsl */ `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

/**
 * Color maths used by the GPU pipeline. Values mirror `ColorAdjustments`:
 * brightness/contrast/saturation in -1..1 and sharpness in 0..1.
 */
export const FRAGMENT_SHADER = /* glsl */ `
precision highp float;

varying vec2 vUv;

uniform sampler2D uImage;
uniform vec2 uTexel;
uniform float uBrightness;
uniform float uContrast;
uniform float uSaturation;
uniform float uGrayscale;
uniform float uSharpen;

float luma(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

void main() {
  vec4 pixel = texture2D(uImage, vUv);
  vec3 color = pixel.rgb;

  if (uSharpen > 0.001) {
    vec3 blur = (
      texture2D(uImage, vUv + vec2(uTexel.x, 0.0)).rgb +
      texture2D(uImage, vUv - vec2(uTexel.x, 0.0)).rgb +
      texture2D(uImage, vUv + vec2(0.0, uTexel.y)).rgb +
      texture2D(uImage, vUv - vec2(0.0, uTexel.y)).rgb
    ) * 0.25;
    color = clamp(color + (color - blur) * uSharpen * 1.6, 0.0, 1.0);
  }

  color += uBrightness * 0.35;
  color = (color - 0.5) * (1.0 + uContrast * 0.75) + 0.5;

  float l = luma(color);
  color = mix(vec3(l), color, max(0.0, 1.0 + uSaturation));

  float gray = luma(color);
  color = mix(color, vec3(gray), uGrayscale);

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), pixel.a);
}
`;
