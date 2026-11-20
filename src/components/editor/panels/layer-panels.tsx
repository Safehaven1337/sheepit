"use client"

import * as React from "react"
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowUpRight,
  Bold,
  Circle,
  Eraser,
  Italic,
  Minus,
  Pencil,
  Square,
  Type,
  CaseUpper,
} from "lucide-react"
import { AdjustSlider, Section } from "../adjust-slider"
import { Button } from "@/components/ui/button"
import { useEditor } from "@/lib/editor/store"
import { FONTS } from "@/lib/editor/fonts"
import { newText } from "@/lib/editor/defaults"
import { docSize } from "@/lib/editor/render"
import type { BlendMode, Layer, ShapeLayer, TextLayer } from "@/lib/editor/types"
import { cn } from "@/lib/utils"

export const SWATCHES = ["#ffffff", "#0b0b0f", "#c6f432", "#ff4d6d", "#ffb703", "#3a86ff", "#8338ec", "#06d6a0", "#f6f1e4", "#fb5607"]

export function ColorRow({
  value,
  onChange,
  allowNone,
  label,
}: {
  value: string | null
  onChange: (c: string | null) => void
  allowNone?: boolean
  label: string
}) {
  return (
    <div className="grid gap-1.5 py-1">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {allowNone && (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Keine Farbe"
            className={cn(
              "relative size-6 overflow-hidden rounded-full ring-1 ring-white/15",
              value === null && "ring-2 ring-primary",
            )}
          >
            <span className="absolute inset-0 m-auto h-px w-8 -rotate-45 bg-red-400" />
          </button>
        )}
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            onClick={() => onChange(c)}
            className={cn(
              "size-6 rounded-full ring-1 ring-white/15 transition hover:scale-110",
              value?.toLowerCase() === c && "ring-2 ring-primary ring-offset-2 ring-offset-background",
            )}
            style={{ background: c }}
          />
        ))}
        <label className="relative size-6 cursor-pointer overflow-hidden rounded-full bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)] ring-1 ring-white/15" title="Eigene Farbe">
          <input
            type="color"
            value={value ?? "#ffffff"}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      </div>
    </div>
  )
}

const BLENDS: { v: BlendMode; l: string }[] = [
  { v: "source-over", l: "Normal" },
  { v: "multiply", l: "Multiplizieren" },
  { v: "screen", l: "Negativ multiplizieren" },
  { v: "overlay", l: "Ineinanderkopieren" },
  { v: "soft-light", l: "Weiches Licht" },
  { v: "hard-light", l: "Hartes Licht" },
  { v: "darken", l: "Abdunkeln" },
  { v: "lighten", l: "Aufhellen" },
  { v: "color-dodge", l: "Farbig abwedeln" },
  { v: "color-burn", l: "Farbig nachbelichten" },
  { v: "difference", l: "Differenz" },
  { v: "exclusion", l: "Ausschluss" },
  { v: "hue", l: "Farbton" },
  { v: "saturation", l: "Sättigung" },
  { v: "color", l: "Farbe" },
  { v: "luminosity", l: "Luminanz" },
]

export function LayerAppearance({ layer }: { layer: Layer }) {
  const updateLayer = useEditor((s) => s.updateLayer)
  return (
    <Section title="Ebene">
      <AdjustSlider
        label="Deckkraft"
        value={Math.round(layer.opacity * 100)}
        min={0}
        max={100}
        neutral={100}
        format={(v) => `${Math.round(v)}%`}
        onChange={(v) => updateLayer(layer.id, { opacity: v / 100 })}
      />
      {layer.type !== "effect" && (
        <label className="mt-1 flex items-center justify-between gap-2 text-[12px] text-muted-foreground">
          Füllmethode
          <select
            value={layer.blend}
            onChange={(e) => updateLayer(layer.id, { blend: e.target.value as BlendMode })}
            className="h-7 max-w-40 rounded-md border border-input bg-background px-1.5 text-[12px] text-foreground"
          >
            {BLENDS.map((b) => (
              <option key={b.v} value={b.v}>
                {b.l}
              </option>
            ))}
          </select>
        </label>
      )}
      {"rotation" in layer && (
        <AdjustSlider
          label="Drehung"
          value={Math.round(layer.rotation)}
          min={-180}
          max={180}
          format={(v) => `${Math.round(v)}°`}
          onChange={(v) => updateLayer(layer.id, { rotation: v } as Partial<Layer>)}
        />
      )}
    </Section>
  )
}

const TEXT_PRESETS: { name: string; p: Partial<TextLayer> }[] = [
  { name: "Überschrift", p: { fontFamily: "Bebas Neue", fontWeight: 400, uppercase: true, letterSpacing: 2, color: "#ffffff", shadow: true, background: null } },
  { name: "Elegant", p: { fontFamily: "Playfair Display", fontWeight: 600, italic: true, color: "#f6f1e4", shadow: true, background: null } },
  { name: "Meme", p: { fontFamily: "Anton", fontWeight: 400, uppercase: true, color: "#ffffff", strokeColor: "#000000", strokeWidth: 4, shadow: false, background: null } },
  { name: "Label", p: { fontFamily: "Space Grotesk", fontWeight: 700, color: "#0b0b0f", background: "#c6f432", shadow: false, padding: 0.35 } },
  { name: "Handschrift", p: { fontFamily: "Caveat", fontWeight: 700, color: "#ffffff", shadow: true, background: null } },
  { name: "Neon", p: { fontFamily: "Pacifico", fontWeight: 400, color: "#ff4d6d", shadow: true, background: null } },
]

export function TextPanel() {
  const sel = useEditor((s) => s.doc.layers.find((l) => l.id === s.selectedId))
  const updateLayer = useEditor((s) => s.updateLayer)
  const t = sel?.type === "text" ? sel : null

  const addPreset = (p: Partial<TextLayer>) => {
    const s = useEditor.getState()
    const { w, h } = docSize(s.doc)
    const l = { ...newText(w / 2, h / 2, Math.round(Math.min(w, h) * 0.09)), ...p }
    l.y -= (l.fontSize * l.lineHeight) / 2
    s.addLayer(l)
    s.setEditingText(l.id)
  }

  return (
    <div>
      <Section title="Text hinzufügen">
        <div className="grid grid-cols-2 gap-1.5">
          {TEXT_PRESETS.map((p) => {
            const f = FONTS.find((x) => x.name === p.p.fontFamily)
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => addPreset(p.p)}
                className={cn("h-12 truncate rounded-lg bg-muted/60 px-2 text-[15px] transition hover:bg-muted", f?.className)}
                style={{
                  fontStyle: p.p.italic ? "italic" : undefined,
                  textTransform: p.p.uppercase ? "uppercase" : undefined,
                  color: p.p.background ? (p.p.color as string) : undefined,
                  background: p.p.background ?? undefined,
                }}
              >
                {p.name}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Oder einfach ins Bild klicken und lostippen.</p>
      </Section>

      {t && (
        <>
          <Section title="Schrift">
            <textarea
              value={t.text}
              onChange={(e) => updateLayer(t.id, { text: e.target.value }, `text:${t.id}`)}
              rows={2}
              className="mb-2 w-full resize-y rounded-lg border border-input bg-background/50 px-2.5 py-2 text-sm outline-none focus:border-ring"
            />
            <div className="grid max-h-44 grid-cols-2 gap-1 overflow-y-auto scrollbar-thin pr-1">
              {FONTS.map((f) => (
                <button
                  key={f.name}
                  type="button"
                  onClick={() => updateLayer(t.id, { fontFamily: f.name, fontWeight: [ "Bebas Neue", "Anton", "Permanent Marker", "Pacifico", "DM Serif" ].includes(f.name) ? 400 : t.fontWeight })}
                  className={cn(
                    "h-8 truncate rounded-md px-2 text-left text-[14px] text-muted-foreground transition hover:bg-muted hover:text-foreground",
                    f.className,
                    t.fontFamily === f.name && "bg-primary/12 text-primary",
                  )}
                >
                  {f.name}
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-1">
              {[
                { i: Bold, on: t.fontWeight >= 700, f: () => updateLayer(t.id, { fontWeight: t.fontWeight >= 700 ? 400 : 700 }), l: "Fett" },
                { i: Italic, on: t.italic, f: () => updateLayer(t.id, { italic: !t.italic }), l: "Kursiv" },
                { i: CaseUpper, on: t.uppercase, f: () => updateLayer(t.id, { uppercase: !t.uppercase }), l: "Großbuchstaben" },
              ].map(({ i: I, on, f, l }) => (
                <Button key={l} size="icon-sm" variant={on ? "default" : "secondary"} onClick={f} aria-label={l} title={l}>
                  <I />
                </Button>
              ))}
              <div className="flex-1" />
              {(["left", "center", "right"] as const).map((a) => {
                const I = a === "left" ? AlignLeft : a === "center" ? AlignCenter : AlignRight
                return (
                  <Button key={a} size="icon-sm" variant={t.align === a ? "default" : "secondary"} onClick={() => updateLayer(t.id, { align: a })} aria-label={`Ausrichtung ${a}`}>
                    <I />
                  </Button>
                )
              })}
            </div>
            <AdjustSlider label="Größe" value={Math.round(t.fontSize)} min={6} max={600} onChange={(v) => updateLayer(t.id, { fontSize: v })} format={(v) => `${Math.round(v)} px`} />
            <AdjustSlider label="Laufweite" value={t.letterSpacing} min={-10} max={60} onChange={(v) => updateLayer(t.id, { letterSpacing: v })} />
            <AdjustSlider label="Zeilenabstand" value={t.lineHeight} min={0.7} max={2.5} step={0.05} neutral={1.15} onChange={(v) => updateLayer(t.id, { lineHeight: v })} />
          </Section>
          <Section title="Stil">
            <ColorRow label="Textfarbe" value={t.color} onChange={(c) => updateLayer(t.id, { color: c ?? "#ffffff" })} />
            <ColorRow label="Hintergrund" allowNone value={t.background} onChange={(c) => updateLayer(t.id, { background: c })} />
            <ColorRow label="Kontur" allowNone value={t.strokeColor} onChange={(c) => updateLayer(t.id, { strokeColor: c, strokeWidth: c && !t.strokeWidth ? Math.max(2, t.fontSize * 0.04) : t.strokeWidth })} />
            {t.strokeColor && (
              <AdjustSlider label="Konturstärke" value={t.strokeWidth} min={0} max={40} step={0.5} onChange={(v) => updateLayer(t.id, { strokeWidth: v })} />
            )}
            <label className="mt-1 flex items-center justify-between text-[12px] text-muted-foreground">
              Schatten
              <input type="checkbox" checked={t.shadow} onChange={(e) => updateLayer(t.id, { shadow: e.target.checked })} className="size-4 accent-[var(--lime)]" />
            </label>
          </Section>
          <LayerAppearance layer={t} />
        </>
      )}
    </div>
  )
}

export function ShapesPanel() {
  const kind = useEditor((s) => s.shapeKind)
  const setKind = useEditor((s) => s.setShapeKind)
  const sel = useEditor((s) => s.doc.layers.find((l) => l.id === s.selectedId))
  const updateLayer = useEditor((s) => s.updateLayer)
  const sh = sel?.type === "shape" ? (sel as ShapeLayer) : null
  const KINDS = [
    { id: "rect", i: Square, l: "Rechteck" },
    { id: "ellipse", i: Circle, l: "Ellipse" },
    { id: "line", i: Minus, l: "Linie" },
    { id: "arrow", i: ArrowUpRight, l: "Pfeil" },
  ] as const
  return (
    <div>
      <Section title="Form">
        <div className="grid grid-cols-4 gap-1.5">
          {KINDS.map(({ id, i: I, l }) => (
            <button
              key={id}
              type="button"
              onClick={() => setKind(id)}
              title={l}
              className={cn(
                "grid aspect-square place-items-center rounded-lg bg-muted/60 text-muted-foreground transition hover:bg-muted hover:text-foreground",
                kind === id && "bg-primary/12 text-primary ring-1 ring-primary/50",
              )}
            >
              <I className="size-5" />
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Im Bild aufziehen. Shift = gleichmäßig.</p>
      </Section>
      {sh && (
        <>
          <Section title="Stil">
            {sh.shape !== "line" && sh.shape !== "arrow" && (
              <ColorRow label="Füllung" allowNone value={sh.fill} onChange={(c) => updateLayer(sh.id, { fill: c })} />
            )}
            <ColorRow label="Kontur" allowNone={sh.shape !== "line" && sh.shape !== "arrow"} value={sh.stroke} onChange={(c) => updateLayer(sh.id, { stroke: c })} />
            <AdjustSlider label="Konturstärke" value={sh.strokeWidth} min={0} max={80} onChange={(v) => updateLayer(sh.id, { strokeWidth: v })} />
            {sh.shape === "rect" && (
              <AdjustSlider label="Eckenradius" value={sh.radius} min={0} max={Math.round(Math.min(Math.abs(sh.width), Math.abs(sh.height)) / 2)} onChange={(v) => updateLayer(sh.id, { radius: v })} />
            )}
          </Section>
          <LayerAppearance layer={sh} />
        </>
      )}
    </div>
  )
}

export function DrawPanel() {
  const draw = useEditor((s) => s.draw)
  const setDraw = useEditor((s) => s.setDraw)
  const sel = useEditor((s) => s.doc.layers.find((l) => l.id === s.selectedId))
  return (
    <div>
      <Section title="Pinsel">
        <div className="mb-2 grid grid-cols-2 gap-1.5">
          <Button variant={!draw.erase ? "default" : "secondary"} onClick={() => setDraw({ erase: false })}>
            <Pencil /> Malen
          </Button>
          <Button variant={draw.erase ? "default" : "secondary"} onClick={() => setDraw({ erase: true })}>
            <Eraser /> Radieren
          </Button>
        </div>
        <ColorRow label="Farbe" value={draw.color} onChange={(c) => setDraw({ color: c ?? "#ffffff", erase: false })} />
        <AdjustSlider label="Größe" value={draw.size} min={1} max={200} onChange={(v) => setDraw({ size: v })} format={(v) => `${Math.round(v)} px`} />
        <p className="mt-1 text-[11px] text-muted-foreground">Striche landen in der ausgewählten Zeichen-Ebene oder in einer neuen.</p>
      </Section>
      {sel?.type === "draw" && <LayerAppearance layer={sel} />}
    </div>
  )
}

export function MovePanel() {
  const sel = useEditor((s) => s.doc.layers.find((l) => l.id === s.selectedId))
  if (!sel)
    return (
      <div className="grid gap-2 p-4 text-sm text-muted-foreground">
        <Type className="size-5 text-primary" />
        Wähle eine Ebene im Bild oder in der Ebenenliste aus, um sie zu verschieben, zu skalieren oder zu drehen.
        <span className="text-[11px]">Tipp: Bilder per Drag & Drop oder Strg+V als neue Ebene einfügen.</span>
      </div>
    )
  if (sel.type === "text") return <TextPanel />
  if (sel.type === "shape") return <ShapesPanel />
  return <LayerAppearance layer={sel} />
}
