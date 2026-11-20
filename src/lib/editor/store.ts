"use client"

import { create } from "zustand"
import { emptyDoc, defaultAdjustments, uid } from "./defaults"
import { remapBaseMask, remapMask } from "./render"
import type { Asset, EffectKind, Layer, RegionShape, SelectionShape, SheepDoc, TextLayer, ToolId } from "./types"

const MAX_HISTORY = 100

export interface PrivacySettings {
  effect: EffectKind
  region: RegionShape
  brushSize: number
  erase: boolean
  /** new regions affect everything except the painted area */
  invert?: boolean
}

export interface BrushSettings {
  size: number // screen px
  hardness: number // 0..1
  opacity: number // 0..1
}

export interface CropDraft {
  aspect: number | null // w/h, null = free
  /** draft crop rect, normalized in rotated image space */
  rect: { x: number; y: number; w: number; h: number } | null
}

export interface ShapeStyle {
  fill: string | null
  stroke: string | null
  strokeWidth: number
  radius: number
}

export type PanelTab = "adjust" | "looks" | "props"

interface EditorState {
  doc: SheepDoc
  assets: Map<string, Asset>
  past: SheepDoc[]
  future: SheepDoc[]
  lastKey: string | null
  lastTime: number
  dirty: boolean
  /** a document is open */
  ready: boolean

  tool: ToolId
  /** selected layer id, BASE_ID for the background photo */
  selectedId: string | null
  compare: boolean
  zoom: number // 0 = fit
  fitZoom: number
  renderTick: number
  fg: string
  bg: string
  brush: BrushSettings
  eraser: BrushSettings
  privacy: PrivacySettings
  crop: CropDraft
  shapeKind: "rect" | "ellipse" | "line" | "arrow"
  shapeStyle: ShapeStyle
  selectMode: "rect" | "ellipse" | "lasso"
  selection: SelectionShape | null
  /** move tool: click selects the topmost layer */
  autoSelect: boolean
  panelTab: PanelTab
  clipboard: Layer | null
  /** style for new text layers */
  textStyle: Partial<TextLayer>
  /** text layer id currently edited inline */
  editingText: string | null

  setTool: (t: ToolId) => void
  select: (id: string | null) => void
  setCompare: (v: boolean) => void
  setZoom: (z: number) => void
  setFitZoom: (z: number) => void
  bump: () => void
  setColors: (p: { fg?: string; bg?: string }) => void
  setBrush: (p: Partial<BrushSettings>) => void
  setEraser: (p: Partial<BrushSettings>) => void
  setPrivacy: (p: Partial<PrivacySettings>) => void
  setCrop: (p: Partial<CropDraft>) => void
  setShapeKind: (k: EditorState["shapeKind"]) => void
  setShapeStyle: (p: Partial<ShapeStyle>) => void
  setSelectMode: (m: EditorState["selectMode"]) => void
  setSelection: (s: SelectionShape | null) => void
  setAutoSelect: (v: boolean) => void
  setPanelTab: (t: PanelTab) => void
  setClipboard: (l: Layer | null) => void
  setTextStyle: (p: Partial<TextLayer>) => void
  setEditingText: (id: string | null) => void

  /** Mutate a clone of the doc. Same `key` within 700ms coalesces into one undo step. */
  patch: (recipe: (d: SheepDoc) => void, key?: string) => void
  updateLayer: (id: string, p: Partial<Layer>, key?: string) => void
  addLayer: (l: Layer, select?: boolean, index?: number) => void
  removeLayer: (id: string) => void
  duplicateLayer: (id: string) => void
  moveLayer: (id: string, dir: 1 | -1 | "top" | "bottom") => void
  reorderLayer: (id: string, toIndex: number) => void
  undo: () => void
  redo: () => void

  addAsset: (blob: Blob) => Promise<Asset>
  openImage: (blob: Blob, name?: string) => Promise<void>
  newBlank: (w: number, h: number, bg: string, name?: string) => void
  loadProject: (doc: SheepDoc, assets: Asset[]) => void
  resetAdjustments: () => void
  markSaved: () => void
  close: () => void
}

export async function blobToAsset(blob: Blob, id = uid()): Promise<Asset> {
  const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" } as ImageBitmapOptions)
  return { id, blob, bitmap, width: bitmap.width, height: bitmap.height, mime: blob.type || "image/png" }
}

/** keeps the layer selection valid after undo/redo */
function validSelection(doc: SheepDoc, id: string | null) {
  if (!id) return null
  if (id === "__base__") return doc.baseAssetId ? id : null
  if (doc.layers.some((l) => l.id === id)) return id
  return doc.layers[doc.layers.length - 1]?.id ?? (doc.baseAssetId ? "__base__" : null)
}

const fresh = {
  past: [] as SheepDoc[],
  future: [] as SheepDoc[],
  selectedId: null,
  zoom: 0,
  dirty: false,
  editingText: null,
  selection: null,
  lastKey: null,
}

export const useEditor = create<EditorState>((set, get) => ({
  doc: emptyDoc(),
  assets: new Map(),
  ...fresh,
  lastTime: 0,
  ready: false,

  tool: "move",
  compare: false,
  fitZoom: 1,
  renderTick: 0,
  fg: "#c6f432",
  bg: "#ffffff",
  brush: { size: 24, hardness: 0.8, opacity: 1 },
  eraser: { size: 40, hardness: 0.6, opacity: 1 },
  privacy: { effect: "pixelate", region: "rect", brushSize: 60, erase: false },
  crop: { aspect: null, rect: null },
  shapeKind: "rect",
  shapeStyle: { fill: "#c6f432", stroke: null, strokeWidth: 8, radius: 0 },
  selectMode: "rect",
  autoSelect: true,
  panelTab: "adjust",
  clipboard: null,
  textStyle: { fontFamily: "Inter", fontWeight: 700, italic: false, align: "left", uppercase: false, shadow: false },

  setTool: (tool) =>
    set((s) => ({
      tool,
      editingText: null,
      crop: { ...s.crop, rect: tool === "crop" ? s.doc.geometry.crop : null },
    })),
  select: (selectedId) => set({ selectedId }),
  setCompare: (compare) => set({ compare }),
  setZoom: (zoom) => set({ zoom }),
  setFitZoom: (fitZoom) => set({ fitZoom }),
  bump: () => set((s) => ({ renderTick: s.renderTick + 1 })),
  setColors: (p) => set((s) => ({ fg: p.fg ?? s.fg, bg: p.bg ?? s.bg })),
  setBrush: (p) => set((s) => ({ brush: { ...s.brush, ...p } })),
  setEraser: (p) => set((s) => ({ eraser: { ...s.eraser, ...p } })),
  setPrivacy: (p) => set((s) => ({ privacy: { ...s.privacy, ...p } })),
  setCrop: (p) => set((s) => ({ crop: { ...s.crop, ...p } })),
  setShapeKind: (shapeKind) => set({ shapeKind }),
  setShapeStyle: (p) => set((s) => ({ shapeStyle: { ...s.shapeStyle, ...p } })),
  setSelectMode: (selectMode) => set({ selectMode }),
  setSelection: (selection) => set({ selection }),
  setAutoSelect: (autoSelect) => set({ autoSelect }),
  setPanelTab: (panelTab) => set({ panelTab }),
  setClipboard: (clipboard) => set({ clipboard }),
  setTextStyle: (p) => set((s) => ({ textStyle: { ...s.textStyle, ...p } })),
  setEditingText: (editingText) => set({ editingText }),

  patch: (recipe, key) => {
    const s = get()
    const next = structuredClone(s.doc)
    recipe(next)
    if (next.baseMask?.length) next.baseMask = remapBaseMask(s.doc, next)
    const now = performance.now()
    const coalesce = key && key === s.lastKey && now - s.lastTime < 700
    set({
      doc: next,
      past: coalesce ? s.past : [...s.past.slice(-MAX_HISTORY), s.doc],
      future: [],
      lastKey: key ?? null,
      lastTime: now,
      dirty: true,
    })
  },

  updateLayer: (id, p, key) =>
    get().patch((d) => {
      const i = d.layers.findIndex((l) => l.id === id)
      if (i >= 0) d.layers[i] = remapMask(d.layers[i], { ...d.layers[i], ...p } as Layer)
    }, key ?? `layer:${id}:${Object.keys(p).join(",")}`),

  addLayer: (l, select = true, index) => {
    get().patch((d) => {
      if (index === undefined) d.layers.push(l)
      else d.layers.splice(index, 0, l)
    })
    if (select) set({ selectedId: l.id })
  },

  removeLayer: (id) => {
    const layers = get().doc.layers
    const i = layers.findIndex((l) => l.id === id)
    if (i < 0) return
    get().patch((d) => {
      d.layers = d.layers.filter((l) => l.id !== id)
    })
    if (get().selectedId === id) {
      const next = get().doc.layers[Math.min(i, get().doc.layers.length - 1)]
      set({ selectedId: next?.id ?? null })
    }
  },

  duplicateLayer: (id) => {
    const l = get().doc.layers.find((x) => x.id === id)
    if (!l) return
    const copy = structuredClone(l)
    copy.id = uid()
    copy.name = `${l.name} Kopie`
    get().patch((d) => {
      const i = d.layers.findIndex((x) => x.id === id)
      d.layers.splice(i + 1, 0, copy)
    })
    set({ selectedId: copy.id })
  },

  moveLayer: (id, dir) =>
    get().patch((d) => {
      const i = d.layers.findIndex((l) => l.id === id)
      if (i < 0) return
      const [l] = d.layers.splice(i, 1)
      const j =
        dir === "top" ? d.layers.length : dir === "bottom" ? 0 : Math.min(d.layers.length, Math.max(0, i + dir))
      d.layers.splice(j, 0, l)
    }),

  reorderLayer: (id, toIndex) =>
    get().patch((d) => {
      const i = d.layers.findIndex((l) => l.id === id)
      if (i < 0) return
      const [l] = d.layers.splice(i, 1)
      d.layers.splice(Math.max(0, Math.min(d.layers.length, toIndex)), 0, l)
    }),

  undo: () => {
    const s = get()
    const prev = s.past[s.past.length - 1]
    if (!prev) return
    set({
      doc: prev,
      past: s.past.slice(0, -1),
      future: [s.doc, ...s.future],
      lastKey: null,
      dirty: true,
      editingText: null,
      selectedId: validSelection(prev, s.selectedId),
    })
  },
  redo: () => {
    const s = get()
    const next = s.future[0]
    if (!next) return
    set({
      doc: next,
      past: [...s.past, s.doc],
      future: s.future.slice(1),
      lastKey: null,
      dirty: true,
      editingText: null,
      selectedId: validSelection(next, s.selectedId),
    })
  },

  addAsset: async (blob) => {
    const a = await blobToAsset(blob)
    const assets = new Map(get().assets)
    assets.set(a.id, a)
    set({ assets })
    return a
  },

  openImage: async (blob, name) => {
    const a = await blobToAsset(blob)
    const assets = new Map<string, Asset>([[a.id, a]])
    const doc: SheepDoc = {
      ...emptyDoc(),
      name: (name ?? "Bild").replace(/\.[^.]+$/, ""),
      baseAssetId: a.id,
      sourceWidth: a.width,
      sourceHeight: a.height,
    }
    for (const old of get().assets.values()) old.bitmap.close?.()
    set({ doc, assets, ...fresh, ready: true, selectedId: "__base__" })
  },

  newBlank: (w, h, bg, name = "Neues Design") => {
    set({
      doc: { ...emptyDoc(), name, sourceWidth: w, sourceHeight: h, background: bg },
      assets: new Map(),
      ...fresh,
      ready: true,
      tool: "text",
    })
  },

  loadProject: (doc, list) => {
    set({ doc, assets: new Map(list.map((a) => [a.id, a])), ...fresh, ready: true })
  },

  resetAdjustments: () =>
    get().patch((d) => {
      d.adjustments = defaultAdjustments()
      d.look = null
      d.lookAmount = 1
    }),

  markSaved: () => set({ dirty: false }),
  close: () => set({ ...fresh, ready: false, doc: emptyDoc(), assets: new Map() }),
}))
