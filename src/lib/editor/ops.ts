"use client"

// Photoshop-style document operations: layers, selection, merge/flatten, clipboard.
import { toast } from "sonner"
import { defaultAdjustments, defaultGeometry, newDraw, newEffect, uid } from "./defaults"
import { docSize, invalidateRenderCache, layerBounds, renderDoc, rotatedSize } from "./render"
import { blobToAsset, useEditor } from "./store"
import { shiftLayer } from "./actions"
import { BASE_ID, type DrawLayer, type ImageLayer, type Layer, type SelectionShape, type SheepDoc, type Stroke } from "./types"

const get = () => useEditor.getState()

/* ------------------------------------------------------------------ helpers */

function layerIndexAboveSelection() {
  const s = get()
  const i = s.doc.layers.findIndex((l) => l.id === s.selectedId)
  return i < 0 ? s.doc.layers.length : i + 1
}

function nextLayerName() {
  const nums = get().doc.layers.map((l) => /^Ebene (\d+)$/.exec(l.name)?.[1]).filter(Boolean).map(Number)
  return `Ebene ${(nums.length ? Math.max(...nums) : 0) + 1}`
}

/** Selection → polygon in doc px (ellipses are approximated with 72 points). */
export function selectionPolygon(sel: SelectionShape): number[] {
  if (sel.kind === "lasso") return sel.points
  const { x, y, w, h } = sel
  if (sel.kind === "rect") return [x, y, x + w, y, x + w, y + h, x, y + h]
  const pts: number[] = []
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2
    pts.push(x + w / 2 + (Math.cos(a) * w) / 2, y + h / 2 + (Math.sin(a) * h) / 2)
  }
  return pts
}

export function selectionBounds(sel: SelectionShape) {
  const p = selectionPolygon(sel)
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (let i = 0; i < p.length; i += 2) {
    x0 = Math.min(x0, p[i])
    y0 = Math.min(y0, p[i + 1])
    x1 = Math.max(x1, p[i])
    y1 = Math.max(y1, p[i + 1])
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

const selectionStroke = (sel: SelectionShape): Stroke => ({
  points: selectionPolygon(sel),
  size: 0,
  poly: true,
  invert: !!sel.inverted,
})

async function canvasToBlob(c: HTMLCanvasElement) {
  const b = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"))
  if (!b) throw new Error("Rendern fehlgeschlagen")
  return b
}

/** Tight bounding box of non-transparent pixels. */
function alphaBounds(c: HTMLCanvasElement) {
  const ctx = c.getContext("2d", { willReadFrequently: true })!
  const { data, width: W, height: H } = ctx.getImageData(0, 0, c.width, c.height)
  let x0 = W, y0 = H, x1 = -1, y1 = -1
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (data[(y * W + x) * 4 + 3] > 2) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}

/** Renders the given layers (optionally with the background) at 100 %, optionally clipped to a selection. */
function renderLayers(layers: Layer[], withBase: boolean, clip?: SelectionShape | null, withBg = false) {
  const s = get()
  const c = renderDoc({ ...s.doc, layers, baseHidden: withBase ? s.doc.baseHidden : true }, s.assets, {
    scale: 1,
    skipBase: !withBase,
    ...(withBg ? {} : { background: null }),
  })
  invalidateRenderCache()
  if (clip) {
    const ctx = c.getContext("2d")!
    ctx.save()
    ctx.globalCompositeOperation = "destination-in"
    ctx.beginPath()
    if (clip.inverted) ctx.rect(0, 0, c.width, c.height)
    const p = selectionPolygon(clip)
    ctx.moveTo(p[0], p[1])
    for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1])
    ctx.closePath()
    ctx.fill(clip.inverted ? "evenodd" : "nonzero")
    ctx.restore()
  }
  return c
}

/** Turns a full-document canvas into a trimmed image layer. */
async function canvasToImageLayer(c: HTMLCanvasElement, name: string): Promise<ImageLayer | null> {
  const b = alphaBounds(c)
  if (!b) return null
  const t = document.createElement("canvas")
  t.width = b.w
  t.height = b.h
  t.getContext("2d")!.drawImage(c, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h)
  const a = await get().addAsset(await canvasToBlob(t))
  return {
    id: uid(),
    type: "image",
    name,
    visible: true,
    locked: false,
    opacity: 1,
    blend: "source-over",
    assetId: a.id,
    x: b.x,
    y: b.y,
    width: b.w,
    height: b.h,
    rotation: 0,
    flipH: false,
  }
}

/* ------------------------------------------------------------------- layers */

export function newLayer() {
  const l = newDraw()
  l.name = nextLayerName()
  get().addLayer(l, true, layerIndexAboveSelection())
  return l.id
}

/** Returns the paint layer brush strokes go into (creates one when needed). */
export function ensurePaintLayer(): string {
  const s = get()
  const sel = s.doc.layers.find((l) => l.id === s.selectedId)
  if (sel?.type === "draw" && !sel.locked) return sel.id
  return newLayer()
}

export function selectedLayer(): Layer | null {
  const s = get()
  return s.doc.layers.find((l) => l.id === s.selectedId) ?? null
}

export function deleteSelectedLayer() {
  const s = get()
  if (!s.selectedId) return
  if (s.selectedId === BASE_ID) {
    if (!s.doc.baseAssetId) return
    s.patch((d) => void (d.baseHidden = true))
    toast.info("Hintergrund ausgeblendet (Auge im Ebenen-Panel blendet ihn wieder ein).")
    return
  }
  s.removeLayer(s.selectedId)
}

export async function rasterizeLayer(id: string) {
  const s = get()
  const l = s.doc.layers.find((x) => x.id === id)
  if (!l || l.type === "effect") return
  const c = renderLayers([{ ...l, opacity: 1, blend: "source-over", visible: true }], false)
  const img = await canvasToImageLayer(c, l.name)
  if (!img) return
  img.opacity = l.opacity
  img.blend = l.blend
  s.patch((d) => {
    const i = d.layers.findIndex((x) => x.id === id)
    if (i >= 0) d.layers[i] = img
  })
  s.select(img.id)
}

/** Strg+E: merge the selected layer into the one below. */
export async function mergeDown() {
  const s = get()
  const i = s.doc.layers.findIndex((l) => l.id === s.selectedId)
  if (i < 0) return
  const upper = s.doc.layers[i]
  if (i === 0) {
    if (!s.doc.baseAssetId) return toast.info("Keine Ebene darunter.")
    return flattenInto([upper])
  }
  const lower = s.doc.layers[i - 1]
  const c = renderLayers([{ ...lower, visible: true }, { ...upper, visible: true }], false)
  const img = await canvasToImageLayer(c, lower.name)
  s.patch((d) => {
    d.layers = d.layers.filter((l) => l.id !== upper.id && l.id !== lower.id)
    if (img) d.layers.splice(i - 1, 0, img)
  })
  s.select(img?.id ?? null)
}

/** Bakes the background (+ given layers) into a new background photo. */
async function flattenInto(layers: Layer[], dropAll = false) {
  const s = get()
  const { w, h } = docSize(s.doc)
  const c = renderLayers(layers.map((l) => ({ ...l, visible: true })), true, null, true)
  const asset = await blobToAsset(await canvasToBlob(c))
  const assets = new Map(s.assets)
  assets.set(asset.id, asset)
  useEditor.setState({ assets })
  const ids = new Set(layers.map((l) => l.id))
  s.patch((d) => {
    d.baseAssetId = asset.id
    d.sourceWidth = w
    d.sourceHeight = h
    d.geometry = defaultGeometry()
    d.adjustments = defaultAdjustments()
    d.look = null
    d.lookAmount = 1
    d.baseMask = []
    d.baseHidden = false
    d.layers = dropAll ? [] : d.layers.filter((l) => !ids.has(l.id))
    d.background = "#ffffff"
  })
  invalidateRenderCache()
  get().select(BASE_ID)
}

/** Ebene › Auf Hintergrundebene reduzieren */
export async function flattenImage() {
  const s = get()
  await flattenInto(s.doc.layers.filter((l) => l.visible), true)
  toast.success("Auf Hintergrundebene reduziert")
}

export function copyLayer(cut = false) {
  const l = selectedLayer()
  if (!l) return false
  get().setClipboard(structuredClone(l))
  if (cut) get().removeLayer(l.id)
  return true
}

export function pasteLayer() {
  const c = get().clipboard
  if (!c) return false
  const l = structuredClone(c)
  l.id = uid()
  shiftLayer(l, 20, 20)
  get().addLayer(l, true, layerIndexAboveSelection())
  get().setClipboard(structuredClone(l))
  return true
}

export function alignLayer(how: "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom") {
  const s = get()
  const l = selectedLayer()
  if (!l) return
  const b = layerBounds(l)
  if (!b) return
  const { w, h } = docSize(s.doc)
  let dx = 0, dy = 0
  if (how === "left") dx = -b.x
  if (how === "hcenter") dx = w / 2 - (b.x + b.w / 2)
  if (how === "right") dx = w - (b.x + b.w)
  if (how === "top") dy = -b.y
  if (how === "vcenter") dy = h / 2 - (b.y + b.h / 2)
  if (how === "bottom") dy = h - (b.y + b.h)
  s.patch((d) => {
    const L = d.layers.find((x) => x.id === l.id)
    if (L) shiftLayer(L, dx, dy)
  })
}

export function flipLayer(axis: "h" | "v") {
  const l = selectedLayer()
  if (!l) return
  if (l.type === "image") {
    if (axis === "h") get().updateLayer(l.id, { flipH: !l.flipH })
    else get().updateLayer(l.id, { flipH: !l.flipH, rotation: ((l.rotation + 360) % 360) - 180 })
  }
}

/* ---------------------------------------------------------------- selection */

export function selectAll() {
  const { w, h } = docSize(get().doc)
  get().setSelection({ kind: "rect", x: 0, y: 0, w, h })
}

export function invertSelection() {
  const sel = get().selection
  if (!sel) return selectAll()
  get().setSelection({ ...sel, inverted: !sel.inverted })
}

function requireSelection() {
  const sel = get().selection
  if (!sel) toast.info("Erst eine Auswahl erstellen (M).")
  return sel
}

/** Bearbeiten › Fläche füllen (Vordergrundfarbe) */
export function fillSelection(color = get().fg) {
  const sel = get().selection
  const s = get()
  const { w, h } = docSize(s.doc)
  const target = sel ?? ({ kind: "rect", x: 0, y: 0, w, h } as SelectionShape)
  const id = ensurePaintLayer()
  s.patch((d) => {
    const L = d.layers.find((l) => l.id === id) as DrawLayer | undefined
    L?.strokes.push({ ...selectionStroke(target), color })
  })
}

/** Entf: erase the selection from the active layer (or the background). */
export function deleteSelection() {
  const sel = requireSelection()
  if (!sel) return
  const s = get()
  const op = selectionStroke(sel)
  if (s.selectedId === BASE_ID || !s.selectedId) {
    if (!s.doc.baseAssetId) return
    s.patch((d) => void (d.baseMask = [...(d.baseMask ?? []), op]))
    return
  }
  const l = selectedLayer()
  if (!l || l.locked) return
  if (l.type === "effect") return toast.info("Unkenntlich-Bereiche kannst du mit dem Verschieben-Werkzeug bearbeiten.")
  s.patch((d) => {
    const L = d.layers.find((x) => x.id === l.id)
    if (L) L.mask = [...(L.mask ?? []), op]
  })
}

/** Strg+J: copy selection of the active layer (or background) to a new layer. */
export async function copyToNewLayer(cut = false) {
  const s = get()
  const sel = s.selection
  const base = s.selectedId === BASE_ID || !s.selectedId
  const l = base ? null : selectedLayer()
  if (!sel) {
    if (l) return s.duplicateLayer(l.id)
    if (!s.doc.baseAssetId) return
  }
  if (l?.type === "effect") return s.duplicateLayer(l.id)
  const c = renderLayers(l ? [{ ...l, visible: true }] : [], base, sel)
  const img = await canvasToImageLayer(c, cut ? "Ausgeschnitten" : `${l?.name ?? "Hintergrund"} Kopie`)
  if (!img) return toast.info("Die Auswahl ist leer.")
  if (cut && sel) deleteSelection()
  get().addLayer(img, true, base ? 0 : layerIndexAboveSelection())
  get().setSelection(null)
}

/** Bild › Freistellen (auf Auswahl zuschneiden) */
export function cropToSelection() {
  const sel = requireSelection()
  if (!sel) return
  const s = get()
  const b = selectionBounds(sel)
  const { w, h } = docSize(s.doc)
  const x = Math.max(0, b.x), y = Math.max(0, b.y)
  const x1 = Math.min(w, b.x + b.w), y1 = Math.min(h, b.y + b.h)
  if (x1 - x < 2 || y1 - y < 2) return
  s.patch((d) => {
    if (d.baseAssetId) {
      const R = rotatedSize(d)
      const c = d.geometry.crop
      d.geometry.crop = { x: c.x + x / R.w, y: c.y + y / R.h, w: (x1 - x) / R.w, h: (y1 - y) / R.h }
    } else {
      d.sourceWidth = Math.round(x1 - x)
      d.sourceHeight = Math.round(y1 - y)
    }
    for (const l of d.layers) shiftLayer(l, -x, -y)
  })
  s.setSelection(null)
}

/** Auswahl › Unkenntlich machen (privacy effect within the selection). */
export function privacyFromSelection() {
  const sel = requireSelection()
  if (!sel) return
  const s = get()
  const { w, h } = docSize(s.doc)
  const l = newEffect(s.privacy.effect, "brush", 0, 0, 0, 0, Math.min(w, h))
  l.strokes = [selectionStroke({ ...sel, inverted: false })]
  l.invert = !!sel.inverted
  s.addLayer(l, true)
  s.setSelection(null)
}

/** Neues leeres Dokument ohne Foto */
export function newDocument(w: number, h: number, bg: string, name?: string) {
  get().newBlank(w, h, bg, name)
  invalidateRenderCache()
}

export function docHasContent(doc: SheepDoc) {
  return !!doc.baseAssetId || doc.layers.length > 0
}
