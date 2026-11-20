"use client"

import { FlipHorizontal2, FlipVertical2, RotateCcw, RotateCw, Check, Undo2 } from "lucide-react"
import { AdjustSlider, Section } from "../adjust-slider"
import { Button } from "@/components/ui/button"
import { useEditor } from "@/lib/editor/store"
import { applyCrop, flip, rotate90 } from "@/lib/editor/actions"
import { rotatedSize } from "@/lib/editor/render"
import { cn } from "@/lib/utils"

const RATIOS: { label: string; v: number | null; sub?: string }[] = [
  { label: "Frei", v: null },
  { label: "Original", v: -1 },
  { label: "1:1", v: 1, sub: "Instagram" },
  { label: "4:5", v: 4 / 5, sub: "Feed" },
  { label: "9:16", v: 9 / 16, sub: "Story" },
  { label: "16:9", v: 16 / 9, sub: "YouTube" },
  { label: "3:2", v: 3 / 2, sub: "Foto" },
  { label: "2:3", v: 2 / 3 },
  { label: "4:3", v: 4 / 3 },
  { label: "3:1", v: 3, sub: "Banner" },
]

function fitAspect(asp: number) {
  const s = useEditor.getState()
  const R = rotatedSize(s.doc)
  const cur = s.crop.rect ?? { x: 0, y: 0, w: 1, h: 1 }
  const cx = cur.x + cur.w / 2
  const cy = cur.y + cur.h / 2
  // largest rect with aspect inside current crop area… but at least use full image
  let w = 1
  let h = (R.w / asp) / R.h
  if (h > 1) {
    h = 1
    w = (R.h * asp) / R.w
  }
  const x = Math.min(1 - w, Math.max(0, cx - w / 2))
  const y = Math.min(1 - h, Math.max(0, cy - h / 2))
  s.setCrop({ rect: { x, y, w, h } })
}

export function CropPanel() {
  const crop = useEditor((s) => s.crop)
  const setCrop = useEditor((s) => s.setCrop)
  const straighten = useEditor((s) => s.doc.geometry.straighten)
  const patch = useEditor((s) => s.patch)
  const doc = useEditor((s) => s.doc)
  const hasImage = !!doc.baseAssetId

  if (!hasImage) return <p className="p-4 text-sm text-muted-foreground">Öffne ein Foto, um es zuzuschneiden.</p>

  const R = rotatedSize(doc)
  const r = crop.rect ?? doc.geometry.crop
  const pxW = Math.round(r.w * R.w)
  const pxH = Math.round(r.h * R.h)

  return (
    <div>
      <Section title="Seitenverhältnis">
        <div className="grid grid-cols-2 gap-1.5">
          {RATIOS.map((ra) => {
            const val = ra.v === -1 ? R.w / R.h : ra.v
            const active = ra.v === -1 ? crop.aspect !== null && Math.abs(crop.aspect - R.w / R.h) < 1e-3 : crop.aspect === ra.v
            return (
              <button
                key={ra.label}
                type="button"
                onClick={() => {
                  setCrop({ aspect: val })
                  if (val) fitAspect(val)
                }}
                className={cn(
                  "flex h-9 items-center justify-between rounded-lg bg-muted/60 px-2.5 text-[12px] text-muted-foreground transition hover:bg-muted hover:text-foreground",
                  active && "bg-primary/12 text-primary ring-1 ring-primary/50",
                )}
              >
                <span className="font-medium">{ra.label}</span>
                {ra.sub && <span className="text-[10px] opacity-70">{ra.sub}</span>}
              </button>
            )
          })}
        </div>
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">
          {pxW} × {pxH} px
        </p>
      </Section>

      <Section title="Drehen & Spiegeln">
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { icon: RotateCcw, label: "Links drehen", fn: () => rotate90(-1) },
            { icon: RotateCw, label: "Rechts drehen", fn: () => rotate90(1) },
            { icon: FlipHorizontal2, label: "Horizontal spiegeln", fn: () => flip("h") },
            { icon: FlipVertical2, label: "Vertikal spiegeln", fn: () => flip("v") },
          ].map(({ icon: Icon, label, fn }) => (
            <Button key={label} variant="secondary" size="icon-lg" className="w-full" onClick={fn} aria-label={label} title={label}>
              <Icon />
            </Button>
          ))}
        </div>
        <AdjustSlider
          className="mt-3"
          label="Begradigen"
          value={straighten}
          min={-45}
          max={45}
          step={0.1}
          format={(v) => `${v.toFixed(1)}°`}
          onChange={(v) => patch((d) => void (d.geometry.straighten = v), "straighten")}
        />
      </Section>

      <div className="flex gap-2 p-4">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => {
            setCrop({ rect: { x: 0, y: 0, w: 1, h: 1 }, aspect: null })
            patch((d) => void (d.geometry.straighten = 0))
          }}
        >
          <Undo2 /> Zurücksetzen
        </Button>
        <Button
          className="flex-1"
          onClick={() => {
            applyCrop()
            useEditor.getState().setTool("adjust")
          }}
        >
          <Check /> Anwenden
        </Button>
      </div>
    </div>
  )
}
