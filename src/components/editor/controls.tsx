"use client"

import * as React from "react"
import { Slider as SliderPrimitive } from "@base-ui/react/slider"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export const SWATCHES = [
  "#ffffff", "#d4d4d8", "#71717a", "#0b0b0f", "#ef4444", "#f97316", "#facc15", "#c6f432",
  "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#f6f1e4", "#a16207", "#7f1d1d",
]

const HEX = /^#?[0-9a-f]{6}$/i

/** Colour swatch with popover: palette, native picker and hex input. */
export function ColorPicker({
  value,
  onChange,
  allowNone,
  label,
  className,
  size = "md",
}: {
  value: string | null
  onChange: (c: string | null) => void
  allowNone?: boolean
  label: string
  className?: string
  size?: "sm" | "md"
}) {
  const [draft, setDraft] = React.useState<string | null>(null)
  const hex = draft ?? value ?? ""
  return (
    <Popover>
      <PopoverTrigger
        aria-label={label}
        title={label}
        className={cn(
          "relative shrink-0 overflow-hidden rounded-md ring-1 ring-white/20 transition hover:ring-white/50",
          size === "sm" ? "size-6" : "size-7",
          className,
        )}
        style={{ background: value ?? "transparent" }}
      >
        {!value && <span className="absolute inset-0 m-auto h-px w-[140%] -translate-x-[15%] -rotate-45 bg-red-400" />}
      </PopoverTrigger>
      <PopoverContent className="w-56 gap-2 p-2.5" align="start">
        <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
        <div className="grid grid-cols-8 gap-1">
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              onClick={() => onChange(c)}
              className={cn("aspect-square rounded ring-1 ring-white/10 hover:scale-110", value?.toLowerCase() === c && "ring-2 ring-primary")}
              style={{ background: c }}
            />
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <label className="relative size-7 shrink-0 cursor-pointer overflow-hidden rounded-md bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)] ring-1 ring-white/15" title="Eigene Farbe">
            <input type="color" value={value ?? "#ffffff"} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
          </label>
          <input
            value={hex}
            onChange={(e) => {
              setDraft(e.target.value)
              if (HEX.test(e.target.value)) onChange(e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`)
            }}
            onKeyDown={(e) => e.stopPropagation()}
            onBlur={() => setDraft(null)}
            className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2 font-mono text-[12px] uppercase"
            aria-label="Hex-Farbwert"
          />
          {allowNone && (
            <button type="button" onClick={() => onChange(null)} className="h-7 rounded-md bg-muted px-2 text-[11px] text-muted-foreground hover:text-foreground">
              Keine
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** Compact numeric field: type a value, ↑/↓ steps, drag the label to scrub. */
export function NumberField({
  label,
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  suffix,
  width = "w-14",
  decimals = 0,
}: {
  label?: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  width?: string
  decimals?: number
}) {
  const [text, setText] = React.useState<string | null>(null)
  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  const shown = text ?? value.toFixed(decimals)
  const scrub = React.useRef<{ x: number; v: number } | null>(null)
  return (
    <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
      {label && (
        <span
          className="cursor-ew-resize select-none"
          onPointerDown={(e) => {
            ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
            scrub.current = { x: e.clientX, v: value }
          }}
          onPointerMove={(e) => {
            if (!scrub.current) return
            onChange(clamp(+(scrub.current.v + ((e.clientX - scrub.current.x) * step) / 2).toFixed(decimals)))
          }}
          onPointerUp={() => (scrub.current = null)}
        >
          {label}
        </span>
      )}
      <span className="relative">
        <input
          value={shown}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            if (text !== null) {
              const v = Number(text.replace(",", "."))
              if (!Number.isNaN(v)) onChange(clamp(v))
            }
            setText(null)
          }}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === "Enter") (e.target as HTMLInputElement).blur()
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault()
              const d = (e.key === "ArrowUp" ? 1 : -1) * step * (e.shiftKey ? 10 : 1)
              onChange(clamp(+(value + d).toFixed(decimals)))
              setText(null)
            }
          }}
          className={cn(
            "h-6 rounded-md border border-input bg-background/60 px-1.5 text-right font-mono text-[11px] text-foreground tabular-nums outline-none focus:border-ring",
            suffix && "pr-5",
            width,
          )}
        />
        {suffix && <span className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 text-[10px] opacity-60">{suffix}</span>}
      </span>
    </label>
  )
}

/** Small inline slider for the options bar. */
export function MiniSlider({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  format,
  width = "w-24",
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step?: number
  format?: (v: number) => string
  width?: string
}) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
      <span className="whitespace-nowrap">{label}</span>
      <SliderPrimitive.Root
        value={value}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : (v as number))}
        thumbAlignment="edge"
        aria-label={label}
        className={width}
      >
        <SliderPrimitive.Control className="relative flex h-4 w-full touch-none items-center">
          <SliderPrimitive.Track className="relative h-[3px] w-full rounded-full bg-muted">
            <SliderPrimitive.Indicator className="rounded-full bg-primary/80" />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb className="block size-3 rounded-full border-2 border-background bg-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </SliderPrimitive.Control>
      </SliderPrimitive.Root>
      <span className="w-9 text-right font-mono tabular-nums text-foreground/80">{format ? format(value) : Math.round(value)}</span>
    </div>
  )
}

export function Seg<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T
  onChange: (v: T) => void
  items: { v: T; label: React.ReactNode; title?: string }[]
}) {
  return (
    <div className="flex rounded-md bg-muted/60 p-0.5">
      {items.map((it) => (
        <button
          key={it.v}
          type="button"
          title={it.title}
          aria-pressed={value === it.v}
          onClick={() => onChange(it.v)}
          className={cn(
            "flex h-6 items-center gap-1 rounded px-2 text-[11px] text-muted-foreground transition hover:text-foreground [&_svg]:size-3.5",
            value === it.v && "bg-background text-foreground shadow-sm",
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}

export function IconBtn({
  label,
  onClick,
  active,
  disabled,
  children,
  className,
}: {
  label: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-35 [&_svg]:size-4",
        active && "bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary",
        className,
      )}
    >
      {children}
    </button>
  )
}

export const Divider = () => <div className="mx-1 h-5 w-px shrink-0 bg-white/10" />
