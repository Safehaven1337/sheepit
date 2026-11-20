"use client"

import * as React from "react"
import { Wand2, RotateCcw } from "lucide-react"
import { AdjustSlider, Section } from "../adjust-slider"
import { CurvesEditor } from "../curves-editor"
import { ColorWheel } from "../color-wheel"
import { Histogram, computeHistogram } from "../histogram"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useEditor } from "@/lib/editor/store"
import { HSL_CHANNELS, type Adjustments, type HslChannel } from "@/lib/editor/types"
import { renderDoc, invalidateRenderCache, docSize } from "@/lib/editor/render"
import { cn } from "@/lib/utils"

type NumKey = { [K in keyof Adjustments]: Adjustments[K] extends number ? K : never }[keyof Adjustments]

const HSL_COLORS: Record<HslChannel, string> = {
  red: "#ef4444",
  orange: "#f97316",
  yellow: "#eab308",
  green: "#22c55e",
  aqua: "#06b6d4",
  blue: "#3b82f6",
  purple: "#8b5cf6",
  magenta: "#d946ef",
}
const HSL_LABEL: Record<HslChannel, string> = {
  red: "Rot",
  orange: "Orange",
  yellow: "Gelb",
  green: "Grün",
  aqua: "Aquamarin",
  blue: "Blau",
  purple: "Lila",
  magenta: "Magenta",
}

export function useAdj() {
  const a = useEditor((s) => s.doc.adjustments)
  const patch = useEditor((s) => s.patch)
  const set = React.useCallback(
    <K extends keyof Adjustments>(k: K, v: Adjustments[K], key?: string) =>
      patch((d) => {
        d.adjustments[k] = v
      }, key ?? `adj:${String(k)}`),
    [patch],
  )
  return [a, set] as const
}

function S({
  k,
  label,
  min = -100,
  max = 100,
  step = 1,
  neutral,
  track,
  format,
}: {
  k: NumKey
  label: string
  min?: number
  max?: number
  step?: number
  neutral?: number
  track?: string
  format?: (v: number) => string
}) {
  const [a, set] = useAdj()
  return (
    <AdjustSlider
      label={label}
      value={a[k] as number}
      min={min}
      max={max}
      step={step}
      neutral={neutral}
      track={track}
      format={format}
      onChange={(v) => set(k, v as never)}
    />
  )
}

export function autoEnhance() {
  const s = useEditor.getState()
  if (!s.doc.baseAssetId) return
  const { w, h } = docSize(s.doc)
  const c = renderDoc({ ...s.doc, layers: [] }, s.assets, { scale: Math.min(1, 400 / Math.max(w, h)), original: true })
  invalidateRenderCache()
  const hist = computeHistogram(c, 400)
  const pct = (p: number) => {
    let acc = 0
    for (let i = 0; i < 256; i++) {
      acc += hist.l[i]
      if (acc >= hist.total * p) return i / 255
    }
    return 1
  }
  const lo = pct(0.005)
  const hi = pct(0.995)
  const mid = pct(0.5)
  let rs = 0, bs = 0, n = 0
  for (let i = 0; i < 256; i++) {
    rs += hist.r[i] * i
    bs += hist.b[i] * i
    n += hist.r[i]
  }
  const cast = n ? (rs - bs) / n / 255 : 0
  const exposure = Math.max(-1.5, Math.min(1.5, Math.log2(0.46 / Math.max(0.05, mid)) * 0.7))
  s.patch((d) => {
    const A = d.adjustments
    A.exposure = Math.round(exposure * 100) / 100
    A.blacks = Math.round(Math.max(-70, Math.min(30, -lo * 300 + 4)))
    A.whites = Math.round(Math.max(-40, Math.min(70, (1 - hi) * 260)))
    A.shadows = Math.round(Math.max(0, Math.min(45, (0.4 - mid) * 120)))
    A.highlights = Math.round(Math.max(-50, Math.min(0, (hi - 0.9) * -300)))
    A.contrast = Math.round(Math.max(5, Math.min(35, (0.8 - (hi - lo)) * 70)))
    A.vibrance = 18
    A.clarity = 8
    A.temperature = Math.round(Math.max(-30, Math.min(30, -cast * 120)))
  })
}

export function AdjustPanel() {
  const [a, set] = useAdj()
  const [hslTab, setHslTab] = React.useState<"hue" | "sat" | "lum">("sat")
  const resetAdjustments = useEditor((s) => s.resetAdjustments)
  const hasImage = useEditor((s) => !!s.doc.baseAssetId)

  if (!hasImage)
    return (
      <p className="p-4 text-sm text-muted-foreground">
        Anpassungen wirken auf ein Foto. Öffne ein Bild, um Belichtung, Farben und Details zu bearbeiten.
      </p>
    )

  return (
    <div>
      <div className="grid gap-2 px-4 pt-4 pb-3">
        <Histogram />
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" onClick={autoEnhance}>
            <Wand2 /> Auto
          </Button>
          <Button size="sm" variant="outline" onClick={resetAdjustments}>
            <RotateCcw /> Zurücksetzen
          </Button>
        </div>
      </div>

      <Section title="Licht">
        <S k="exposure" label="Belichtung" min={-5} max={5} step={0.01} format={(v) => (v > 0 ? "+" : "") + v.toFixed(2)} />
        <S k="contrast" label="Kontrast" />
        <S k="highlights" label="Lichter" />
        <S k="shadows" label="Tiefen" />
        <S k="whites" label="Weiß" />
        <S k="blacks" label="Schwarz" />
      </Section>

      <Section title="Farbe">
        <S k="temperature" label="Temperatur" track="linear-gradient(90deg,#3b82f6,#e5e7eb 50%,#f59e0b)" />
        <S k="tint" label="Tönung" track="linear-gradient(90deg,#22c55e,#e5e7eb 50%,#d946ef)" />
        <S k="vibrance" label="Dynamik" />
        <S k="saturation" label="Sättigung" track="linear-gradient(90deg,#777,#e5e7eb 50%,#ef4444)" />
        <div className="mt-2 flex items-center justify-between text-[12px]">
          <span className="text-muted-foreground">Schwarz-Weiß</span>
          <Switch checked={a.monochrome} onCheckedChange={(v) => set("monochrome", v)} aria-label="Schwarz-Weiß" />
        </div>
      </Section>

      <Section title="Präsenz">
        <S k="texture" label="Struktur" />
        <S k="clarity" label="Klarheit" />
        <S k="dehaze" label="Dunst entfernen" />
      </Section>

      <Section title="Gradationskurve" defaultOpen={false}>
        <CurvesEditor curves={a.curves} onChange={(c) => set("curves", c, "adj:curves")} />
      </Section>

      <Section title={a.monochrome ? "S/W-Mixer" : "Farbmischer"} defaultOpen={false}>
        {!a.monochrome && (
          <div className="mb-2 grid grid-cols-3 gap-1 rounded-lg bg-muted/60 p-0.5 text-[11px]">
            {(["hue", "sat", "lum"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setHslTab(t)}
                className={cn(
                  "h-6 rounded-md text-muted-foreground transition",
                  hslTab === t && "bg-background text-foreground shadow-sm",
                )}
              >
                {{ hue: "Farbton", sat: "Sättigung", lum: "Luminanz" }[t]}
              </button>
            ))}
          </div>
        )}
        {HSL_CHANNELS.map((c) => {
          const tab = a.monochrome ? "lum" : hslTab
          return (
            <AdjustSlider
              key={c + tab}
              label={HSL_LABEL[c]}
              value={a.hsl[c][tab]}
              min={-100}
              max={100}
              track={
                tab === "hue"
                  ? `linear-gradient(90deg, ${HSL_COLORS[HSL_CHANNELS[(HSL_CHANNELS.indexOf(c) + 7) % 8]]}, ${HSL_COLORS[c]}, ${HSL_COLORS[HSL_CHANNELS[(HSL_CHANNELS.indexOf(c) + 1) % 8]]})`
                  : tab === "sat"
                    ? `linear-gradient(90deg, #777, ${HSL_COLORS[c]})`
                    : `linear-gradient(90deg, #111, ${HSL_COLORS[c]}, #fff)`
              }
              onChange={(v) => set("hsl", { ...a.hsl, [c]: { ...a.hsl[c], [tab]: v } }, `adj:hsl:${c}:${tab}`)}
            />
          )
        })}
      </Section>

      <Section title="Color Grading" defaultOpen={false}>
        <div className="grid grid-cols-3 gap-2">
          <ColorWheel label="Tiefen" value={a.gradeShadows} onChange={(v) => set("gradeShadows", v, "adj:gs")} />
          <ColorWheel label="Mitten" value={a.gradeMidtones} onChange={(v) => set("gradeMidtones", v, "adj:gm")} />
          <ColorWheel label="Lichter" value={a.gradeHighlights} onChange={(v) => set("gradeHighlights", v, "adj:gh")} />
        </div>
        <S k="gradeBlending" label="Überblendung" min={0} max={100} />
        <S k="gradeBalance" label="Balance" />
      </Section>

      <Section title="Details" defaultOpen={false}>
        <S k="sharpen" label="Schärfen" min={0} max={150} />
        <S k="sharpenRadius" label="Radius" min={0.5} max={3} step={0.1} neutral={1} format={(v) => v.toFixed(1)} />
        <S k="denoise" label="Rauschreduzierung" min={0} max={100} />
      </Section>

      <Section title="Effekte" defaultOpen={false}>
        <S k="vignette" label="Vignette" />
        <S k="vignetteMidpoint" label="Mittelpunkt" min={0} max={100} neutral={50} />
        <S k="vignetteFeather" label="Weiche Kante" min={0} max={100} neutral={50} />
        <S k="grain" label="Körnung" min={0} max={100} />
        <S k="grainSize" label="Korngröße" min={0} max={100} neutral={25} />
        <S k="fade" label="Verblassen" min={0} max={100} />
      </Section>
    </div>
  )
}
