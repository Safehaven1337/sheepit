import type { EffectLayer, Stroke } from "./types"

export function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas")
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  return c
}

export function ctx2d(c: HTMLCanvasElement) {
  return c.getContext("2d", { willReadFrequently: false })!
}

/** In-place separable box blur, run `passes` times (≈ gaussian). */
export function boxBlurRGBA(data: Uint8ClampedArray, w: number, h: number, r: number, passes = 3, alphaOnly = false) {
  r = Math.max(0, Math.floor(r))
  if (r < 1) return
  const tmp = new Uint8ClampedArray(data.length)
  const chans = alphaOnly ? [3] : [0, 1, 2, 3]
  for (let p = 0; p < passes; p++) {
    blurLine(data, tmp, w, h, r, true, chans)
    blurLine(tmp, data, w, h, r, false, chans)
  }
}

function blurLine(src: Uint8ClampedArray, dst: Uint8ClampedArray, w: number, h: number, r: number, horiz: boolean, chans: number[]) {
  const len = horiz ? w : h
  const lines = horiz ? h : w
  const div = r * 2 + 1
  for (let l = 0; l < lines; l++) {
    for (const ch of chans) {
      const idx = (i: number) => {
        const k = i < 0 ? 0 : i >= len ? len - 1 : i
        return (horiz ? l * w + k : k * w + l) * 4 + ch
      }
      let sum = 0
      for (let i = -r; i <= r; i++) sum += src[idx(i)]
      for (let i = 0; i < len; i++) {
        dst[idx(i)] = sum / div
        sum += src[idx(i + r + 1)] - src[idx(i - r)]
      }
    }
  }
}

export function strokeBounds(strokes: Stroke[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const s of strokes) {
    const hs = s.size / 2
    for (let i = 0; i < s.points.length; i += 2) {
      x0 = Math.min(x0, s.points[i] - hs)
      y0 = Math.min(y0, s.points[i + 1] - hs)
      x1 = Math.max(x1, s.points[i] + hs)
      y1 = Math.max(y1, s.points[i + 1] + hs)
    }
  }
  if (!isFinite(x0)) return null
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

export function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, scale: number) {
  const p = s.points
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  ctx.lineWidth = s.size * scale
  ctx.beginPath()
  if (p.length === 2) {
    ctx.arc(p[0] * scale, p[1] * scale, (s.size * scale) / 2, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  ctx.moveTo(p[0] * scale, p[1] * scale)
  for (let i = 2; i < p.length - 2; i += 2) {
    const mx = ((p[i] + p[i + 2]) / 2) * scale
    const my = ((p[i + 1] + p[i + 3]) / 2) * scale
    ctx.quadraticCurveTo(p[i] * scale, p[i + 1] * scale, mx, my)
  }
  ctx.lineTo(p[p.length - 2] * scale, p[p.length - 1] * scale)
  ctx.stroke()
}

/** Paints the effect region mask (white = affected) into a full-size canvas. */
export function buildMask(layer: EffectLayer, b: { x: number; y: number; w: number; h: number }, scale: number) {
  const W = b.w
  const H = b.h
  const m = makeCanvas(W, H)
  const c = m.getContext("2d", { willReadFrequently: layer.feather > 0 })!
  c.translate(-b.x, -b.y)
  c.fillStyle = "#fff"
  c.strokeStyle = "#fff"
  if (layer.region === "rect") {
    c.fillRect(layer.x * scale, layer.y * scale, layer.width * scale, layer.height * scale)
  } else if (layer.region === "ellipse") {
    c.beginPath()
    c.ellipse(
      (layer.x + layer.width / 2) * scale,
      (layer.y + layer.height / 2) * scale,
      Math.abs(layer.width / 2) * scale,
      Math.abs(layer.height / 2) * scale,
      0,
      0,
      Math.PI * 2,
    )
    c.fill()
  } else {
    for (const s of layer.strokes) {
      c.globalCompositeOperation = s.erase ? "destination-out" : "source-over"
      drawStroke(c, s, scale)
    }
    c.globalCompositeOperation = "source-over"
  }
  c.setTransform(1, 0, 0, 1, 0, 0)
  if (layer.invert) {
    c.globalCompositeOperation = "xor"
    c.fillRect(0, 0, W, H)
    c.globalCompositeOperation = "source-over"
  }
  const f = Math.round(layer.feather * scale)
  if (f > 0) {
    const img = c.getImageData(0, 0, W, H)
    boxBlurRGBA(img.data, W, H, f / 2, 3, true)
    c.putImageData(img, 0, 0)
  }
  return m
}

function regionBounds(layer: EffectLayer, W: number, H: number, scale: number) {
  if (layer.invert) return { x: 0, y: 0, w: W, h: H }
  let b: { x: number; y: number; w: number; h: number } | null
  if (layer.region === "brush") b = strokeBounds(layer.strokes)
  else
    b = {
      x: Math.min(layer.x, layer.x + layer.width),
      y: Math.min(layer.y, layer.y + layer.height),
      w: Math.abs(layer.width),
      h: Math.abs(layer.height),
    }
  if (!b) return null
  const pad = layer.feather
  const x = Math.max(0, Math.floor((b.x - pad) * scale))
  const y = Math.max(0, Math.floor((b.y - pad) * scale))
  const x1 = Math.min(W, Math.ceil((b.x + b.w + pad) * scale))
  const y1 = Math.min(H, Math.ceil((b.y + b.h + pad) * scale))
  if (x1 <= x || y1 <= y) return null
  return { x, y, w: x1 - x, h: y1 - y }
}

function rand(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return ((s >>> 0) % 100000) / 100000
  }
}

/** Applies a privacy/effect layer onto the composite (in place). */
export function applyEffect(target: HTMLCanvasElement, layer: EffectLayer, scale: number) {
  const W = target.width
  const H = target.height
  const b = regionBounds(layer, W, H, scale)
  if (!b) return
  const tctx = ctx2d(target)
  const amt = Math.max(1, layer.amount * scale)

  // effect canvas covering bounds
  const fx = makeCanvas(b.w, b.h)
  const f = ctx2d(fx)

  if (layer.effect === "redact") {
    f.fillStyle = layer.color
    f.fillRect(0, 0, b.w, b.h)
  } else if (layer.effect === "pixelate") {
    const px = Math.max(2, amt)
    // align grid to document origin so blocks don't swim when moving
    const ox = b.x % px
    const oy = b.y % px
    const gx = b.x - ox
    const gy = b.y - oy
    const gw = b.w + ox
    const gh = b.h + oy
    const sw = Math.max(1, Math.ceil(gw / px))
    const sh = Math.max(1, Math.ceil(gh / px))
    const small = makeCanvas(sw, sh)
    const sc = ctx2d(small)
    sc.imageSmoothingEnabled = true
    sc.imageSmoothingQuality = "medium"
    sc.drawImage(target, gx, gy, sw * px, sh * px, 0, 0, sw, sh)
    f.imageSmoothingEnabled = false
    f.drawImage(small, 0, 0, sw, sh, -ox, -oy, sw * px, sh * px)
  } else {
    // blur-family: read with padding to avoid edge darkening
    const pad = Math.ceil(amt * 2)
    const rx = Math.max(0, b.x - pad)
    const ry = Math.max(0, b.y - pad)
    const rw = Math.min(W, b.x + b.w + pad) - rx
    const rh = Math.min(H, b.y + b.h + pad) - ry
    // downscale for speed on large radii
    const ds = amt > 24 ? Math.min(4, amt / 12) : 1
    const tw = Math.max(1, Math.round(rw / ds))
    const th = Math.max(1, Math.round(rh / ds))
    const work = makeCanvas(tw, th)
    const wc = work.getContext("2d", { willReadFrequently: true })!
    wc.drawImage(target, rx, ry, rw, rh, 0, 0, tw, th)
    const img = wc.getImageData(0, 0, tw, th)
    const d = img.data
    if (layer.effect === "blur") {
      boxBlurRGBA(d, tw, th, amt / ds / 1.7, 3)
    } else if (layer.effect === "glass") {
      const r = rand(7)
      const src = new Uint8ClampedArray(d)
      const rad = Math.max(1, Math.round(amt / ds))
      for (let y = 0; y < th; y++)
        for (let x = 0; x < tw; x++) {
          const sx = Math.min(tw - 1, Math.max(0, x + Math.round((r() - 0.5) * 2 * rad)))
          const sy = Math.min(th - 1, Math.max(0, y + Math.round((r() - 0.5) * 2 * rad)))
          const i = (y * tw + x) * 4
          const j = (sy * tw + sx) * 4
          d[i] = src[j]
          d[i + 1] = src[j + 1]
          d[i + 2] = src[j + 2]
        }
      boxBlurRGBA(d, tw, th, Math.max(1, rad / 4), 2)
    } else if (layer.effect === "noise") {
      boxBlurRGBA(d, tw, th, Math.max(2, (amt / ds) * 0.25), 3)
      const r = rand(13)
      const strength = 40 + layer.amount * 1.6
      for (let i = 0; i < d.length; i += 4) {
        const n = (r() - 0.5) * strength
        d[i] += n
        d[i + 1] += n
        d[i + 2] += n
      }
    }
    wc.putImageData(img, 0, 0)
    f.imageSmoothingEnabled = true
    f.drawImage(work, 0, 0, tw, th, (rx - b.x) , (ry - b.y), rw, rh)
  }

  // mask it
  const mask = buildMask(layer, b, scale)
  f.globalCompositeOperation = "destination-in"
  f.drawImage(mask, 0, 0)
  f.globalCompositeOperation = "source-over"

  tctx.save()
  tctx.globalAlpha = layer.opacity
  tctx.drawImage(fx, b.x, b.y)
  tctx.restore()
}
