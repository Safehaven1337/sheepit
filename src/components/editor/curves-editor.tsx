"use client"

import * as React from "react"
import { sampleCurve } from "@/lib/editor/curves"
import type { CurvePoint, Curves } from "@/lib/editor/types"
import { cn } from "@/lib/utils"

const CH: { id: keyof Curves; label: string; color: string }[] = [
  { id: "rgb", label: "RGB", color: "#f5f5f5" },
  { id: "r", label: "R", color: "#ff5a5a" },
  { id: "g", label: "G", color: "#4ade80" },
  { id: "b", label: "B", color: "#60a5fa" },
]

const PRESETS: { name: string; pts: CurvePoint[] }[] = [
  { name: "Linear", pts: [[0, 0], [1, 1]] },
  { name: "S-Kurve", pts: [[0, 0], [0.25, 0.18], [0.75, 0.84], [1, 1]] },
  { name: "Matt", pts: [[0, 0.1], [0.3, 0.3], [0.75, 0.78], [1, 0.94]] },
  { name: "Hell", pts: [[0, 0], [0.4, 0.52], [1, 1]] },
]

export function CurvesEditor({ curves, onChange }: { curves: Curves; onChange: (c: Curves) => void }) {
  const [ch, setCh] = React.useState<keyof Curves>("rgb")
  const svg = React.useRef<SVGSVGElement>(null)
  const drag = React.useRef<number | null>(null)
  const pts = curves[ch]
  const color = CH.find((c) => c.id === ch)!.color

  const toPt = (e: React.PointerEvent): CurvePoint => {
    const r = svg.current!.getBoundingClientRect()
    return [
      Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height)),
    ]
  }
  const set = (p: CurvePoint[]) => onChange({ ...curves, [ch]: p })

  const path = React.useMemo(() => {
    const s = sampleCurve(pts, 128)
    let d = ""
    for (let i = 0; i < 128; i++) d += `${i ? "L" : "M"}${(i / 127) * 100} ${100 - s[i] * 100}`
    return d
  }, [pts])

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {CH.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCh(c.id)}
              className={cn(
                "h-6 rounded-md px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted",
                ch === c.id && "bg-muted text-foreground",
              )}
            >
              <span className="mr-1 inline-block size-1.5 rounded-full align-middle" style={{ background: c.color }} />
              {c.label}
            </button>
          ))}
        </div>
        <select
          className="h-6 rounded-md border border-input bg-transparent px-1 text-[11px] text-muted-foreground"
          value=""
          onChange={(e) => {
            const p = PRESETS.find((x) => x.name === e.target.value)
            if (p) set(p.pts.map((q) => [...q] as CurvePoint))
          }}
          aria-label="Kurven-Vorlage"
        >
          <option value="" disabled>
            Vorlage
          </option>
          {PRESETS.map((p) => (
            <option key={p.name}>{p.name}</option>
          ))}
        </select>
      </div>
      <svg
        ref={svg}
        viewBox="-2 -2 104 104"
        className="aspect-square w-full touch-none rounded-lg bg-black/30"
        onPointerDown={(e) => {
          ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
          const p = toPt(e)
          let idx = pts.findIndex((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.05)
          if (idx < 0) {
            const next = [...pts, p].sort((a, b) => a[0] - b[0]) as CurvePoint[]
            idx = next.indexOf(p)
            set(next)
          }
          drag.current = idx
        }}
        onPointerMove={(e) => {
          if (drag.current === null) return
          const p = toPt(e)
          const i = drag.current
          const next = pts.map((q) => [...q] as CurvePoint)
          const lo = i === 0 ? 0 : next[i - 1][0] + 0.01
          const hi = i === next.length - 1 ? 1 : next[i + 1][0] - 0.01
          next[i] = [i === 0 ? Math.min(p[0], hi) : i === next.length - 1 ? Math.max(p[0], lo) : Math.min(hi, Math.max(lo, p[0])), p[1]]
          set(next)
        }}
        onPointerUp={() => (drag.current = null)}
        onDoubleClick={(e) => {
          const p = toPt(e as unknown as React.PointerEvent)
          const idx = pts.findIndex((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.05)
          if (idx > 0 && idx < pts.length - 1) set(pts.filter((_, i) => i !== idx))
        }}
      >
        {[25, 50, 75].map((v) => (
          <g key={v} stroke="white" strokeOpacity={0.08} strokeWidth={0.5}>
            <line x1={v} y1={0} x2={v} y2={100} />
            <line x1={0} y1={v} x2={100} y2={v} />
          </g>
        ))}
        <line x1={0} y1={100} x2={100} y2={0} stroke="white" strokeOpacity={0.15} strokeWidth={0.5} strokeDasharray="2 2" />
        <path d={path} fill="none" stroke={color} strokeWidth={1.4} />
        {pts.map((p, i) => (
          <circle key={i} cx={p[0] * 100} cy={100 - p[1] * 100} r={2.4} fill="#111" stroke={color} strokeWidth={1.2} />
        ))}
      </svg>
      <p className="text-[11px] text-muted-foreground">Klicken = Punkt setzen · Doppelklick = Punkt löschen</p>
    </div>
  )
}
