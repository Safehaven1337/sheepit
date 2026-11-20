"use client"

import * as React from "react"
import {
  ArrowLeftRight,
  Brush,
  Crop,
  Eraser,
  Hand,
  MousePointer2,
  Pipette,
  Shapes,
  ShieldHalf,
  SquareDashed,
  Type,
  ZoomIn,
} from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useEditor } from "@/lib/editor/store"
import { switchTool } from "@/lib/editor/actions"
import type { ToolId } from "@/lib/editor/types"
import { cn } from "@/lib/utils"

export const TOOLS: { id: ToolId; label: string; icon: React.ElementType; key: string; hint: string }[] = [
  { id: "move", label: "Verschieben", icon: MousePointer2, key: "v", hint: "Ebenen auswählen, verschieben, skalieren & drehen" },
  { id: "select", label: "Auswahl", icon: SquareDashed, key: "m", hint: "Rechteck, Ellipse oder Lasso auswählen" },
  { id: "crop", label: "Freistellen", icon: Crop, key: "c", hint: "Zuschneiden, drehen & begradigen" },
  { id: "eyedropper", label: "Pipette", icon: Pipette, key: "i", hint: "Farbe aus dem Bild aufnehmen (auch Alt+Klick)" },
  { id: "brush", label: "Pinsel", icon: Brush, key: "b", hint: "Malen auf einer Ebene" },
  { id: "eraser", label: "Radierer", icon: Eraser, key: "e", hint: "Auf der aktiven Ebene radieren" },
  { id: "text", label: "Text", icon: Type, key: "t", hint: "Ins Bild klicken und tippen" },
  { id: "shapes", label: "Formen", icon: Shapes, key: "u", hint: "Rechteck, Ellipse, Linie, Pfeil" },
  { id: "privacy", label: "Unkenntlich", icon: ShieldHalf, key: "p", hint: "Verpixeln, weichzeichnen, schwärzen" },
  { id: "hand", label: "Hand", icon: Hand, key: "h", hint: "Ansicht verschieben (auch Leertaste)" },
  { id: "zoom", label: "Zoom", icon: ZoomIn, key: "z", hint: "Klick = vergrößern, Alt+Klick = verkleinern" },
]

export function Toolbar({ orientation = "vertical" }: { orientation?: "vertical" | "horizontal" }) {
  const tool = useEditor((s) => s.tool)
  const fg = useEditor((s) => s.fg)
  const bg = useEditor((s) => s.bg)
  const setColors = useEditor((s) => s.setColors)
  const vertical = orientation === "vertical"

  return (
    <nav
      aria-label="Werkzeuge"
      className={cn(
        "flex shrink-0 gap-0.5 bg-background/70",
        vertical ? "w-12 flex-col items-center border-r border-white/6 py-2" : "overflow-x-auto border-t border-white/6 px-2 py-1",
      )}
    >
      {TOOLS.map(({ id, label, icon: Icon, key, hint }) => (
        <Tooltip key={id}>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={() => switchTool(id)}
                aria-pressed={tool === id}
                aria-label={label}
                className={cn(
                  "grid shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted/70 hover:text-foreground",
                  vertical ? "size-9" : "h-11 min-w-12 gap-0.5",
                  tool === id && "bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary",
                )}
              >
                <Icon className="size-[18px]" />
                {!vertical && <span className="text-[9px] leading-none">{label}</span>}
              </button>
            }
          />
          <TooltipContent side={vertical ? "right" : "top"} className="max-w-56">
            <span className="font-medium">{label}</span>
            <kbd className="ml-1.5 rounded bg-background/20 px-1 font-mono text-[10px]">{key.toUpperCase()}</kbd>
            <span className="block text-[11px] opacity-70">{hint}</span>
          </TooltipContent>
        </Tooltip>
      ))}

      {/* foreground / background colour */}
      <div className={cn("relative shrink-0", vertical ? "mt-3 size-10" : "ml-2 size-10 self-center")}>
        <label
          className="absolute right-0 bottom-0 size-6 cursor-pointer rounded-md ring-1 ring-white/30"
          style={{ background: bg }}
          title="Hintergrundfarbe"
        >
          <input type="color" value={bg} onChange={(e) => setColors({ bg: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
        <label
          className="absolute top-0 left-0 z-10 size-6 cursor-pointer rounded-md shadow-[0_0_0_2px_var(--background)] ring-1 ring-white/40"
          style={{ background: fg }}
          title="Vordergrundfarbe (X tauscht, D setzt zurück)"
        >
          <input type="color" value={fg} onChange={(e) => setColors({ fg: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
        <button
          type="button"
          aria-label="Farben tauschen (X)"
          title="Farben tauschen (X)"
          onClick={() => setColors({ fg: bg, bg: fg })}
          className="absolute -top-1 -right-1 grid size-4 place-items-center rounded text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftRight className="size-3" />
        </button>
      </div>
    </nav>
  )
}
