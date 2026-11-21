// Spot healing / content-aware fill (lightweight): the painted area is filled
// from its surroundings with a multi-resolution harmonic interpolation, then
// matching grain is added so the patch doesn't look smeared.

type Level = { w: number; h: number; rgb: Float32Array; known: Uint8Array }

function downsample(l: Level): Level {
  const w = Math.max(1, Math.ceil(l.w / 2))
  const h = Math.max(1, Math.ceil(l.h / 2))
  const rgb = new Float32Array(w * h * 3)
  const known = new Uint8Array(w * h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, n = 0
      for (let dy = 0; dy < 2; dy++)
        for (let dx = 0; dx < 2; dx++) {
          const sx = Math.min(l.w - 1, x * 2 + dx)
          const sy = Math.min(l.h - 1, y * 2 + dy)
          const i = sy * l.w + sx
          if (!l.known[i]) continue
          r += l.rgb[i * 3]
          g += l.rgb[i * 3 + 1]
          b += l.rgb[i * 3 + 2]
          n++
        }
      const o = y * w + x
      if (n) {
        rgb[o * 3] = r / n
        rgb[o * 3 + 1] = g / n
        rgb[o * 3 + 2] = b / n
        known[o] = 1
      }
    }
  return { w, h, rgb, known }
}

function relax(l: Level, iterations: number) {
  const { w, h, rgb, known } = l
  for (let it = 0; it < iterations; it++) {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x
        if (known[i]) continue
        let r = 0, g = 0, b = 0, n = 0
        const add = (j: number) => {
          r += rgb[j * 3]
          g += rgb[j * 3 + 1]
          b += rgb[j * 3 + 2]
          n++
        }
        if (x > 0) add(i - 1)
        if (x < w - 1) add(i + 1)
        if (y > 0) add(i - w)
        if (y < h - 1) add(i + w)
        rgb[i * 3] = r / n
        rgb[i * 3 + 1] = g / n
        rgb[i * 3 + 2] = b / n
      }
  }
}

/**
 * @param data RGBA pixels of the region (will not be modified)
 * @param fill 1 where pixels must be reconstructed
 * @returns RGBA patch: reconstructed pixels, alpha = (feathered) fill mask
 */
export function healRegion(data: Uint8ClampedArray, fill: Uint8Array, w: number, h: number): ImageData {
  const base: Level = { w, h, rgb: new Float32Array(w * h * 3), known: new Uint8Array(w * h) }
  let sum = [0, 0, 0]
  let cnt = 0
  for (let i = 0; i < w * h; i++) {
    base.rgb[i * 3] = data[i * 4]
    base.rgb[i * 3 + 1] = data[i * 4 + 1]
    base.rgb[i * 3 + 2] = data[i * 4 + 2]
    base.known[i] = fill[i] ? 0 : 1
    if (!fill[i]) {
      sum = [sum[0] + data[i * 4], sum[1] + data[i * 4 + 1], sum[2] + data[i * 4 + 2]]
      cnt++
    }
  }
  const mean = cnt ? sum.map((v) => v / cnt) : [128, 128, 128]

  // pyramid down to a few pixels
  const levels: Level[] = [base]
  while (levels[levels.length - 1].w > 8 && levels[levels.length - 1].h > 8) levels.push(downsample(levels[levels.length - 1]))
  const top = levels[levels.length - 1]
  for (let i = 0; i < top.w * top.h; i++)
    if (!top.known[i]) {
      top.rgb[i * 3] = mean[0]
      top.rgb[i * 3 + 1] = mean[1]
      top.rgb[i * 3 + 2] = mean[2]
    }
  relax(top, 120)
  // coarse-to-fine: initialise unknown pixels from the level above, then relax
  for (let li = levels.length - 2; li >= 0; li--) {
    const l = levels[li]
    const up = levels[li + 1]
    for (let y = 0; y < l.h; y++)
      for (let x = 0; x < l.w; x++) {
        const i = y * l.w + x
        if (l.known[i]) continue
        const j = Math.min(up.h - 1, y >> 1) * up.w + Math.min(up.w - 1, x >> 1)
        l.rgb[i * 3] = up.rgb[j * 3]
        l.rgb[i * 3 + 1] = up.rgb[j * 3 + 1]
        l.rgb[i * 3 + 2] = up.rgb[j * 3 + 2]
      }
    relax(l, li === 0 ? 40 : 60)
  }

  // estimate grain of the surroundings (median absolute deviation from neighbours)
  const diffs: number[] = []
  for (let y = 1; y < h - 1; y += 2)
    for (let x = 1; x < w - 1; x += 2) {
      const i = y * w + x
      if (!base.known[i] || !base.known[i + 1]) continue
      diffs.push(Math.abs(data[i * 4] - data[(i + 1) * 4]))
    }
  diffs.sort((a, b) => a - b)
  const grain = (diffs[Math.floor(diffs.length / 2)] ?? 2) * 0.9

  const out = new ImageData(w, h)
  let seed = 987654321
  const rnd = () => {
    seed ^= seed << 13
    seed ^= seed >>> 17
    seed ^= seed << 5
    return ((seed >>> 0) % 10000) / 10000 - 0.5
  }
  // feathered alpha: dilate the fill mask by 1px and soften
  const alpha = new Float32Array(w * h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (fill[i]) alpha[i] = 1
      else {
        let near = 0
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            const xx = x + dx, yy = y + dy
            if (xx >= 0 && yy >= 0 && xx < w && yy < h && fill[yy * w + xx]) near = Math.max(near, 1 - Math.hypot(dx, dy) / 3)
          }
        alpha[i] = near
      }
    }
  for (let i = 0; i < w * h; i++) {
    if (alpha[i] <= 0) continue
    const n = rnd() * grain * 2
    out.data[i * 4] = base.rgb[i * 3] + n
    out.data[i * 4 + 1] = base.rgb[i * 3 + 1] + n
    out.data[i * 4 + 2] = base.rgb[i * 3 + 2] + n
    out.data[i * 4 + 3] = Math.round(alpha[i] * 255)
  }
  return out
}

/** Flood fill on RGBA data from (sx,sy); returns 1 for every filled pixel. */
export function floodFill(data: Uint8ClampedArray, w: number, h: number, sx: number, sy: number, tolerance: number, limit?: Uint8Array) {
  const out = new Uint8Array(w * h)
  const i0 = (sy * w + sx) * 4
  const r0 = data[i0], g0 = data[i0 + 1], b0 = data[i0 + 2], a0 = data[i0 + 3]
  const tol = (tolerance / 100) * 255 * 2
  const match = (i: number) => {
    const p = i * 4
    return (
      Math.abs(data[p] - r0) + Math.abs(data[p + 1] - g0) + Math.abs(data[p + 2] - b0) + Math.abs(data[p + 3] - a0) <= tol
    )
  }
  const stack = [sy * w + sx]
  while (stack.length) {
    const i = stack.pop()!
    if (out[i] || (limit && !limit[i]) || !match(i)) continue
    // scanline fill
    let x = i % w
    const y = (i - x) / w
    let l = x
    while (l > 0 && !out[y * w + l - 1] && (!limit || limit[y * w + l - 1]) && match(y * w + l - 1)) l--
    let r = x
    while (r < w - 1 && !out[y * w + r + 1] && (!limit || limit[y * w + r + 1]) && match(y * w + r + 1)) r++
    for (x = l; x <= r; x++) {
      const j = y * w + x
      out[j] = 1
      if (y > 0 && !out[j - w]) stack.push(j - w)
      if (y < h - 1 && !out[j + w]) stack.push(j + w)
    }
  }
  return out
}
