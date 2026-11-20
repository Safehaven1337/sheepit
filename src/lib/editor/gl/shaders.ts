export const VERT = /* glsl */ `#version 300 es
in vec2 a_pos;
uniform float u_flipY;
out vec2 v_uv;
void main() {
  vec2 uv = a_pos * 0.5 + 0.5;
  if (u_flipY > 0.5) uv.y = 1.0 - uv.y;
  v_uv = uv;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`

export const COPY_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
out vec4 o;
void main() { o = texture(u_tex, v_uv); }`

/** Separable gaussian with adaptive tap spacing. */
export const BLUR_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_dir;     // texel size * direction
uniform float u_sigma;  // in texels
out vec4 o;
void main() {
  float s = max(u_sigma, 0.5);
  float stepPx = max(1.0, s / 3.0);
  vec4 acc = vec4(0.0);
  float wsum = 0.0;
  for (int i = -9; i <= 9; i++) {
    float x = float(i) * stepPx;
    float w = exp(-(x * x) / (2.0 * s * s));
    acc += texture(u_tex, v_uv + u_dir * x) * w;
    wsum += w;
  }
  o = acc / wsum;
}`

export const DEVELOP_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_src;
uniform sampler2D u_blurS;   // small radius blur (detail)
uniform sampler2D u_blurL;   // large radius blur (local contrast)
uniform sampler2D u_lut;     // 256x1 curves LUT
uniform vec2 u_texel;
uniform vec2 u_size;

uniform float u_exposure, u_contrast, u_highlights, u_shadows, u_whites, u_blacks;
uniform float u_temp, u_tint, u_vibrance, u_saturation;
uniform float u_texture, u_clarity, u_dehaze;
uniform float u_sharpen, u_denoise;
uniform float u_vignette, u_vigMid, u_vigFeather;
uniform float u_grain, u_grainSize, u_fade, u_seed;
uniform vec3 u_hsl[8];
uniform vec3 u_gShadow, u_gMid, u_gHigh; // rgb offsets (already * sat)
uniform vec3 u_gLum;                       // lum for shadows / mid / high
uniform float u_gBalance, u_gBlend;
uniform float u_mono;
uniform float u_useLut;
out vec4 o;

const vec3 LW = vec3(0.2126, 0.7152, 0.0722);
float luma(vec3 c) { return dot(c, LW); }

vec3 toLin(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 toSrgb(vec3 c) { c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }

vec3 rgb2hsl(vec3 c) {
  float mx = max(max(c.r, c.g), c.b);
  float mn = min(min(c.r, c.g), c.b);
  float l = (mx + mn) * 0.5;
  float h = 0.0, s = 0.0;
  float d = mx - mn;
  if (d > 1e-5) {
    s = l > 0.5 ? d / (2.0 - mx - mn) : d / (mx + mn);
    if (mx == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
    else if (mx == c.g) h = (c.b - c.r) / d + 2.0;
    else h = (c.r - c.g) / d + 4.0;
    h /= 6.0;
  }
  return vec3(h, s, l);
}
float hue2rgb(float p, float q, float t) {
  t = fract(t);
  if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
  if (t < 0.5) return q;
  if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
  return p;
}
vec3 hsl2rgb(vec3 hsl) {
  if (hsl.y <= 0.0) return vec3(hsl.z);
  float q = hsl.z < 0.5 ? hsl.z * (1.0 + hsl.y) : hsl.z + hsl.y - hsl.z * hsl.y;
  float p = 2.0 * hsl.z - q;
  return vec3(hue2rgb(p, q, hsl.x + 1.0/3.0), hue2rgb(p, q, hsl.x), hue2rgb(p, q, hsl.x - 1.0/3.0));
}

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1, 0)), c = hash(i + vec2(0, 1)), d = hash(i + vec2(1, 1));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// hue centers for the 8-channel colour mixer (0..1)
const float HC[9] = float[9](0.0, 30.0/360.0, 60.0/360.0, 120.0/360.0, 180.0/360.0, 240.0/360.0, 270.0/360.0, 300.0/360.0, 1.0);

vec3 mixerAt(float h) {
  // partition-of-unity interpolation between neighbouring hue centres
  for (int i = 0; i < 8; i++) {
    if (h >= HC[i] && h <= HC[i + 1]) {
      float t = (h - HC[i]) / (HC[i + 1] - HC[i]);
      int j = i == 7 ? 0 : i + 1;
      return mix(u_hsl[i], u_hsl[j], t);
    }
  }
  return u_hsl[0];
}

void main() {
  vec2 uv = v_uv;
  vec3 c = texture(u_src, uv).rgb;
  float alpha = texture(u_src, uv).a;

  // --- Noise reduction (bilateral 5x5) ---
  if (u_denoise > 0.0) {
    float sr = mix(0.015, 0.14, u_denoise);
    vec3 acc = vec3(0.0); float ws = 0.0;
    for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++) {
      vec3 s = texture(u_src, uv + vec2(x, y) * u_texel * 1.25).rgb;
      vec3 d = s - c;
      float w = exp(-dot(d, d) / (2.0 * sr * sr)) * exp(-float(x*x + y*y) / 8.0);
      acc += s * w; ws += w;
    }
    c = mix(c, acc / ws, min(1.0, u_denoise * 1.4));
  }

  vec3 bS = texture(u_blurS, uv).rgb;
  vec3 bL = texture(u_blurL, uv).rgb;
  float L0 = luma(c);

  // --- Detail: sharpen + texture ---
  vec3 detail = c - bS;
  float edgeMask = smoothstep(0.004, 0.03, length(detail));
  c += detail * (u_sharpen * 2.2 * edgeMask + u_texture * 1.4);

  // --- Clarity (local contrast on midtones) ---
  float localL = luma(bL);
  float mid = 1.0 - pow(abs(2.0 * L0 - 1.0), 2.0);
  c += (L0 - localL) * u_clarity * 1.6 * mid;

  // --- Linear-light operations ---
  vec3 lin = toLin(clamp(c, 0.0, 1.0));

  // white balance
  vec3 wb = vec3(1.0 + u_temp * 0.42, 1.0 - u_tint * 0.3, 1.0 - u_temp * 0.48);
  wb.r *= 1.0 + u_tint * 0.08; wb.b *= 1.0 + u_tint * 0.08;
  lin *= wb / luma(wb);

  // exposure (EV) with soft shoulder
  lin *= exp2(u_exposure);
  if (u_exposure > 0.0) lin = lin / (1.0 + max(lin - 1.0, 0.0) * 0.6);

  // dehaze (dark-channel approximation)
  if (u_dehaze != 0.0) {
    vec3 blin = toLin(bL);
    float dark = min(min(blin.r, blin.g), blin.b);
    if (u_dehaze > 0.0) {
      float A = 0.92;
      float t = max(1.0 - u_dehaze * 0.95 * dark / A, 0.25);
      lin = (lin - A * (1.0 - t)) / t;
      lin = mix(lin, lin * (1.0 + u_dehaze * 0.15), 0.5);
    } else {
      lin = mix(lin, vec3(0.78), -u_dehaze * 0.45);
    }
  }

  c = toSrgb(max(lin, 0.0));

  // --- Tone: highlights / shadows / whites / blacks ---
  float L = luma(c);
  float Lb = mix(L, luma(toSrgb(toLin(bL) * exp2(u_exposure))), 0.55);
  float sh = 1.0 - smoothstep(0.0, 0.6, Lb);
  float hl = smoothstep(0.35, 1.0, Lb);
  float delta = 0.0;
  delta += u_shadows * 0.42 * sh * (u_shadows > 0.0 ? (1.0 - L) : L * 1.2);
  delta += u_highlights * 0.42 * hl * (u_highlights > 0.0 ? (1.0 - L) * 1.5 + 0.1 : L);
  float nL = clamp(L + delta, 0.0, 1.2);
  vec3 ratioC = c * (nL / max(L, 1e-3));
  c = mix(c + (nL - L), ratioC, smoothstep(0.02, 0.18, L));

  // whites / blacks as tonal end points (levels) with soft knee
  float bp = -u_blacks * 0.14;
  float wp = 1.0 - u_whites * 0.18;
  c = (c - bp) / max(wp - bp, 0.05);

  // --- Contrast ---
  if (u_contrast > 0.0) {
    vec3 s = mix(2.0 * c * c, 1.0 - 2.0 * (1.0 - c) * (1.0 - c), step(0.5, c));
    c = mix(c, s, u_contrast * 0.85);
  } else {
    c = mix(c, vec3(0.5) + (c - 0.5) * 0.55, -u_contrast);
  }
  c = clamp(c, 0.0, 1.0);

  // --- Curves ---
  if (u_useLut > 0.5) {
    c = vec3(
      texture(u_lut, vec2(c.r * 255.0 / 256.0 + 0.5 / 256.0, 0.5)).r,
      texture(u_lut, vec2(c.g * 255.0 / 256.0 + 0.5 / 256.0, 0.5)).g,
      texture(u_lut, vec2(c.b * 255.0 / 256.0 + 0.5 / 256.0, 0.5)).b
    );
  }

  // --- Colour mixer (HSL) ---
  vec3 hsl = rgb2hsl(c);
  vec3 mx = mixerAt(hsl.x);
  float satW = smoothstep(0.02, 0.25, hsl.y);
  if (u_mono < 0.5) {
    hsl.x = fract(hsl.x + mx.x * (30.0 / 360.0) * satW);
    hsl.y = clamp(hsl.y * (1.0 + mx.y * satW), 0.0, 1.0);
    hsl.z = clamp(hsl.z * (1.0 + mx.z * 0.45 * satW * hsl.y * 1.6), 0.0, 1.0);
    c = hsl2rgb(hsl);

    // vibrance (protect already-saturated colours and skin tones)
    float sat = hsl.y;
    float skin = 1.0 - smoothstep(0.0, 0.08, abs(hsl.x - 0.07)) * 0.5;
    float vib = u_vibrance * (1.0 - sat) * skin;
    float gray = luma(c);
    c = mix(vec3(gray), c, 1.0 + vib * 1.2);
    // saturation
    c = mix(vec3(luma(c)), c, 1.0 + u_saturation);
  } else {
    // B&W mixer: colour luminance contributions
    float g = luma(c) + mx.z * 0.35 * hsl.y;
    c = vec3(clamp(g, 0.0, 1.0));
  }
  c = clamp(c, 0.0, 1.0);

  // --- Colour grading ---
  float Lg = luma(c);
  float bal = u_gBalance * 0.35;
  float soft = mix(0.15, 0.5, u_gBlend);
  float ws = 1.0 - smoothstep(0.33 + bal - soft * 0.5, 0.33 + bal + soft * 0.5, Lg);
  float wh = smoothstep(0.66 + bal - soft * 0.5, 0.66 + bal + soft * 0.5, Lg);
  float wm = clamp(1.0 - ws - wh, 0.0, 1.0);
  c += u_gShadow * ws * 0.5 + u_gMid * wm * 0.4 + u_gHigh * wh * 0.5;
  c += u_gLum.x * ws * 0.2 + u_gLum.y * wm * 0.2 + u_gLum.z * wh * 0.2;

  // --- Fade ---
  c = c * (1.0 - u_fade * 0.18) + u_fade * 0.12;

  // --- Vignette ---
  if (u_vignette != 0.0) {
    float aspect = u_size.x / u_size.y;
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0) / vec2(max(aspect, 1.0), max(1.0 / aspect, 1.0));
    float d = length(p) * 1.414;
    float start = mix(0.05, 0.95, u_vigMid);
    float v = smoothstep(start, start + mix(0.05, 1.0, u_vigFeather), d);
    if (u_vignette < 0.0) c *= 1.0 + u_vignette * v;
    else c = mix(c, vec3(1.0), u_vignette * v);
  }

  // --- Grain ---
  if (u_grain > 0.0) {
    float sz = mix(0.8, 3.5, u_grainSize);
    vec2 px = uv * u_size / sz + u_seed;
    float n = vnoise(px) * 0.6 + vnoise(px * 2.1 + 7.0) * 0.4 - 0.5;
    float Ln = luma(c);
    c += n * u_grain * 0.22 * (1.0 - abs(Ln - 0.5) * 0.8);
  }

  o = vec4(clamp(c, 0.0, 1.0), alpha);
}`
