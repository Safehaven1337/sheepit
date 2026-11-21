// Sheepit document model. Everything here is plain JSON so it can be
// snapshotted for undo/redo and serialised into a .sheepit project file.

export type CurvePoint = [number, number] // 0..1 in, 0..1 out

export interface Curves {
  rgb: CurvePoint[]
  r: CurvePoint[]
  g: CurvePoint[]
  b: CurvePoint[]
}

export const HSL_CHANNELS = [
  "red",
  "orange",
  "yellow",
  "green",
  "aqua",
  "blue",
  "purple",
  "magenta",
] as const
export type HslChannel = (typeof HSL_CHANNELS)[number]

export interface HslAdjust {
  hue: number // -100..100
  sat: number // -100..100
  lum: number // -100..100
}

export interface GradeWheel {
  hue: number // 0..360
  sat: number // 0..100
  lum: number // -100..100
}

export interface Adjustments {
  // Light
  exposure: number // -5..5 (EV)
  contrast: number // -100..100
  highlights: number
  shadows: number
  whites: number
  blacks: number
  // Color
  temperature: number // -100..100
  tint: number
  vibrance: number
  saturation: number
  // Presence
  texture: number
  clarity: number
  dehaze: number
  // Detail
  sharpen: number // 0..100
  sharpenRadius: number // 0.5..3
  denoise: number // 0..100
  // Effects
  vignette: number // -100..100
  vignetteMidpoint: number // 0..100
  vignetteFeather: number // 0..100
  grain: number // 0..100
  grainSize: number // 0..100
  fade: number // 0..100
  // HSL / color mixer
  hsl: Record<HslChannel, HslAdjust>
  // Color grading
  gradeShadows: GradeWheel
  gradeMidtones: GradeWheel
  gradeHighlights: GradeWheel
  gradeBalance: number // -100..100
  gradeBlending: number // 0..100
  // Curves
  curves: Curves
  // Black & white
  monochrome: boolean
}

export interface Geometry {
  /** quarter turns clockwise 0..3 */
  rotate90: number
  /** fine straighten angle in degrees -45..45 */
  straighten: number
  flipH: boolean
  flipV: boolean
  /** crop rect in the rotated (but un-straightened-crop) image space, normalized 0..1 */
  crop: { x: number; y: number; w: number; h: number }
}

export type BlendMode =
  | "source-over"
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten"
  | "color-dodge"
  | "color-burn"
  | "hard-light"
  | "soft-light"
  | "difference"
  | "exclusion"
  | "hue"
  | "saturation"
  | "color"
  | "luminosity"

export interface Stroke {
  points: number[] // flat [x,y,x,y...] in doc px
  size: number
  /** true = erase from mask */
  erase?: boolean
  /** 0..1, 1 = hard edge */
  hardness?: number
  /** 0..1 stroke opacity */
  alpha?: number
  /** points describe a closed polygon that gets filled (selection fill / delete) */
  poly?: boolean
  /** with poly: fill everything except the polygon (inverted selection) */
  invert?: boolean
  /** raster stamp: asset id; points = [TL x,y, TR x,y, BL x,y] of the target quad */
  raster?: string
  /** selection the stroke is clipped to (polygon in doc px) */
  clip?: number[]
  clipInvert?: boolean
}

/** destructive-style filters, kept editable per layer */
export interface Filters {
  blur?: number // px
  pixelate?: number // block size px
  posterize?: number // levels (2..32), 0 = off
  noise?: number // 0..100
  invert?: boolean
}

interface LayerBase {
  id: string
  name: string
  visible: boolean
  locked: boolean
  opacity: number // 0..1
  blend: BlendMode
  /** erase operations (eraser tool, "delete selection") applied to this layer only */
  mask?: Stroke[]
  /** per-layer photo adjustments (Lightroom-style develop) */
  adjustments?: Adjustments
  /** per-layer look preset */
  look?: string | null
  lookAmount?: number
  filters?: Filters
}

export interface ImageLayer extends LayerBase {
  type: "image"
  assetId: string
  x: number
  y: number
  width: number
  height: number
  rotation: number // degrees
  flipH: boolean
}

export interface TextLayer extends LayerBase {
  type: "text"
  text: string
  x: number
  y: number
  rotation: number
  fontFamily: string
  fontSize: number
  fontWeight: number
  italic: boolean
  align: "left" | "center" | "right"
  color: string
  letterSpacing: number
  lineHeight: number
  /** background box behind text */
  background: string | null
  padding: number
  strokeColor: string | null
  strokeWidth: number
  shadow: boolean
  uppercase: boolean
}

export type ShapeKind = "rect" | "ellipse" | "line" | "arrow"

export interface ShapeLayer extends LayerBase {
  type: "shape"
  shape: ShapeKind
  x: number
  y: number
  width: number
  height: number
  rotation: number
  fill: string | null
  stroke: string | null
  strokeWidth: number
  radius: number
}

export type EffectKind = "blur" | "pixelate" | "redact" | "noise" | "glass" | "clone"
export type RegionShape = "rect" | "ellipse" | "brush"

/** A privacy / effect region that alters everything beneath it. */
export interface EffectLayer extends LayerBase {
  type: "effect"
  effect: EffectKind
  region: RegionShape
  x: number
  y: number
  width: number
  height: number
  strokes: Stroke[]
  /** blur radius / pixel size / noise amount depending on effect */
  amount: number
  /** soft edge in px */
  feather: number
  color: string // redact color
  /** invert = apply everywhere except region (e.g. background blur) */
  invert: boolean
  /** clone stamp: source offset (source − destination) in doc px */
  dx?: number
  dy?: number
}

/** colour / gradient fill layer (Photoshop "Füllebene") */
export interface FillLayer extends LayerBase {
  type: "fill"
  fill: "solid" | "linear" | "radial"
  color: string
  /** second colour; "transparent" fades out */
  color2: string
  x1: number
  y1: number
  x2: number
  y2: number
  /** optional selection the fill is limited to */
  clip?: number[]
  clipInvert?: boolean
}

export interface DrawLayer extends LayerBase {
  type: "draw"
  strokes: (Stroke & { color: string })[]
}

export type Layer = ImageLayer | TextLayer | ShapeLayer | EffectLayer | DrawLayer | FillLayer

export interface SheepDoc {
  version: 1
  name: string
  /** id of the base image asset */
  baseAssetId: string | null
  /** natural size of base image */
  sourceWidth: number
  sourceHeight: number
  geometry: Geometry
  adjustments: Adjustments
  /** id of the applied look preset (purely informational) */
  look: string | null
  lookAmount: number // 0..1
  layers: Layer[]
  background: string // used when there is no base image; "transparent" = none
  /** background (photo) layer visibility */
  baseHidden?: boolean
  /** erase operations on the background photo */
  baseMask?: Stroke[]
  /** filters on the background photo */
  filters?: Filters
}

export interface Asset {
  id: string
  blob: Blob
  bitmap: ImageBitmap
  width: number
  height: number
  mime: string
}

export type ToolId =
  | "move"
  | "select"
  | "crop"
  | "eyedropper"
  | "brush"
  | "eraser"
  | "gradient"
  | "bucket"
  | "clone"
  | "heal"
  | "text"
  | "shapes"
  | "privacy"
  | "hand"
  | "zoom"

/** id used for the background photo in layer selection */
export const BASE_ID = "__base__"

export type SelectionShape =
  | { kind: "rect" | "ellipse"; x: number; y: number; w: number; h: number; inverted?: boolean }
  | { kind: "lasso"; points: number[]; inverted?: boolean }
