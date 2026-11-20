"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { NumberField, ColorPicker } from "./controls"
import { newDocument } from "@/lib/editor/ops"
import { cn } from "@/lib/utils"

const PRESETS = [
  { label: "Instagram Post", w: 1080, h: 1080 },
  { label: "Instagram Hochformat", w: 1080, h: 1350 },
  { label: "Story / Reel", w: 1080, h: 1920 },
  { label: "YouTube Thumbnail", w: 1280, h: 720 },
  { label: "Full HD", w: 1920, h: 1080 },
  { label: "A4 (300 dpi)", w: 2480, h: 3508 },
  { label: "Visitenkarte", w: 1050, h: 600 },
  { label: "Profilbild", w: 800, h: 800 },
]

export function NewDocDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [w, setW] = React.useState(1080)
  const [h, setH] = React.useState(1080)
  const [bg, setBg] = React.useState<string | null>("#ffffff")
  const [name, setName] = React.useState("Neues Design")
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Neues Dokument</DialogTitle>
          <DialogDescription>Leere Arbeitsfläche – Bilder kannst du danach als Ebenen platzieren.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                setW(p.w)
                setH(p.h)
              }}
              className={cn(
                "grid gap-0.5 rounded-lg bg-muted/60 p-2 text-left ring-1 ring-transparent hover:bg-muted",
                w === p.w && h === p.h && "bg-primary/12 ring-primary/50",
              )}
            >
              <span className="text-[12px] leading-tight font-medium">{p.label}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{p.w}×{p.h}</span>
            </button>
          ))}
        </div>
        <div className="grid gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            aria-label="Name"
          />
          <div className="flex flex-wrap items-center gap-3">
            <NumberField label="Breite" value={w} min={1} max={8000} onChange={setW} suffix="px" width="w-20" />
            <NumberField label="Höhe" value={h} min={1} max={8000} onChange={setH} suffix="px" width="w-20" />
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              Hintergrund
              <ColorPicker label="Hintergrund (Keine = transparent)" allowNone value={bg} onChange={setBg} />
            </div>
          </div>
          <Button
            onClick={() => {
              newDocument(w, h, bg ?? "transparent", name || "Neues Design")
              onOpenChange(false)
            }}
          >
            Erstellen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
