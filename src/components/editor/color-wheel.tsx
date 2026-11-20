"use client"

import * as React from "react"
import type { GradeWheel } from "@/lib/editor/types"

export function ColorWheel({
  label,
  value,
  onChange,
}: {
  label: string
  value: GradeWheel
  onChange: (v: GradeWheel) => void
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const dragging = React.useRef(false)
  const a = ((value.hue - 90) * Math.PI) / 180
  const r = value.sat / 100
  const px = 50 + Math.cos(a) * r * 50
  const py = 50 + Math.sin(a) * r * 50

  const update = (e: React.PointerEvent) => {
    const b = ref.current!.getBoundingClientRect()
    const x = (e.clientX - b.left) / b.width - 0.5
    const y = (e.clientY - b.top) / b.height - 0.5
    const hue = ((Math.atan2(y, x) * 180) / Math.PI + 90 + 360) % 360
    const sat = Math.min(100, (Math.hypot(x, y) / 0.5) * 100)
    onChange({ ...value, hue: Math.round(hue), sat: Math.round(sat) })
  }

  return (
    <div className="grid justify-items-center gap-1.5">
      <div
        ref={ref}
        role="slider"
        aria-label={`${label} Farbton`}
        aria-valuenow={value.hue}
        tabIndex={0}
        className="relative aspect-square w-full max-w-24 touch-none rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(128,128,128,1) 0%, rgba(128,128,128,0) 70%), conic-gradient(from 0deg, hsl(0 80% 55%), hsl(60 80% 55%), hsl(120 80% 55%), hsl(180 80% 55%), hsl(240 80% 55%), hsl(300 80% 55%), hsl(360 80% 55%))",
        }}
        onPointerDown={(e) => {
          ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
          dragging.current = true
          update(e)
        }}
        onPointerMove={(e) => dragging.current && update(e)}
        onPointerUp={() => (dragging.current = false)}
        onDoubleClick={() => onChange({ ...value, sat: 0, lum: 0 })}
      >
        <div className="absolute inset-0 rounded-full ring-1 ring-white/10" />
        <div
          className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${px}%`, top: `${py}%`, background: `hsl(${value.hue} 80% 55%)` }}
        />
      </div>
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <input
        type="range"
        min={-100}
        max={100}
        value={value.lum}
        onChange={(e) => onChange({ ...value, lum: Number(e.target.value) })}
        onDoubleClick={() => onChange({ ...value, lum: 0 })}
        aria-label={`${label} Luminanz`}
        className="h-1 w-full max-w-24 cursor-pointer appearance-none rounded-full bg-gradient-to-r from-black to-white accent-[var(--lime)]"
      />
    </div>
  )
}
