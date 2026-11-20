"use client"

import * as React from "react"
import { Brush, Circle, Eraser, Grid3x3, Droplets, Square, ScanFace, Sparkles, SquareSlash, Snowflake, ShieldCheck } from "lucide-react"
import { AdjustSlider, Section } from "../adjust-slider"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useEditor } from "@/lib/editor/store"
import { autoDetectFaces } from "@/lib/editor/actions"
import { EFFECT_LABEL } from "@/lib/editor/defaults"
import type { EffectKind, EffectLayer, RegionShape } from "@/lib/editor/types"
import { cn } from "@/lib/utils"

const EFFECTS: { id: EffectKind; icon: React.ElementType; hint: string }[] = [
  { id: "pixelate", icon: Grid3x3, hint: "Klassisch verpixeln" },
  { id: "blur", icon: Droplets, hint: "Weich verwischen" },
  { id: "redact", icon: SquareSlash, hint: "100 % sicher" },
  { id: "glass", icon: Snowflake, hint: "Milchglas-Look" },
  { id: "noise", icon: Sparkles, hint: "Mit Rauschen zerstören" },
]

const REGIONS: { id: RegionShape; icon: React.ElementType; label: string }[] = [
  { id: "rect", icon: Square, label: "Rechteck" },
  { id: "ellipse", icon: Circle, label: "Ellipse" },
  { id: "brush", icon: Brush, label: "Pinsel" },
]

export function PrivacyPanel() {
  const privacy = useEditor((s) => s.privacy)
  const setPrivacy = useEditor((s) => s.setPrivacy)
  const selected = useEditor((s) => s.doc.layers.find((l) => l.id === s.selectedId))
  const effectLayers = useEditor((s) => s.doc.layers.filter((l) => l.type === "effect").length)
  const hasImage = useEditor((s) => !!s.doc.baseAssetId)
  const updateLayer = useEditor((s) => s.updateLayer)
  const [busy, setBusy] = React.useState(false)
  const sel = selected?.type === "effect" ? (selected as EffectLayer) : null

  const chooseEffect = (e: EffectKind) => {
    setPrivacy({ effect: e })
    if (sel) {
      const minDim = 1000
      updateLayer(sel.id, {
        effect: e,
        name: EFFECT_LABEL[e],
        amount: e === sel.effect ? sel.amount : e === "noise" ? 60 : e === "redact" ? sel.amount : Math.max(8, sel.amount || minDim / 40),
      } as Partial<EffectLayer>)
    }
  }

  const amountLabel = (e: EffectKind) =>
    e === "pixelate" ? "Pixelgröße" : e === "blur" ? "Stärke" : e === "glass" ? "Streuung" : e === "noise" ? "Rauschen" : ""

  return (
    <div>
      <div className="grid gap-3 p-4">
        <Button
          className="h-10 w-full justify-start gap-2"
          disabled={!hasImage || busy}
          onClick={async () => {
            setBusy(true)
            await autoDetectFaces()
            setBusy(false)
          }}
        >
          <ScanFace className="size-4" />
          {busy ? "Suche Gesichter …" : "Gesichter automatisch finden"}
        </Button>
        <p className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
          <ShieldCheck className="mt-px size-3.5 shrink-0 text-primary" />
          Die Erkennung läuft komplett auf deinem Gerät. Dein Foto wird nirgendwo hochgeladen.
        </p>
      </div>

      <Section title="Effekt">
        <div className="grid grid-cols-5 gap-1.5">
          {EFFECTS.map(({ id, icon: Icon, hint }) => {
            const active = (sel?.effect ?? privacy.effect) === id
            return (
              <button
                key={id}
                type="button"
                title={hint}
                onClick={() => chooseEffect(id)}
                className={cn(
                  "grid aspect-square place-items-center gap-0.5 rounded-lg bg-muted/60 p-1 text-muted-foreground ring-1 ring-transparent transition hover:bg-muted hover:text-foreground",
                  active && "bg-primary/12 text-primary ring-primary/50",
                )}
              >
                <Icon className="size-4" />
                <span className="text-[9.5px] leading-none">{EFFECT_LABEL[id].replace("Weichzeichner", "Blur")}</span>
              </button>
            )
          })}
        </div>
      </Section>

      <Section title="Bereich">
        <div className="grid grid-cols-3 gap-1.5">
          {REGIONS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setPrivacy({ region: id, erase: false })}
              className={cn(
                "flex h-8 items-center justify-center gap-1.5 rounded-lg bg-muted/60 text-[12px] text-muted-foreground transition hover:bg-muted hover:text-foreground",
                privacy.region === id && !privacy.erase && "bg-primary/12 text-primary ring-1 ring-primary/50",
              )}
            >
              <Icon className="size-3.5" /> {label}
            </button>
          ))}
        </div>
        {privacy.region === "brush" && (
          <div className="mt-3 grid gap-2">
            <AdjustSlider
              label="Pinselgröße"
              value={privacy.brushSize}
              min={4}
              max={300}
              onChange={(v) => setPrivacy({ brushSize: v })}
              format={(v) => `${Math.round(v)} px`}
            />
            <button
              type="button"
              onClick={() => setPrivacy({ erase: !privacy.erase })}
              className={cn(
                "flex h-8 items-center justify-center gap-1.5 rounded-lg bg-muted/60 text-[12px] text-muted-foreground transition hover:bg-muted",
                privacy.erase && "bg-destructive/15 text-destructive ring-1 ring-destructive/40",
              )}
            >
              <Eraser className="size-3.5" /> {privacy.erase ? "Radierer aktiv" : "Radierer"}
            </button>
          </div>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          {privacy.region === "brush"
            ? "Male über die Stellen, die unkenntlich werden sollen."
            : "Zieh einen Rahmen über die Stelle. Shift = Quadrat/Kreis."}
        </p>
      </Section>

      {sel && (
        <Section title="Ausgewählter Bereich">
          {sel.effect !== "redact" ? (
            <AdjustSlider
              label={amountLabel(sel.effect)}
              value={sel.amount}
              min={sel.effect === "noise" ? 0 : 2}
              max={sel.effect === "noise" ? 100 : 200}
              onChange={(v) => updateLayer(sel.id, { amount: v })}
            />
          ) : (
            <label className="flex items-center justify-between py-1 text-[12px] text-muted-foreground">
              Farbe
              <input
                type="color"
                value={sel.color}
                onChange={(e) => updateLayer(sel.id, { color: e.target.value })}
                className="h-7 w-12 cursor-pointer rounded border border-input bg-transparent"
              />
            </label>
          )}
          <AdjustSlider label="Weiche Kante" value={sel.feather} min={0} max={120} onChange={(v) => updateLayer(sel.id, { feather: v })} />
          <AdjustSlider
            label="Deckkraft"
            value={Math.round(sel.opacity * 100)}
            min={0}
            max={100}
            neutral={100}
            format={(v) => `${Math.round(v)}%`}
            onChange={(v) => updateLayer(sel.id, { opacity: v / 100 })}
          />
          <div className="mt-2 flex items-center justify-between text-[12px]">
            <span className="text-muted-foreground">Umkehren (alles außer Bereich)</span>
            <Switch checked={sel.invert} onCheckedChange={(v) => updateLayer(sel.id, { invert: v })} aria-label="Umkehren" />
          </div>
          {sel.effect === "blur" && sel.amount < 12 && (
            <p className="mt-2 rounded-md bg-amber-500/10 p-2 text-[11px] text-amber-300">
              Schwacher Weichzeichner kann bei Text teilweise rekonstruiert werden. Für sensible Daten: Schwärzen.
            </p>
          )}
        </Section>
      )}
      {!sel && effectLayers > 0 && (
        <p className="px-4 py-3 text-[11px] text-muted-foreground">
          Tipp: Klicke einen Bereich im Bild an, um ihn zu verschieben oder die Stärke zu ändern.
        </p>
      )}
    </div>
  )
}
