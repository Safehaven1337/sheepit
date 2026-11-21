"use client"

import * as React from "react"
import { toast } from "sonner"
import { useEditor } from "@/lib/editor/store"
import { aabb, docSize, layerBounds, measureText, remapBaseMask, renderDoc, textFont } from "@/lib/editor/render"
import { newEffect, newShape, newText, uid } from "@/lib/editor/defaults"
import { ensureFont, fontFamilyFor } from "@/lib/editor/fonts"
import { finishTextEdit } from "@/lib/editor/actions"
import { bucketFill, ensurePaintLayer, healStroke, selectionClip, selectionPolygon } from "@/lib/editor/ops"
import { shiftLayer } from "@/lib/editor/actions"
import { openContextMenu } from "./context-menu"
import { BASE_ID, type FillLayer, type Layer, type SelectionShape, type SheepDoc, type Stroke, type TextLayer } from "@/lib/editor/types"
import { cn } from "@/lib/utils"

type Pt = { x: number; y: number }
type Box = { x: number; y: number; w: number; h: number; rotation: number }

const DEG = Math.PI / 180
const rot = (p: Pt, a: number): Pt => ({
  x: p.x * Math.cos(a) - p.y * Math.sin(a),
  y: p.x * Math.sin(a) + p.y * Math.cos(a),
})

function hit(b: Box, p: Pt, pad = 0) {
  const c = { x: b.x + b.w / 2, y: b.y + b.h / 2 }
  const l = rot({ x: p.x - c.x, y: p.y - c.y }, -b.rotation * DEG)
  return Math.abs(l.x) <= Math.abs(b.w) / 2 + pad && Math.abs(l.y) <= Math.abs(b.h) / 2 + pad
}

function pointInPoly(p: Pt, pts: number[]) {
  let inside = false
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i], yi = pts[i + 1], xj = pts[j], yj = pts[j + 1]
    if (yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

type Gesture =
  | { kind: "pan"; sx: number; sy: number; px: number; py: number }
  | { kind: "pinch"; d0: number; z0: number; mid: Pt }
  | { kind: "move"; id: string; start: Pt; orig: Layer; key: string; moved: boolean }
  | { kind: "resize"; id: string; hx: number; hy: number; orig: Layer; box: Box; key: string; keepAspect: boolean }
  | { kind: "endpoint"; id: string; end: 0 | 1; orig: Layer; key: string }
  | { kind: "rotate"; id: string; center: Pt; key: string }
  | { kind: "create"; id: string | null; start: Pt; key: string; what: "effect" | "shape" }
  | { kind: "paint"; target: string; key: string; last: Pt; into: "strokes" | "mask" | "base" }
  | { kind: "select"; start: Pt; points: number[]; moved: boolean }
  | { kind: "moveSelection"; start: Pt; orig: SelectionShape }
  | { kind: "crop"; mode: "move" | "resize"; hx: number; hy: number; start: Pt; orig: { x: number; y: number; w: number; h: number } }
  | { kind: "gradient"; id: string; start: Pt; key: string }
  | { kind: "heal"; stroke: Stroke; last: Pt }

/** last brush point – shift+click draws a straight line from here (Photoshop) */
let lastPaintPoint: Pt | null = null

export function Viewport({ className }: { className?: string }) {
  const doc = useEditor((s) => s.doc)
  const assets = useEditor((s) => s.assets)
  const tool = useEditor((s) => s.tool)
  const compare = useEditor((s) => s.compare)
  const zoom = useEditor((s) => s.zoom)
  const renderTick = useEditor((s) => s.renderTick)
  const selectedId = useEditor((s) => s.selectedId)
  const crop = useEditor((s) => s.crop)
  const editingText = useEditor((s) => s.editingText)
  const privacy = useEditor((s) => s.privacy)
  const brush = useEditor((s) => s.brush)
  const eraser = useEditor((s) => s.eraser)
  const selection = useEditor((s) => s.selection)
  const selectMode = useEditor((s) => s.selectMode)

  const containerRef = React.useRef<HTMLDivElement>(null)
  const stageRef = React.useRef<HTMLDivElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const gesture = React.useRef<Gesture | null>(null)
  const pointers = React.useRef(new Map<number, Pt>())
  const [pan, setPan] = React.useState({ x: 0, y: 0 })
  const [box, setBox] = React.useState({ w: 0, h: 0 })
  const [spaceDown, setSpaceDown] = React.useState(false)
  const [altDown, setAltDown] = React.useState(false)
  const [cursor, setCursor] = React.useState<Pt | null>(null)
  const [panning, setPanning] = React.useState(false)
  const [hoverId, setHoverId] = React.useState<string | null>(null)
  const [lasso, setLasso] = React.useState<number[] | null>(null)
  const [guides, setGuides] = React.useState<{ v: number[]; h: number[] }>({ v: [], h: [] })
  const [healPts, setHealPts] = React.useState<Stroke | null>(null)
  const [dragTool, setDragTool] = React.useState<string | null>(null)
  const stamp = useEditor((s) => s.stamp)
  const cloneSource = useEditor((s) => s.cloneSource)
  const cloneOffset = useEditor((s) => s.cloneOffset)
  const showGrid = useEditor((s) => s.showGrid)

  const cropMode = tool === "crop" && !!doc.baseAssetId
  const viewDoc: SheepDoc = React.useMemo(
    () => {
      if (!cropMode) return doc
      const full = { ...doc, geometry: { ...doc.geometry, crop: { x: 0, y: 0, w: 1, h: 1 } }, layers: [] }
      return { ...full, baseMask: remapBaseMask(doc, full) }
    },
    [doc, cropMode],
  )
  const { w: DW, h: DH } = docSize(viewDoc)

  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const pad = box.w < 640 ? 24 : 72
  const fit = box.w ? Math.max(0.02, Math.min((box.w - pad) / DW, (box.h - pad) / DH)) : 1
  const z = zoom || fit
  React.useEffect(() => {
    useEditor.getState().setFitZoom(fit)
  }, [fit])
  // invariant: in "fit" mode (zoom 0) the pan offset is zero
  React.useEffect(
    () =>
      useEditor.subscribe((s, prev) => {
        if (s.zoom === 0 && prev.zoom !== 0) setPan({ x: 0, y: 0 })
      }),
    [],
  )

  // fonts used by text layers
  React.useEffect(() => {
    const texts = doc.layers.filter((l): l is TextLayer => l.type === "text")
    if (!texts.length) return
    Promise.all(texts.map((t) => ensureFont(t.fontFamily, t.fontWeight, t.italic))).then(() => useEditor.getState().bump())
  }, [doc.layers])

  // render (rAF-throttled)
  const dpr = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1
  const maxDim = Math.max(DW, DH)
  const target = Math.min(3200, Math.max(1400, Math.ceil((maxDim * z * dpr) / 400) * 400))
  const renderScale = Math.min(1, target / maxDim)
  React.useEffect(() => {
    const id = requestAnimationFrame(() => {
      const c = canvasRef.current
      if (!c) return
      const hide = editingText ? new Set([editingText]) : undefined
      renderDoc(viewDoc, assets, { scale: renderScale, original: compare, hide, cacheBase: true, epoch: renderTick }, c)
      window.dispatchEvent(new Event("sheepit:rendered"))
    })
    return () => cancelAnimationFrame(id)
  }, [viewDoc, assets, compare, renderScale, renderTick, editingText])

  // modifier keys
  React.useEffect(() => {
    const isField = (t: EventTarget | null) => !!(t as HTMLElement)?.closest?.("input,textarea,select,[contenteditable]")
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isField(e.target)) {
        setSpaceDown(true)
        e.preventDefault()
      }
      if (e.key === "Alt") {
        setAltDown(true)
        e.preventDefault()
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceDown(false)
      if (e.key === "Alt") setAltDown(false)
    }
    const blur = () => {
      setSpaceDown(false)
      setAltDown(false)
    }
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    window.addEventListener("blur", blur)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
      window.removeEventListener("blur", blur)
    }
  }, [])

  const toDoc = React.useCallback(
    (cx: number, cy: number): Pt => {
      const r = stageRef.current!.getBoundingClientRect()
      return { x: ((cx - r.left) / r.width) * DW, y: ((cy - r.top) / r.height) * DH }
    },
    [DW, DH],
  )

  const zoomAt = React.useCallback(
    (nz: number, clientX: number, clientY: number) => {
      nz = Math.min(32, Math.max(0.02, nz))
      const p = toDoc(clientX, clientY)
      setPan((pn) => ({ x: pn.x + (p.x - DW / 2) * (z - nz), y: pn.y + (p.y - DH / 2) * (z - nz) }))
      useEditor.getState().setZoom(nz)
    },
    [toDoc, DW, DH, z],
  )

  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey || e.altKey) {
        const f = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0022))
        zoomAt(z * f, e.clientX, e.clientY)
      } else {
        const dx = e.shiftKey ? e.deltaY : e.deltaX
        const dy = e.shiftKey ? 0 : e.deltaY
        setPan((p) => ({ x: p.x - dx, y: p.y - dy }))
        if (!useEditor.getState().zoom) useEditor.getState().setZoom(z)
      }
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [z, zoomAt])

  const isBase = selectedId === BASE_ID
  const selected = isBase ? null : (doc.layers.find((l) => l.id === selectedId) ?? null)
  const showHandles = tool === "move" && !!selected && !cropMode && !editingText && !selected.locked
  const selBox = showHandles && selected ? layerBounds(selected) : null

  const topLayerAt = (p: Pt, filter?: (l: Layer) => boolean) => {
    for (let i = doc.layers.length - 1; i >= 0; i--) {
      const l = doc.layers[i]
      if (!l.visible || l.locked || (filter && !filter(l))) continue
      if (l.type === "effect" && l.region === "brush") {
        if (l.strokes.some((s) => s.poly && pointInPoly(p, s.points))) return l
      }
      const b = layerBounds(l)
      if (b && !(l.type === "effect" && l.invert) && hit(b, p, 4 / z)) return l
    }
    return null
  }

  const st = useEditor.getState

  const pickColor = (p: Pt) => {
    const c = canvasRef.current
    if (!c) return
    const x = Math.floor(p.x * renderScale)
    const y = Math.floor(p.y * renderScale)
    if (x < 0 || y < 0 || x >= c.width || y >= c.height) return
    const d = c.getContext("2d")!.getImageData(x, y, 1, 1).data
    const hex = "#" + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join("")
    st().setColors({ fg: hex })
  }

  /** starts a paint/erase stroke on the right target */
  const beginPaint = (p: Pt, e: React.PointerEvent) => {
    const s = st()
    const erase = tool === "eraser"
    const set = erase ? s.eraser : s.brush
    const stroke: Stroke = { points: [p.x, p.y], size: set.size / z, hardness: set.hardness, alpha: set.opacity, ...selectionClip() }
    if (e.shiftKey && lastPaintPoint) stroke.points = [lastPaintPoint.x, lastPaintPoint.y, p.x, p.y]
    const key = `g:${uid()}`
    if (!erase) {
      const id = ensurePaintLayer()
      st().patch((d) => {
        const L = d.layers.find((x) => x.id === id)
        if (L?.type === "draw") L.strokes.push({ ...stroke, color: s.fg })
      }, key)
      gesture.current = { kind: "paint", target: id, key, last: p, into: "strokes" }
      return
    }
    // eraser
    if (isBase || (!s.selectedId && doc.baseAssetId)) {
      if (!doc.baseAssetId) return
      s.patch((d) => void (d.baseMask = [...(d.baseMask ?? []), stroke]), key)
      gesture.current = { kind: "paint", target: BASE_ID, key, last: p, into: "base" }
      return
    }
    const l = selected
    if (!l) return toast.info("Wähle zuerst eine Ebene zum Radieren.")
    if (l.locked) return toast.info("Diese Ebene ist gesperrt.")
    if (l.type === "effect") {
      if (l.region !== "brush") return toast.info("Rahmen-Bereiche mit dem Verschieben-Werkzeug ändern oder löschen.")
      s.patch((d) => {
        const L = d.layers.find((x) => x.id === l.id)
        if (L?.type === "effect") L.strokes.push({ ...stroke, erase: true, hardness: 1, alpha: 1 })
      }, key)
      gesture.current = { kind: "paint", target: l.id, key, last: p, into: "strokes" }
      return
    }
    s.patch((d) => {
      const L = d.layers.find((x) => x.id === l.id)
      if (L) L.mask = [...(L.mask ?? []), stroke]
    }, key)
    gesture.current = { kind: "paint", target: l.id, key, last: p, into: "mask" }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    const el = e.currentTarget as HTMLElement
    if ((e.target as HTMLElement).closest("textarea")) return
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* synthetic / already released pointers */
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      gesture.current = { kind: "pinch", d0: Math.hypot(a.x - b.x, a.y - b.y), z0: z, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }
      return
    }
    // right button is handled by the context menu
    if (e.button === 2) return
    if (e.button === 1 || spaceDown || tool === "hand") {
      gesture.current = { kind: "pan", sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y }
      setPanning(true)
      return
    }
    if (e.button !== 0) return
    const p = toDoc(e.clientX, e.clientY)
    const handle = (e.target as HTMLElement).dataset?.handle ?? (e.target as SVGElement).getAttribute?.("data-handle")
    const s = st()

    // finish inline text editing on any click outside the editor
    if (s.editingText) {
      finishTextEdit()
      if (tool === "text") return
    }

    if (tool === "zoom") {
      zoomAt(z * (e.altKey ? 1 / 1.5 : 1.5), e.clientX, e.clientY)
      return
    }
    if (tool === "bucket") {
      if (e.altKey) return pickColor(p)
      void bucketFill(p.x, p.y)
      return
    }
    if (tool === "gradient") {
      const fillL: FillLayer = {
        id: uid(),
        type: "fill",
        name: "Verlauf",
        visible: true,
        locked: false,
        opacity: 1,
        blend: "source-over",
        fill: s.gradient.type,
        color: s.fg,
        color2: s.gradient.to === "bg" ? s.bg : "transparent",
        x1: p.x,
        y1: p.y,
        x2: p.x + 1,
        y2: p.y,
        ...(s.selection ? { clip: selectionPolygon(s.selection), clipInvert: !!s.selection.inverted } : {}),
      }
      const key = `g:${uid()}`
      const idx = s.doc.layers.findIndex((l) => l.id === s.selectedId)
      s.patch((d) => void d.layers.splice(idx < 0 ? d.layers.length : idx + 1, 0, fillL), key)
      s.select(fillL.id)
      gesture.current = { kind: "gradient", id: fillL.id, start: p, key }
      setDragTool("gradient")
      return
    }
    if (tool === "clone") {
      if (e.altKey) {
        s.setCloneSource(p)
        toast.success("Quelle gesetzt – jetzt an der Zielstelle malen.")
        return
      }
      if (!s.cloneSource) return void toast.info("Erst mit Alt+Klick eine Quelle setzen.")
      const off = s.cloneOffset ?? { dx: s.cloneSource.x - p.x, dy: s.cloneSource.y - p.y }
      if (!s.cloneOffset) s.setCloneOffset(off)
      const size = s.stamp.size / z
      const st: Stroke = { points: [p.x, p.y], size, hardness: s.stamp.hardness, ...selectionClip() }
      const key = `g:${uid()}`
      const cur = selected?.type === "effect" && selected.effect === "clone" && selected.dx === off.dx && selected.dy === off.dy ? selected : null
      let id: string
      if (cur) {
        id = cur.id
        s.patch((d) => {
          const L = d.layers.find((x) => x.id === id)
          if (L?.type === "effect") L.strokes.push(st)
        }, key)
      } else {
        const l = newEffect("clone", "brush", 0, 0, 0, 0, Math.min(DW, DH))
        l.dx = off.dx
        l.dy = off.dy
        l.strokes = [st]
        l.opacity = s.stamp.opacity
        id = l.id
        const idx = s.doc.layers.findIndex((x) => x.id === s.selectedId)
        s.patch((d) => void d.layers.splice(idx < 0 ? d.layers.length : idx + 1, 0, l), key)
        s.select(l.id)
      }
      gesture.current = { kind: "paint", target: id, key, last: p, into: "strokes" }
      return
    }
    if (tool === "heal") {
      const st: Stroke = { points: [p.x, p.y], size: s.stamp.size / z, hardness: 1 }
      gesture.current = { kind: "heal", stroke: st, last: p }
      setHealPts({ ...st })
      return
    }

    if (tool === "eyedropper" || (e.altKey && (tool === "brush" || tool === "text" || tool === "shapes"))) {
      pickColor(p)
      return
    }

    if (cropMode && crop.rect) {
      const orig = { ...crop.rect }
      if (handle) {
        const [hx, hy] = handle.split(",").map(Number)
        gesture.current = { kind: "crop", mode: "resize", hx, hy, start: p, orig }
      } else {
        const r = { x: orig.x * DW, y: orig.y * DH, w: orig.w * DW, h: orig.h * DH }
        if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h)
          gesture.current = { kind: "crop", mode: "move", hx: 0, hy: 0, start: p, orig }
      }
      return
    }

    if (tool === "brush" || tool === "eraser") {
      beginPaint(p, e)
      return
    }

    if (tool === "select") {
      if (selection && !selection.inverted && pointInPoly(p, selectionPolygon(selection)) && !e.shiftKey) {
        gesture.current = { kind: "moveSelection", start: p, orig: structuredClone(selection) }
        return
      }
      gesture.current = { kind: "select", start: p, points: [p.x, p.y], moved: false }
      if (selectMode === "lasso") setLasso([p.x, p.y])
      return
    }

    // transform handles (move tool only)
    if (handle && selected && tool === "move") {
      const key = `g:${uid()}`
      if (handle === "rotate") {
        const b = layerBounds(selected)!
        gesture.current = { kind: "rotate", id: selected.id, center: { x: b.x + b.w / 2, y: b.y + b.h / 2 }, key }
      } else if (handle.startsWith("end")) {
        gesture.current = { kind: "endpoint", id: selected.id, end: handle === "end0" ? 0 : 1, orig: selected, key }
      } else {
        const [hx, hy] = handle.split(",").map(Number)
        gesture.current = {
          kind: "resize",
          id: selected.id,
          hx,
          hy,
          orig: selected,
          box: layerBounds(selected)!,
          key,
          keepAspect: (selected.type === "image" || selected.type === "text") && hx !== 0 && hy !== 0,
        }
      }
      return
    }

    if (tool === "privacy" && (privacy.region === "brush" || privacy.erase)) {
      const size = privacy.brushSize / z
      const key = `g:${uid()}`
      let layer = selected?.type === "effect" && selected.region === "brush" ? selected : null
      if (!layer) {
        if (privacy.erase) return
        const l = newEffect(privacy.effect, "brush", 0, 0, 0, 0, Math.min(DW, DH))
        l.invert = !!privacy.invert
        if (l.invert) l.feather = Math.round(Math.min(DW, DH) * 0.02)
        l.strokes = [{ points: [p.x, p.y], size, ...selectionClip() }]
        s.patch((d) => void d.layers.push(l), key)
        s.select(l.id)
        layer = l
      } else {
        const id = layer.id
        s.patch((d) => {
          const L = d.layers.find((x) => x.id === id)
          if (L?.type === "effect") L.strokes.push({ points: [p.x, p.y], size, erase: privacy.erase, ...selectionClip() })
        }, key)
      }
      gesture.current = { kind: "paint", target: layer.id, key, last: p, into: "strokes" }
      return
    }

    const under = topLayerAt(p)

    if (tool === "text") {
      if (under?.type === "text") {
        s.select(under.id)
        s.setEditingText(under.id)
        e.preventDefault()
        return
      }
      e.preventDefault()
      const t = { ...newText(p.x, p.y, Math.round(Math.max(24, Math.min(DW, DH) * 0.07))), ...s.textStyle }
      t.text = ""
      t.color = s.fg
      t.y -= (t.fontSize * t.lineHeight) / 2
      const above = s.doc.layers.findIndex((l) => l.id === s.selectedId)
      s.addLayer(t, true, above < 0 ? undefined : above + 1)
      s.setEditingText(t.id)
      return
    }

    if (tool === "shapes" || tool === "privacy") {
      const same = under && ((tool === "privacy" && under.type === "effect") || (tool === "shapes" && under.type === "shape"))
      if (same) {
        s.select(under.id)
        gesture.current = { kind: "move", id: under.id, start: p, orig: under, key: `g:${uid()}`, moved: false }
      } else {
        gesture.current = { kind: "create", id: null, start: p, key: `g:${uid()}`, what: tool === "privacy" ? "effect" : "shape" }
      }
      return
    }

    // move tool
    // auto-select picks the layer under the cursor; otherwise the active layer moves
    const pickTarget = s.autoSelect || e.ctrlKey || e.metaKey ? under : selected
    if (pickTarget) {
      s.select(pickTarget.id)
      gesture.current = { kind: "move", id: pickTarget.id, start: p, orig: pickTarget, key: `g:${uid()}`, moved: false }
    } else if (s.autoSelect) {
      s.select(doc.baseAssetId ? BASE_ID : null)
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (!stageRef.current) return
    const p = toDoc(e.clientX, e.clientY)
    setCursor(p)
    window.dispatchEvent(new CustomEvent("sheepit:cursor", { detail: p }))
    const g = gesture.current
    if (!g) {
      if (tool === "move") setHoverId(topLayerAt(p)?.id ?? null)
      return
    }
    const s = st()
    switch (g.kind) {
      case "pan":
        setPan({ x: g.px + e.clientX - g.sx, y: g.py + e.clientY - g.sy })
        if (!s.zoom) s.setZoom(z)
        break
      case "pinch": {
        if (pointers.current.size < 2) break
        const [a, b] = [...pointers.current.values()]
        zoomAt(g.z0 * (Math.hypot(a.x - b.x, a.y - b.y) / g.d0), g.mid.x, g.mid.y)
        break
      }
      case "move": {
        let dx = p.x - g.start.x
        let dy = p.y - g.start.y
        if (!g.moved && Math.hypot(dx, dy) * z < 3) break
        g.moved = true
        if (e.shiftKey) {
          if (Math.abs(dx) > Math.abs(dy)) dy = 0
          else dx = 0
        }
        // smart guides: snap edges/centres to the canvas and other layers (Ctrl disables)
        const ob = layerBounds(g.orig)
        if (ob && !(e.ctrlKey || e.metaKey)) {
          const r = aabb(ob)
          const tol = 6 / z
          const xs = [0, DW / 2, DW]
          const ys = [0, DH / 2, DH]
          for (const o of doc.layers) {
            if (o.id === g.id || !o.visible) continue
            const b2 = layerBounds(o)
            if (!b2 || (o.type === "effect" && o.region === "brush")) continue
            const q = aabb(b2)
            xs.push(q.x, q.x + q.w / 2, q.x + q.w)
            ys.push(q.y, q.y + q.h / 2, q.y + q.h)
          }
          const snap1 = (vals: number[], cands: number[]) => {
            let best: { d: number; at: number } | null = null
            for (const v of vals)
              for (const c of cands) {
                const dd = c - v
                if (Math.abs(dd) < tol && (!best || Math.abs(dd) < Math.abs(best.d))) best = { d: dd, at: c }
              }
            return best
          }
          const sx = snap1([r.x + dx, r.x + r.w / 2 + dx, r.x + r.w + dx], xs)
          const sy = snap1([r.y + dy, r.y + r.h / 2 + dy, r.y + r.h + dy], ys)
          if (sx) dx += sx.d
          if (sy) dy += sy.d
          setGuides({ v: sx ? [sx.at] : [], h: sy ? [sy.at] : [] })
        }
        s.patch((d) => {
          const i = d.layers.findIndex((l) => l.id === g.id)
          if (i < 0) return
          const L = structuredClone(g.orig)
          shiftLayer(L, dx, dy)
          d.layers[i] = L
        }, g.key)
        break
      }
      case "rotate": {
        let a = Math.atan2(p.y - g.center.y, p.x - g.center.x) / DEG + 90
        if (e.shiftKey) a = Math.round(a / 15) * 15
        else {
          const m = ((a % 90) + 90) % 90
          if (m < 2.5 || m > 87.5) a = Math.round(a / 90) * 90
        }
        s.updateLayer(g.id, { rotation: ((a + 540) % 360) - 180 } as Partial<Layer>, g.key)
        break
      }
      case "endpoint": {
        const o = g.orig
        if (o.type !== "shape") break
        if (g.end === 0) s.updateLayer(g.id, { x: p.x, y: p.y, width: o.x + o.width - p.x, height: o.y + o.height - p.y }, g.key)
        else s.updateLayer(g.id, { width: p.x - o.x, height: p.y - o.y }, g.key)
        break
      }
      case "resize": {
        const b = g.box
        const a = b.rotation * DEG
        const c0 = { x: b.x + b.w / 2, y: b.y + b.h / 2 }
        const lp = rot({ x: p.x - c0.x, y: p.y - c0.y }, -a)
        const fromCenter = e.altKey
        const anchor = fromCenter ? { x: 0, y: 0 } : { x: (-g.hx * b.w) / 2, y: (-g.hy * b.h) / 2 }
        const f = fromCenter ? 2 : 1
        let nw = g.hx ? Math.max(4, (lp.x - anchor.x) * g.hx * f) : b.w
        let nh = g.hy ? Math.max(4, (lp.y - anchor.y) * g.hy * f) : b.h
        // Photoshop: proportional by default for images/text, Shift toggles
        if (g.keepAspect !== e.shiftKey) {
          const k = g.hx && g.hy ? Math.max(nw / b.w, nh / b.h) : g.hx ? nw / b.w : nh / b.h
          nw = b.w * k
          nh = b.h * k
        }
        const local = fromCenter
          ? { x: 0, y: 0 }
          : { x: g.hx ? anchor.x + (g.hx * nw) / 2 : 0, y: g.hy ? anchor.y + (g.hy * nh) / 2 : 0 }
        const wc = rot(local, a)
        const C = { x: c0.x + wc.x, y: c0.y + wc.y }
        const o = g.orig
        if (o.type === "text") {
          const fs = Math.max(4, o.fontSize * (nh / b.h))
          const m = measureText({ ...o, fontSize: fs })
          s.updateLayer(g.id, { fontSize: fs, x: C.x - (m.box.x + m.box.w / 2), y: C.y - (m.box.y + m.box.h / 2) } as Partial<Layer>, g.key)
        } else if (o.type === "image" || o.type === "shape" || o.type === "effect") {
          s.updateLayer(g.id, { x: C.x - nw / 2, y: C.y - nh / 2, width: nw, height: nh } as Partial<Layer>, g.key)
        }
        break
      }
      case "create": {
        let w = Math.abs(p.x - g.start.x)
        let h = Math.abs(p.y - g.start.y)
        if (e.shiftKey) w = h = Math.max(w, h)
        const x = e.altKey ? g.start.x - w : p.x < g.start.x ? g.start.x - w : g.start.x
        const y = e.altKey ? g.start.y - h : p.y < g.start.y ? g.start.y - h : g.start.y
        if (e.altKey) {
          w *= 2
          h *= 2
        }
        const kind = s.shapeKind
        const line = g.what === "shape" && (kind === "line" || kind === "arrow")
        if (!g.id) {
          if (w * z < 4 && h * z < 4) break
          let l: Layer
          if (g.what === "effect") {
            l = newEffect(privacy.effect, privacy.region === "ellipse" ? "ellipse" : "rect", x, y, w, h, Math.min(DW, DH))
          } else {
            const sh = line ? newShape(kind, g.start.x, g.start.y, p.x - g.start.x, p.y - g.start.y) : newShape(kind, x, y, w, h)
            const style = s.shapeStyle
            sh.fill = line ? null : style.fill
            sh.stroke = line ? (style.stroke ?? s.fg) : style.stroke
            sh.strokeWidth = style.strokeWidth
            sh.radius = style.radius
            l = sh
          }
          g.id = l.id
          const idx = s.doc.layers.findIndex((x) => x.id === s.selectedId)
          s.patch((d) => void d.layers.splice(idx < 0 ? d.layers.length : idx + 1, 0, l), g.key)
          s.select(l.id)
        } else if (line) {
          s.updateLayer(g.id, { x: g.start.x, y: g.start.y, width: p.x - g.start.x, height: p.y - g.start.y } as Partial<Layer>, g.key)
        } else s.updateLayer(g.id, { x, y, width: w, height: h } as Partial<Layer>, g.key)
        break
      }
      case "gradient": {
        let q = p
        if (e.shiftKey) {
          // snap to 45° steps
          const ang = Math.round(Math.atan2(p.y - g.start.y, p.x - g.start.x) / (Math.PI / 4)) * (Math.PI / 4)
          const len = Math.hypot(p.x - g.start.x, p.y - g.start.y)
          q = { x: g.start.x + Math.cos(ang) * len, y: g.start.y + Math.sin(ang) * len }
        }
        s.updateLayer(g.id, { x2: q.x, y2: q.y } as Partial<Layer>, g.key)
        break
      }
      case "heal": {
        if (Math.hypot(p.x - g.last.x, p.y - g.last.y) < 1.5 / z) break
        g.last = p
        g.stroke.points.push(p.x, p.y)
        setHealPts({ ...g.stroke, points: [...g.stroke.points] })
        break
      }
      case "paint": {
        let q = p
        if (Math.hypot(q.x - g.last.x, q.y - g.last.y) < 1.5 / z) break
        g.last = q
        q = { x: q.x, y: q.y }
        s.patch((d) => {
          let list: Stroke[] | undefined
          if (g.into === "base") list = d.baseMask
          else {
            const L = d.layers.find((x) => x.id === g.target)
            if (!L) return
            list = g.into === "mask" ? L.mask : L.type === "draw" || L.type === "effect" ? L.strokes : undefined
          }
          list?.[list.length - 1]?.points.push(q.x, q.y)
        }, g.key)
        break
      }
      case "select": {
        const dx = p.x - g.start.x
        const dy = p.y - g.start.y
        if (!g.moved && Math.hypot(dx, dy) * z < 3) break
        g.moved = true
        if (selectMode === "lasso") {
          g.points.push(p.x, p.y)
          setLasso([...g.points])
        } else {
          let w = Math.abs(dx)
          let h = Math.abs(dy)
          if (e.shiftKey) w = h = Math.max(w, h)
          let x = dx < 0 ? g.start.x - w : g.start.x
          let y = dy < 0 ? g.start.y - h : g.start.y
          if (e.altKey) {
            x = g.start.x - w
            y = g.start.y - h
            w *= 2
            h *= 2
          }
          s.setSelection({ kind: selectMode, x, y, w, h })
        }
        break
      }
      case "moveSelection": {
        const dx = p.x - g.start.x
        const dy = p.y - g.start.y
        const o = g.orig
        if (o.kind === "lasso") s.setSelection({ ...o, points: o.points.map((v, i) => v + (i % 2 ? dy : dx)) })
        else s.setSelection({ ...o, x: o.x + dx, y: o.y + dy })
        break
      }
      case "crop": {
        const dx = (p.x - g.start.x) / DW
        const dy = (p.y - g.start.y) / DH
        const o = g.orig
        let r = { ...o }
        if (g.mode === "move") {
          r.x = Math.min(1 - o.w, Math.max(0, o.x + dx))
          r.y = Math.min(1 - o.h, Math.max(0, o.y + dy))
        } else {
          let x0 = o.x, y0 = o.y, x1 = o.x + o.w, y1 = o.y + o.h
          if (g.hx < 0) x0 = Math.min(x1 - 0.02, Math.max(0, o.x + dx))
          if (g.hx > 0) x1 = Math.max(x0 + 0.02, Math.min(1, o.x + o.w + dx))
          if (g.hy < 0) y0 = Math.min(y1 - 0.02, Math.max(0, o.y + dy))
          if (g.hy > 0) y1 = Math.max(y0 + 0.02, Math.min(1, o.y + o.h + dy))
          r = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
          const asp = s.crop.aspect
          if (asp) {
            const wpx = r.w * DW
            const hpx = r.h * DH
            if (g.hx !== 0 && (g.hy === 0 || wpx / hpx > asp)) r.h = wpx / asp / DH
            else r.w = (hpx * asp) / DW
            if (g.hx < 0) r.x = x1 - r.w
            if (g.hy < 0) r.y = y1 - r.h
            if (g.hy === 0) r.y = o.y + o.h / 2 - r.h / 2
            if (g.hx === 0) r.x = o.x + o.w / 2 - r.w / 2
            if (r.w > 1) { r.h /= r.w; r.w = 1 }
            if (r.h > 1) { r.w /= r.h; r.h = 1 }
            r.x = Math.min(1 - r.w, Math.max(0, r.x))
            r.y = Math.min(1 - r.h, Math.max(0, r.y))
          }
        }
        s.setCrop({ rect: r })
        break
      }
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    const g = gesture.current
    if (g?.kind === "pinch" && pointers.current.size === 1) {
      gesture.current = null
      return
    }
    if (g?.kind === "paint") lastPaintPoint = g.last
    if (g?.kind === "move") setGuides({ v: [], h: [] })
    if (g?.kind === "gradient") setDragTool(null)
    if (g?.kind === "heal") {
      const st = g.stroke
      const id = toast.loading("Repariere …")
      void healStroke(st).then(() => {
        toast.dismiss(id)
        setHealPts(null)
      })
    }
    if (g?.kind === "select") {
      if (!g.moved) st().setSelection(null)
      else if (selectMode === "lasso" && g.points.length >= 6) st().setSelection({ kind: "lasso", points: g.points })
      setLasso(null)
    }
    gesture.current = null
    setPanning(false)
  }

  /** Right-click: brush settings for painting tools, otherwise a menu for what is under the cursor. */
  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    if (cropMode) return
    const s = st()
    if (s.editingText) finishTextEdit()
    const at = { x: e.clientX, y: e.clientY }
    if (tool === "brush" || tool === "eraser") return openContextMenu({ ...at, kind: tool })
    if (tool === "clone" || tool === "heal") return openContextMenu({ ...at, kind: "stamp" })
    if (tool === "privacy" && (privacy.region === "brush" || privacy.erase)) return openContextMenu({ ...at, kind: "privacy-brush" })
    const p = toDoc(e.clientX, e.clientY)
    if (selection && (tool === "select" || (!selection.inverted && pointInPoly(p, selectionPolygon(selection))) || selection.inverted))
      return openContextMenu({ ...at, kind: "selection" })
    const under = topLayerAt(p)
    if (under) {
      s.select(under.id)
      return openContextMenu({ ...at, kind: "layer" })
    }
    if (doc.baseAssetId) {
      s.select(BASE_ID)
      return openContextMenu({ ...at, kind: "base" })
    }
    openContextMenu({ ...at, kind: "canvas" })
  }

  const onDoubleClick = (e: React.MouseEvent) => {
    if (tool !== "move" && tool !== "text") return
    const p = toDoc(e.clientX, e.clientY)
    const under = topLayerAt(p, (l) => l.type === "text")
    if (under) {
      st().select(under.id)
      st().setEditingText(under.id)
    }
  }

  const hs = 9 / z
  const isBrushTool =
    tool === "brush" || tool === "eraser" || tool === "clone" || tool === "heal" || (tool === "privacy" && (privacy.region === "brush" || privacy.erase))
  const brushPx =
    tool === "brush" ? brush.size : tool === "eraser" ? eraser.size : tool === "clone" || tool === "heal" ? stamp.size : privacy.brushSize
  const brushR = brushPx / z / 2
  const cursorClass = panning
    ? "cursor-grabbing"
    : spaceDown || tool === "hand"
      ? "cursor-grab"
      : tool === "zoom"
        ? altDown
          ? "cursor-zoom-out"
          : "cursor-zoom-in"
        : tool === "eyedropper" || (altDown && (tool === "brush" || tool === "text" || tool === "shapes" || tool === "bucket"))
          ? "cursor-copy"
          : isBrushTool
            ? "cursor-none"
            : tool === "text"
              ? "cursor-text"
              : tool === "select" || tool === "privacy" || tool === "shapes" || tool === "crop" || tool === "gradient" || tool === "bucket"
                ? "cursor-crosshair"
                : "cursor-default"

  const editLayer = doc.layers.find((l) => l.id === editingText && l.type === "text") as TextLayer | undefined
  const hover = tool === "move" && hoverId && hoverId !== selectedId ? doc.layers.find((l) => l.id === hoverId) : null
  const hoverBox = hover ? layerBounds(hover) : null
  const selPoly = selection ? selectionPolygon(selection) : null

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden touch-none select-none", cursorClass, className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => {
        setCursor(null)
        setHoverId(null)
      }}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      data-viewport
    >
      <div
        ref={stageRef}
        className="absolute top-1/2 left-1/2 origin-center"
        style={{
          width: DW,
          height: DH,
          transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${z})`,
          // hidden until the viewport has been measured (avoids a 100 % flash)
          visibility: box.w ? "visible" : "hidden",
        }}
      >
        <div className="checkerboard absolute inset-0 shadow-[0_30px_80px_-20px_rgba(0,0,0,.7)]" />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 size-full"
          style={{ imageRendering: z * renderScale > 2 ? "pixelated" : "auto" }}
        />
        <svg className="absolute inset-0 size-full overflow-visible" viewBox={`0 0 ${DW} ${DH}`} style={{ pointerEvents: "none" }}>
          {/* privacy regions: thin outlines only (no transform box) */}
          {tool === "privacy" &&
            !cropMode &&
            doc.layers
              .filter((l) => l.type === "effect" && l.visible && l.region !== "brush")
              .map((l) => {
                const b = layerBounds(l)!
                const active = l.id === selectedId
                return (
                  <rect
                    key={l.id}
                    x={b.x}
                    y={b.y}
                    width={Math.abs(b.w)}
                    height={Math.abs(b.h)}
                    rx={l.type === "effect" && l.region === "ellipse" ? Math.abs(b.w) / 2 : 0}
                    fill="none"
                    stroke={active ? "var(--lime)" : "white"}
                    strokeOpacity={active ? 0.9 : 0.35}
                    strokeDasharray={`${4 / z} ${4 / z}`}
                    strokeWidth={1.2 / z}
                  />
                )
              })}

          {hoverBox && (
            <g transform={`rotate(${hoverBox.rotation} ${hoverBox.x + hoverBox.w / 2} ${hoverBox.y + hoverBox.h / 2})`}>
              <rect x={hoverBox.x} y={hoverBox.y} width={Math.abs(hoverBox.w)} height={Math.abs(hoverBox.h)} fill="none" stroke="#3b9dff" strokeWidth={1.5 / z} />
            </g>
          )}

          {selBox && selected && <SelectionHandles layer={selected} b={selBox} hs={hs} z={z} />}

          {cropMode && crop.rect && <CropOverlay rect={crop.rect} W={DW} H={DH} hs={hs} z={z} />}

          {showGrid && !cropMode && <Grid W={DW} H={DH} z={z} />}

          {selPoly && !cropMode && <MarchingAnts points={selPoly} z={z} inverted={!!selection?.inverted} W={DW} H={DH} />}

          {/* smart guides */}
          {guides.v.map((x) => (
            <line key={`v${x}`} x1={x} y1={-1e4} x2={x} y2={1e4} stroke="#ff3bd4" strokeWidth={1 / z} />
          ))}
          {guides.h.map((y) => (
            <line key={`h${y}`} x1={-1e4} y1={y} x2={1e4} y2={y} stroke="#ff3bd4" strokeWidth={1 / z} />
          ))}

          {/* healing stroke preview */}
          {healPts && (
            <path
              d={healPts.points.reduce((acc, v, i) => (i % 2 ? acc + ` ${v}` : acc + `${i ? "L" : "M"}${v}`), "")}
              fill="none"
              stroke="#ff4d6d"
              strokeOpacity={0.45}
              strokeWidth={healPts.size}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* gradient direction while dragging */}
          {tool === "gradient" && selected?.type === "fill" && selected.fill !== "solid" && dragTool === "gradient" && (
            <g>
              <line x1={selected.x1} y1={selected.y1} x2={selected.x2} y2={selected.y2} stroke="black" strokeOpacity={0.5} strokeWidth={3 / z} />
              <line x1={selected.x1} y1={selected.y1} x2={selected.x2} y2={selected.y2} stroke="white" strokeWidth={1.25 / z} />
              <circle cx={selected.x1} cy={selected.y1} r={4 / z} fill="white" />
            </g>
          )}

          {/* clone source crosshair */}
          {tool === "clone" && (cloneOffset && cursor ? { x: cursor.x + cloneOffset.dx, y: cursor.y + cloneOffset.dy } : cloneSource) && (() => {
            const c = cloneOffset && cursor ? { x: cursor.x + cloneOffset.dx, y: cursor.y + cloneOffset.dy } : cloneSource!
            const r = brushR
            return (
              <g>
                <circle cx={c.x} cy={c.y} r={r} fill="none" stroke="white" strokeDasharray={`${3 / z} ${3 / z}`} strokeWidth={1 / z} />
                <line x1={c.x - r * 0.4} y1={c.y} x2={c.x + r * 0.4} y2={c.y} stroke="white" strokeWidth={1 / z} />
                <line x1={c.x} y1={c.y - r * 0.4} x2={c.x} y2={c.y + r * 0.4} stroke="white" strokeWidth={1 / z} />
              </g>
            )
          })()}
          {lasso && lasso.length >= 4 && <MarchingAnts points={lasso} z={z} open />}

          {isBrushTool && cursor && !panning && (
            <g>
              <circle cx={cursor.x} cy={cursor.y} r={brushR} fill="none" stroke="black" strokeOpacity={0.6} strokeWidth={3 / z} />
              <circle cx={cursor.x} cy={cursor.y} r={brushR} fill="none" stroke="white" strokeWidth={1.25 / z} />
              {tool === "brush" && brush.hardness < 0.95 && (
                <circle cx={cursor.x} cy={cursor.y} r={brushR * (0.35 + 0.65 * brush.hardness)} fill="none" stroke="white" strokeOpacity={0.5} strokeDasharray={`${2 / z} ${2 / z}`} strokeWidth={1 / z} />
              )}
            </g>
          )}
        </svg>

        {editLayer && <InlineTextEditor layer={editLayer} />}
      </div>
    </div>
  )
}

function Grid({ W, H, z }: { W: number; H: number; z: number }) {
  // ~ 8 cells across the short side, rounded to a "nice" step
  const raw = Math.min(W, H) / 8
  const p = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 5, 10].map((m) => m * p).find((v) => v >= raw) ?? raw
  const lines: React.ReactNode[] = []
  for (let x = step; x < W; x += step) lines.push(<line key={`x${x}`} x1={x} y1={0} x2={x} y2={H} />)
  for (let y = step; y < H; y += step) lines.push(<line key={`y${y}`} x1={0} y1={y} x2={W} y2={y} />)
  return (
    <g stroke="white" strokeOpacity={0.22} strokeWidth={1 / z}>
      {lines}
    </g>
  )
}

function MarchingAnts({ points, z, open, inverted, W, H }: { points: number[]; z: number; open?: boolean; inverted?: boolean; W?: number; H?: number }) {
  let d = `M${points[0]} ${points[1]}`
  for (let i = 2; i < points.length; i += 2) d += `L${points[i]} ${points[i + 1]}`
  if (!open) d += "Z"
  const dash = `${5 / z} ${5 / z}`
  return (
    <g>
      {inverted && W && H && (
        <rect x={0} y={0} width={W} height={H} fill="none" stroke="white" strokeWidth={1 / z} strokeDasharray={dash} className="sheepit-ants" />
      )}
      <path d={d} fill="none" stroke="black" strokeWidth={1.2 / z} />
      <path d={d} fill="none" stroke="white" strokeWidth={1.2 / z} strokeDasharray={dash} className="sheepit-ants" style={{ ["--ants" as string]: `${10 / z}px` }} />
    </g>
  )
}

function SelectionHandles({ layer, b, hs, z }: { layer: Layer; b: Box; hs: number; z: number }) {
  const cx = b.x + b.w / 2
  const cy = b.y + b.h / 2
  const sw = 1.5 / z
  if (layer.type === "shape" && (layer.shape === "line" || layer.shape === "arrow")) {
    const pts = [
      { x: layer.x, y: layer.y, h: "end0" },
      { x: layer.x + layer.width, y: layer.y + layer.height, h: "end1" },
    ]
    return (
      <g>
        <line x1={pts[0].x} y1={pts[0].y} x2={pts[1].x} y2={pts[1].y} stroke="#3b9dff" strokeWidth={sw} />
        {pts.map((p) => (
          <circle key={p.h} data-handle={p.h} cx={p.x} cy={p.y} r={hs * 0.6} fill="white" stroke="#3b9dff" strokeWidth={sw} style={{ pointerEvents: "all", cursor: "move" }} />
        ))}
      </g>
    )
  }
  const resizable = layer.type === "image" || layer.type === "shape" || layer.type === "text" || (layer.type === "effect" && layer.region !== "brush")
  const rotatable = layer.type === "image" || layer.type === "shape" || layer.type === "text"
  const handles: [number, number][] = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]]
  const cursors: Record<string, string> = {
    "-1,-1": "nwse-resize", "1,1": "nwse-resize", "1,-1": "nesw-resize", "-1,1": "nesw-resize",
    "0,-1": "ns-resize", "0,1": "ns-resize", "-1,0": "ew-resize", "1,0": "ew-resize",
  }
  const w = Math.abs(b.w)
  const h = Math.abs(b.h)
  return (
    <g transform={`rotate(${b.rotation} ${cx} ${cy})`}>
      <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} fill="none" stroke="#3b9dff" strokeWidth={sw} />
      {rotatable && (
        <>
          <line x1={cx} y1={cy - h / 2} x2={cx} y2={cy - h / 2 - 24 / z} stroke="#3b9dff" strokeWidth={sw} />
          <circle data-handle="rotate" cx={cx} cy={cy - h / 2 - 24 / z} r={hs * 0.6} fill="white" stroke="#3b9dff" strokeWidth={sw} style={{ pointerEvents: "all", cursor: "grab" }} />
        </>
      )}
      {resizable &&
        handles.map(([hx, hy]) => (
          <rect
            key={`${hx},${hy}`}
            data-handle={`${hx},${hy}`}
            x={cx + (hx * w) / 2 - hs / 2}
            y={cy + (hy * h) / 2 - hs / 2}
            width={hs}
            height={hs}
            fill="white"
            stroke="#3b9dff"
            strokeWidth={sw}
            style={{ pointerEvents: "all", cursor: cursors[`${hx},${hy}`] }}
          />
        ))}
    </g>
  )
}

function CropOverlay({ rect, W, H, hs, z }: { rect: { x: number; y: number; w: number; h: number }; W: number; H: number; hs: number; z: number }) {
  const x = rect.x * W
  const y = rect.y * H
  const w = rect.w * W
  const h = rect.h * H
  const sw = 1.5 / z
  const L = Math.min(w, h) * 0.12
  const corners: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
  const edges: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]]
  const pos = (hx: number, hy: number) => ({ x: x + ((hx + 1) / 2) * w, y: y + ((hy + 1) / 2) * h })
  return (
    <g>
      <path d={`M0 0H${W}V${H}H0Z M${x} ${y}V${y + h}H${x + w}V${y}Z`} fill="rgba(8,8,10,.62)" fillRule="evenodd" />
      <rect x={x} y={y} width={w} height={h} fill="none" stroke="white" strokeWidth={sw} style={{ pointerEvents: "all", cursor: "move" }} />
      {[1, 2].map((i) => (
        <g key={i} stroke="white" strokeOpacity={0.45} strokeWidth={sw * 0.7}>
          <line x1={x + (w * i) / 3} y1={y} x2={x + (w * i) / 3} y2={y + h} />
          <line x1={x} y1={y + (h * i) / 3} x2={x + w} y2={y + (h * i) / 3} />
        </g>
      ))}
      {corners.map(([hx, hy]) => {
        const p = pos(hx, hy)
        return (
          <g key={`${hx}${hy}`}>
            <path d={`M${p.x} ${p.y - hy * L}V${p.y}H${p.x - hx * L}`} fill="none" stroke="white" strokeWidth={4 / z} />
            <rect data-handle={`${hx},${hy}`} x={p.x - hs * 1.2} y={p.y - hs * 1.2} width={hs * 2.4} height={hs * 2.4} fill="transparent" style={{ pointerEvents: "all", cursor: hx === hy ? "nwse-resize" : "nesw-resize" }} />
          </g>
        )
      })}
      {edges.map(([hx, hy]) => {
        const p = pos(hx, hy)
        const horiz = hy !== 0
        return (
          <rect
            key={`${hx}${hy}`}
            data-handle={`${hx},${hy}`}
            x={p.x - (horiz ? hs * 1.6 : hs * 0.5)}
            y={p.y - (horiz ? hs * 0.5 : hs * 1.6)}
            width={horiz ? hs * 3.2 : hs}
            height={horiz ? hs : hs * 3.2}
            rx={hs * 0.4}
            fill="white"
            style={{ pointerEvents: "all", cursor: horiz ? "ns-resize" : "ew-resize" }}
          />
        )
      })}
    </g>
  )
}

/** On-canvas text editing – type directly into the image (Photoshop style). */
function InlineTextEditor({ layer }: { layer: TextLayer }) {
  const ref = React.useRef<HTMLTextAreaElement>(null)
  const m = measureText({ ...layer, text: layer.text || " " })
  React.useEffect(() => {
    const t = ref.current
    if (!t) return
    const id = requestAnimationFrame(() => {
      t.focus()
      t.setSelectionRange(t.value.length, t.value.length)
    })
    return () => cancelAnimationFrame(id)
  }, [layer.id])
  const width = Math.max(m.w, layer.fontSize * 0.6) + layer.fontSize * 0.6
  const left = layer.align === "left" ? layer.x : layer.align === "center" ? layer.x - width / 2 : layer.x - width
  const cx = m.box.x + m.box.w / 2
  const cy = m.box.y + m.box.h / 2
  return (
    <textarea
      ref={ref}
      value={layer.text}
      spellCheck={false}
      placeholder="Text eingeben"
      onPointerDown={(e) => e.stopPropagation()}
      onChange={(e) => useEditor.getState().updateLayer(layer.id, { text: e.target.value }, `text:${layer.id}`)}
      onBlur={() => finishTextEdit()}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) {
          e.preventDefault()
          finishTextEdit()
        }
      }}
      className="absolute resize-none overflow-hidden border-0 bg-transparent p-0 whitespace-pre outline-1 outline-offset-2 outline-[#3b9dff] placeholder:text-white/40"
      style={{
        left,
        top: layer.y,
        width,
        height: m.h + 2,
        font: textFont(layer),
        fontFamily: fontFamilyFor(layer.fontFamily),
        lineHeight: `${layer.fontSize * layer.lineHeight}px`,
        letterSpacing: `${layer.letterSpacing}px`,
        textAlign: layer.align,
        color: layer.color,
        textTransform: layer.uppercase ? "uppercase" : "none",
        transformOrigin: `${layer.x - left + cx}px ${cy}px`,
        transform: `rotate(${layer.rotation}deg)`,
        caretColor: layer.color,
        opacity: layer.opacity,
        textShadow: layer.shadow ? "0 2px 12px rgba(0,0,0,.45)" : undefined,
        WebkitTextStroke: layer.strokeColor && layer.strokeWidth ? `${layer.strokeWidth}px ${layer.strokeColor}` : undefined,
        background: layer.background ?? "transparent",
      }}
    />
  )
}
