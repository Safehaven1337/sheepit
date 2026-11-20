"use client"

import { create } from "zustand"
import { emptyDoc, defaultAdjustments, defaultGeometry, uid } from "./defaults"
import type { Asset, EffectKind, Layer, RegionShape, SheepDoc, ToolId } from "./types"

const MAX_HISTORY = 80

export interface PrivacySettings {
  effect: EffectKind
  region: RegionShape
  brushSize: number
  erase: boolean
  /** new regions affect everything except the painted area */
  invert?: boolean
}

export interface DrawSettings {
  color: string
  size: number
  erase: boolean
}

export interface CropDraft {
  aspect: number | null // w/h, null = free
  /** draft crop rect, normalized in rotated image space */
  rect: { x: number; y: number; w: number; h: number } | null
}

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
  selectedId: string | null
  compare: boolean
  zoom: number // 0 = fit
  fitZoom: number
  renderTick: number
  privacy: PrivacySettings
  draw: DrawSettings
  crop: CropDraft
  shapeKind: "rect" | "ellipse" | "line" | "arrow"
  /** text layer id currently edited inline */
  editingText: string | null

  setTool: (t: ToolId) => void
  select: (id: string | null) => void
  setCompare: (v: boolean) => void
  setZoom: (z: number) => void
  setFitZoom: (z: number) => void
  bump: () => void
  setPrivacy: (p: Partial<PrivacySettings>) => void
  setDraw: (p: Partial<DrawSettings>) => void
  setCrop: (p: Partial<CropDraft>) => void
  setShapeKind: (k: EditorState["shapeKind"]) => void
  setEditingText: (id: string | null) => void

  /** Mutate a clone of the doc. Same `key` within 700ms coalesces into one undo step. */
  patch: (recipe: (d: SheepDoc) => void, key?: string) => void
  updateLayer: (id: string, p: Partial<Layer>, key?: string) => void
  addLayer: (l: Layer, select?: boolean) => void
  removeLayer: (id: string) => void
  duplicateLayer: (id: string) => void
  moveLayer: (id: string, dir: 1 | -1 | "top" | "bottom") => void
  undo: () => void
  redo: () => void

  addAsset: (blob: Blob) => Promise<Asset>
  openImage: (blob: Blob, name?: string) => Promise<void>
  newBlank: (w: number, h: number, bg: string) => void
  loadProject: (doc: SheepDoc, assets: Asset[]) => void
  resetAdjustments: () => void
  markSaved: () => void
  close: () => void
}

export async function blobToAsset(blob: Blob, id = uid()): Promise<Asset> {
  const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" } as ImageBitmapOptions)
  return { id, blob, bitmap, width: bitmap.width, height: bitmap.height, mime: blob.type || "image/png" }
}

export const useEditor = create<EditorState>((set, get) => ({
  doc: emptyDoc(),
  assets: new Map(),
  past: [],
  future: [],
  lastKey: null,
  lastTime: 0,
  dirty: false,
  ready: false,

  tool: "adjust",
  selectedId: null,
  compare: false,
  zoom: 0,
  fitZoom: 1,
  renderTick: 0,
  privacy: { effect: "pixelate", region: "rect", brushSize: 60, erase: false },
  draw: { color: "#c6f432", size: 12, erase: false },
  crop: { aspect: null, rect: null },
  shapeKind: "rect",
  editingText: null,

  setTool: (tool) => set((s) => ({ tool, editingText: null, crop: { ...s.crop, rect: tool === "crop" ? s.doc.geometry.crop : null } })),
  select: (selectedId) => set({ selectedId }),
  setCompare: (compare) => set({ compare }),
  setZoom: (zoom) => set({ zoom }),
  setFitZoom: (fitZoom) => set({ fitZoom }),
  bump: () => set((s) => ({ renderTick: s.renderTick + 1 })),
  setPrivacy: (p) => set((s) => ({ privacy: { ...s.privacy, ...p } })),
  setDraw: (p) => set((s) => ({ draw: { ...s.draw, ...p } })),
  setCrop: (p) => set((s) => ({ crop: { ...s.crop, ...p } })),
  setShapeKind: (shapeKind) => set({ shapeKind }),
  setEditingText: (editingText) => set({ editingText }),

  patch: (recipe, key) => {
    const s = get()
    const next = structuredClone(s.doc)
    recipe(next)
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
      if (i >= 0) d.layers[i] = { ...d.layers[i], ...p } as Layer
    }, key ?? `layer:${id}:${Object.keys(p).join(",")}`),

  addLayer: (l, select = true) => {
    get().patch((d) => {
      d.layers.push(l)
    })
    if (select) set({ selectedId: l.id })
  },

  removeLayer: (id) => {
    get().patch((d) => {
      d.layers = d.layers.filter((l) => l.id !== id)
    })
    if (get().selectedId === id) set({ selectedId: null })
  },

  duplicateLayer: (id) => {
    const l = get().doc.layers.find((x) => x.id === id)
    if (!l) return
    const copy = structuredClone(l)
    copy.id = uid()
    copy.name = `${l.name} Kopie`
    if ("x" in copy && "y" in copy) {
      copy.x += 24
      copy.y += 24
    }
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

  undo: () => {
    const s = get()
    const prev = s.past[s.past.length - 1]
    if (!prev) return
    set({ doc: prev, past: s.past.slice(0, -1), future: [s.doc, ...s.future], lastKey: null, dirty: true })
  },
  redo: () => {
    const s = get()
    const next = s.future[0]
    if (!next) return
    set({ doc: next, past: [...s.past, s.doc], future: s.future.slice(1), lastKey: null, dirty: true })
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
    set({ doc, assets, past: [], future: [], selectedId: null, zoom: 0, dirty: false, editingText: null, ready: true })
  },

  newBlank: (w, h, bg) => {
    set({
      doc: { ...emptyDoc(), name: "Neues Design", sourceWidth: w, sourceHeight: h, background: bg },
      assets: new Map(),
      past: [],
      future: [],
      selectedId: null,
      zoom: 0,
      dirty: false,
      ready: true,
      tool: "text",
    })
  },

  loadProject: (doc, list) => {
    set({
      doc,
      assets: new Map(list.map((a) => [a.id, a])),
      past: [],
      future: [],
      selectedId: null,
      zoom: 0,
      dirty: false,
      ready: true,
    })
  },

  resetAdjustments: () =>
    get().patch((d) => {
      d.adjustments = defaultAdjustments()
      d.look = null
      d.lookAmount = 1
    }),

  markSaved: () => set({ dirty: false }),
  close: () => set({ ready: false, doc: emptyDoc(), assets: new Map(), past: [], future: [], selectedId: null, dirty: false }),
}))

export const resetGeometry = () =>
  useEditor.getState().patch((d) => {
    d.geometry = defaultGeometry()
  })
