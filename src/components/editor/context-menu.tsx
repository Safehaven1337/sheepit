"use client"

import * as React from "react"
import { Brush, Eraser, ShieldHalf } from "lucide-react"
import { useEditor } from "@/lib/editor/store"
import { autoEnhance } from "./panels/adjust-panel"
import { ColorPicker, MiniSlider, Seg } from "./controls"
import { ui } from "./menu-bar"
import {
  copyLayer,
  copyToNewLayer,
  cropToSelection,
  deleteSelectedLayer,
  deleteSelection,
  fillSelection,
  flipLayer,
  invertSelection,
  mergeDown,
  newLayer,
  pasteLayer,
  privacyFromSelection,
  rasterizeLayer,
  selectAll,
} from "@/lib/editor/ops"
import { EFFECT_LABEL } from "@/lib/editor/defaults"
import { BASE_ID, type EffectKind } from "@/lib/editor/types"
import { cn } from "@/lib/utils"

export type ContextKind = "brush" | "eraser" | "privacy-brush" | "layer" | "base" | "selection" | "canvas"
export interface ContextRequest {
  x: number
  y: number
  kind: ContextKind
}

export const openContextMenu = (c: ContextRequest) => window.dispatchEvent(new CustomEvent("sheepit:context", { detail: c }))

type Item = { label: string; kbd?: string; run: () => void; disabled?: boolean; danger?: boolean } | "-"

const BRUSH_PRESETS = [
  { name: "Hart", hardness: 1, opacity: 1, preview: "radial-gradient(circle, #fff 62%, transparent 64%)" },
  { name: "Mittel", hardness: 0.6, opacity: 1, preview: "radial-gradient(circle, #fff 35%, transparent 66%)" },
  { name: "Weich", hardness: 0.15, opacity: 1, preview: "radial-gradient(circle, #fff 5%, transparent 68%)" },
  { name: "Airbrush", hardness: 0, opacity: 0.25, preview: "radial-gradient(circle, rgba(255,255,255,.45) 0%, transparent 68%)" },
]

/** Right-click menu for the canvas and the layers panel (content depends on tool & target). */
export function ContextMenuHost() {
  const [req, setReq] = React.useState<ContextRequest | null>(null)
  const ref = React.useRef<HTMLDivElement>(null)
  const [pos, setPos] = React.useState<{ left: number; top: number } | null>(null)

  React.useEffect(() => {
    const open = (e: Event) => {
      setPos(null)
      setReq((e as CustomEvent<ContextRequest>).detail)
    }
    window.addEventListener("sheepit:context", open)
    return () => window.removeEventListener("sheepit:context", open)
  }, [])

  // keep the menu inside the window
  React.useLayoutEffect(() => {
    if (!req || !ref.current) return
    // offset sizes ignore the zoom-in animation transform
    const w = ref.current.offsetWidth
    const h = ref.current.offsetHeight
    setPos({
      left: Math.max(8, Math.min(req.x, window.innerWidth - w - 8)),
      top: Math.max(8, Math.min(req.y, window.innerHeight - h - 8)),
    })
  }, [req])

  React.useEffect(() => {
    if (!req) return
    const close = (e: Event) => {
      if (e.type === "keydown" && (e as KeyboardEvent).key !== "Escape") return
      if (e.type === "pointerdown" && ref.current?.contains(e.target as Node)) return
      if (e.type === "pointerdown" && (e.target as HTMLElement).closest?.("[data-slot=popover-content]")) return
      setReq(null)
    }
    window.addEventListener("pointerdown", close, true)
    window.addEventListener("keydown", close)
    window.addEventListener("resize", close)
    window.addEventListener("wheel", close, { passive: true })
    return () => {
      window.removeEventListener("pointerdown", close, true)
      window.removeEventListener("keydown", close)
      window.removeEventListener("resize", close)
      window.removeEventListener("wheel", close)
    }
  }, [req])

  if (!req) return null
  const close = () => setReq(null)
  return (
    <div
      ref={ref}
      role="menu"
      onContextMenu={(e) => e.preventDefault()}
      className="fixed z-[60] max-h-[calc(100vh-16px)] min-w-56 overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-xl ring-1 ring-foreground/10 animate-in fade-in-0 zoom-in-95 duration-100"
      style={pos ?? { left: req.x, top: req.y, visibility: "hidden" }}
    >
      {req.kind === "brush" || req.kind === "eraser" ? (
        <BrushMenu eraser={req.kind === "eraser"} />
      ) : req.kind === "privacy-brush" ? (
        <PrivacyBrushMenu />
      ) : (
        <ItemList items={itemsFor(req.kind)} close={close} />
      )}
    </div>
  )
}

function ItemList({ items, close }: { items: Item[]; close: () => void }) {
  return (
    <div className="grid">
      {items.map((it, i) =>
        it === "-" ? (
          <div key={i} className="-mx-1 my-1 h-px bg-border" />
        ) : (
          <button
            key={i}
            type="button"
            role="menuitem"
            disabled={it.disabled}
            onClick={() => {
              close()
              it.run()
            }}
            className={cn(
              "flex h-[26px] items-center justify-between gap-6 rounded-md px-2 text-left text-[12.5px] outline-none hover:bg-accent focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-40",
              it.danger && "text-destructive hover:bg-destructive/10",
            )}
          >
            {it.label}
            {it.kbd && <span className="text-[11px] tracking-widest text-muted-foreground">{it.kbd}</span>}
          </button>
        ),
      )}
    </div>
  )
}

function itemsFor(kind: ContextKind): Item[] {
  const s = useEditor.getState()
  const l = s.doc.layers.find((x) => x.id === s.selectedId)
  const view: Item[] = [
    { label: "Ganzes Bild", kbd: "Strg+0", run: () => s.setZoom(0) },
    { label: "100 %", kbd: "Strg+1", run: () => s.setZoom(1) },
  ]
  if (kind === "selection")
    return [
      { label: "Ebene durch Kopie", kbd: "Strg+J", run: () => void copyToNewLayer() },
      { label: "Ebene durch Ausschneiden", kbd: "⇧Strg+J", run: () => void copyToNewLayer(true) },
      "-",
      { label: "Fläche füllen (Vordergrund)", kbd: "Alt+Entf", run: () => fillSelection() },
      { label: "Fläche füllen (Hintergrund)", kbd: "Strg+Entf", run: () => fillSelection(s.bg) },
      { label: "Inhalt löschen", kbd: "Entf", run: deleteSelection },
      { label: "Unkenntlich machen", run: privacyFromSelection },
      { label: "Auf Auswahl freistellen", run: cropToSelection },
      "-",
      { label: "Auswahl umkehren", kbd: "⇧Strg+I", run: invertSelection },
      { label: "Auswahl aufheben", kbd: "Strg+D", run: () => s.setSelection(null) },
    ]
  if (kind === "base")
    return [
      { label: "Anpassungen …", run: () => s.setPanelTab("adjust") },
      { label: "Looks & Filter …", run: () => s.setPanelTab("looks") },
      { label: "Auto-Verbessern", kbd: "⇧Strg+L", run: autoEnhance },
      "-",
      { label: "Ebene durch Kopie", kbd: "Strg+J", run: () => void copyToNewLayer() },
      { label: "Neue Ebene", kbd: "⇧Strg+N", run: newLayer },
      { label: "Einfügen", kbd: "Strg+V", run: pasteLayer, disabled: !s.clipboard },
      "-",
      { label: s.doc.baseHidden ? "Hintergrund einblenden" : "Hintergrund ausblenden", run: () => s.patch((d) => void (d.baseHidden = !d.baseHidden)) },
      "-",
      ...view,
    ]
  if (kind === "layer" && l) {
    const isEffect = l.type === "effect"
    return [
      ...(l.type === "text" ? [{ label: "Text bearbeiten", run: () => s.setEditingText(l.id) } as Item, "-" as const] : []),
      { label: "Ebene duplizieren", kbd: "Strg+J", run: () => s.duplicateLayer(l.id) },
      { label: "Ebene kopieren", kbd: "Strg+C", run: () => copyLayer() },
      { label: "Einfügen", kbd: "Strg+V", run: pasteLayer, disabled: !s.clipboard },
      "-",
      { label: "Anpassungen …", run: () => s.setPanelTab("adjust"), disabled: isEffect },
      { label: "Looks & Filter …", run: () => s.setPanelTab("looks"), disabled: isEffect },
      { label: "Auto-Verbessern", kbd: "⇧Strg+L", run: autoEnhance, disabled: isEffect },
      { label: "Eigenschaften …", run: () => s.setPanelTab("props") },
      "-",
      { label: "In den Vordergrund", kbd: "⇧Strg+]", run: () => s.moveLayer(l.id, "top") },
      { label: "Schrittweise vorwärts", kbd: "Strg+]", run: () => s.moveLayer(l.id, 1) },
      { label: "Schrittweise rückwärts", kbd: "Strg+[", run: () => s.moveLayer(l.id, -1) },
      { label: "In den Hintergrund", kbd: "⇧Strg+[", run: () => s.moveLayer(l.id, "bottom") },
      "-",
      ...(l.type === "image" ? [{ label: "Horizontal spiegeln", run: () => flipLayer("h") } as Item] : []),
      { label: "Ebene rastern", run: () => void rasterizeLayer(l.id), disabled: isEffect || l.type === "image" },
      { label: "Auf eine Ebene reduzieren", kbd: "Strg+E", run: () => void mergeDown() },
      { label: l.locked ? "Entsperren" : "Sperren", run: () => s.updateLayer(l.id, { locked: !l.locked }) },
      { label: l.visible ? "Ausblenden" : "Einblenden", run: () => s.updateLayer(l.id, { visible: !l.visible }) },
      "-",
      { label: "Ebene löschen", kbd: "Entf", run: deleteSelectedLayer, danger: true },
    ]
  }
  return [
    { label: "Einfügen", kbd: "Strg+V", run: pasteLayer, disabled: !s.clipboard },
    { label: "Neue Ebene", kbd: "⇧Strg+N", run: newLayer },
    { label: "Bild als Ebene platzieren …", run: () => ui("place") },
    { label: "Alles auswählen", kbd: "Strg+A", run: selectAll },
    "-",
    ...view,
  ]
}

function BrushMenu({ eraser }: { eraser: boolean }) {
  const set = useEditor((s) => (eraser ? s.eraser : s.brush))
  const update = useEditor((s) => (eraser ? s.setEraser : s.setBrush))
  const fg = useEditor((s) => s.fg)
  const setColors = useEditor((s) => s.setColors)
  const target = useEditor((s) => (s.selectedId === BASE_ID ? "Hintergrund" : (s.doc.layers.find((l) => l.id === s.selectedId)?.name ?? null)))
  return (
    <div className="grid w-64 gap-3 p-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[12px] font-semibold">
          {eraser ? <Eraser className="size-3.5" /> : <Brush className="size-3.5" />}
          {eraser ? "Radierer" : "Pinsel"}
        </span>
        {!eraser && <ColorPicker size="sm" label="Pinselfarbe" value={fg} onChange={(c) => c && setColors({ fg: c })} />}
      </div>
      {/* live preview of the brush tip */}
      <div className="grid h-20 place-items-center rounded-md bg-black/40 ring-1 ring-white/5">
        <span
          className="block rounded-full"
          style={{
            width: Math.min(72, Math.max(4, set.size)),
            height: Math.min(72, Math.max(4, set.size)),
            opacity: set.opacity,
            background: `radial-gradient(circle, ${eraser ? "#fff" : fg} ${Math.round(set.hardness * 62)}%, transparent ${Math.round(set.hardness * 8 + 62)}%)`,
          }}
        />
      </div>
      <div className="grid grid-cols-4 gap-1">
        {BRUSH_PRESETS.map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() => update({ hardness: p.hardness, opacity: p.opacity })}
            className={cn(
              "grid justify-items-center gap-1 rounded-md bg-muted/50 py-1.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground",
              Math.abs(set.hardness - p.hardness) < 0.05 && Math.abs(set.opacity - p.opacity) < 0.05 && "bg-primary/15 text-primary",
            )}
          >
            <span className="size-6 rounded-full" style={{ background: p.preview }} />
            {p.name}
          </button>
        ))}
      </div>
      <MiniSlider label="Größe" value={set.size} min={1} max={500} onChange={(v) => update({ size: v })} width="w-32" format={(v) => `${Math.round(v)} px`} />
      <MiniSlider label="Härte" value={Math.round(set.hardness * 100)} min={0} max={100} onChange={(v) => update({ hardness: v / 100 })} width="w-32" format={(v) => `${v}%`} />
      <MiniSlider label="Deckkraft" value={Math.round(set.opacity * 100)} min={1} max={100} onChange={(v) => update({ opacity: v / 100 })} width="w-32" format={(v) => `${v}%`} />
      <p className="text-[10.5px] text-muted-foreground">
        {eraser ? (target ? `Radiert auf: ${target}` : "Wähle eine Ebene zum Radieren") : "[ ] Größe · ⇧[ ] Härte · 1–0 Deckkraft"}
      </p>
    </div>
  )
}

function PrivacyBrushMenu() {
  const privacy = useEditor((s) => s.privacy)
  const setPrivacy = useEditor((s) => s.setPrivacy)
  return (
    <div className="grid w-72 gap-3 p-2">
      <span className="flex items-center gap-1.5 text-[12px] font-semibold">
        <ShieldHalf className="size-3.5" /> Unkenntlich-Pinsel
      </span>
      <Seg<EffectKind>
        value={privacy.effect}
        onChange={(e) => setPrivacy({ effect: e })}
        items={(["pixelate", "blur", "redact", "glass", "noise"] as EffectKind[]).map((e) => ({ v: e, label: EFFECT_LABEL[e].replace("Weichzeichner", "Blur") }))}
      />
      <MiniSlider label="Größe" value={privacy.brushSize} min={4} max={400} onChange={(v) => setPrivacy({ brushSize: v })} width="w-36" format={(v) => `${Math.round(v)} px`} />
      <label className="flex items-center justify-between text-[12px] text-muted-foreground">
        Radieren
        <input type="checkbox" checked={privacy.erase} onChange={(e) => setPrivacy({ erase: e.target.checked })} className="size-4 accent-[var(--lime)]" />
      </label>
    </div>
  )
}
