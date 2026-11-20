"use client"

import * as React from "react"
import { Check } from "lucide-react"
import { AdjustSlider } from "../adjust-slider"
import { useEditor } from "@/lib/editor/store"
import { LOOKS } from "@/lib/editor/looks"
import { docSize, renderDoc } from "@/lib/editor/render"
import { defaultAdjustments } from "@/lib/editor/defaults"
import { cn } from "@/lib/utils"

export function LooksPanel() {
  const doc = useEditor((s) => s.doc)
  const assets = useEditor((s) => s.assets)
  const patch = useEditor((s) => s.patch)
  const [thumbs, setThumbs] = React.useState<Record<string, string>>({})
  const geoKey = JSON.stringify(doc.geometry) + doc.baseAssetId

  React.useEffect(() => {
    if (!doc.baseAssetId) return
    let cancelled = false
    const { w, h } = docSize(doc)
    const scale = Math.min(1, 168 / Math.min(w, h))
    const base = { ...doc, layers: [], adjustments: defaultAdjustments() }
    const ids = ["none", ...LOOKS.map((l) => l.id)]
    let i = 0
    const step = () => {
      if (cancelled || i >= ids.length) {
        useEditor.getState().bump()
        return
      }
      const id = ids[i++]
      const c = renderDoc({ ...base, look: id === "none" ? null : id, lookAmount: 1 }, assets, { scale })
      const url = c.toDataURL("image/jpeg", 0.75)
      setThumbs((t) => ({ ...t, [id]: url }))
      setTimeout(step, 0)
    }
    step()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoKey, assets])

  if (!doc.baseAssetId) return <p className="p-4 text-sm text-muted-foreground">Öffne ein Foto, um Looks anzuwenden.</p>

  const groups = [...new Set(LOOKS.map((l) => l.group))]

  return (
    <div className="grid gap-4 p-4">
      <AdjustSlider
        label="Intensität"
        value={Math.round(doc.lookAmount * 100)}
        min={0}
        max={100}
        neutral={100}
        disabled={!doc.look}
        format={(v) => `${v}%`}
        onChange={(v) => patch((d) => void (d.lookAmount = v / 100), "look:amount")}
      />
      <LookTile
        name="Original"
        src={thumbs.none}
        active={!doc.look}
        onClick={() => patch((d) => void (d.look = null))}
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
                src={thumbs[l.id]}
                active={doc.look === l.id}
                onClick={() =>
                  patch((d) => {
                    if (d.look !== l.id) d.lookAmount = 1
                    d.look = l.id
                  })
                }
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
