import { applyEffect, applyMask, ctx2d, drawStroke, makeCanvas } from "./effects"
import { fontFamilyFor } from "./fonts"
import { DevelopRenderer } from "./gl/develop"
import { effectiveAdjustments } from "./looks"
import { defaultAdjustments, isAdjustmentsDefault } from "./defaults"
import type { Asset, FillLayer, Geometry, ImageLayer, Layer, SheepDoc, ShapeLayer, Stroke, TextLayer } from "./types"
import { applyFilters, hasFilters } from "./filters"

const DEG = Math.PI / 180

/** size of the image after 90° rotations */
export function rotatedSize(doc: Pick<SheepDoc, "sourceWidth" | "sourceHeight" | "geometry">) {
  const odd = doc.geometry.rotate90 % 2 === 1
  return odd
    ? { w: doc.sourceHeight, h: doc.sourceWidth }
    : { w: doc.sourceWidth, h: doc.sourceHeight }
}

/** final document (canvas) size in px */
export function docSize(doc: SheepDoc) {
  if (!doc.baseAssetId) return { w: doc.sourceWidth, h: doc.sourceHeight }
  const r = rotatedSize(doc)
  return {
    w: Math.max(1, Math.round(doc.geometry.crop.w * r.w)),
    h: Math.max(1, Math.round(doc.geometry.crop.h * r.h)),
  }
}

/** zoom factor needed so a straightened image still covers its frame */
export function coverScale(w: number, h: number, deg: number) {
  const t = Math.abs(deg * DEG)
  const c = Math.cos(t)
  const s = Math.sin(t)
  return Math.max((w * c + h * s) / w, (w * s + h * c) / h)
}

/** Draws the geometry-transformed source into ctx (current transform = doc px). */
export function drawGeometry(
  ctx: CanvasRenderingContext2D,
  bmp: CanvasImageSource,
  srcW: number,
  srcH: number,
  g: Geometry,
  cropPx: { x: number; y: number },
) {
  const odd = g.rotate90 % 2 === 1
  const RW = odd ? srcH : srcW
  const RH = odd ? srcW : srcH
  const k = coverScale(RW, RH, g.straighten)
  ctx.translate(-cropPx.x, -cropPx.y)
  ctx.translate(RW / 2, RH / 2)
  ctx.rotate(g.straighten * DEG)
  ctx.scale(k, k)
  ctx.rotate(g.rotate90 * 90 * DEG)
  ctx.scale(g.flipH ? -1 : 1, g.flipV ? -1 : 1)
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(bmp, -srcW / 2, -srcH / 2, srcW, srcH)
}

export interface RenderOptions {
  scale: number
  /** skip the develop step (for 'before' compare) */
  original?: boolean
  /** do not draw these layer ids (e.g. while editing text inline) */
  hide?: Set<string>
  /** fill background (jpg export) */
  background?: string | null
  /** reuse the developed base image when only layers changed (interactive preview) */
  cacheBase?: boolean
  /** do not draw the background photo / colour */
  skipBase?: boolean
  /** bumps when fonts/assets finished loading (invalidates caches) */
  epoch?: number
}

let baseKey = ""
let baseCache: HTMLCanvasElement | null = null

let developer: DevelopRenderer | null | undefined
function getDeveloper() {
  if (developer === undefined) developer = DevelopRenderer.create()
  return developer
}

// a second GPU pipeline for per-layer adjustments, so the background cache stays valid
let layerDeveloper: DevelopRenderer | null | undefined
function getLayerDeveloper() {
  if (layerDeveloper === undefined) layerDeveloper = DevelopRenderer.create()
  return layerDeveloper
}

/** effective develop settings of a layer, or null when it has none */
export function layerDevelop(l: Layer) {
  if (l.type === "effect" || (!l.adjustments && !l.look)) return null
  const eff = effectiveAdjustments(l.adjustments ?? defaultAdjustments(), l.look ?? null, l.lookAmount ?? 1)
  return isAdjustmentsDefault(eff) ? null : eff
}

// geometry cache — re-uploading the source to the GPU only when geometry/scale changes
let geoKey = ""
let geoCanvas: HTMLCanvasElement | null = null

function geometryCanvas(doc: SheepDoc, asset: Asset, W: number, H: number, scale: number) {
  const key = `${asset.id}|${JSON.stringify(doc.geometry)}|${W}x${H}|${scale}`
  if (key === geoKey && geoCanvas) return { canvas: geoCanvas, changed: false }
  const c = geoCanvas && geoCanvas.width === W && geoCanvas.height === H ? geoCanvas : makeCanvas(W, H)
  const x = ctx2d(c)
  x.setTransform(1, 0, 0, 1, 0, 0)
  x.clearRect(0, 0, W, H)
  x.scale(scale, scale)
  const r = rotatedSize(doc)
  drawGeometry(x, asset.bitmap, doc.sourceWidth, doc.sourceHeight, doc.geometry, {
    x: doc.geometry.crop.x * r.w,
    y: doc.geometry.crop.y * r.h,
  })
  x.setTransform(1, 0, 0, 1, 0, 0)
  geoKey = key
  geoCanvas = c
  return { canvas: c, changed: true }
}

let lastDevelopSrc: HTMLCanvasElement | null = null

/** Composites the whole document into `out` (resized as needed). */
export function renderDoc(
  doc: SheepDoc,
  assets: Map<string, Asset>,
  opts: RenderOptions,
  out?: HTMLCanvasElement,
): HTMLCanvasElement {
  const { w: DW, h: DH } = docSize(doc)
  const scale = opts.scale
  const W = Math.max(1, Math.round(DW * scale))
  const H = Math.max(1, Math.round(DH * scale))
  const canvas = out ?? makeCanvas(W, H)
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W
    canvas.height = H
  }
  const ctx = ctx2d(canvas)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = "source-over"
  ctx.clearRect(0, 0, W, H)
  const bg = opts.skipBase
    ? null
    : opts.background !== undefined
      ? opts.background
      : doc.baseAssetId || doc.background === "transparent"
        ? null
        : doc.background
  if (bg && bg !== "transparent") {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)
  }

  const base = doc.baseAssetId && !opts.skipBase && !doc.baseHidden ? assets.get(doc.baseAssetId) : undefined
  // with an erase mask the background is composited through its own buffer
  const baseTarget = base && doc.baseMask?.length ? makeCanvas(W, H) : canvas
  const bctx = baseTarget === canvas ? ctx : ctx2d(baseTarget)
  if (base) {
    const key = `${base.id}|${W}x${H}|${scale}|${opts.original ? 1 : 0}|${JSON.stringify(doc.geometry)}|${JSON.stringify(doc.adjustments)}|${doc.look}|${doc.lookAmount}|${JSON.stringify(doc.filters ?? null)}`
    if (opts.cacheBase && key === baseKey && baseCache) {
      bctx.drawImage(baseCache, 0, 0)
    } else {
      const { canvas: geo, changed } = geometryCanvas(doc, base, W, H, scale)
      const adj = effectiveAdjustments(doc.adjustments, doc.look, doc.lookAmount)
      const dev = !opts.original && !isAdjustmentsDefault(adj) ? getDeveloper() : null
      let src: CanvasImageSource = geo
      if (dev && W <= dev.maxSize && H <= dev.maxSize) {
        if (changed || lastDevelopSrc !== geo) dev.setSource(geo, W, H)
        lastDevelopSrc = geo
        src = dev.render(adj, scale)
      }
      if (!opts.original && hasFilters(doc.filters)) {
        const fc = makeCanvas(W, H)
        ctx2d(fc).drawImage(src, 0, 0)
        applyFilters(fc, doc.filters!, scale)
        src = fc
      }
      bctx.drawImage(src, 0, 0)
      if (opts.cacheBase) {
        if (!baseCache || baseCache.width !== W || baseCache.height !== H) baseCache = makeCanvas(W, H)
        const bc = ctx2d(baseCache)
        bc.clearRect(0, 0, W, H)
        bc.drawImage(src, 0, 0)
        baseKey = key
      }
    }
  }
  if (base && baseTarget !== canvas) {
    applyMask(bctx, doc.baseMask, scale, assets)
    ctx.drawImage(baseTarget, 0, 0)
  }

  const interactive = !!opts.cacheBase && !opts.hide?.size
  const rc: RenderCtx = { interactive, epoch: opts.epoch ?? 0, assets }
  const layers = doc.layers
  let start = 0
  if (interactive) {
    // layers below the one being edited are composited once and reused
    const stateKey = `${W}x${H}|${scale}|${opts.original ? 1 : 0}|${rc.epoch}|${objId(doc.baseMask)}|${doc.baseHidden ? 1 : 0}|${bg}|${base ? baseKey : "-"}|${objId(assets)}`
    if (snap.key === stateKey && snap.canvas && isPrefix(snap.refs, layers)) {
      ctx.clearRect(0, 0, W, H)
      ctx.drawImage(snap.canvas, 0, 0)
      start = snap.refs.length
    }
    const changedAt = firstDiff(lastLayers, layers)
    lastLayers = layers
    for (let i = start; i < layers.length; i++) {
      if (i === changedAt && i > 0 && !(snap.key === stateKey && snap.refs.length === i && isPrefix(snap.refs, layers))) {
        if (!snap.canvas || snap.canvas.width !== W || snap.canvas.height !== H) snap.canvas = makeCanvas(W, H)
        const sc = ctx2d(snap.canvas)
        sc.globalCompositeOperation = "copy"
        sc.drawImage(canvas, 0, 0)
        sc.globalCompositeOperation = "source-over"
        snap.refs = layers.slice(0, i)
        snap.key = stateKey
      }
      const layer = layers[i]
      if (!layer.visible) continue
      drawLayer(ctx, canvas, layer, assets, scale, !!opts.original, rc)
    }
    return canvas
  }
  for (const layer of layers) {
    if (!layer.visible || opts.hide?.has(layer.id)) continue
    drawLayer(ctx, canvas, layer, assets, scale, !!opts.original, rc)
  }
  return canvas
}

/* ---------------------------------------------------------------- caches */

interface RenderCtx {
  interactive: boolean
  epoch: number
  assets: Map<string, Asset>
}

const ids = new WeakMap<object, number>()
let nextId = 1
function objId(o: object | undefined | null) {
  if (!o) return 0
  let v = ids.get(o)
  if (!v) ids.set(o, (v = nextId++))
  return v
}
const isPrefix = (prefix: Layer[], all: Layer[]) => prefix.length <= all.length && prefix.every((l, i) => all[i] === l)
function firstDiff(a: Layer[], b: Layer[]) {
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i
  return a.length === b.length ? -1 : n
}

let lastLayers: Layer[] = []
const snap: { key: string; refs: Layer[]; canvas: HTMLCanvasElement | null } = { key: "", refs: [], canvas: null }

/** finished (masked + developed) pixels of expensive layers, keyed by layer identity */
const layerCache = new WeakMap<Layer, { key: string; canvas: HTMLCanvasElement; x: number; y: number }>()
/** draw layers: pixels of all strokes but the last, so painting only renders the new stroke */
const strokeCache = new Map<string, { key: string; strokes: object[]; canvas: HTMLCanvasElement }>()

/** Force the develop pipeline to re-upload (e.g. after an export at another scale). */
export function invalidateRenderCache() {
  geoKey = ""
  baseKey = ""
  lastDevelopSrc = null
  snap.key = ""
  lastLayers = []
}

function drawLayer(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  layer: Layer,
  assets: Map<string, Asset>,
  s: number,
  original: boolean,
  rc: RenderCtx,
) {
  if (layer.type === "effect") {
    applyEffect(canvas, layer, s, assets)
    return
  }
  const adj = original ? null : layerDevelop(layer)
  const filt = layer.filters && hasFilters(layer.filters) ? layer.filters : null
  // layers with an erase mask, paint layers and developed/filtered layers are rendered
  // in isolation first, so erasing / adjusting never touches the layers below
  if (layer.mask?.length || layer.type === "draw" || adj || filt) {
    const W = canvas.width
    const H = canvas.height
    const key = `${W}x${H}|${s}|${original ? 1 : 0}|${rc.epoch}|${objId(assets)}`
    const hit = rc.interactive ? layerCache.get(layer) : undefined
    let out: { canvas: CanvasImageSource; x: number; y: number }
    if (hit && hit.key === key) out = hit
    else {
      const buf = makeCanvas(W, H)
      const b = ctx2d(buf)
      if (layer.type === "draw" && rc.interactive) paintStrokesIncremental(b, layer, s, key, assets)
      else paintLayer(b, layer, assets, s)
      applyMask(b, layer.mask, s, assets)
      out = { canvas: buf, x: 0, y: 0 }
      const dev = adj ? getLayerDeveloper() : null
      const box = adj || filt ? layerBounds(layer) : null
      if (box && (dev || filt)) {
        // process only the layer's own area (faster, and vignette etc. relate to the layer)
        const r = aabb(box)
        const pad = Math.ceil(Math.max(4, Math.min(r.w, r.h) * 0.08) * s + (filt?.blur ?? 0) * s * 2)
        const x0 = Math.max(0, Math.floor(r.x * s) - pad)
        const y0 = Math.max(0, Math.floor(r.y * s) - pad)
        const x1 = Math.min(W, Math.ceil((r.x + r.w) * s) + pad)
        const y1 = Math.min(H, Math.ceil((r.y + r.h) * s) + pad)
        const w = x1 - x0
        const h = y1 - y0
        if (w > 1 && h > 1) {
          let sub = makeCanvas(w, h)
          ctx2d(sub).drawImage(buf, x0, y0, w, h, 0, 0, w, h)
          if (dev && w <= dev.maxSize && h <= dev.maxSize) {
            dev.setSource(sub, w, h)
            const developed = dev.render(adj!, s)
            // copy out of the shared WebGL canvas so it can be cached
            sub = makeCanvas(w, h)
            ctx2d(sub).drawImage(developed, 0, 0)
          }
          if (filt) applyFilters(sub, filt, s)
          out = { canvas: sub, x: x0, y: y0 }
        }
      }
      if (rc.interactive) layerCache.set(layer, { key, canvas: out.canvas as HTMLCanvasElement, x: out.x, y: out.y })
    }
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalAlpha = layer.opacity
    ctx.globalCompositeOperation = layer.blend
    ctx.drawImage(out.canvas, out.x, out.y)
    ctx.restore()
    return
  }
  ctx.save()
  ctx.globalAlpha = layer.opacity
  ctx.globalCompositeOperation = layer.blend
  paintLayer(ctx, layer, assets, s)
  ctx.restore()
}

/** Paints a draw layer, re-using the pixels of all unchanged strokes from the previous frame. */
function paintStrokesIncremental(
  ctx: CanvasRenderingContext2D,
  layer: Extract<Layer, { type: "draw" }>,
  s: number,
  key: string,
  assets: Map<string, Asset>,
) {
  const strokes = layer.strokes
  const c = strokeCache.get(layer.id)
  let from = 0
  if (c && c.key === key && c.strokes.length <= strokes.length && c.strokes.every((st, i) => st === strokes[i])) {
    ctx.drawImage(c.canvas, 0, 0)
    from = c.strokes.length
  }
  const paint = (st: (typeof strokes)[number]) => {
    ctx.strokeStyle = st.color
    ctx.fillStyle = st.color
    ctx.globalCompositeOperation = st.erase ? "destination-out" : "source-over"
    drawStroke(ctx, st, s, assets)
  }
  for (let i = from; i < strokes.length - 1; i++) paint(strokes[i])
  // snapshot everything except the stroke that is (probably) still being painted
  if (strokes.length > 1 && from < strokes.length - 1) {
    const W = ctx.canvas.width
    const H = ctx.canvas.height
    const keep = c?.canvas && c.canvas.width === W && c.canvas.height === H ? c.canvas : makeCanvas(W, H)
    const kc = ctx2d(keep)
    kc.globalCompositeOperation = "copy"
    kc.drawImage(ctx.canvas, 0, 0)
    kc.globalCompositeOperation = "source-over"
    strokeCache.set(layer.id, { key, strokes: strokes.slice(0, -1), canvas: keep })
  }
  if (strokes.length && from <= strokes.length - 1) paint(strokes[strokes.length - 1])
  ctx.globalCompositeOperation = "source-over"
}

/** Paints a layer's own content (no opacity/blend) – ctx at identity transform. */
function paintLayer(ctx: CanvasRenderingContext2D, layer: Layer, assets: Map<string, Asset>, s: number) {
  ctx.save()
  switch (layer.type) {
    case "image":
      ctx.scale(s, s)
      drawImageLayer(ctx, layer, assets)
      break
    case "text":
      ctx.scale(s, s)
      drawText(ctx, layer)
      break
    case "shape":
      ctx.scale(s, s)
      drawShape(ctx, layer)
      break
    case "draw":
      for (const st of layer.strokes) {
        ctx.strokeStyle = st.color
        ctx.fillStyle = st.color
        ctx.globalCompositeOperation = st.erase ? "destination-out" : "source-over"
        drawStroke(ctx, st, s, assets)
      }
      break
    case "fill":
      drawFill(ctx, layer, s)
      break
  }
  ctx.restore()
}

function drawImageLayer(ctx: CanvasRenderingContext2D, l: ImageLayer, assets: Map<string, Asset>) {
  const a = assets.get(l.assetId)
  if (!a) return
  ctx.translate(l.x + l.width / 2, l.y + l.height / 2)
  ctx.rotate(l.rotation * DEG)
  if (l.flipH) ctx.scale(-1, 1)
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(a.bitmap, -l.width / 2, -l.height / 2, l.width, l.height)
}

export function textFont(l: TextLayer) {
  return `${l.italic ? "italic " : ""}${l.fontWeight} ${l.fontSize}px ${fontFamilyFor(l.fontFamily)}`
}

let measureCtx: CanvasRenderingContext2D | null = null
/** Measures a text layer → box relative to its anchor (x,y = anchor). */
export function measureText(l: TextLayer) {
  if (!measureCtx) measureCtx = ctx2d(makeCanvas(2, 2))
  const c = measureCtx
  c.font = textFont(l)
  try {
    c.letterSpacing = `${l.letterSpacing}px`
  } catch {
    /* older browsers */
  }
  const lines = (l.uppercase ? l.text.toUpperCase() : l.text).split("\n")
  const lh = l.fontSize * l.lineHeight
  const widths = lines.map((t) => c.measureText(t).width)
  const w = Math.max(1, ...widths)
  const h = lh * lines.length
  const pad = l.background ? l.fontSize * l.padding : 0
  const ax = l.align === "left" ? 0 : l.align === "center" ? -w / 2 : -w
  return { lines, widths, w, h, lh, pad, box: { x: ax - pad, y: -pad, w: w + pad * 2, h: h + pad * 2 } }
}

function drawText(ctx: CanvasRenderingContext2D, l: TextLayer) {
  const m = measureText(l)
  // rotate around the visual centre of the text box
  const cx = m.box.x + m.box.w / 2
  const cy = m.box.y + m.box.h / 2
  ctx.translate(l.x + cx, l.y + cy)
  ctx.rotate(l.rotation * DEG)
  ctx.translate(-cx, -cy)
  ctx.font = textFont(l)
  try {
    ctx.letterSpacing = `${l.letterSpacing}px`
  } catch {
    /* ignore */
  }
  if (l.background) {
    ctx.fillStyle = l.background
    const r = Math.min(m.box.h / 2, l.fontSize * 0.25)
    ctx.beginPath()
    ctx.roundRect(m.box.x, m.box.y, m.box.w, m.box.h, r)
    ctx.fill()
  }
  ctx.textBaseline = "middle"
  ctx.textAlign = l.align
  const ax = 0
  if (l.shadow) {
    ctx.shadowColor = "rgba(0,0,0,0.45)"
    ctx.shadowBlur = l.fontSize * 0.18
    ctx.shadowOffsetY = l.fontSize * 0.05
  }
  m.lines.forEach((line, i) => {
    const y = i * m.lh + m.lh / 2
    if (l.strokeColor && l.strokeWidth > 0) {
      ctx.lineJoin = "round"
      ctx.strokeStyle = l.strokeColor
      ctx.lineWidth = l.strokeWidth * 2
      ctx.strokeText(line, ax, y)
      ctx.shadowColor = "transparent"
    }
    ctx.fillStyle = l.color
    ctx.fillText(line, ax, y)
  })
}

function drawShape(ctx: CanvasRenderingContext2D, l: ShapeLayer) {
  ctx.translate(l.x + l.width / 2, l.y + l.height / 2)
  ctx.rotate(l.rotation * DEG)
  const w = l.width
  const h = l.height
  ctx.lineWidth = l.strokeWidth
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  if (l.shape === "line" || l.shape === "arrow") {
    ctx.strokeStyle = l.stroke ?? "#fff"
    ctx.fillStyle = l.stroke ?? "#fff"
    const x0 = -w / 2, y0 = -h / 2, x1 = w / 2, y1 = h / 2
    const ang = Math.atan2(y1 - y0, x1 - x0)
    const head = Math.max(l.strokeWidth * 3.5, 12)
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    if (l.shape === "arrow") ctx.lineTo(x1 - Math.cos(ang) * head * 0.8, y1 - Math.sin(ang) * head * 0.8)
    else ctx.lineTo(x1, y1)
    ctx.stroke()
    if (l.shape === "arrow") {
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x1 - Math.cos(ang - 0.45) * head, y1 - Math.sin(ang - 0.45) * head)
      ctx.lineTo(x1 - Math.cos(ang + 0.45) * head, y1 - Math.sin(ang + 0.45) * head)
      ctx.closePath()
      ctx.fill()
    }
    return
  }
  ctx.beginPath()
  if (l.shape === "rect") ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(l.radius, Math.abs(w) / 2, Math.abs(h) / 2))
  else ctx.ellipse(0, 0, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2)
  if (l.fill) {
    ctx.fillStyle = l.fill
    ctx.fill()
  }
  if (l.stroke && l.strokeWidth > 0) {
    ctx.strokeStyle = l.stroke
    ctx.stroke()
  }
}

/** Axis-aligned bounds of a layer in doc px (for selection & hit testing). */
export function layerBounds(l: Layer): { x: number; y: number; w: number; h: number; rotation: number } | null {
  switch (l.type) {
    case "image":
    case "shape":
      return { x: l.x, y: l.y, w: l.width, h: l.height, rotation: l.rotation }
    case "effect":
      if (l.region === "brush") {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
        for (const s of l.strokes)
          for (let i = 0; i < s.points.length; i += 2) {
            x0 = Math.min(x0, s.points[i] - s.size / 2)
            y0 = Math.min(y0, s.points[i + 1] - s.size / 2)
            x1 = Math.max(x1, s.points[i] + s.size / 2)
            y1 = Math.max(y1, s.points[i + 1] + s.size / 2)
          }
        return isFinite(x0) ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0, rotation: 0 } : null
      }
      return { x: l.x, y: l.y, w: l.width, h: l.height, rotation: 0 }
    case "text": {
      const m = measureText(l)
      return { x: l.x + m.box.x, y: l.y + m.box.y, w: m.box.w, h: m.box.h, rotation: l.rotation }
    }
    case "draw": {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
      for (const s of l.strokes)
        for (let i = 0; i < s.points.length; i += 2) {
          x0 = Math.min(x0, s.points[i] - s.size / 2)
          y0 = Math.min(y0, s.points[i + 1] - s.size / 2)
          x1 = Math.max(x1, s.points[i] + s.size / 2)
          y1 = Math.max(y1, s.points[i + 1] + s.size / 2)
        }
      return isFinite(x0) ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0, rotation: 0 } : null
    }
    case "fill": {
      if (!l.clip?.length || l.clipInvert) return null
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
      for (let i = 0; i < l.clip.length; i += 2) {
        x0 = Math.min(x0, l.clip[i])
        y0 = Math.min(y0, l.clip[i + 1])
        x1 = Math.max(x1, l.clip[i])
        y1 = Math.max(y1, l.clip[i + 1])
      }
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, rotation: 0 }
    }
  }
}

/** transparent version of a colour for "fade out" gradients */
function transparentOf(c: string) {
  if (/^#[0-9a-f]{6}$/i.test(c)) return `${c}00`
  return "rgba(0,0,0,0)"
}

/** Solid or gradient fill, optionally limited to a selection polygon. */
function drawFill(ctx: CanvasRenderingContext2D, l: FillLayer, s: number) {
  const W = ctx.canvas.width
  const H = ctx.canvas.height
  const c2 = l.color2 === "transparent" ? transparentOf(l.color) : l.color2
  let style: string | CanvasGradient = l.color
  if (l.fill === "linear") {
    const g = ctx.createLinearGradient(l.x1 * s, l.y1 * s, l.x2 * s, l.y2 * s)
    g.addColorStop(0, l.color)
    g.addColorStop(1, c2)
    style = g
  } else if (l.fill === "radial") {
    const r = Math.hypot(l.x2 - l.x1, l.y2 - l.y1) * s
    const g = ctx.createRadialGradient(l.x1 * s, l.y1 * s, 0, l.x1 * s, l.y1 * s, Math.max(1, r))
    g.addColorStop(0, l.color)
    g.addColorStop(1, c2)
    style = g
  }
  ctx.fillStyle = style
  ctx.beginPath()
  if (l.clip?.length) {
    if (l.clipInvert) ctx.rect(0, 0, W, H)
    ctx.moveTo(l.clip[0] * s, l.clip[1] * s)
    for (let i = 2; i < l.clip.length; i += 2) ctx.lineTo(l.clip[i] * s, l.clip[i + 1] * s)
    ctx.closePath()
    ctx.fill(l.clipInvert ? "evenodd" : "nonzero")
  } else ctx.fillRect(0, 0, W, H)
}

/**
 * Keeps a layer's erase mask glued to the layer when it is moved, scaled or
 * rotated: every mask point is mapped from the old box into the new box.
 */
export function remapMask<T extends Layer>(before: Layer, after: T): T {
  if (!after.mask?.length || after.type === "draw") return after
  const a = layerBounds(before)
  const b = layerBounds(after)
  if (!a || !b || !a.w || !a.h) return after
  if (a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h && a.rotation === b.rotation) return after
  const ca = { x: a.x + a.w / 2, y: a.y + a.h / 2 }
  const cb = { x: b.x + b.w / 2, y: b.y + b.h / 2 }
  const ra = -a.rotation * DEG
  const rb = b.rotation * DEG
  const sx = b.w / a.w
  const sy = b.h / a.h
  const k = Math.sqrt(Math.abs(sx * sy))
  return {
    ...after,
    mask: after.mask.map((m) => {
      const pts = m.points.slice()
      for (let i = 0; i < pts.length; i += 2) {
        const dx = pts[i] - ca.x
        const dy = pts[i + 1] - ca.y
        const lx = (dx * Math.cos(ra) - dy * Math.sin(ra)) * sx
        const ly = (dx * Math.sin(ra) + dy * Math.cos(ra)) * sy
        pts[i] = cb.x + lx * Math.cos(rb) - ly * Math.sin(rb)
        pts[i + 1] = cb.y + lx * Math.sin(rb) + ly * Math.cos(rb)
      }
      return { ...m, points: pts, size: m.size * k }
    }),
  }
}

/** Matrix mapping centred source-image coordinates to document coordinates (same as drawGeometry). */
export function geometryMatrix(doc: Pick<SheepDoc, "sourceWidth" | "sourceHeight" | "geometry">): DOMMatrix {
  const g = doc.geometry
  const odd = g.rotate90 % 2 === 1
  const RW = odd ? doc.sourceHeight : doc.sourceWidth
  const RH = odd ? doc.sourceWidth : doc.sourceHeight
  const k = coverScale(RW, RH, g.straighten)
  return new DOMMatrix()
    .translate(-g.crop.x * RW, -g.crop.y * RH)
    .translate(RW / 2, RH / 2)
    .rotate(g.straighten)
    .scale(k, k)
    .rotate(g.rotate90 * 90)
    .scale(g.flipH ? -1 : 1, g.flipV ? -1 : 1)
}

/** Keeps background erase masks glued to the photo when crop/rotate/flip/straighten change. */
export function remapBaseMask(prev: SheepDoc, next: SheepDoc, mask = next.baseMask): Stroke[] | undefined {
  if (!mask?.length || !prev.baseAssetId || prev.baseAssetId !== next.baseAssetId) return mask
  if (JSON.stringify(prev.geometry) === JSON.stringify(next.geometry)) return mask
  const M = geometryMatrix(next).multiply(geometryMatrix(prev).inverse())
  const ks = Math.sqrt(Math.abs(M.a * M.d - M.b * M.c))
  return mask.map((m) => {
    const pts = m.points.slice()
    for (let i = 0; i < pts.length; i += 2) {
      const p = M.transformPoint({ x: pts[i], y: pts[i + 1] })
      pts[i] = p.x
      pts[i + 1] = p.y
    }
    return { ...m, points: pts, size: m.size * ks }
  })
}

/** axis-aligned box of a (possibly rotated) layer box */
export function aabb(b: { x: number; y: number; w: number; h: number; rotation: number }) {
  if (!b.rotation) return { x: Math.min(b.x, b.x + b.w), y: Math.min(b.y, b.y + b.h), w: Math.abs(b.w), h: Math.abs(b.h) }
  const cx = b.x + b.w / 2
  const cy = b.y + b.h / 2
  const a = b.rotation * DEG
  const c = Math.abs(Math.cos(a))
  const sn = Math.abs(Math.sin(a))
  const w = Math.abs(b.w) * c + Math.abs(b.h) * sn
  const h = Math.abs(b.w) * sn + Math.abs(b.h) * c
  return { x: cx - w / 2, y: cy - h / 2, w, h }
}
