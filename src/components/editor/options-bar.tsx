"use client"

import * as React from "react"
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowUpRight,
  Bold,
  Check,
  Circle,
  Copy,
  Crop,
  Eraser,
  FlipHorizontal2,
  FlipVertical2,
  Italic,
  Lasso,
  Minus,
  PaintBucket,
  RotateCcw,
  RotateCw,
  ScanFace,
  Square,
  Trash2,
  Undo2,
  X,
  Brush,
  ShieldHalf,
  CaseUpper,
  SlidersHorizontal,
} from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { ColorPicker, Divider, IconBtn, MiniSlider, NumberField, Seg } from "./controls"
import { useEditor } from "@/lib/editor/store"
import { applyCrop, autoDetectFaces, flip, rotate90 } from "@/lib/editor/actions"
import {
  alignLayer,
  copyToNewLayer,
  cropToSelection,
  deleteSelection,
  fillSelection,
  flipLayer,
  invertSelection,
  privacyFromSelection,
  selectAll,
} from "@/lib/editor/ops"
import { docSize, layerBounds, rotatedSize, measureText } from "@/lib/editor/render"
import { FONTS } from "@/lib/editor/fonts"
import { EFFECT_LABEL } from "@/lib/editor/defaults"
import { BASE_ID, type EffectKind, type Layer, type TextLayer } from "@/lib/editor/types"

export function OptionsBar() {
  const tool = useEditor((s) => s.tool)
  return (
    <div className="flex h-10 shrink-0 items-center gap-2 overflow-x-auto border-b border-white/6 bg-background/60 px-3 scrollbar-thin [&>*]:shrink-0">
      {tool === "move" && <MoveOptions />}
      {tool === "select" && <SelectOptions />}
      {tool === "crop" && <CropOptions />}
      {tool === "eyedropper" && <EyedropperOptions />}
      {(tool === "brush" || tool === "eraser") && <BrushOptions eraser={tool === "eraser"} />}
      {tool === "text" && <TextOptions />}
      {tool === "shapes" && <ShapeOptions />}
      {tool === "privacy" && <PrivacyOptions />}
      {(tool === "hand" || tool === "zoom") && <ViewOptions />}
    </div>
  )
}

const useSelectedLayer = () =>
  useEditor((s) => (s.selectedId && s.selectedId !== BASE_ID ? (s.doc.layers.find((l) => l.id === s.selectedId) ?? null) : null))

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-medium text-muted-foreground">{children}</span>
}

/* ------------------------------------------------------------------ move */
function MoveOptions() {
  const autoSelect = useEditor((s) => s.autoSelect)
  const setAutoSelect = useEditor((s) => s.setAutoSelect)
  const l = useSelectedLayer()
  const updateLayer = useEditor((s) => s.updateLayer)
  const b = l ? layerBounds(l) : null
  const setBox = (p: Partial<{ x: number; y: number; w: number; h: number }>) => {
    if (!l || !b) return
    if (l.type === "image" || l.type === "shape" || (l.type === "effect" && l.region !== "brush")) {
      updateLayer(l.id, {
        ...(p.x !== undefined && { x: p.x }),
        ...(p.y !== undefined && { y: p.y }),
        ...(p.w !== undefined && { width: p.w }),
        ...(p.h !== undefined && { height: p.h }),
      } as Partial<Layer>)
    } else if (l.type === "text") {
      if (p.h !== undefined) updateLayer(l.id, { fontSize: Math.max(4, (l.fontSize * p.h) / b.h) })
      else updateLayer(l.id, { x: l.x + (p.x ?? b.x) - b.x, y: l.y + (p.y ?? b.y) - b.y })
    }
  }
  return (
    <>
      <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <input type="checkbox" checked={autoSelect} onChange={(e) => setAutoSelect(e.target.checked)} className="size-3.5 accent-[var(--lime)]" />
        Automatisch wählen
      </label>
      <Divider />
      {l && b ? (
        <>
          <NumberField label="X" value={Math.round(b.x)} onChange={(v) => setBox({ x: v })} suffix="px" />
          <NumberField label="Y" value={Math.round(b.y)} onChange={(v) => setBox({ y: v })} suffix="px" />
          {l.type !== "draw" && !(l.type === "effect" && l.region === "brush") && (
            <>
              <NumberField label="B" value={Math.round(Math.abs(b.w))} min={1} onChange={(v) => setBox({ w: v })} suffix="px" />
              <NumberField label="H" value={Math.round(Math.abs(b.h))} min={1} onChange={(v) => setBox({ h: v })} suffix="px" />
            </>
          )}
          {"rotation" in l && (
            <NumberField
              label="∠"
              value={Math.round(l.rotation)}
              min={-180}
              max={180}
              onChange={(v) => updateLayer(l.id, { rotation: v } as Partial<Layer>)}
              suffix="°"
              width="w-12"
            />
          )}
          <Divider />
          <IconBtn label="Links ausrichten" onClick={() => alignLayer("left")}><AlignStartVertical /></IconBtn>
          <IconBtn label="Horizontal zentrieren" onClick={() => alignLayer("hcenter")}><AlignCenterVertical /></IconBtn>
          <IconBtn label="Rechts ausrichten" onClick={() => alignLayer("right")}><AlignEndVertical /></IconBtn>
          <IconBtn label="Oben ausrichten" onClick={() => alignLayer("top")}><AlignStartHorizontal /></IconBtn>
          <IconBtn label="Vertikal zentrieren" onClick={() => alignLayer("vcenter")}><AlignCenterHorizontal /></IconBtn>
          <IconBtn label="Unten ausrichten" onClick={() => alignLayer("bottom")}><AlignEndHorizontal /></IconBtn>
          {l.type === "image" && (
            <>
              <Divider />
              <IconBtn label="Horizontal spiegeln" onClick={() => flipLayer("h")}><FlipHorizontal2 /></IconBtn>
              <IconBtn label="Vertikal spiegeln" onClick={() => flipLayer("v")}><FlipVertical2 /></IconBtn>
            </>
          )}
        </>
      ) : (
        <Label>Klicke eine Ebene im Bild an – Ziehen verschiebt, Griffe skalieren (Shift = frei), Alt = von der Mitte.</Label>
      )}
    </>
  )
}

/* ------------------------------------------------------------- selection */
function SelectOptions() {
  const mode = useEditor((s) => s.selectMode)
  const setMode = useEditor((s) => s.setSelectMode)
  const sel = useEditor((s) => s.selection)
  const setSelection = useEditor((s) => s.setSelection)
  return (
    <>
      <Seg
        value={mode}
        onChange={setMode}
        items={[
          { v: "rect", label: <><Square /> Rechteck</> },
          { v: "ellipse", label: <><Circle /> Ellipse</> },
          { v: "lasso", label: <><Lasso /> Lasso</> },
        ]}
      />
      <Divider />
      <Button size="xs" variant="ghost" onClick={selectAll}>Alles</Button>
      {sel ? (
        <>
          <Button size="xs" variant="ghost" onClick={() => setSelection(null)}><X /> Aufheben</Button>
          <Button size="xs" variant="ghost" onClick={invertSelection}>Umkehren</Button>
          <Divider />
          <Button size="xs" variant="secondary" onClick={() => fillSelection()}><PaintBucket /> Füllen</Button>
          <Button size="xs" variant="secondary" onClick={deleteSelection}><Trash2 /> Löschen</Button>
          <Button size="xs" variant="secondary" onClick={() => copyToNewLayer()}><Copy /> Neue Ebene</Button>
          <Button size="xs" variant="secondary" onClick={privacyFromSelection}><ShieldHalf /> Unkenntlich</Button>
          <Button size="xs" variant="secondary" onClick={cropToSelection}><Crop /> Freistellen</Button>
        </>
      ) : (
        <Label>Aufziehen (Shift = Quadrat/Kreis, Alt = von der Mitte). Danach füllen, löschen, kopieren oder unkenntlich machen.</Label>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ crop */
const RATIOS: { label: string; v: number | null }[] = [
  { label: "Frei", v: null },
  { label: "1:1", v: 1 },
  { label: "4:5", v: 4 / 5 },
  { label: "9:16", v: 9 / 16 },
  { label: "16:9", v: 16 / 9 },
  { label: "3:2", v: 3 / 2 },
  { label: "2:3", v: 2 / 3 },
  { label: "4:3", v: 4 / 3 },
  { label: "3:1", v: 3 },
]

function CropOptions() {
  const crop = useEditor((s) => s.crop)
  const setCrop = useEditor((s) => s.setCrop)
  const doc = useEditor((s) => s.doc)
  const patch = useEditor((s) => s.patch)
  if (!doc.baseAssetId) return <Label>Freistellen wirkt auf das Foto. Für leere Leinwände: Auswahl ziehen → „Freistellen“.</Label>
  const R = rotatedSize(doc)
  const r = crop.rect ?? doc.geometry.crop
  const fitAspect = (asp: number) => {
    let w = 1
    let h = R.w / asp / R.h
    if (h > 1) {
      h = 1
      w = (R.h * asp) / R.w
    }
    setCrop({ aspect: asp, rect: { x: r.x + r.w / 2 - w / 2 < 0 ? 0 : Math.min(1 - w, r.x + r.w / 2 - w / 2), y: Math.max(0, Math.min(1 - h, r.y + r.h / 2 - h / 2)), w, h } })
  }
  return (
    <>
      <select
        value={RATIOS.findIndex((x) => x.v === crop.aspect || (x.v && crop.aspect && Math.abs(x.v - crop.aspect) < 1e-3))}
        onChange={(e) => {
          const ra = RATIOS[Number(e.target.value)]
          if (ra.v) fitAspect(ra.v)
          else setCrop({ aspect: null })
        }}
        className="h-7 rounded-md border border-input bg-background px-2 text-[12px]"
        aria-label="Seitenverhältnis"
      >
        {RATIOS.map((x, i) => (
          <option key={x.label} value={i}>{x.label}</option>
        ))}
      </select>
      <span className="font-mono text-[11px] text-muted-foreground">{Math.round(r.w * R.w)} × {Math.round(r.h * R.h)} px</span>
      <Divider />
      <IconBtn label="90° links drehen" onClick={() => rotate90(-1)}><RotateCcw /></IconBtn>
      <IconBtn label="90° rechts drehen" onClick={() => rotate90(1)}><RotateCw /></IconBtn>
      <IconBtn label="Horizontal spiegeln" onClick={() => flip("h")}><FlipHorizontal2 /></IconBtn>
      <IconBtn label="Vertikal spiegeln" onClick={() => flip("v")}><FlipVertical2 /></IconBtn>
      <Divider />
      <MiniSlider
        label="Begradigen"
        value={doc.geometry.straighten}
        min={-45}
        max={45}
        step={0.1}
        format={(v) => `${v.toFixed(1)}°`}
        onChange={(v) => patch((d) => void (d.geometry.straighten = v), "straighten")}
      />
      <Divider />
      <Button
        size="xs"
        variant="ghost"
        onClick={() => {
          setCrop({ rect: { x: 0, y: 0, w: 1, h: 1 }, aspect: null })
          patch((d) => void (d.geometry.straighten = 0))
        }}
      >
        <Undo2 /> Zurücksetzen
      </Button>
      <Button size="xs" variant="ghost" onClick={() => useEditor.getState().setTool("move")}><X /> Abbrechen</Button>
      <Button
        size="xs"
        onClick={() => {
          applyCrop()
          useEditor.getState().setTool("move")
        }}
      >
        <Check /> Anwenden
      </Button>
    </>
  )
}

function EyedropperOptions() {
  const fg = useEditor((s) => s.fg)
  return (
    <>
      <span className="size-5 rounded ring-1 ring-white/30" style={{ background: fg }} />
      <span className="font-mono text-[12px] uppercase">{fg}</span>
      <Label>Klicke ins Bild, um die Vordergrundfarbe aufzunehmen.</Label>
    </>
  )
}

/* ---------------------------------------------------------- brush/eraser */
function BrushOptions({ eraser }: { eraser: boolean }) {
  const set = useEditor((s) => (eraser ? s.eraser : s.brush))
  const update = useEditor((s) => (eraser ? s.setEraser : s.setBrush))
  const fg = useEditor((s) => s.fg)
  const setColors = useEditor((s) => s.setColors)
  const target = useEditor((s) =>
    s.selectedId === BASE_ID ? "Hintergrund" : (s.doc.layers.find((l) => l.id === s.selectedId)?.name ?? null),
  )
  return (
    <>
      {eraser ? <Eraser className="size-4 text-muted-foreground" /> : <Brush className="size-4 text-muted-foreground" />}
      <MiniSlider label="Größe" value={set.size} min={1} max={500} onChange={(v) => update({ size: v })} format={(v) => `${Math.round(v)}`} />
      <MiniSlider label="Härte" value={Math.round(set.hardness * 100)} min={0} max={100} onChange={(v) => update({ hardness: v / 100 })} format={(v) => `${v}%`} />
      <MiniSlider label="Deckkraft" value={Math.round(set.opacity * 100)} min={1} max={100} onChange={(v) => update({ opacity: v / 100 })} format={(v) => `${v}%`} />
      {!eraser && (
        <>
          <Divider />
          <ColorPicker label="Pinselfarbe" value={fg} onChange={(c) => c && setColors({ fg: c })} />
        </>
      )}
      <Divider />
      <Label>
        {eraser
          ? target
            ? `Radiert auf: ${target}`
            : "Wähle eine Ebene zum Radieren"
          : "Malt auf die aktive Ebene (oder legt eine neue an) · [ ] = Größe · Shift+Klick = gerade Linie · Alt = Pipette"}
      </Label>
    </>
  )
}

/* ------------------------------------------------------------------ text */
function TextOptions() {
  const l = useSelectedLayer()
  const t = l?.type === "text" ? l : null
  const style = useEditor((s) => s.textStyle)
  const setStyle = useEditor((s) => s.setTextStyle)
  const updateLayer = useEditor((s) => s.updateLayer)
  const fg = useEditor((s) => s.fg)
  const setColors = useEditor((s) => s.setColors)
  const docMin = useEditor((s) => {
    const d = docSize(s.doc)
    return Math.min(d.w, d.h)
  })
  const v = { ...style, ...(t ?? {}) } as Partial<TextLayer>
  const set = (p: Partial<TextLayer>) => {
    setStyle(p)
    if (t) updateLayer(t.id, p)
  }
  return (
    <>
      <select
        value={v.fontFamily}
        onChange={(e) => {
          const name = e.target.value
          set({ fontFamily: name, fontWeight: ["Bebas Neue", "Anton", "Permanent Marker", "Pacifico", "DM Serif"].includes(name) ? 400 : v.fontWeight })
        }}
        className="h-7 w-40 rounded-md border border-input bg-background px-2 text-[12px]"
        aria-label="Schriftart"
        style={{ fontFamily: FONTS.find((f) => f.name === v.fontFamily)?.family }}
      >
        {FONTS.map((f) => (
          <option key={f.name} value={f.name} style={{ fontFamily: f.family }}>
            {f.name}
          </option>
        ))}
      </select>
      <NumberField
        value={Math.round(v.fontSize ?? Math.round(docMin * 0.07))}
        min={4}
        max={2000}
        onChange={(n) => set({ fontSize: n })}
        suffix="px"
        width="w-16"
      />
      <IconBtn label="Fett" active={(v.fontWeight ?? 400) >= 700} onClick={() => set({ fontWeight: (v.fontWeight ?? 400) >= 700 ? 400 : 700 })}><Bold /></IconBtn>
      <IconBtn label="Kursiv" active={!!v.italic} onClick={() => set({ italic: !v.italic })}><Italic /></IconBtn>
      <IconBtn label="Großbuchstaben" active={!!v.uppercase} onClick={() => set({ uppercase: !v.uppercase })}><CaseUpper /></IconBtn>
      <Divider />
      <IconBtn label="Linksbündig" active={v.align === "left"} onClick={() => alignText(t, "left", set)}><AlignLeft /></IconBtn>
      <IconBtn label="Zentriert" active={v.align === "center"} onClick={() => alignText(t, "center", set)}><AlignCenter /></IconBtn>
      <IconBtn label="Rechtsbündig" active={v.align === "right"} onClick={() => alignText(t, "right", set)}><AlignRight /></IconBtn>
      <Divider />
      <ColorPicker
        label="Textfarbe"
        value={t?.color ?? fg}
        onChange={(c) => {
          if (!c) return
          setColors({ fg: c })
          if (t) updateLayer(t.id, { color: c })
        }}
      />
      <Popover>
        <PopoverTrigger className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground">
          <SlidersHorizontal className="size-3.5" /> Stil
        </PopoverTrigger>
        <PopoverContent className="w-64 gap-3" align="start">
          <div className="flex items-center justify-between text-[12px]">
            Kontur
            <div className="flex items-center gap-2">
              <NumberField value={v.strokeWidth ?? 0} min={0} max={60} step={0.5} decimals={1} onChange={(n) => set({ strokeWidth: n, strokeColor: v.strokeColor ?? "#000000" })} width="w-12" />
              <ColorPicker size="sm" label="Konturfarbe" allowNone value={v.strokeColor ?? null} onChange={(c) => set({ strokeColor: c, strokeWidth: c && !v.strokeWidth ? 3 : v.strokeWidth })} />
            </div>
          </div>
          <div className="flex items-center justify-between text-[12px]">
            Hintergrund
            <ColorPicker size="sm" label="Hintergrund" allowNone value={v.background ?? null} onChange={(c) => set({ background: c })} />
          </div>
          <label className="flex items-center justify-between text-[12px]">
            Schatten
            <input type="checkbox" checked={!!v.shadow} onChange={(e) => set({ shadow: e.target.checked })} className="size-4 accent-[var(--lime)]" />
          </label>
          <MiniSlider label="Laufweite" value={v.letterSpacing ?? 0} min={-10} max={60} onChange={(n) => set({ letterSpacing: n })} width="w-28" />
          <MiniSlider label="Zeilenabst." value={v.lineHeight ?? 1.15} min={0.7} max={2.5} step={0.05} format={(n) => n.toFixed(2)} onChange={(n) => set({ lineHeight: n })} width="w-28" />
        </PopoverContent>
      </Popover>
      <Divider />
      <Label>Ins Bild klicken und tippen · Text anklicken zum Bearbeiten · Esc beendet</Label>
    </>
  )
}

/** keeps the text visually in place when the alignment anchor changes */
function alignText(t: TextLayer | null, align: TextLayer["align"], set: (p: Partial<TextLayer>) => void) {
  if (!t) return set({ align })
  const m = measureText(t)
  const left = t.x + m.box.x + (t.background ? m.pad : 0)
  const x = align === "left" ? left : align === "center" ? left + m.w / 2 : left + m.w
  set({ align })
  useEditor.getState().updateLayer(t.id, { align, x })
}

/* ---------------------------------------------------------------- shapes */
function ShapeOptions() {
  const kind = useEditor((s) => s.shapeKind)
  const setKind = useEditor((s) => s.setShapeKind)
  const style = useEditor((s) => s.shapeStyle)
  const setStyle = useEditor((s) => s.setShapeStyle)
  const l = useSelectedLayer()
  const sh = l?.type === "shape" ? l : null
  const updateLayer = useEditor((s) => s.updateLayer)
  const v = sh ? { fill: sh.fill, stroke: sh.stroke, strokeWidth: sh.strokeWidth, radius: sh.radius } : style
  const set = (p: Partial<typeof style>) => {
    setStyle(p)
    if (sh) updateLayer(sh.id, p)
  }
  const line = (sh?.shape ?? kind) === "line" || (sh?.shape ?? kind) === "arrow"
  return (
    <>
      <Seg
        value={kind}
        onChange={setKind}
        items={[
          { v: "rect", label: <Square />, title: "Rechteck" },
          { v: "ellipse", label: <Circle />, title: "Ellipse" },
          { v: "line", label: <Minus />, title: "Linie" },
          { v: "arrow", label: <ArrowUpRight />, title: "Pfeil" },
        ]}
      />
      <Divider />
      {!line && (
        <>
          <Label>Füllung</Label>
          <ColorPicker label="Füllung" allowNone value={v.fill} onChange={(c) => set({ fill: c })} />
        </>
      )}
      <Label>Kontur</Label>
      <ColorPicker label="Kontur" allowNone={!line} value={v.stroke} onChange={(c) => set({ stroke: c })} />
      <NumberField value={v.strokeWidth} min={0} max={200} onChange={(n) => set({ strokeWidth: n })} suffix="px" width="w-14" />
      {(sh?.shape ?? kind) === "rect" && <NumberField label="Radius" value={v.radius} min={0} max={2000} onChange={(n) => set({ radius: n })} suffix="px" />}
      <Divider />
      <Label>Aufziehen · Shift = gleichmäßig · Alt = von der Mitte</Label>
    </>
  )
}

/* --------------------------------------------------------------- privacy */
const EFFECTS: EffectKind[] = ["pixelate", "blur", "redact", "glass", "noise"]

function PrivacyOptions() {
  const privacy = useEditor((s) => s.privacy)
  const setPrivacy = useEditor((s) => s.setPrivacy)
  const hasImage = useEditor((s) => !!s.doc.baseAssetId)
  const l = useSelectedLayer()
  const eff = l?.type === "effect" ? l : null
  const updateLayer = useEditor((s) => s.updateLayer)
  const [busy, setBusy] = React.useState(false)
  return (
    <>
      <Button
        size="xs"
        disabled={!hasImage || busy}
        onClick={async () => {
          setBusy(true)
          await autoDetectFaces()
          setBusy(false)
        }}
      >
        <ScanFace /> {busy ? "Suche …" : "Gesichter finden"}
      </Button>
      <Divider />
      <Seg
        value={eff?.effect ?? privacy.effect}
        onChange={(e) => {
          setPrivacy({ effect: e })
          if (eff) updateLayer(eff.id, { effect: e, name: EFFECT_LABEL[e], amount: e === "noise" ? 60 : eff.amount })
        }}
        items={EFFECTS.map((e) => ({ v: e, label: EFFECT_LABEL[e].replace("Weichzeichner", "Blur") }))}
      />
      <Divider />
      <Seg
        value={privacy.region}
        onChange={(r) => setPrivacy({ region: r, erase: false })}
        items={[
          { v: "rect", label: <Square />, title: "Rechteck" },
          { v: "ellipse", label: <Circle />, title: "Ellipse" },
          { v: "brush", label: <Brush />, title: "Pinsel" },
        ]}
      />
      {privacy.region === "brush" && (
        <>
          <MiniSlider label="Größe" value={privacy.brushSize} min={4} max={400} onChange={(v) => setPrivacy({ brushSize: v })} />
          <IconBtn label="Radierer für Pinselbereich" active={privacy.erase} onClick={() => setPrivacy({ erase: !privacy.erase })}><Eraser /></IconBtn>
        </>
      )}
      {eff && eff.effect !== "redact" && (
        <>
          <Divider />
          <MiniSlider label="Stärke" value={eff.amount} min={eff.effect === "noise" ? 0 : 2} max={eff.effect === "noise" ? 100 : 200} onChange={(v) => updateLayer(eff.id, { amount: v })} />
          <MiniSlider label="Weiche Kante" value={eff.feather} min={0} max={120} onChange={(v) => updateLayer(eff.id, { feather: v })} />
        </>
      )}
      {eff && eff.effect === "redact" && (
        <>
          <Divider />
          <Label>Farbe</Label>
          <ColorPicker label="Schwärzungsfarbe" value={eff.color} onChange={(c) => c && updateLayer(eff.id, { color: c })} />
        </>
      )}
    </>
  )
}

function ViewOptions() {
  const zoom = useEditor((s) => s.zoom)
  const fit = useEditor((s) => s.fitZoom)
  const setZoom = useEditor((s) => s.setZoom)
  const z = zoom || fit
  return (
    <>
      <Button size="xs" variant="ghost" onClick={() => setZoom(0)}>Ganzes Bild</Button>
      <Button size="xs" variant="ghost" onClick={() => setZoom(1)}>100 %</Button>
      <Button size="xs" variant="ghost" onClick={() => setZoom(z * 1.25)}>Einzoomen</Button>
      <Button size="xs" variant="ghost" onClick={() => setZoom(z / 1.25)}>Auszoomen</Button>
      <span className="font-mono text-[11px] text-muted-foreground">{Math.round(z * 100)} %</span>
    </>
  )
}

