"use client"

import * as React from "react"
import { useEditor } from "@/lib/editor/store"
import { docSize, layerBounds, measureText, renderDoc, rotatedSize, textFont } from "@/lib/editor/render"
import { newDraw, newEffect, newShape, newText, uid } from "@/lib/editor/defaults"
import { ensureFont, fontFamilyFor } from "@/lib/editor/fonts"
import type { Layer, SheepDoc, TextLayer } from "@/lib/editor/types"
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

type Gesture =
  | { kind: "pan"; sx: number; sy: number; px: number; py: number }
  | { kind: "pinch"; d0: number; z0: number; mid: Pt }
  | { kind: "move"; id: string; start: Pt; orig: Layer; key: string }
  | { kind: "resize"; id: string; hx: number; hy: number; orig: Layer; box: Box; key: string; keepAspect: boolean }
  | { kind: "endpoint"; id: string; end: 0 | 1; orig: Layer; key: string }
  | { kind: "rotate"; id: string; center: Pt; orig: Layer; key: string }
  | { kind: "create"; id: string | null; start: Pt; key: string; what: "effect" | "shape" }
  | { kind: "brush"; id: string; key: string; last: Pt }
  | { kind: "crop"; mode: "move" | "resize"; hx: number; hy: number; start: Pt; orig: { x: number; y: number; w: number; h: number } }

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
  const drawSet = useEditor((s) => s.draw)

  const containerRef = React.useRef<HTMLDivElement>(null)
  const stageRef = React.useRef<HTMLDivElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const gesture = React.useRef<Gesture | null>(null)
  const pointers = React.useRef(new Map<number, Pt>())
  const [pan, setPan] = React.useState({ x: 0, y: 0 })
  const [box, setBox] = React.useState({ w: 0, h: 0 })
  const [spaceDown, setSpaceDown] = React.useState(false)
  const [cursor, setCursor] = React.useState<Pt | null>(null)
  const [panning, setPanning] = React.useState(false)

  const cropMode = tool === "crop" && !!doc.baseAssetId
  const viewDoc: SheepDoc = React.useMemo(
    () =>
      cropMode
        ? { ...doc, geometry: { ...doc.geometry, crop: { x: 0, y: 0, w: 1, h: 1 } }, layers: [] }
        : doc,
    [doc, cropMode],
  )
  const { w: DW, h: DH } = docSize(viewDoc)

  // container size
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
    Promise.all(texts.map((t) => ensureFont(t.fontFamily, t.fontWeight, t.italic))).then(() =>
      useEditor.getState().bump(),
    )
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
      renderDoc(viewDoc, assets, { scale: renderScale, original: compare, hide, cacheBase: true }, c)
      window.dispatchEvent(new Event("sheepit:rendered"))
    })
    return () => cancelAnimationFrame(id)
  }, [viewDoc, assets, compare, renderScale, renderTick, editingText])

  // space to pan
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target as HTMLElement).closest("input,textarea,[contenteditable]")) {
        setSpaceDown(true)
        e.preventDefault()
      }
    }
    const up = (e: KeyboardEvent) => e.code === "Space" && setSpaceDown(false)
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
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

  // wheel: ctrl/cmd = zoom, otherwise pan (trackpads)
  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        const f = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0022))
        zoomAt(z * f, e.clientX, e.clientY)
      } else {
        setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }))
        if (!useEditor.getState().zoom) useEditor.getState().setZoom(z)
      }
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [z, zoomAt])

  const selected = doc.layers.find((l) => l.id === selectedId) ?? null
  const selBox = selected && !cropMode ? layerBounds(selected) : null

  const topLayerAt = (p: Pt, filter?: (l: Layer) => boolean) => {
    for (let i = doc.layers.length - 1; i >= 0; i--) {
      const l = doc.layers[i]
      if (!l.visible || l.locked || (filter && !filter(l))) continue
      const b = layerBounds(l)
      if (b && hit(b, p, 4 / z)) return l
    }
    return null
  }

  const st = useEditor.getState

  const onPointerDown = (e: React.PointerEvent) => {
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      gesture.current = {
        kind: "pinch",
        d0: Math.hypot(a.x - b.x, a.y - b.y),
        z0: z,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      }
      return
    }
    if (e.button === 1 || spaceDown || (e.button === 0 && (e.target as HTMLElement) === containerRef.current && tool !== "privacy" && tool !== "draw")) {
      gesture.current = { kind: "pan", sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y }
      setPanning(true)
      return
    }
    if (e.button !== 0) return
    const p = toDoc(e.clientX, e.clientY)
    const target = (e.target as HTMLElement).dataset
    const s = st()

    if (cropMode && crop.rect) {
      const R = { w: DW, h: DH }
      const orig = { ...crop.rect }
      if (target.handle) {
        const [hx, hy] = target.handle.split(",").map(Number)
        gesture.current = { kind: "crop", mode: "resize", hx, hy, start: p, orig }
      } else {
        const r = { x: orig.x * R.w, y: orig.y * R.h, w: orig.w * R.w, h: orig.h * R.h }
        if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h)
          gesture.current = { kind: "crop", mode: "move", hx: 0, hy: 0, start: p, orig }
      }
      return
    }

    // handles on selected layer
    if (target.handle && selected) {
      const key = `g:${uid()}`
      if (target.handle === "rotate") {
        const b = layerBounds(selected)!
        gesture.current = { kind: "rotate", id: selected.id, center: { x: b.x + b.w / 2, y: b.y + b.h / 2 }, orig: selected, key }
      } else if (target.handle.startsWith("end")) {
        gesture.current = { kind: "endpoint", id: selected.id, end: target.handle === "end0" ? 0 : 1, orig: selected, key }
      } else {
        const [hx, hy] = target.handle.split(",").map(Number)
        gesture.current = {
          kind: "resize",
          id: selected.id,
          hx,
          hy,
          orig: selected,
          box: layerBounds(selected)!,
          key,
          keepAspect: selected.type === "image" || selected.type === "text" ? hx !== 0 && hy !== 0 : e.shiftKey,
        }
      }
      return
    }

    // tool-specific creation
    if (tool === "privacy" && (privacy.region === "brush" || privacy.erase)) {
      const size = privacy.brushSize / z
      const key = `g:${uid()}`
      let layer =
        selected?.type === "effect" && selected.region === "brush" ? selected : null
      if (!layer) {
        if (privacy.erase) return
        const l = newEffect(privacy.effect, "brush", 0, 0, 0, 0, Math.min(DW, DH))
        l.invert = !!privacy.invert
        if (l.invert) l.feather = Math.round(Math.min(DW, DH) * 0.02)
        l.strokes = [{ points: [p.x, p.y], size }]
        s.patch((d) => void d.layers.push(l), key)
        s.select(l.id)
        layer = l
      } else {
        const id = layer.id
        s.patch((d) => {
          const L = d.layers.find((x) => x.id === id)
          if (L?.type === "effect") L.strokes.push({ points: [p.x, p.y], size, erase: privacy.erase })
        }, key)
      }
      gesture.current = { kind: "brush", id: layer.id, key, last: p }
      return
    }
    if (tool === "draw") {
      const size = drawSet.size / z
      const key = `g:${uid()}`
      let layer = selected?.type === "draw" ? selected : null
      if (!layer) {
        if (drawSet.erase) return
        const l = newDraw()
        l.strokes = [{ points: [p.x, p.y], size, color: drawSet.color }]
        s.patch((d) => void d.layers.push(l), key)
        s.select(l.id)
        layer = l
      } else {
        const id = layer.id
        s.patch((d) => {
          const L = d.layers.find((x) => x.id === id)
          if (L?.type === "draw") L.strokes.push({ points: [p.x, p.y], size, color: drawSet.color, erase: drawSet.erase })
        }, key)
      }
      gesture.current = { kind: "brush", id: layer.id, key, last: p }
      return
    }

    const under = topLayerAt(p)
    if (tool === "text") {
      if (under?.type === "text") {
        s.select(under.id)
        gesture.current = { kind: "move", id: under.id, start: p, orig: under, key: `g:${uid()}` }
        return
      }
      // keep the browser from moving focus away from the inline editor we are about to mount
      e.preventDefault()
      const t = newText(p.x, p.y, Math.round(Math.max(24, Math.min(DW, DH) * 0.08)))
      t.y -= (t.fontSize * t.lineHeight) / 2
      s.addLayer(t)
      s.setEditingText(t.id)
      return
    }
    if ((tool === "privacy" || tool === "shapes") && !(under && under.id === selectedId)) {
      // clicking an existing effect/shape selects & moves it, otherwise draw a new region
      const sameKind = under && ((tool === "privacy" && under.type === "effect") || (tool === "shapes" && under.type === "shape"))
      if (!sameKind) {
        s.select(null)
        gesture.current = { kind: "create", id: null, start: p, key: `g:${uid()}`, what: tool === "privacy" ? "effect" : "shape" }
        return
      }
    }
    if (under) {
      s.select(under.id)
      if (s.editingText && s.editingText !== under.id) s.setEditingText(null)
      gesture.current = { kind: "move", id: under.id, start: p, orig: under, key: `g:${uid()}` }
    } else {
      s.select(null)
      s.setEditingText(null)
      gesture.current = { kind: "pan", sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y }
      setPanning(true)
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const p = stageRef.current ? toDoc(e.clientX, e.clientY) : null
    if (p && (tool === "privacy" || tool === "draw")) setCursor(p)
    const g = gesture.current
    if (!g || !p) return
    const s = st()
    switch (g.kind) {
      case "pan":
        setPan({ x: g.px + e.clientX - g.sx, y: g.py + e.clientY - g.sy })
        if (!s.zoom) s.setZoom(z)
        break
      case "pinch": {
        if (pointers.current.size < 2) break
        const [a, b] = [...pointers.current.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        zoomAt(g.z0 * (d / g.d0), g.mid.x, g.mid.y)
        break
      }
      case "move": {
        const dx = p.x - g.start.x
        const dy = p.y - g.start.y
        s.patch((d) => {
          const i = d.layers.findIndex((l) => l.id === g.id)
          if (i < 0) return
          const L = structuredClone(g.orig)
          if ("x" in L) {
            L.x += dx
            L.y += dy
          }
          if (L.type === "effect" || L.type === "draw")
            for (const stx of L.strokes) for (let k = 0; k < stx.points.length; k += 2) {
              stx.points[k] += dx
              stx.points[k + 1] += dy
            }
          d.layers[i] = L
        }, g.key)
        break
      }
      case "rotate": {
        let a = Math.atan2(p.y - g.center.y, p.x - g.center.x) / DEG + 90
        if (e.shiftKey) a = Math.round(a / 15) * 15
        else if (Math.abs(((a % 90) + 90) % 90) < 2.5 || Math.abs(((a % 90) + 90) % 90) > 87.5) a = Math.round(a / 90) * 90
        s.updateLayer(g.id, { rotation: ((a + 540) % 360) - 180 } as Partial<Layer>, g.key)
        break
      }
      case "endpoint": {
        const o = g.orig
        if (o.type !== "shape") break
        if (g.end === 0)
          s.updateLayer(g.id, { x: p.x, y: p.y, width: o.x + o.width - p.x, height: o.y + o.height - p.y }, g.key)
        else s.updateLayer(g.id, { width: p.x - o.x, height: p.y - o.y }, g.key)
        break
      }
      case "resize": {
        const b = g.box
        const a = b.rotation * DEG
        const c0 = { x: b.x + b.w / 2, y: b.y + b.h / 2 }
        const lp = rot({ x: p.x - c0.x, y: p.y - c0.y }, -a)
        const anchor = { x: (-g.hx * b.w) / 2, y: (-g.hy * b.h) / 2 }
        let nw = g.hx ? Math.max(4, (lp.x - anchor.x) * g.hx) : b.w
        let nh = g.hy ? Math.max(4, (lp.y - anchor.y) * g.hy) : b.h
        if (g.keepAspect || e.shiftKey) {
          const k = Math.max(nw / b.w, nh / b.h)
          nw = b.w * k
          nh = b.h * k
        }
        // new centre in local space (edge handles keep the other axis centred)
        const local = {
          x: g.hx ? anchor.x + (g.hx * nw) / 2 : 0,
          y: g.hy ? anchor.y + (g.hy * nh) / 2 : 0,
        }
        const wc = rot(local, a)
        const C = { x: c0.x + wc.x, y: c0.y + wc.y }
        const o = g.orig
        if (o.type === "text") {
          const k = nh / b.h
          const fs = Math.max(4, o.fontSize * k)
          const m = measureText({ ...o, fontSize: fs })
          const cx = m.box.x + m.box.w / 2
          const cy = m.box.y + m.box.h / 2
          s.updateLayer(g.id, { fontSize: fs, x: C.x - cx, y: C.y - cy } as Partial<Layer>, g.key)
        } else if (o.type === "image" || o.type === "shape" || o.type === "effect") {
          s.updateLayer(g.id, { x: C.x - nw / 2, y: C.y - nh / 2, width: nw, height: nh } as Partial<Layer>, g.key)
        }
        break
      }
      case "create": {
        const x = Math.min(g.start.x, p.x)
        const y = Math.min(g.start.y, p.y)
        let w = Math.abs(p.x - g.start.x)
        let h = Math.abs(p.y - g.start.y)
        if (e.shiftKey) w = h = Math.max(w, h)
        if (!g.id) {
          if (w * z < 4 && h * z < 4) break
          if (g.what === "effect") {
            const l = newEffect(privacy.effect, privacy.region === "ellipse" ? "ellipse" : "rect", x, y, w, h, Math.min(DW, DH))
            g.id = l.id
            s.patch((d) => void d.layers.push(l), g.key)
            s.select(l.id)
          } else {
            const kind = s.shapeKind
            const l =
              kind === "line" || kind === "arrow"
                ? newShape(kind, g.start.x, g.start.y, p.x - g.start.x, p.y - g.start.y)
                : newShape(kind, x, y, w, h)
            l.strokeWidth = Math.max(3, Math.round(Math.min(DW, DH) * 0.008))
            g.id = l.id
            s.patch((d) => void d.layers.push(l), g.key)
            s.select(l.id)
          }
        } else {
          const kind = s.shapeKind
          if (g.what === "shape" && (kind === "line" || kind === "arrow"))
            s.updateLayer(g.id, { x: g.start.x, y: g.start.y, width: p.x - g.start.x, height: p.y - g.start.y } as Partial<Layer>, g.key)
          else s.updateLayer(g.id, { x, y, width: w, height: h } as Partial<Layer>, g.key)
        }
        break
      }
      case "brush": {
        if (Math.hypot(p.x - g.last.x, p.y - g.last.y) < 2 / z) break
        g.last = p
        s.patch((d) => {
          const L = d.layers.find((x) => x.id === g.id)
          if (L && (L.type === "effect" || L.type === "draw")) {
            const stx = L.strokes[L.strokes.length - 1]
            stx.points.push(p.x, p.y)
          }
        }, g.key)
        break
      }
      case "crop": {
        const R = { w: DW, h: DH }
        const dx = (p.x - g.start.x) / R.w
        const dy = (p.y - g.start.y) / R.h
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
            // aspect in px: (w*R.w)/(h*R.h) = asp
            const wpx = r.w * R.w
            const hpx = r.h * R.h
            if (g.hx !== 0 && (g.hy === 0 || wpx / hpx > asp)) {
              r.h = wpx / asp / R.h
            } else {
              r.w = (hpx * asp) / R.w
            }
            if (g.hx < 0) r.x = x1 - r.w
            if (g.hy < 0) r.y = y1 - r.h
            if (g.hy === 0) r.y = o.y + o.h / 2 - r.h / 2
            if (g.hx === 0) r.x = o.x + o.w / 2 - r.w / 2
            // keep inside
            if (r.w > 1) { r.h *= 1 / r.w; r.w = 1 }
            if (r.h > 1) { r.w *= 1 / r.h; r.h = 1 }
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
    gesture.current = null
    setPanning(false)
  }

  const onDoubleClick = (e: React.MouseEvent) => {
    const p = toDoc(e.clientX, e.clientY)
    const under = topLayerAt(p, (l) => l.type === "text")
    if (under) {
      st().select(under.id)
      st().setEditingText(under.id)
    }
  }

  const hs = 9 / z // handle size in doc px
  const isBrushTool = (tool === "privacy" && (privacy.region === "brush" || privacy.erase)) || tool === "draw"
  const brushR = ((tool === "draw" ? drawSet.size : privacy.brushSize) / z) / 2
  const cursorClass = panning
    ? "cursor-grabbing"
    : spaceDown
      ? "cursor-grab"
      : isBrushTool
        ? "cursor-none"
        : tool === "text"
          ? "cursor-text"
          : tool === "privacy" || tool === "shapes"
            ? "cursor-crosshair"
            : "cursor-default"

  const editLayer = doc.layers.find((l) => l.id === editingText && l.type === "text") as TextLayer | undefined
  const R = cropMode ? rotatedSize(doc) : null

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden touch-none select-none", cursorClass, className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => setCursor(null)}
      onDoubleClick={onDoubleClick}
      data-viewport
    >
      <div
        ref={stageRef}
        className="absolute top-1/2 left-1/2 origin-center"
        style={{
          width: DW,
          height: DH,
          transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${z})`,
        }}
      >
        <div className="checkerboard absolute inset-0 shadow-[0_30px_80px_-20px_rgba(0,0,0,.7)]" />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 size-full"
          style={{ imageRendering: z * renderScale > 2 ? "pixelated" : "auto" }}
        />
        <svg
          className="absolute inset-0 size-full overflow-visible"
          viewBox={`0 0 ${DW} ${DH}`}
          style={{ pointerEvents: "none" }}
        >
          {/* hover outlines for effect layers in privacy tool */}
          {tool === "privacy" &&
            !cropMode &&
            doc.layers
              .filter((l) => l.type === "effect" && l.visible && l.id !== selectedId && l.region !== "brush")
              .map((l) => {
                const b = layerBounds(l)!
                return (
                  <rect
                    key={l.id}
                    x={b.x}
                    y={b.y}
                    width={Math.abs(b.w)}
                    height={Math.abs(b.h)}
                    fill="none"
                    stroke="white"
                    strokeOpacity={0.35}
                    strokeDasharray={`${4 / z} ${4 / z}`}
                    strokeWidth={1 / z}
                  />
                )
              })}

          {selBox && selected && !editingText && (
            <SelectionHandles layer={selected} b={selBox} hs={hs} z={z} />
          )}

          {cropMode && crop.rect && R && (
            <CropOverlay rect={crop.rect} W={DW} H={DH} hs={hs} z={z} />
          )}

          {isBrushTool && cursor && (
            <g>
              <circle cx={cursor.x} cy={cursor.y} r={brushR} fill="none" stroke="black" strokeOpacity={0.6} strokeWidth={3 / z} />
              <circle cx={cursor.x} cy={cursor.y} r={brushR} fill="none" stroke="white" strokeWidth={1.25 / z} />
            </g>
          )}
        </svg>

        {editLayer && <InlineTextEditor layer={editLayer} />}
      </div>
    </div>
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
        <line x1={pts[0].x} y1={pts[0].y} x2={pts[1].x} y2={pts[1].y} stroke="var(--lime)" strokeWidth={sw} strokeDasharray={`${4 / z}`} />
        {pts.map((p) => (
          <circle key={p.h} data-handle={p.h} cx={p.x} cy={p.y} r={hs * 0.7} fill="white" stroke="var(--lime)" strokeWidth={sw} style={{ pointerEvents: "all", cursor: "move" }} />
        ))}
      </g>
    )
  }
  const resizable = layer.type === "image" || layer.type === "shape" || layer.type === "text" || (layer.type === "effect" && layer.region !== "brush")
  const rotatable = layer.type === "image" || layer.type === "shape" || layer.type === "text"
  const handles: [number, number][] = layer.type === "text"
    ? [[-1, -1], [1, -1], [1, 1], [-1, 1]]
    : [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]]
  const cursors: Record<string, string> = {
    "-1,-1": "nwse-resize", "1,1": "nwse-resize", "1,-1": "nesw-resize", "-1,1": "nesw-resize",
    "0,-1": "ns-resize", "0,1": "ns-resize", "-1,0": "ew-resize", "1,0": "ew-resize",
  }
  const w = Math.abs(b.w)
  const h = Math.abs(b.h)
  return (
    <g transform={`rotate(${b.rotation} ${cx} ${cy})`}>
      <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} fill="none" stroke="black" strokeOpacity={0.5} strokeWidth={sw * 2.2} />
      <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} fill="none" stroke="var(--lime)" strokeWidth={sw} />
      {rotatable && (
        <>
          <line x1={cx} y1={cy - h / 2} x2={cx} y2={cy - h / 2 - 26 / z} stroke="var(--lime)" strokeWidth={sw} />
          <circle
            data-handle="rotate"
            cx={cx}
            cy={cy - h / 2 - 26 / z}
            r={hs * 0.7}
            fill="var(--lime)"
            stroke="black"
            strokeWidth={sw * 0.6}
            style={{ pointerEvents: "all", cursor: "grab" }}
          />
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
            rx={hs * 0.25}
            fill="white"
            stroke="black"
            strokeOpacity={0.6}
            strokeWidth={sw * 0.8}
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
      <path
        d={`M0 0H${W}V${H}H0Z M${x} ${y}V${y + h}H${x + w}V${y}Z`}
        fill="rgba(8,8,10,.62)"
        fillRule="evenodd"
      />
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
            <path
              d={`M${p.x} ${p.y - hy * L}V${p.y}H${p.x - hx * L}`}
              fill="none"
              stroke="white"
              strokeWidth={4 / z}
            />
            <rect
              data-handle={`${hx},${hy}`}
              x={p.x - hs * 1.2}
              y={p.y - hs * 1.2}
              width={hs * 2.4}
              height={hs * 2.4}
              fill="transparent"
              style={{ pointerEvents: "all", cursor: hx === hy ? "nwse-resize" : "nesw-resize" }}
            />
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

function InlineTextEditor({ layer }: { layer: TextLayer }) {
  const ref = React.useRef<HTMLTextAreaElement>(null)
  const m = measureText(layer)
  React.useEffect(() => {
    const t = ref.current
    if (!t) return
    // focus after the pointer sequence that created the layer has finished
    const id = requestAnimationFrame(() => {
      t.focus()
      t.select()
    })
    return () => cancelAnimationFrame(id)
  }, [layer.id])
  const finish = () => useEditor.getState().setEditingText(null)
  const minW = Math.max(m.w, layer.fontSize * 2)
  const left = layer.align === "left" ? layer.x : layer.align === "center" ? layer.x - minW / 2 : layer.x - minW
  return (
    <textarea
      ref={ref}
      value={layer.text}
      spellCheck={false}
      onPointerDown={(e) => e.stopPropagation()}
      onChange={(e) => useEditor.getState().updateLayer(layer.id, { text: e.target.value }, `text:${layer.id}`)}
      onBlur={finish}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) finish()
      }}
      className="absolute resize-none overflow-hidden border-0 bg-transparent p-0 outline-2 outline-offset-4 outline-[var(--lime)] outline-dashed"
      style={{
        left,
        top: layer.y,
        width: minW + layer.fontSize,
        height: m.h + 4,
        font: textFont(layer),
        fontFamily: fontFamilyFor(layer.fontFamily),
        lineHeight: `${layer.fontSize * layer.lineHeight}px`,
        letterSpacing: `${layer.letterSpacing}px`,
        textAlign: layer.align,
        color: layer.color,
        textTransform: layer.uppercase ? "uppercase" : "none",
        transform: `rotate(${layer.rotation}deg)`,
        caretColor: "var(--lime)",
        textShadow: layer.shadow ? "0 2px 12px rgba(0,0,0,.45)" : undefined,
        WebkitTextStroke: layer.strokeColor && layer.strokeWidth ? `${layer.strokeWidth}px ${layer.strokeColor}` : undefined,
        background: layer.background ?? "transparent",
      }}
    />
  )
}
