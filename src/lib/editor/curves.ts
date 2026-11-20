import type { CurvePoint, Curves } from "./types"

/** Monotone cubic (Fritsch–Carlson) interpolation sampled into `n` values. */
export function sampleCurve(points: CurvePoint[], n = 256): Float32Array {
  const pts = [...points].sort((a, b) => a[0] - b[0])
  const out = new Float32Array(n)
  if (pts.length < 2) {
    for (let i = 0; i < n; i++) out[i] = i / (n - 1)
    return out
  }
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const m = pts.length
  const d: number[] = []
  const ms: number[] = new Array(m).fill(0)
  for (let i = 0; i < m - 1; i++) {
    const dx = xs[i + 1] - xs[i] || 1e-6
    d.push((ys[i + 1] - ys[i]) / dx)
  }
  ms[0] = d[0]
  ms[m - 1] = d[m - 2]
  for (let i = 1; i < m - 1; i++) {
    if (d[i - 1] * d[i] <= 0) ms[i] = 0
    else ms[i] = (d[i - 1] + d[i]) / 2
  }
  for (let i = 0; i < m - 1; i++) {
    if (d[i] === 0) {
      ms[i] = 0
      ms[i + 1] = 0
      continue
    }
    const a = ms[i] / d[i]
    const b = ms[i + 1] / d[i]
    const s = a * a + b * b
    if (s > 9) {
      const t = 3 / Math.sqrt(s)
      ms[i] = t * a * d[i]
      ms[i + 1] = t * b * d[i]
    }
  }
  for (let k = 0; k < n; k++) {
    const x = k / (n - 1)
    let y: number
    if (x <= xs[0]) y = ys[0]
    else if (x >= xs[m - 1]) y = ys[m - 1]
    else {
      let i = 0
      while (i < m - 2 && x > xs[i + 1]) i++
      const h = xs[i + 1] - xs[i] || 1e-6
      const t = (x - xs[i]) / h
      const t2 = t * t
      const t3 = t2 * t
      y =
        (2 * t3 - 3 * t2 + 1) * ys[i] +
        (t3 - 2 * t2 + t) * h * ms[i] +
        (-2 * t3 + 3 * t2) * ys[i + 1] +
        (t3 - t2) * h * ms[i + 1]
    }
    out[k] = Math.min(1, Math.max(0, y))
  }
  return out
}

/** Builds a 256x1 RGBA LUT: channel = channelCurve(masterCurve(x)). */
export function buildCurveLut(c: Curves): Uint8Array {
  const master = sampleCurve(c.rgb)
  const r = sampleCurve(c.r)
  const g = sampleCurve(c.g)
  const b = sampleCurve(c.b)
  const lut = new Uint8Array(256 * 4)
  for (let i = 0; i < 256; i++) {
    const v = Math.round(master[i] * 255)
    lut[i * 4] = Math.round(r[v] * 255)
    lut[i * 4 + 1] = Math.round(g[v] * 255)
    lut[i * 4 + 2] = Math.round(b[v] * 255)
    lut[i * 4 + 3] = 255
  }
  return lut
}

export const isIdentityCurve = (p: CurvePoint[]) =>
  p.length === 2 && p[0][0] === 0 && p[0][1] === 0 && p[1][0] === 1 && p[1][1] === 1
