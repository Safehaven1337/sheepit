"use client"

// "Adjustment target": the background photo or the active layer. Adjust panel,
// looks and auto-enhance all work on whatever is targeted (like Photoshop's
// adjustments applied to the active layer).
import { defaultAdjustments } from "./defaults"
import { useEditor } from "./store"
import { BASE_ID, type Adjustments, type Layer, type SheepDoc } from "./types"

export type AdjTarget = { kind: "base" } | { kind: "layer"; id: string; name: string }

export interface DevelopState {
  adjustments: Adjustments
  look: string | null
  lookAmount: number
}

export const isAdjustable = (l: Layer | undefined | null) => !!l && l.type !== "effect"

export function targetOf(doc: SheepDoc, selectedId: string | null): AdjTarget | null {
  if (selectedId && selectedId !== BASE_ID) {
    const l = doc.layers.find((x) => x.id === selectedId)
    if (isAdjustable(l)) return { kind: "layer", id: l!.id, name: l!.type === "text" ? l!.text.split("\n")[0] || l!.name : l!.name }
  }
  return doc.baseAssetId ? { kind: "base" } : null
}

export function useAdjTarget() {
  return useEditor((s) => {
    const t = targetOf(s.doc, s.selectedId)
    return t ? (t.kind === "base" ? "base" : `layer:${t.id}`) : null
  })
}

export function readDevelop(doc: SheepDoc, t: AdjTarget): DevelopState {
  if (t.kind === "base") return { adjustments: doc.adjustments, look: doc.look, lookAmount: doc.lookAmount }
  const l = doc.layers.find((x) => x.id === t.id)
  return {
    adjustments: l?.adjustments ?? DEFAULT,
    look: l?.look ?? null,
    lookAmount: l?.lookAmount ?? 1,
  }
}

const DEFAULT = defaultAdjustments()

/** Mutates the develop state of the target inside a history-tracked patch. */
export function patchDevelop(t: AdjTarget, recipe: (d: DevelopState) => void, key?: string) {
  useEditor.getState().patch((doc) => {
    if (t.kind === "base") {
      const st: DevelopState = { adjustments: doc.adjustments, look: doc.look, lookAmount: doc.lookAmount }
      recipe(st)
      doc.adjustments = st.adjustments
      doc.look = st.look
      doc.lookAmount = st.lookAmount
      return
    }
    const l = doc.layers.find((x) => x.id === t.id)
    if (!l) return
    const st: DevelopState = {
      adjustments: l.adjustments ?? defaultAdjustments(),
      look: l.look ?? null,
      lookAmount: l.lookAmount ?? 1,
    }
    recipe(st)
    l.adjustments = st.adjustments
    l.look = st.look
    l.lookAmount = st.lookAmount
  }, key && `${t.kind === "base" ? "base" : t.id}:${key}`)
}

export function currentTarget(): AdjTarget | null {
  const s = useEditor.getState()
  return targetOf(s.doc, s.selectedId)
}
