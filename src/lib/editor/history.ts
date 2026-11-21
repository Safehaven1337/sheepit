// Human readable names for history steps (Photoshop "Protokoll"), derived by diffing two documents.
import { EFFECT_LABEL } from "./defaults"
import type { Adjustments, Layer, SheepDoc } from "./types"

const ADJ_LABEL: Partial<Record<keyof Adjustments, string>> = {
  exposure: "Belichtung",
  contrast: "Kontrast",
  highlights: "Lichter",
  shadows: "Tiefen",
  whites: "Weiß",
  blacks: "Schwarz",
  temperature: "Temperatur",
  tint: "Tönung",
  vibrance: "Dynamik",
  saturation: "Sättigung",
  texture: "Struktur",
  clarity: "Klarheit",
  dehaze: "Dunst entfernen",
  sharpen: "Schärfen",
  denoise: "Rauschreduzierung",
  vignette: "Vignette",
  grain: "Körnung",
  fade: "Verblassen",
  hsl: "Farbmischer",
  curves: "Gradationskurve",
  monochrome: "Schwarz-Weiß",
  gradeShadows: "Color Grading",
  gradeMidtones: "Color Grading",
  gradeHighlights: "Color Grading",
}

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b)

function adjLabel(a?: Adjustments, b?: Adjustments) {
  if (!a || !b) return "Anpassungen"
  for (const k of Object.keys(b) as (keyof Adjustments)[]) {
    if (!same(a[k], b[k])) return ADJ_LABEL[k] ?? "Anpassungen"
  }
  return "Anpassungen"
}

function layerLabel(a: Layer, b: Layer): string {
  if (a.adjustments !== b.adjustments && !same(a.adjustments, b.adjustments)) return adjLabel(a.adjustments, b.adjustments)
  if (a.look !== b.look) return "Look"
  if ((b.mask?.length ?? 0) > (a.mask?.length ?? 0)) return b.mask![b.mask!.length - 1].poly ? "Löschen" : "Radieren"
  if ((b.type === "draw" || b.type === "effect") && (a.type === b.type)) {
    const al = (a as typeof b).strokes.length
    const bl = b.strokes.length
    if (bl > al) {
      const last = b.strokes[bl - 1]
      if (last.poly) return "Fläche füllen"
      if (last.erase) return "Radieren"
      return b.type === "draw" ? "Pinsel" : "Unkenntlich-Pinsel"
    }
  }
  if (a.visible !== b.visible) return b.visible ? "Einblenden" : "Ausblenden"
  if (a.opacity !== b.opacity) return "Deckkraft"
  if (a.blend !== b.blend) return "Füllmethode"
  if (a.locked !== b.locked) return b.locked ? "Sperren" : "Entsperren"
  if (a.name !== b.name) return "Umbenennen"
  if (a.type === "text" && b.type === "text" && a.text !== b.text) return "Text bearbeiten"
  if ("rotation" in a && "rotation" in b && a.rotation !== b.rotation) return "Drehen"
  if ("width" in a && "width" in b && (a.width !== b.width || a.height !== b.height)) return "Transformieren"
  if (a.type === "text" && b.type === "text" && a.fontSize !== b.fontSize) return "Transformieren"
  if ("x" in a && "x" in b && (a.x !== b.x || a.y !== b.y)) return "Verschieben"
  if (a.type === "effect" && b.type === "effect" && a.effect !== b.effect) return EFFECT_LABEL[b.effect]
  if (a.type === "text") return "Textformat"
  return "Eigenschaften"
}

export function describeChange(prev: SheepDoc, next: SheepDoc): string {
  if (prev.baseAssetId !== next.baseAssetId) return "Auf Hintergrund reduzieren"
  if (prev.geometry !== next.geometry && !same(prev.geometry, next.geometry)) {
    const a = prev.geometry
    const b = next.geometry
    if (a.rotate90 !== b.rotate90) return "Drehen 90°"
    if (a.flipH !== b.flipH || a.flipV !== b.flipV) return "Spiegeln"
    if (a.straighten !== b.straighten) return "Begradigen"
    return "Freistellen"
  }
  if (prev.adjustments !== next.adjustments && !same(prev.adjustments, next.adjustments))
    return adjLabel(prev.adjustments, next.adjustments)
  if (prev.look !== next.look || prev.lookAmount !== next.lookAmount) return "Look"
  if ((next.baseMask?.length ?? 0) > (prev.baseMask?.length ?? 0))
    return next.baseMask![next.baseMask!.length - 1].poly ? "Löschen" : "Radieren"
  if (prev.baseHidden !== next.baseHidden) return next.baseHidden ? "Hintergrund ausblenden" : "Hintergrund einblenden"
  if (prev.background !== next.background) return "Hintergrundfarbe"
  if (prev.name !== next.name) return "Umbenennen"
  if (prev.sourceWidth !== next.sourceWidth || prev.sourceHeight !== next.sourceHeight) return "Freistellen"

  const pl = prev.layers
  const nl = next.layers
  if (nl.length > pl.length) {
    const added = nl.filter((l) => !pl.some((p) => p.id === l.id))
    if (added.length === 1) {
      const l = added[0]
      if (l.type === "text") return "Text"
      if (l.type === "shape") return "Form"
      if (l.type === "fill") return l.fill === "solid" ? "Farbfläche" : "Verlauf"
      if (l.type === "effect") return l.name === "Gesicht" ? "Gesichter unkenntlich" : EFFECT_LABEL[l.effect]
      if (l.type === "image") return /Kopie|Ausgeschnitten/.test(l.name) ? "Ebene durch Kopie" : "Bild platzieren"
      return "Neue Ebene"
    }
    if (added.every((l) => l.type === "effect")) return "Gesichter unkenntlich"
    return "Ebenen hinzufügen"
  }
  if (nl.length < pl.length) {
    const fresh = nl.some((l) => !pl.some((p) => p.id === l.id))
    return fresh || nl.length < pl.length - 1 ? "Auf eine Ebene reduzieren" : "Ebene löschen"
  }
  const order = pl.map((l) => l.id).join() !== nl.map((l) => l.id).join()
  if (order) {
    if (pl.every((l) => nl.some((n) => n.id === l.id))) return "Anordnen"
    return "Auf eine Ebene reduzieren"
  }
  for (let i = 0; i < nl.length; i++) if (pl[i] !== nl[i]) return layerLabel(pl[i], nl[i])
  return "Bearbeiten"
}
