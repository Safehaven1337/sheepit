import {
  HSL_CHANNELS,
  type Adjustments,
  type Curves,
  type EffectLayer,
  type Geometry,
  type HslAdjust,
  type HslChannel,
  type SheepDoc,
  type ShapeLayer,
  type TextLayer,
  type DrawLayer,
} from "./types"

export const uid = () =>
  Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4)

export const identityCurve = (): [number, number][] => [
  [0, 0],
  [1, 1],
]

export const defaultCurves = (): Curves => ({
  rgb: identityCurve(),
  r: identityCurve(),
  g: identityCurve(),
  b: identityCurve(),
})

export const defaultHsl = (): Record<HslChannel, HslAdjust> =>
  Object.fromEntries(HSL_CHANNELS.map((c) => [c, { hue: 0, sat: 0, lum: 0 }])) as Record<
    HslChannel,
    HslAdjust
  >

export const defaultAdjustments = (): Adjustments => ({
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  temperature: 0,
  tint: 0,
  vibrance: 0,
  saturation: 0,
  texture: 0,
  clarity: 0,
  dehaze: 0,
  sharpen: 0,
  sharpenRadius: 1,
  denoise: 0,
  vignette: 0,
  vignetteMidpoint: 50,
  vignetteFeather: 50,
  grain: 0,
  grainSize: 25,
  fade: 0,
  hsl: defaultHsl(),
  gradeShadows: { hue: 220, sat: 0, lum: 0 },
  gradeMidtones: { hue: 40, sat: 0, lum: 0 },
  gradeHighlights: { hue: 45, sat: 0, lum: 0 },
  gradeBalance: 0,
  gradeBlending: 50,
  curves: defaultCurves(),
  monochrome: false,
})

export const defaultGeometry = (): Geometry => ({
  rotate90: 0,
  straighten: 0,
  flipH: false,
  flipV: false,
  crop: { x: 0, y: 0, w: 1, h: 1 },
})

export const emptyDoc = (): SheepDoc => ({
  version: 1,
  name: "Unbenannt",
  baseAssetId: null,
  sourceWidth: 1080,
  sourceHeight: 1080,
  geometry: defaultGeometry(),
  adjustments: defaultAdjustments(),
  look: null,
  lookAmount: 1,
  layers: [],
  background: "#ffffff",
})

export function isAdjustmentsDefault(a: Adjustments) {
  return JSON.stringify(a) === JSON.stringify(defaultAdjustments())
}

export const newText = (x: number, y: number, size: number): TextLayer => ({
  id: uid(),
  type: "text",
  name: "Text",
  visible: true,
  locked: false,
  opacity: 1,
  blend: "source-over",
  text: "Dein Text",
  x,
  y,
  rotation: 0,
  fontFamily: "Inter",
  fontSize: size,
  fontWeight: 700,
  italic: false,
  align: "center",
  color: "#ffffff",
  letterSpacing: 0,
  lineHeight: 1.15,
  background: null,
  padding: 0.3,
  strokeColor: null,
  strokeWidth: 0,
  shadow: true,
  uppercase: false,
})

export const newShape = (
  shape: ShapeLayer["shape"],
  x: number,
  y: number,
  w: number,
  h: number,
): ShapeLayer => ({
  id: uid(),
  type: "shape",
  name: { rect: "Rechteck", ellipse: "Ellipse", line: "Linie", arrow: "Pfeil" }[shape],
  visible: true,
  locked: false,
  opacity: 1,
  blend: "source-over",
  shape,
  x,
  y,
  width: w,
  height: h,
  rotation: 0,
  fill: shape === "line" || shape === "arrow" ? null : "#c6f432",
  stroke: shape === "line" || shape === "arrow" ? "#c6f432" : null,
  strokeWidth: Math.max(4, Math.round(Math.min(w, h) * 0.04)),
  radius: 0,
})

export const EFFECT_LABEL: Record<EffectLayer["effect"], string> = {
  blur: "Weichzeichner",
  pixelate: "Verpixeln",
  redact: "Schwärzen",
  noise: "Rauschen",
  glass: "Milchglas",
}

export const newEffect = (
  effect: EffectLayer["effect"],
  region: EffectLayer["region"],
  x: number,
  y: number,
  w: number,
  h: number,
  docMin: number,
): EffectLayer => ({
  id: uid(),
  type: "effect",
  name: EFFECT_LABEL[effect],
  visible: true,
  locked: false,
  opacity: 1,
  blend: "source-over",
  effect,
  region,
  x,
  y,
  width: w,
  height: h,
  strokes: [],
  amount:
    effect === "pixelate"
      ? Math.max(8, Math.round(docMin / 40))
      : effect === "blur"
        ? Math.max(8, Math.round(docMin / 50))
        : effect === "glass"
          ? Math.max(6, Math.round(docMin / 80))
          : 60,
  feather: 0,
  color: "#0a0a0a",
  invert: false,
})

export const newDraw = (): DrawLayer => ({
  id: uid(),
  type: "draw",
  name: "Zeichnung",
  visible: true,
  locked: false,
  opacity: 1,
  blend: "source-over",
  strokes: [],
})
