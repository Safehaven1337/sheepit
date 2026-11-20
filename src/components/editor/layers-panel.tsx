"use client"

import * as React from "react"
import {
  Copy,
  Eye,
  EyeOff,
  FilePlus2,
  Layers2,
  Lock,
  MoreHorizontal,
  Pencil,
  ShieldHalf,
  Trash2,
  Type,
  Unlock,
  Shapes,
  Image as ImageIcon,
} from "lucide-react"
import { useEditor } from "@/lib/editor/store"
import { docSize, renderDoc } from "@/lib/editor/render"
import { deleteSelectedLayer, flattenImage, mergeDown, newLayer, rasterizeLayer } from "@/lib/editor/ops"
import { BASE_ID, type BlendMode, type Layer, type SheepDoc } from "@/lib/editor/types"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { IconBtn, NumberField } from "./controls"
import { openContextMenu } from "./context-menu"
import { cn } from "@/lib/utils"

export const BLENDS: { v: BlendMode; l: string }[] = [
  { v: "source-over", l: "Normal" },
  { v: "darken", l: "Abdunkeln" },
  { v: "multiply", l: "Multiplizieren" },
  { v: "color-burn", l: "Farbig nachbelichten" },
  { v: "lighten", l: "Aufhellen" },
  { v: "screen", l: "Negativ multiplizieren" },
  { v: "color-dodge", l: "Farbig abwedeln" },
  { v: "overlay", l: "Ineinanderkopieren" },
  { v: "soft-light", l: "Weiches Licht" },
  { v: "hard-light", l: "Hartes Licht" },
  { v: "difference", l: "Differenz" },
  { v: "exclusion", l: "Ausschluss" },
  { v: "hue", l: "Farbton" },
  { v: "saturation", l: "Sättigung" },
  { v: "color", l: "Farbe" },
  { v: "luminosity", l: "Luminanz" },
]

const ICON: Record<Layer["type"], React.ElementType> = {
  image: ImageIcon,
  text: Type,
  shape: Shapes,
  effect: ShieldHalf,
  draw: Pencil,
}

const THUMB = 44

/** Debounced per-layer thumbnails (rendered in isolation on a transparent canvas). */
function useThumbs(doc: SheepDoc) {
  const assets = useEditor((s) => s.assets)
  const [thumbs, setThumbs] = React.useState<Record<string, string>>({})
  const baseKey = JSON.stringify([doc.baseAssetId, doc.geometry, doc.adjustments, doc.look, doc.lookAmount, doc.baseMask?.length, doc.background])
  React.useEffect(() => {
    const t = setTimeout(() => {
      const { w, h } = docSize(doc)
      const scale = Math.min(1, (THUMB * 2) / Math.max(w, h))
      const out: Record<string, string> = {}
      for (const l of doc.layers) {
        if (l.type === "effect") continue
        const c = renderDoc({ ...doc, layers: [{ ...l, visible: true, opacity: 1, blend: "source-over" }] }, assets, { scale, skipBase: true, background: null })
        out[l.id] = c.toDataURL("image/png")
      }
      setThumbs((prev) => ({ ...prev, ...out }))
    }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.layers, assets])
  React.useEffect(() => {
    const t = setTimeout(() => {
      const { w, h } = docSize(doc)
      const scale = Math.min(1, (THUMB * 2) / Math.max(w, h))
      const c = renderDoc({ ...doc, layers: [], baseHidden: false }, assets, { scale })
      setThumbs((prev) => ({ ...prev, [BASE_ID]: c.toDataURL("image/jpeg", 0.8) }))
    }, 500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseKey, assets])
  return thumbs
}

export function LayersPanel() {
  const doc = useEditor((s) => s.doc)
  const selectedId = useEditor((s) => s.selectedId)
  const s = useEditor.getState
  const thumbs = useThumbs(doc)
  const [renaming, setRenaming] = React.useState<string | null>(null)
  const [drag, setDrag] = React.useState<{ id: string; over: number | null } | null>(null)
  const layers = [...doc.layers].reverse()
  const n = doc.layers.length
  const sel = doc.layers.find((l) => l.id === selectedId) ?? null
  const isBase = selectedId === BASE_ID
  const { w, h } = docSize(doc)
  const aspect = w / h

  return (
    <div className="flex min-h-0 flex-col">
      {/* blend + opacity of the active layer */}
      <div className="flex items-center gap-2 border-b border-white/6 px-3 py-2">
        <select
          value={sel?.blend ?? "source-over"}
          disabled={!sel || sel.type === "effect"}
          onChange={(e) => sel && s().updateLayer(sel.id, { blend: e.target.value as BlendMode })}
          className="h-6 min-w-0 flex-1 rounded-md border border-input bg-background px-1.5 text-[11px] disabled:opacity-40"
          aria-label="Füllmethode"
        >
          {BLENDS.map((b) => (
            <option key={b.v} value={b.v}>{b.l}</option>
          ))}
        </select>
        <NumberField
          label="Deckkr."
          value={Math.round((sel?.opacity ?? 1) * 100)}
          min={0}
          max={100}
          suffix="%"
          width="w-14"
          onChange={(v) => sel && s().updateLayer(sel.id, { opacity: v / 100 })}
        />
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto p-1.5 scrollbar-thin"
        onDragOver={(e) => e.preventDefault()}
      >
        {layers.map((l, i) => {
          const Icon = ICON[l.type]
          const active = l.id === selectedId
          const showDrop = drag && drag.over === i && drag.id !== l.id
          return (
            <div
              key={l.id}
              draggable={renaming !== l.id}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move"
                setDrag({ id: l.id, over: null })
              }}
              onDragOver={(e) => {
                e.preventDefault()
                if (drag && drag.over !== i) setDrag({ ...drag, over: i })
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (drag && drag.id !== l.id) s().reorderLayer(drag.id, n - 1 - i)
                setDrag(null)
              }}
              onDragEnd={() => setDrag(null)}
              onClick={() => s().select(l.id)}
              onContextMenu={(e) => {
                e.preventDefault()
                s().select(l.id)
                openContextMenu({ x: e.clientX, y: e.clientY, kind: "layer" })
              }}
              onDoubleClick={() => setRenaming(l.id)}
              className={cn(
                "group relative flex h-12 cursor-default items-center gap-2 rounded-lg px-1.5 text-[12.5px] text-muted-foreground transition hover:bg-muted/60",
                active && "bg-[#3b9dff]/15 text-foreground ring-1 ring-[#3b9dff]/40 hover:bg-[#3b9dff]/20",
                showDrop && "before:absolute before:inset-x-1 before:-top-px before:h-0.5 before:rounded before:bg-[#3b9dff]",
              )}
            >
              <button
                type="button"
                aria-label={l.visible ? "Ausblenden" : "Einblenden"}
                onClick={(e) => {
                  e.stopPropagation()
                  s().updateLayer(l.id, { visible: !l.visible })
                }}
                className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground hover:text-foreground"
              >
                {l.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5 opacity-60" />}
              </button>
              <div
                className="checkerboard grid shrink-0 place-items-center overflow-hidden rounded ring-1 ring-white/10"
                style={{ width: aspect >= 1 ? THUMB : THUMB * aspect, height: aspect >= 1 ? THUMB / aspect : THUMB, maxHeight: 40 }}
              >
                {l.type === "effect" ? (
                  <Icon className="size-4 text-primary" />
                ) : thumbs[l.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbs[l.id]} alt="" className="size-full object-contain" />
                ) : (
                  <Icon className="size-4" />
                )}
              </div>
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
                    if (e.key === "Escape") setRenaming(null)
                  }}
                />
              ) : (
                <span className={cn("min-w-0 flex-1 truncate", !l.visible && "opacity-50")} title="Doppelklick zum Umbenennen">
                  {l.type === "text" ? l.text.split("\n")[0] || l.name : l.name}
                  {!!l.mask?.length && <span className="ml-1 text-[10px] text-muted-foreground">· Maske</span>}
                </span>
              )}
              <button
                type="button"
                aria-label={l.locked ? "Entsperren" : "Sperren"}
                onClick={(e) => {
                  e.stopPropagation()
                  s().updateLayer(l.id, { locked: !l.locked })
                }}
                className={cn("grid size-6 shrink-0 place-items-center rounded hover:text-foreground", !l.locked && "opacity-0 group-hover:opacity-100")}
              >
                {l.locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
              </button>
            </div>
          )
        })}

        {/* background */}
        {(doc.baseAssetId || doc.background) && (
          <div
            onClick={() => s().select(doc.baseAssetId ? BASE_ID : null)}
            onContextMenu={(e) => {
              e.preventDefault()
              if (!doc.baseAssetId) return
              s().select(BASE_ID)
              openContextMenu({ x: e.clientX, y: e.clientY, kind: "base" })
            }}
            onDragOver={(e) => {
              e.preventDefault()
              if (drag && drag.over !== n) setDrag({ ...drag, over: n })
            }}
            onDrop={(e) => {
              e.preventDefault()
              if (drag) s().reorderLayer(drag.id, 0)
              setDrag(null)
            }}
            className={cn(
              "relative flex h-12 items-center gap-2 rounded-lg px-1.5 text-[12.5px] text-muted-foreground hover:bg-muted/60",
              isBase && "bg-[#3b9dff]/15 text-foreground ring-1 ring-[#3b9dff]/40",
              drag?.over === n && "before:absolute before:inset-x-1 before:-top-px before:h-0.5 before:rounded before:bg-[#3b9dff]",
            )}
          >
            <button
              type="button"
              aria-label={doc.baseHidden ? "Einblenden" : "Ausblenden"}
              disabled={!doc.baseAssetId}
              onClick={(e) => {
                e.stopPropagation()
                s().patch((d) => void (d.baseHidden = !d.baseHidden))
              }}
              className="grid size-6 shrink-0 place-items-center rounded hover:text-foreground disabled:opacity-30"
            >
              {doc.baseHidden ? <EyeOff className="size-3.5 opacity-60" /> : <Eye className="size-3.5" />}
            </button>
            <div
              className="checkerboard shrink-0 overflow-hidden rounded ring-1 ring-white/10"
              style={{ width: aspect >= 1 ? THUMB : THUMB * aspect, height: aspect >= 1 ? THUMB / aspect : THUMB, maxHeight: 40 }}
            >
              {thumbs[BASE_ID] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbs[BASE_ID]} alt="" className="size-full object-cover" />
              )}
            </div>
            <span className="flex-1 italic">Hintergrund{doc.baseMask?.length ? " · Maske" : ""}</span>
            <Lock className="mr-1.5 size-3.5 opacity-50" />
          </div>
        )}
      </div>

      {/* footer actions */}
      <div className="flex items-center justify-end gap-0.5 border-t border-white/6 px-2 py-1">
        <IconBtn label="Neue Ebene (Strg+Umschalt+N)" onClick={newLayer}><FilePlus2 /></IconBtn>
        <IconBtn label="Ebene duplizieren (Strg+J)" disabled={!sel} onClick={() => sel && s().duplicateLayer(sel.id)}><Copy /></IconBtn>
        <IconBtn label="Auf eine Ebene reduzieren (Strg+E)" disabled={!sel} onClick={mergeDown}><Layers2 /></IconBtn>
        <DropdownMenu>
          <DropdownMenuTrigger render={<IconBtn label="Weitere Ebenen-Befehle" onClick={() => {}}><MoreHorizontal /></IconBtn>} />
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuItem disabled={!sel || sel.type === "effect"} onClick={() => sel && rasterizeLayer(sel.id)}>Ebene rastern</DropdownMenuItem>
            <DropdownMenuItem disabled={!sel} onClick={() => sel && s().moveLayer(sel.id, "top")}>In den Vordergrund</DropdownMenuItem>
            <DropdownMenuItem disabled={!sel} onClick={() => sel && s().moveLayer(sel.id, "bottom")}>In den Hintergrund</DropdownMenuItem>
            <DropdownMenuItem disabled={!sel?.mask?.length} onClick={() => sel && s().updateLayer(sel.id, { mask: [] })}>Radierungen zurücksetzen</DropdownMenuItem>
            {isBase && <DropdownMenuItem disabled={!doc.baseMask?.length} onClick={() => s().patch((d) => void (d.baseMask = []))}>Hintergrund-Radierungen zurücksetzen</DropdownMenuItem>}
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={!n} onClick={flattenImage}>Auf Hintergrundebene reduzieren</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <IconBtn label="Ebene löschen (Entf)" disabled={!sel && !isBase} onClick={deleteSelectedLayer}><Trash2 /></IconBtn>
      </div>
    </div>
  )
}
