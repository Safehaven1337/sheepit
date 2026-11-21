"use client"

import * as React from "react"
import { FlipHorizontal2, MousePointerClick, ShieldCheck } from "lucide-react"
import { AdjustSlider, Section } from "./adjust-slider"
import { ColorPicker } from "./controls"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { useEditor } from "@/lib/editor/store"
import { EFFECT_LABEL } from "@/lib/editor/defaults"
import { FONTS } from "@/lib/editor/fonts"
import { docSize } from "@/lib/editor/render"
import { BASE_ID, type EffectKind, type Layer } from "@/lib/editor/types"
import { cn } from "@/lib/utils"

export function PropertiesPanel() {
  const selectedId = useEditor((s) => s.selectedId)
  const l = useEditor((s) => s.doc.layers.find((x) => x.id === s.selectedId) ?? null)
  const doc = useEditor((s) => s.doc)
  const update = useEditor((s) => s.updateLayer)
  const patch = useEditor((s) => s.patch)

  if (selectedId === BASE_ID || (!l && !doc.baseAssetId)) {
    const { w, h } = docSize(doc)
    return (
      <div>
        <Section title="Dokument">
          <dl className="grid grid-cols-2 gap-y-1 text-[12px]">
            <dt className="text-muted-foreground">Größe</dt>
            <dd className="text-right font-mono">{w} × {h} px</dd>
            <dt className="text-muted-foreground">Ebenen</dt>
            <dd className="text-right font-mono">{doc.layers.length}</dd>
          </dl>
          {!doc.baseAssetId && (
            <div className="mt-3 flex items-center justify-between text-[12px]">
              <span className="text-muted-foreground">Hintergrundfarbe</span>
              <ColorPicker
                label="Hintergrundfarbe"
                allowNone
                value={doc.background === "transparent" ? null : doc.background}
                onChange={(c) => patch((d) => void (d.background = c ?? "transparent"), "bg")}
              />
            </div>
          )}
        </Section>
        <p className="flex items-start gap-1.5 px-4 py-3 text-[11px] leading-snug text-muted-foreground">
          <ShieldCheck className="mt-px size-3.5 shrink-0 text-primary" />
          Alles wird lokal auf deinem Gerät berechnet – nichts wird hochgeladen.
        </p>
      </div>
    )
  }
  if (!l)
    return (
      <div className="grid justify-items-center gap-2 px-6 py-10 text-center text-[12px] text-muted-foreground">
        <MousePointerClick className="size-5" />
        Wähle eine Ebene im Bild (Verschieben-Werkzeug, V) oder im Ebenen-Panel.
      </div>
    )

  const u = (p: Partial<Layer>, key?: string) => update(l.id, p, key)

  return (
    <div>
      <Section title={typeLabel(l)}>
        <input
          value={l.name}
          onChange={(e) => u({ name: e.target.value }, "rename")}
          onKeyDown={(e) => e.stopPropagation()}
          className="mb-2 h-7 w-full rounded-md border border-input bg-background/50 px-2 text-[12px]"
          aria-label="Ebenenname"
        />
        <AdjustSlider label="Deckkraft" value={Math.round(l.opacity * 100)} min={0} max={100} neutral={100} format={(v) => `${Math.round(v)}%`} onChange={(v) => u({ opacity: v / 100 })} />
        {"rotation" in l && (
          <AdjustSlider label="Drehung" value={Math.round(l.rotation)} min={-180} max={180} format={(v) => `${Math.round(v)}°`} onChange={(v) => u({ rotation: v } as Partial<Layer>)} />
        )}
      </Section>

      {l.type === "text" && (
        <Section title="Text">
          <textarea
            value={l.text}
            rows={3}
            onChange={(e) => u({ text: e.target.value }, `text:${l.id}`)}
            onKeyDown={(e) => e.stopPropagation()}
            className="w-full resize-y rounded-lg border border-input bg-background/50 px-2.5 py-2 text-sm outline-none focus:border-ring"
            style={{ fontFamily: FONTS.find((f) => f.name === l.fontFamily)?.family }}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">Tipp: Mit dem Text-Werkzeug (T) direkt im Bild tippen.</p>
        </Section>
      )}

      {l.type === "image" && (
        <Section title="Bild">
          <Button size="sm" variant="secondary" onClick={() => u({ flipH: !l.flipH })}>
            <FlipHorizontal2 /> Spiegeln
          </Button>
        </Section>
      )}

      {l.type === "draw" && (
        <Section title="Pixel">
          <p className="text-[12px] text-muted-foreground">{l.strokes.length} Pinselstriche</p>
          <Button size="sm" variant="secondary" className="mt-2" onClick={() => u({ strokes: [] } as Partial<Layer>)}>
            Ebene leeren
          </Button>
        </Section>
      )}

      {l.type === "shape" && (
        <Section title="Form">
          {l.shape !== "line" && l.shape !== "arrow" && (
            <Row label="Füllung"><ColorPicker label="Füllung" allowNone value={l.fill} onChange={(c) => u({ fill: c })} /></Row>
          )}
          <Row label="Kontur"><ColorPicker label="Kontur" allowNone value={l.stroke} onChange={(c) => u({ stroke: c })} /></Row>
          <AdjustSlider label="Konturstärke" value={l.strokeWidth} min={0} max={100} onChange={(v) => u({ strokeWidth: v })} />
          {l.shape === "rect" && (
            <AdjustSlider label="Eckenradius" value={l.radius} min={0} max={Math.round(Math.min(Math.abs(l.width), Math.abs(l.height)) / 2)} onChange={(v) => u({ radius: v })} />
          )}
        </Section>
      )}

      {l.type === "fill" && (
        <Section title="Füllung">
          <div className="mb-2 grid grid-cols-3 gap-1">
            {(["solid", "linear", "radial"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => u({ fill: k } as Partial<Layer>)}
                className={cn("h-7 rounded-md bg-muted/60 text-[11px] text-muted-foreground hover:text-foreground", l.fill === k && "bg-primary/15 text-primary")}
              >
                {{ solid: "Farbe", linear: "Linear", radial: "Radial" }[k]}
              </button>
            ))}
          </div>
          <Row label={l.fill === "solid" ? "Farbe" : "Startfarbe"}>
            <ColorPicker label="Farbe" value={l.color} onChange={(c) => c && u({ color: c } as Partial<Layer>)} />
          </Row>
          {l.fill !== "solid" && (
            <Row label="Endfarbe">
              <ColorPicker
                label="Endfarbe (Keine = transparent)"
                allowNone
                value={l.color2 === "transparent" ? null : l.color2}
                onChange={(c) => u({ color2: c ?? "transparent" } as Partial<Layer>)}
              />
            </Row>
          )}
          {l.fill !== "solid" && (
            <Button
              size="sm"
              variant="secondary"
              className="mt-2"
              onClick={() =>
                l.color2 !== "transparent" && u({ color: l.color2, color2: l.color } as Partial<Layer>)
              }
            >
              Farben tauschen
            </Button>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">Richtung ändern: mit dem Verlaufswerkzeug (G) neu ziehen.</p>
        </Section>
      )}

      {l.type === "effect" && (
        <Section title="Unkenntlich machen">
          <div className="mb-2 grid grid-cols-5 gap-1">
            {(["pixelate", "blur", "redact", "glass", "noise"] as EffectKind[]).map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => u({ effect: e, name: EFFECT_LABEL[e] } as Partial<Layer>)}
                className={cn("h-7 rounded-md bg-muted/60 text-[10px] text-muted-foreground hover:text-foreground", l.effect === e && "bg-primary/15 text-primary")}
              >
                {EFFECT_LABEL[e].replace("Weichzeichner", "Blur")}
              </button>
            ))}
          </div>
          {l.effect !== "redact" ? (
            <AdjustSlider label="Stärke" value={l.amount} min={l.effect === "noise" ? 0 : 2} max={l.effect === "noise" ? 100 : 200} onChange={(v) => u({ amount: v })} />
          ) : (
            <Row label="Farbe"><ColorPicker label="Farbe" value={l.color} onChange={(c) => c && u({ color: c })} /></Row>
          )}
          <AdjustSlider label="Weiche Kante" value={l.feather} min={0} max={120} onChange={(v) => u({ feather: v })} />
          <div className="mt-2 flex items-center justify-between text-[12px]">
            <span className="text-muted-foreground">Umkehren (alles außer Bereich)</span>
            <Switch checked={l.invert} onCheckedChange={(v) => u({ invert: v })} aria-label="Umkehren" />
          </div>
          {l.effect === "blur" && l.amount < 12 && (
            <p className="mt-2 rounded-md bg-amber-500/10 p-2 text-[11px] text-amber-300">
              Schwacher Weichzeichner kann bei Text teilweise rekonstruiert werden. Für sensible Daten: Schwärzen.
            </p>
          )}
        </Section>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1 text-[12px]">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

const typeLabel = (l: Layer) =>
  ({ image: "Bildebene", text: "Textebene", shape: "Formebene", effect: "Unkenntlich-Ebene", draw: "Pixelebene", fill: "Füllebene" })[l.type]
