"use client"

import * as React from "react"
import { FileArchive, ImagePlus, ShieldCheck, Smartphone, Monitor, Square, MonitorPlay as Youtube, FileText } from "lucide-react"
import { useEditor } from "@/lib/editor/store"
import { openFile } from "@/lib/editor/actions"
import { ACCEPT } from "@/lib/editor/handoff"
import { BorderBeam } from "@/components/ui/border-beam"
import { SheepMark } from "@/components/brand/sheep-logo"
import { cn } from "@/lib/utils"

const BLANKS = [
  { label: "Instagram Post", w: 1080, h: 1080, icon: Square },
  { label: "Insta Story / Reel", w: 1080, h: 1920, icon: Smartphone },
  { label: "YouTube Thumbnail", w: 1280, h: 720, icon: Youtube },
  { label: "Präsentation 16:9", w: 1920, h: 1080, icon: Monitor },
  { label: "A4 Hochformat", w: 2480, h: 3508, icon: FileText },
]

export function DropScreen({ hint }: { hint?: string }) {
  const [over, setOver] = React.useState(false)
  const input = React.useRef<HTMLInputElement>(null)
  const newBlank = useEditor((s) => s.newBlank)

  return (
    <div className="flex h-full w-full items-center justify-center overflow-y-auto p-4 md:p-10">
      <div className="grid w-full max-w-2xl gap-6">
        <div
          role="button"
          tabIndex={0}
          onClick={() => input.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setOver(false)
            const f = e.dataTransfer.files[0]
            if (f) openFile(f)
          }}
          className={cn(
            "relative grid cursor-pointer place-items-center gap-4 overflow-hidden rounded-3xl border border-dashed border-white/15 bg-card/60 px-6 py-14 text-center transition",
            "hover:border-primary/50 hover:bg-card",
            over && "scale-[1.01] border-primary bg-primary/5",
          )}
        >
          <BorderBeam size={120} duration={8} colorFrom="#c6f432" colorTo="#f6f1e4" />
          <div className="relative">
            <SheepMark className="size-16 drop-shadow-[0_10px_30px_rgba(198,244,50,.25)]" />
          </div>
          <div className="grid gap-1.5">
            <p className="text-xl font-semibold tracking-tight md:text-2xl">{hint ?? "Bild hierher ziehen"}</p>
            <p className="text-sm text-muted-foreground">
              oder <span className="text-primary underline underline-offset-4">Datei auswählen</span> · Strg+V zum Einfügen ·
              JPG, PNG, WebP, AVIF, GIF, .sheepit
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[12px] text-primary">
            <ShieldCheck className="size-3.5" /> Dein Bild bleibt auf deinem Gerät – kein Upload
          </div>
          <input
            ref={input}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) openFile(f)
              e.target.value = ""
            }}
          />
        </div>

        <div className="grid gap-2">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Oder mit leerer Leinwand starten
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {BLANKS.map(({ label, w, h, icon: Icon }) => (
              <button
                key={label}
                type="button"
                onClick={() => newBlank(w, h, "#f6f1e4")}
                className="group grid gap-1.5 rounded-2xl bg-card/70 p-3 text-left ring-1 ring-white/5 transition hover:bg-card hover:ring-white/15"
              >
                <Icon className="size-4 text-muted-foreground group-hover:text-primary" />
                <span className="text-[12.5px] leading-tight font-medium">{label}</span>
                <span className="font-mono text-[10.5px] text-muted-foreground">
                  {w}×{h}
                </span>
              </button>
            ))}
          </div>
        </div>
        <p className="flex items-center justify-center gap-1.5 text-[12px] text-muted-foreground">
          <FileArchive className="size-3.5" /> Hast du eine .sheepit-Datei? Einfach reinziehen und weitermachen.
          <ImagePlus className="hidden" />
        </p>
      </div>
    </div>
  )
}
