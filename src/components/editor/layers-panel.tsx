"use client"

import * as React from "react"
import { ChevronDown, ChevronUp, Copy, Eye, EyeOff, Image as ImageIcon, Lock, Pencil, Shapes, Trash2, Type, Unlock, ShieldHalf } from "lucide-react"
import { useEditor } from "@/lib/editor/store"
import type { Layer } from "@/lib/editor/types"
import { cn } from "@/lib/utils"

const ICON: Record<Layer["type"], React.ElementType> = {
  image: ImageIcon,
  text: Type,
  shape: Shapes,
  effect: ShieldHalf,
  draw: Pencil,
}

export function LayersPanel() {
  const layers = useEditor((s) => s.doc.layers)
  const selectedId = useEditor((s) => s.selectedId)
  const hasBase = useEditor((s) => !!s.doc.baseAssetId)
  const s = useEditor.getState
  const [renaming, setRenaming] = React.useState<string | null>(null)

  return (
    <div className="grid gap-0.5 p-2">
      {[...layers].reverse().map((l) => {
        const Icon = ICON[l.type]
        const active = l.id === selectedId
        return (
          <div
            key={l.id}
            role="button"
            tabIndex={0}
            onClick={() => s().select(l.id)}
            onKeyDown={(e) => e.key === "Enter" && s().select(l.id)}
            className={cn(
              "group flex h-9 items-center gap-2 rounded-lg px-2 text-[12.5px] text-muted-foreground transition hover:bg-muted/70",
              active && "bg-muted text-foreground ring-1 ring-white/10",
              !l.visible && "opacity-50",
            )}
          >
            <Icon className={cn("size-3.5 shrink-0", active && "text-primary")} />
            {renaming === l.id ? (
              <input
                autoFocus
                defaultValue={l.name}
                className="h-6 min-w-0 flex-1 rounded bg-background px-1 text-[12px] outline-none ring-1 ring-ring"
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => {
                  s().updateLayer(l.id, { name: e.target.value || l.name })
                  setRenaming(null)
                }}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur()
                }}
              />
            ) : (
              <span className="min-w-0 flex-1 truncate" onDoubleClick={() => setRenaming(l.id)}>
                {l.type === "text" ? l.text.split("\n")[0] || l.name : l.name}
              </span>
            )}
            <div className={cn("flex items-center opacity-0 transition group-hover:opacity-100", active && "opacity-100")}>
              <IconBtn label="Nach oben" onClick={() => s().moveLayer(l.id, 1)}>
                <ChevronUp />
              </IconBtn>
              <IconBtn label="Nach unten" onClick={() => s().moveLayer(l.id, -1)}>
                <ChevronDown />
              </IconBtn>
              <IconBtn label="Duplizieren" onClick={() => s().duplicateLayer(l.id)}>
                <Copy />
              </IconBtn>
              <IconBtn label={l.locked ? "Entsperren" : "Sperren"} onClick={() => s().updateLayer(l.id, { locked: !l.locked })}>
                {l.locked ? <Lock /> : <Unlock />}
              </IconBtn>
              <IconBtn label="Löschen" onClick={() => s().removeLayer(l.id)}>
                <Trash2 />
              </IconBtn>
            </div>
            <IconBtn label={l.visible ? "Ausblenden" : "Einblenden"} onClick={() => s().updateLayer(l.id, { visible: !l.visible })}>
              {l.visible ? <Eye /> : <EyeOff />}
            </IconBtn>
          </div>
        )
      })}
      {hasBase && (
        <div className="flex h-9 items-center gap-2 rounded-lg px-2 text-[12.5px] text-muted-foreground/80">
          <Lock className="size-3.5" />
          <span className="flex-1">Hintergrund (Foto)</span>
        </div>
      )}
      {!layers.length && !hasBase && <p className="px-2 py-3 text-[12px] text-muted-foreground">Noch keine Ebenen.</p>}
    </div>
  )
}

function IconBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-background/60 hover:text-foreground [&_svg]:size-3.5"
    >
      {children}
    </button>
  )
}
