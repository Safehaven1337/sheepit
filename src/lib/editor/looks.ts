import { defaultAdjustments } from "./defaults"
import { isIdentityCurve } from "./curves"
import { HSL_CHANNELS, type Adjustments, type CurvePoint, type HslChannel, type HslAdjust } from "./types"

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }
export type LookDef = {
  id: string
  name: string
  group: "Klassisch" | "Film" | "Mood" | "Schwarz-Weiß" | "Porträt" | "Landschaft"
  adj: DeepPartial<Adjustments>
}

export const LOOKS: LookDef[] = [
  { id: "vivid", name: "Vivid", group: "Klassisch", adj: { vibrance: 35, saturation: 10, contrast: 18, clarity: 12 } },
  { id: "punch", name: "Punch", group: "Klassisch", adj: { contrast: 35, blacks: -15, whites: 12, vibrance: 20, clarity: 20 } },
  { id: "soft", name: "Soft", group: "Klassisch", adj: { contrast: -20, highlights: -25, shadows: 25, clarity: -18, fade: 15 } },
  { id: "bright", name: "Hell & Luftig", group: "Klassisch", adj: { exposure: 0.45, shadows: 35, highlights: -20, contrast: -10, vibrance: 10, temperature: 5 } },
  { id: "kodak", name: "Portra", group: "Film", adj: {
    temperature: 10, tint: 4, contrast: -8, fade: 22, vibrance: -8, grain: 18,
    curves: { rgb: [[0, 0.06], [0.25, 0.26], [0.75, 0.78], [1, 0.96]] },
    gradeShadows: { hue: 200, sat: 14 }, gradeHighlights: { hue: 40, sat: 18 },
    hsl: { orange: { sat: 10, lum: 8 }, green: { hue: -20, sat: -25 }, blue: { sat: -15 } },
  } },
  { id: "fuji", name: "Velvia", group: "Film", adj: {
    contrast: 25, saturation: 18, vibrance: 15, blacks: -10,
    hsl: { green: { hue: 10, sat: 20 }, blue: { sat: 25, lum: -10 }, red: { sat: 10 } },
    gradeShadows: { hue: 160, sat: 10 },
  } },
  { id: "cine", name: "Cinematic", group: "Film", adj: {
    contrast: 15, fade: 10, highlights: -30, shadows: 10,
    gradeShadows: { hue: 190, sat: 35 }, gradeHighlights: { hue: 35, sat: 30 }, gradeBalance: -10,
    hsl: { orange: { sat: 12 }, aqua: { hue: 15, sat: 15 }, green: { sat: -30 } }, vignette: -18,
  } },
  { id: "expired", name: "Expired", group: "Film", adj: {
    temperature: 18, tint: 12, fade: 35, contrast: -10, grain: 40, grainSize: 50, saturation: -12,
    curves: { b: [[0, 0.12], [1, 0.9]], r: [[0, 0.03], [1, 1]] }, vignette: -25,
  } },
  { id: "moody", name: "Moody", group: "Mood", adj: {
    exposure: -0.3, contrast: 20, highlights: -35, shadows: -10, saturation: -25, clarity: 15,
    gradeShadows: { hue: 215, sat: 25 }, vignette: -30, fade: 8,
  } },
  { id: "golden", name: "Golden Hour", group: "Mood", adj: {
    temperature: 30, tint: 6, vibrance: 20, highlights: -15, shadows: 15,
    gradeHighlights: { hue: 38, sat: 35 }, gradeMidtones: { hue: 30, sat: 12 },
  } },
  { id: "teal", name: "Teal & Orange", group: "Mood", adj: {
    contrast: 18,
    hsl: { orange: { sat: 25, lum: 5 }, yellow: { hue: -25 }, green: { hue: 40, sat: -20 }, aqua: { hue: 10, sat: 30 }, blue: { hue: -15, sat: 20 } },
    gradeShadows: { hue: 190, sat: 30 }, gradeHighlights: { hue: 30, sat: 25 },
  } },
  { id: "nordic", name: "Nordic", group: "Mood", adj: {
    temperature: -22, saturation: -30, contrast: 8, highlights: -20, fade: 12, clarity: 10,
    gradeShadows: { hue: 210, sat: 18 },
  } },
  { id: "neon", name: "Neon Nights", group: "Mood", adj: {
    tint: 20, temperature: -15, contrast: 25, vibrance: 40,
    hsl: { purple: { sat: 40 }, magenta: { sat: 40, lum: 10 }, blue: { sat: 30, hue: 10 } },
    gradeShadows: { hue: 260, sat: 30 }, gradeHighlights: { hue: 320, sat: 25 },
  } },
  { id: "skin", name: "Clean Skin", group: "Porträt", adj: {
    texture: -25, clarity: -10, highlights: -10, shadows: 15, vibrance: 8,
    hsl: { orange: { sat: -8, lum: 15 }, red: { sat: -8, lum: 6 } },
  } },
  { id: "warmport", name: "Warmes Porträt", group: "Porträt", adj: {
    temperature: 14, exposure: 0.15, contrast: 5, shadows: 18, texture: -12,
    hsl: { orange: { lum: 10 } }, gradeHighlights: { hue: 35, sat: 12 }, vignette: -12,
  } },
  { id: "land", name: "Landschaft Pop", group: "Landschaft", adj: {
    dehaze: 20, clarity: 20, vibrance: 30, highlights: -40, shadows: 30,
    hsl: { blue: { sat: 20, lum: -18 }, green: { sat: 15 }, aqua: { sat: 10, lum: -8 } },
  } },
  { id: "dramasky", name: "Dramatischer Himmel", group: "Landschaft", adj: {
    dehaze: 30, highlights: -60, contrast: 20, clarity: 25,
    hsl: { blue: { lum: -35, sat: 15 }, aqua: { lum: -20 } }, vignette: -15,
  } },
  { id: "bw", name: "Klassisch S/W", group: "Schwarz-Weiß", adj: { monochrome: true, contrast: 20, clarity: 10 } },
  { id: "bwhigh", name: "Hochkontrast S/W", group: "Schwarz-Weiß", adj: {
    monochrome: true, contrast: 55, blacks: -30, whites: 25, clarity: 30, grain: 15,
    hsl: { blue: { lum: -40 }, red: { lum: 20 }, orange: { lum: 25 } },
  } },
  { id: "bwsoft", name: "Silber", group: "Schwarz-Weiß", adj: {
    monochrome: true, contrast: -10, fade: 25, highlights: -20, shadows: 20, grain: 25,
  } },
  { id: "sepia", name: "Sepia", group: "Schwarz-Weiß", adj: {
    monochrome: true, fade: 15, gradeShadows: { hue: 30, sat: 40 }, gradeHighlights: { hue: 42, sat: 30 }, gradeMidtones: { hue: 35, sat: 25 },
  } },
]

const clampN = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

const NUM_RANGE: Partial<Record<keyof Adjustments, [number, number]>> = {
  exposure: [-5, 5],
  sharpen: [0, 150],
  denoise: [0, 100],
  grain: [0, 100],
  grainSize: [0, 100],
  fade: [0, 100],
  vignetteMidpoint: [0, 100],
  vignetteFeather: [0, 100],
  gradeBlending: [0, 100],
  sharpenRadius: [0.5, 3],
}

function lerpCurve(points: CurvePoint[], t: number): CurvePoint[] {
  return points.map(([x, y]) => [x, x + (y - x) * t])
}

/** user adjustments + look * amount → effective adjustments */
export function effectiveAdjustments(user: Adjustments, lookId: string | null, amount: number): Adjustments {
  const look = LOOKS.find((l) => l.id === lookId)
  if (!look || amount <= 0) return user
  const L = look.adj
  const out: Adjustments = structuredClone(user)
  const d = defaultAdjustments()
  for (const key of Object.keys(L) as (keyof Adjustments)[]) {
    const v = L[key]
    if (typeof v === "number") {
      const base = out[key] as number
      const delta = (v - (d[key] as number)) * amount
      const [lo, hi] = NUM_RANGE[key] ?? [-100, 100]
      ;(out as unknown as Record<string, number>)[key] = clampN(base + delta, lo, hi)
    }
  }
  if (L.monochrome) out.monochrome = amount >= 0.5 ? true : user.monochrome
  if (L.hsl) {
    for (const c of HSL_CHANNELS) {
      const lc = L.hsl[c as HslChannel] as Partial<HslAdjust> | undefined
      if (!lc) continue
      out.hsl[c] = {
        hue: clampN(out.hsl[c].hue + (lc.hue ?? 0) * amount, -100, 100),
        sat: clampN(out.hsl[c].sat + (lc.sat ?? 0) * amount, -100, 100),
        lum: clampN(out.hsl[c].lum + (lc.lum ?? 0) * amount, -100, 100),
      }
    }
  }
  for (const w of ["gradeShadows", "gradeMidtones", "gradeHighlights"] as const) {
    const lw = L[w]
    if (lw && (lw.sat ?? 0) > 0 && out[w].sat === 0) {
      out[w] = { hue: lw.hue ?? out[w].hue, sat: (lw.sat ?? 0) * amount, lum: out[w].lum + (lw.lum ?? 0) * amount }
    }
  }
  if (L.curves) {
    for (const ch of ["rgb", "r", "g", "b"] as const) {
      const pts = L.curves[ch] as CurvePoint[] | undefined
      if (pts && isIdentityCurve(out.curves[ch])) out.curves[ch] = lerpCurve(pts, amount)
    }
  }
  return out
}
