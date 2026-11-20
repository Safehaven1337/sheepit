"use client"

import * as React from "react"

export function computeHistogram(src: HTMLCanvasElement, size = 220) {
  const s = Math.min(1, size / Math.max(src.width, src.height))
  const c = document.createElement("canvas")
  c.width = Math.max(1, Math.round(src.width * s))
  c.height = Math.max(1, Math.round(src.height * s))
  const x = c.getContext("2d", { willReadFrequently: true })!
  x.drawImage(src, 0, 0, c.width, c.height)
  const d = x.getImageData(0, 0, c.width, c.height).data
  const r = new Uint32Array(256), g = new Uint32Array(256), b = new Uint32Array(256), l = new Uint32Array(256)
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 8) continue
    r[d[i]]++
    g[d[i + 1]]++
    b[d[i + 2]]++
    l[Math.round(d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722)]++
  }
  return { r, g, b, l, total: (d.length / 4) | 0 }
}

function toPath(h: Uint32Array, max: number) {
  let p = "M0 100"
  for (let i = 0; i < 256; i++) p += `L${(i / 255) * 256} ${100 - Math.min(1, Math.sqrt(h[i] / max)) * 96}`
  return p + "L256 100Z"
}

export function Histogram() {
  const [paths, setPaths] = React.useState<{ r: string; g: string; b: string } | null>(null)
  const [clip, setClip] = React.useState({ lo: 0, hi: 0 })

  React.useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined
    const run = () => {
      const c = document.querySelector<HTMLCanvasElement>("[data-viewport] canvas")
      if (!c || !c.width) return
      const h = computeHistogram(c)
      let max = 1
      for (let i = 2; i < 254; i++) max = Math.max(max, h.r[i], h.g[i], h.b[i])
      setPaths({ r: toPath(h.r, max), g: toPath(h.g, max), b: toPath(h.b, max) })
      setClip({ lo: (h.l[0] / h.total) * 100, hi: (h.l[255] / h.total) * 100 })
    }
    const schedule = () => {
      clearTimeout(t)
      t = setTimeout(run, 120)
    }
    schedule()
    window.addEventListener("sheepit:rendered", schedule)
    return () => {
      clearTimeout(t)
      window.removeEventListener("sheepit:rendered", schedule)
    }
  }, [])

  return (
    <div className="relative overflow-hidden rounded-lg bg-black/35 ring-1 ring-white/5">
      <svg viewBox="0 0 256 100" preserveAspectRatio="none" className="block h-20 w-full">
        {paths && (
          <g style={{ mixBlendMode: "screen" }}>
            <path d={paths.r} fill="#ff4d4d" fillOpacity={0.55} />
            <path d={paths.g} fill="#3ddc84" fillOpacity={0.55} />
            <path d={paths.b} fill="#4d8dff" fillOpacity={0.55} />
          </g>
        )}
      </svg>
      <span
        className="absolute top-1.5 left-1.5 size-1.5 rounded-full transition-colors"
        style={{ background: clip.lo > 0.5 ? "#60a5fa" : "rgba(255,255,255,.15)" }}
        title="Tiefen-Clipping"
      />
      <span
        className="absolute top-1.5 right-1.5 size-1.5 rounded-full transition-colors"
        style={{ background: clip.hi > 0.5 ? "#f87171" : "rgba(255,255,255,.15)" }}
        title="Lichter-Clipping"
      />
    </div>
  )
}
