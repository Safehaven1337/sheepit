"use client"

import * as React from "react"
import { History } from "lucide-react"
import { useEditor } from "@/lib/editor/store"
import { cn } from "@/lib/utils"

/** Photoshop-style history: every step is listed, clicking one jumps there. */
export function HistoryPanel() {
  const past = useEditor((s) => s.past)
  const future = useEditor((s) => s.future)
  const current = useEditor((s) => s.currentLabel)
  const jumpTo = useEditor((s) => s.jumpTo)
  const activeRef = React.useRef<HTMLButtonElement>(null)
  const entries = [...past.map((p) => p.label), current, ...future.map((f) => f.label)]
  const index = past.length

  React.useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" })
  }, [index, entries.length])

  return (
    <div className="grid gap-0.5 p-2">
      <p className="flex items-center gap-1.5 px-2 pt-1 pb-2 text-[11px] text-muted-foreground">
        <History className="size-3.5" /> Klicke einen Schritt, um dorthin zurückzuspringen. Neue Bearbeitungen verwerfen die ausgegrauten Schritte.
      </p>
      {entries.map((label, i) => (
        <button
          key={i}
          ref={i === index ? activeRef : undefined}
          type="button"
          onClick={() => jumpTo(i)}
          className={cn(
            "flex h-8 items-center gap-2 rounded-md px-2 text-left text-[12.5px] transition hover:bg-muted/70",
            i === index && "bg-[#3b9dff]/15 text-foreground ring-1 ring-[#3b9dff]/40",
            i > index && "text-muted-foreground/50 italic",
            i < index && "text-muted-foreground",
          )}
        >
          <span className="w-6 shrink-0 text-right font-mono text-[10px] opacity-60">{i + 1}</span>
          <span className="truncate">{label}</span>
        </button>
      ))}
    </div>
  )
}
