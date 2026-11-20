"use client"

import * as React from "react"
import { Check } from "lucide-react"
import { AdjustSlider } from "../adjust-slider"
import { useEditor } from "@/lib/editor/store"
import { LOOKS } from "@/lib/editor/looks"
import { aabb, docSize, invalidateRenderCache, layerBounds, renderDoc } from "@/lib/editor/render"
import { patchDevelop, readDevelop, targetOf } from "@/lib/editor/target"
import { TargetBadge } from "./adjust-panel"
import { defaultAdjustments } from "@/lib/editor/defaults"
import { cn } from "@/lib/utils"

export function LooksPanel() {
  const doc = useEditor((s) => s.doc)
  const assets = useEditor((s) => s.assets)
  const selectedId = useEditor((s) => s.selectedId)
  const target = targetOf(doc, selectedId)
  const dev = target ? readDevelop(doc, target) : null
  const [thumbs, setThumbs] = React.useState<{ key: string; urls: Record<string, string> }>({ key: "", urls: {} })
  const layer = target?.kind === "layer" ? doc.layers.find((l) => l.id === target.id) : null
  // thumbnails only depend on the target's pixels, not on its current adjustments
  const srcKey =
    target?.kind === "layer" && layer
      ? `L:${JSON.stringify({ ...layer, adjustments: null, look: null, lookAmount: null, opacity: 1, name: "" })}`
      : `B:${JSON.stringify(doc.geometry)}${doc.baseAssetId}`

  React.useEffect(() => {
    if (!target) return
    let cancelled = false
    const { w, h } = docSize(doc)
    const ids = ["none", ...LOOKS.map((l) => l.id)]
    let render: (id: string) => HTMLCanvasElement
    if (layer) {
      const box = layerBounds(layer)
      const r = box ? aabb(box) : { x: 0, y: 0, w, h }
      const scale = Math.min(1, 168 / Math.max(1, Math.min(r.w, r.h)))
      render = (id) => {
        const l = { ...layer, adjustments: undefined, look: id === "none" ? null : id, lookAmount: 1, opacity: 1, blend: "source-over" as const, visible: true }
        const c = renderDoc({ ...doc, layers: [l] }, assets, { scale, skipBase: true, background: null })
        const out = document.createElement("canvas")
        out.width = Math.max(1, Math.round(r.w * scale))
        out.height = Math.max(1, Math.round(r.h * scale))
        const x = out.getContext("2d")!
        x.fillStyle = "#2a2a2e"
        x.fillRect(0, 0, out.width, out.height)
        x.drawImage(c, r.x * scale, r.y * scale, out.width, out.height, 0, 0, out.width, out.height)
        return out
      }
    } else {
      const scale = Math.min(1, 168 / Math.min(w, h))
      const base = { ...doc, layers: [], adjustments: defaultAdjustments() }
      render = (id) => renderDoc({ ...base, look: id === "none" ? null : id, lookAmount: 1 }, assets, { scale })
    }
    const urls: Record<string, string> = {}
    let i = 0
    const step = () => {
      if (cancelled) return
      if (i >= ids.length) {
        invalidateRenderCache()
        useEditor.getState().bump()
        return
      }
      const id = ids[i++]
      urls[id] = render(id).toDataURL("image/jpeg", 0.75)
      setThumbs({ key: srcKey, urls: { ...urls } })
      setTimeout(step, 0)
    }
    step()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcKey, assets])

  if (!target || !dev)
    return <p className="p-4 text-sm text-muted-foreground">Wähle eine Ebene oder öffne ein Foto, um Looks anzuwenden.</p>

  const urls = thumbs.key === srcKey ? thumbs.urls : {}
  const setLook = (id: string | null) =>
    patchDevelop(target, (d) => {
      if (d.look !== id) d.lookAmount = 1
      d.look = id
    })

  const groups = [...new Set(LOOKS.map((l) => l.group))]

  return (
    <div className="grid gap-4 p-4">
      <TargetBadge target={target} />
      <AdjustSlider
        label="Intensität"
        value={Math.round(dev.lookAmount * 100)}
        min={0}
        max={100}
        neutral={100}
        disabled={!dev.look}
        format={(v) => `${v}%`}
        onChange={(v) => patchDevelop(target, (d) => void (d.lookAmount = v / 100), "look:amount")}
      />
      <LookTile
        name="Original"
        src={urls.none}
        active={!dev.look}
        onClick={() => setLook(null)}
        wide
      />
      {groups.map((g) => (
        <div key={g} className="grid gap-2">
          <h3 className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{g}</h3>
          <div className="grid grid-cols-3 gap-2">
            {LOOKS.filter((l) => l.group === g).map((l) => (
              <LookTile
                key={l.id}
                name={l.name}
                src={urls[l.id]}
                active={dev.look === l.id}
                onClick={() => setLook(l.id)}
              />
            ))}
          </div>
        </div>
      ))}
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Looks werden zusätzlich zu deinen Reglern angewendet – du kannst danach unter „Anpassen“ alles weiter verfeinern.
      </p>
    </div>
  )
}

function LookTile({
  name,
  src,
  active,
  onClick,
  wide,
}: {
  name: string
  src?: string
  active: boolean
  onClick: () => void
  wide?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-lg bg-muted text-left ring-1 ring-white/5 transition hover:ring-white/25",
        wide ? "flex h-12 items-center gap-3 pr-3" : "aspect-square",
        active && "ring-2 ring-primary hover:ring-primary",
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className={cn("object-cover", wide ? "h-full w-16" : "absolute inset-0 size-full transition-transform duration-500 group-hover:scale-105")} />
      ) : (
        <div className={cn("animate-pulse bg-white/5", wide ? "h-full w-16" : "absolute inset-0")} />
      )}
      <span
        className={cn(
          "text-[11px] font-medium",
          !wide && "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 pt-4 pb-1 text-white",
        )}
      >
        {name}
      </span>
      {active && (
        <span className="absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-3" />
        </span>
      )}
    </button>
  )
}
