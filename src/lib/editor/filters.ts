// Per-layer filters (blur, pixelate, posterize, noise, invert) applied on a canvas region.
import { boxBlurRGBA, ctx2d, makeCanvas } from "./effects"
import type { Filters } from "./types"

export const hasFilters = (f?: Filters | null) =>
  !!f && (!!f.blur || !!f.pixelate || (!!f.posterize && f.posterize >= 2) || !!f.noise || !!f.invert)

export function applyFilters(c: HTMLCanvasElement, f: Filters, scale: number) {
  const W = c.width
  const H = c.height
  const ctx = c.getContext("2d", { willReadFrequently: true })!
  if (f.pixelate && f.pixelate * scale >= 2) {
    const px = f.pixelate * scale
    const sw = Math.max(1, Math.round(W / px))
    const sh = Math.max(1, Math.round(H / px))
    const small = makeCanvas(sw, sh)
    const sc = ctx2d(small)
    sc.imageSmoothingQuality = "medium"
    sc.drawImage(c, 0, 0, sw, sh)
    ctx.save()
    ctx.globalCompositeOperation = "copy"
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(small, 0, 0, W, H)
    ctx.restore()
  }
  const needPixels = (f.blur && f.blur * scale >= 0.5) || (f.posterize && f.posterize >= 2) || f.noise || f.invert
  if (!needPixels) return
  const img = ctx.getImageData(0, 0, W, H)
  const d = img.data
  if (f.blur && f.blur * scale >= 0.5) {
    // premultiply so transparent pixels don't bleed dark fringes
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3] / 255
      d[i] *= a
      d[i + 1] *= a
      d[i + 2] *= a
    }
    boxBlurRGBA(d, W, H, (f.blur * scale) / 1.7, 3)
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3] / 255
      if (a > 0) {
        d[i] /= a
        d[i + 1] /= a
        d[i + 2] /= a
      }
    }
  }
  if (f.posterize && f.posterize >= 2) {
    const n = f.posterize - 1
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.round((d[i] / 255) * n) * (255 / n)
      d[i + 1] = Math.round((d[i + 1] / 255) * n) * (255 / n)
      d[i + 2] = Math.round((d[i + 2] / 255) * n) * (255 / n)
    }
  }
  if (f.invert) {
    for (let i = 0; i < d.length; i += 4) {
      d[i] = 255 - d[i]
      d[i + 1] = 255 - d[i + 1]
      d[i + 2] = 255 - d[i + 2]
    }
  }
  if (f.noise) {
    let seed = 1234567
    const amt = f.noise * 1.2
    for (let i = 0; i < d.length; i += 4) {
      seed ^= seed << 13
      seed ^= seed >>> 17
      seed ^= seed << 5
      const n = (((seed >>> 0) % 1000) / 1000 - 0.5) * amt
      d[i] += n
      d[i + 1] += n
      d[i + 2] += n
    }
  }
  ctx.putImageData(img, 0, 0)
}
