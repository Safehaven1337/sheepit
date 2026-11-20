"use client"

import { toast } from "sonner"
import { newEffect } from "./defaults"
import { detectFaces } from "./faces"
import { isProjectFile } from "./handoff"
import { loadProject } from "./project"
import { docSize, renderDoc, rotatedSize, invalidateRenderCache } from "./render"
import { useEditor } from "./store"
import type { Layer, SheepDoc, ToolId } from "./types"

const get = () => useEditor.getState()

export function shiftLayer(l: Layer, dx: number, dy: number) {
  if ("x" in l && "y" in l) {
    l.x += dx
    l.y += dy
  }
  const lists = [l.mask ?? [], l.type === "effect" || l.type === "draw" ? l.strokes : []]
  for (const list of lists)
    for (const s of list)
      for (let i = 0; i < s.points.length; i += 2) {
        s.points[i] += dx
        s.points[i + 1] += dy
      }
}

/** Commits the crop draft, keeping layers anchored to the image. */
export function applyCrop() {
  const s = get()
  const r = s.crop.rect
  if (!r) return
  const c = s.doc.geometry.crop
  if (Math.abs(r.x - c.x) + Math.abs(r.y - c.y) + Math.abs(r.w - c.w) + Math.abs(r.h - c.h) < 1e-6) return
  const R = rotatedSize(s.doc)
  const dx = (c.x - r.x) * R.w
  const dy = (c.y - r.y) * R.h
  s.patch((d) => {
    d.geometry.crop = { ...r }
    for (const l of d.layers) shiftLayer(l, dx, dy)
  })
}

export function switchTool(t: ToolId) {
  const s = get()
  if (s.tool === "crop" && t !== "crop") applyCrop()
  // finishing an empty text edit removes the empty layer
  if (s.editingText) finishTextEdit()
  s.setTool(t)
}

/** Ends inline text editing; empty text layers are removed (like Photoshop). */
export function finishTextEdit() {
  const s = get()
  const id = s.editingText
  if (!id) return
  s.setEditingText(null)
  const l = s.doc.layers.find((x) => x.id === id)
  if (l?.type === "text" && !l.text.trim()) s.removeLayer(id)
}

/** Geometry changes that alter the rotated frame reset the crop. */
export function rotate90(dir: 1 | -1) {
  const s = get()
  s.patch((d) => {
    d.geometry.rotate90 = (d.geometry.rotate90 + dir + 4) % 4
    const c = d.geometry.crop
    d.geometry.crop = dir === 1 ? { x: 1 - c.y - c.h, y: c.x, w: c.h, h: c.w } : { x: c.y, y: 1 - c.x - c.w, w: c.h, h: c.w }
  })
  if (get().tool === "crop") get().setCrop({ rect: get().doc.geometry.crop })
}

export function flip(axis: "h" | "v") {
  const s = get()
  // flips happen before rotation; map screen axis to source axis
  const odd = s.doc.geometry.rotate90 % 2 === 1
  const srcAxis = odd ? (axis === "h" ? "v" : "h") : axis
  s.patch((d) => {
    if (srcAxis === "h") d.geometry.flipH = !d.geometry.flipH
    else d.geometry.flipV = !d.geometry.flipV
    const c = d.geometry.crop
    if (axis === "h") c.x = 1 - c.x - c.w
    else c.y = 1 - c.y - c.h
  })
  if (get().tool === "crop") get().setCrop({ rect: get().doc.geometry.crop })
}

export async function openFile(file: File) {
  try {
    if (isProjectFile(file)) {
      const { doc, assets } = await loadProject(file)
      get().loadProject(doc, assets)
      invalidateRenderCache()
      toast.success("Projekt geladen – du kannst genau dort weitermachen.")
      return true
    }
    if (!file.type.startsWith("image/") && !/\.(heic|heif|avif|webp|jpe?g|png|gif|bmp)$/i.test(file.name)) {
      toast.error("Dieses Dateiformat wird nicht unterstützt.")
      return false
    }
    await get().openImage(file, file.name)
    invalidateRenderCache()
    return true
  } catch (e) {
    console.error(e)
    toast.error(
      /heic|heif/i.test(file.name)
        ? "HEIC kann dein Browser leider nicht öffnen. Tipp: In Safari öffnen oder vorher als JPG exportieren."
        : `Datei konnte nicht geöffnet werden: ${(e as Error).message}`,
    )
    return false
  }
}

/** Adds an image as a new layer (e.g. paste or drag onto an open document). */
export async function addImageLayer(blob: Blob, name = "Bild") {
  const s = get()
  const a = await s.addAsset(blob)
  const { w, h } = docSize(s.doc)
  const k = Math.min(1, (Math.min(w, h) * 0.6) / Math.max(a.width, a.height))
  const lw = a.width * k
  const lh = a.height * k
  s.addLayer({
    id: a.id + "L",
    type: "image",
    name,
    visible: true,
    locked: false,
    opacity: 1,
    blend: "source-over",
    assetId: a.id,
    x: (w - lw) / 2,
    y: (h - lh) / 2,
    width: lw,
    height: lh,
    rotation: 0,
    flipH: false,
  })
  switchTool("move")
}

export async function autoDetectFaces(doc?: SheepDoc) {
  const s = get()
  const d = doc ?? s.doc
  if (!d.baseAssetId) return 0
  const { w, h } = docSize(d)
  const scale = Math.min(1, 2048 / Math.max(w, h))
  const id = toast.loading("Suche Gesichter … (läuft lokal auf deinem Gerät)")
  try {
    const canvas = renderDoc({ ...d, layers: [] }, s.assets, { scale, original: true })
    invalidateRenderCache()
    const faces = await detectFaces(canvas, (done, total) =>
      toast.loading(`Suche Gesichter … ${Math.round((done / total) * 100)} % (lokal auf deinem Gerät)`, { id }),
    )
    if (!faces.length) {
      toast.info("Keine Gesichter gefunden. Markiere sie einfach manuell.", { id })
      return 0
    }
    const eff = s.privacy.effect
    const minDim = Math.min(w, h)
    // skip faces already covered by an existing region (e.g. detection run twice)
    const covered = (f: { x: number; y: number; w: number; h: number }) =>
      get().doc.layers.some((l) => {
        if (l.type !== "effect" || l.region === "brush" || l.invert || !l.visible) return false
        const cx = f.x + f.w / 2
        const cy = f.y + f.h / 2
        return cx > l.x && cx < l.x + l.width && cy > l.y && cy < l.y + l.height
      })
    const fresh = faces
      .map((f0) => ({ x: f0.x / scale, y: f0.y / scale, w: f0.w / scale, h: f0.h / scale }))
      .filter((f) => !covered(f))
    if (!fresh.length) {
      toast.info("Alle gefundenen Gesichter sind bereits unkenntlich gemacht.", { id })
      return 0
    }
    s.patch((dd) => {
      for (const f of fresh) {
        const padX = f.w * 0.18
        const padY = f.h * 0.28
        const l = newEffect(eff, "ellipse", f.x - padX, f.y - padY * 1.4, f.w + padX * 2, f.h + padY * 2.2, minDim)
        l.name = "Gesicht"
        if (eff === "pixelate") l.amount = Math.max(8, Math.round(f.w / 7))
        if (eff === "blur") l.amount = Math.max(10, Math.round(f.w / 6))
        l.feather = Math.round(f.w * 0.06)
        dd.layers.push(l)
      }
    })
    toast.success(
      `${fresh.length} ${fresh.length === 1 ? "Gesicht" : "Gesichter"} unkenntlich gemacht – fehlt eins? Einfach einen Rahmen ziehen.`,
      { id },
    )
    return fresh.length
  } catch (e) {
    console.error(e)
    toast.error("Gesichtserkennung konnte nicht geladen werden.", { id })
    return 0
  }
}
