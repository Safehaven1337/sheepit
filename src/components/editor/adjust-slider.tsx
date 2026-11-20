"use client"

import * as React from "react"
import { Slider as SliderPrimitive } from "@base-ui/react/slider"
import { cn } from "@/lib/utils"

interface Props {
  label: string
  value: number
  min: number
  max: number
  step?: number
  /** neutral value; fill grows from here and double-click resets to it */
  neutral?: number
  onChange: (v: number) => void
  onCommit?: (v: number) => void
  /** css background for the track (e.g. temperature gradient) */
  track?: string
  format?: (v: number) => string
  className?: string
  disabled?: boolean
}

export function AdjustSlider({
  label,
  value,
  min,
  max,
  step = 1,
  neutral = min < 0 ? 0 : min,
  onChange,
  onCommit,
  track,
  format,
  className,
  disabled,
}: Props) {
  const [editing, setEditing] = React.useState(false)
  const pct = (v: number) => ((v - min) / (max - min)) * 100
  const a = pct(Math.min(value, neutral))
  const b = pct(Math.max(value, neutral))
  const changed = Math.abs(value - neutral) > 1e-6
  const display = format ? format(value) : step < 1 ? value.toFixed(2) : (value > 0 && min < 0 ? "+" : "") + Math.round(value)

  return (
    <div
      className={cn("group/slider grid gap-1.5 py-1", disabled && "pointer-events-none opacity-40", className)}
      onDoubleClick={() => {
        onChange(neutral)
        onCommit?.(neutral)
      }}
    >
      <div className="flex items-center justify-between text-[12px] leading-none">
        <span className={cn("text-muted-foreground transition-colors", changed && "text-foreground")}>{label}</span>
        {editing ? (
          <input
            autoFocus
            defaultValue={String(value)}
            className="h-5 w-14 rounded border border-input bg-background px-1 text-right font-mono text-[11px] outline-none focus:border-ring"
            onBlur={(e) => {
              const v = Number(e.currentTarget.value.replace(",", "."))
              if (!Number.isNaN(v)) {
                const c = Math.min(max, Math.max(min, v))
                onChange(c)
                onCommit?.(c)
              }
              setEditing(false)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur()
              if (e.key === "Escape") setEditing(false)
              e.stopPropagation()
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={cn(
              "h-5 min-w-10 rounded px-1 text-right font-mono text-[11px] tabular-nums text-muted-foreground hover:bg-muted",
              changed && "text-primary",
            )}
            aria-label={`${label} Wert eingeben`}
          >
            {display}
          </button>
        )}
      </div>
      <SliderPrimitive.Root
        value={value}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : (v as number))}
        onValueCommitted={(v) => onCommit?.(Array.isArray(v) ? v[0] : (v as number))}
        thumbAlignment="edge"
        aria-label={label}
      >
        <SliderPrimitive.Control className="relative flex h-4 w-full touch-none items-center select-none">
          <SliderPrimitive.Track
            className="relative h-[3px] w-full rounded-full bg-muted"
            style={track ? { background: track } : undefined}
          >
            {!track && (
              <div
                className="absolute inset-y-0 rounded-full bg-primary/80"
                style={{ left: `${a}%`, width: `${b - a}%` }}
              />
            )}
            {min < neutral && (
              <div
                className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-foreground/25"
                style={{ left: `${pct(neutral)}%` }}
              />
            )}
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb className="block size-3.5 rounded-full border-2 border-background bg-foreground shadow-[0_0_0_1px_rgba(0,0,0,.4)] outline-none transition-transform hover:scale-110 focus-visible:ring-3 focus-visible:ring-ring active:scale-110" />
        </SliderPrimitive.Control>
      </SliderPrimitive.Root>
    </div>
  )
}

export function Section({
  title,
  children,
  action,
  defaultOpen = true,
}: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = React.useState(defaultOpen)
  return (
    <section className="border-b border-border/70 last:border-b-0">
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase hover:text-foreground"
          aria-expanded={open}
        >
          <svg viewBox="0 0 10 10" className={cn("size-2.5 transition-transform", open ? "rotate-90" : "")}>
            <path d="M3 1.5 7 5 3 8.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          {title}
        </button>
        {action}
      </div>
      {open && <div className="px-4 pb-3">{children}</div>}
    </section>
  )
}
