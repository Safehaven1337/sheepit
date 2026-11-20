"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ImagePlus, ShieldCheck } from "lucide-react"
import { BorderBeam } from "@/components/ui/border-beam"
import { setPendingFile, ACCEPT } from "@/lib/editor/handoff"
import { cn } from "@/lib/utils"

export function HeroDrop({
  slug,
  cta = "Bild auswählen",
  title = "Bild hierher ziehen",
  className,
}: {
  slug?: string
  cta?: string
  title?: string
  className?: string
}) {
  const router = useRouter()
  const input = React.useRef<HTMLInputElement>(null)
  const [over, setOver] = React.useState(false)
  const href = `/editor${slug ? `?tool=${slug}` : ""}`

  React.useEffect(() => {
    router.prefetch(href)
  }, [router, href])

  const go = (f: File | undefined) => {
    if (!f) return
    setPendingFile(f)
    router.push(href)
  }

  React.useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const f = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"))?.getAsFile()
      if (f) go(new File([f], "Eingefügt.png", { type: f.type }))
    }
    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [href])

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={title}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        go(e.dataTransfer.files[0])
      }}
      className={cn(
        "group relative grid cursor-pointer place-items-center gap-5 overflow-hidden rounded-[28px] border border-white/10 bg-card/70 px-6 py-10 text-center shadow-[0_40px_120px_-40px_rgba(198,244,50,.25)] backdrop-blur-xl transition duration-300 md:py-14",
        "hover:border-primary/40",
        over && "scale-[1.015] border-primary bg-primary/[0.06]",
        className,
      )}
    >
      <BorderBeam size={160} duration={7} colorFrom="#c6f432" colorTo="#f6f1e4" borderWidth={1.5} />
      <div className="grid size-16 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[0_12px_40px_-8px_rgba(198,244,50,.6)] transition-transform duration-300 group-hover:-translate-y-1 group-hover:rotate-[-4deg]">
        <ImagePlus className="size-7" />
      </div>
      <div className="grid gap-1.5">
        <p className="text-xl font-semibold tracking-tight md:text-2xl">{title}</p>
        <p className="text-sm text-muted-foreground">
          oder <span className="font-medium text-primary underline underline-offset-4">{cta}</span> · Strg+V zum Einfügen
        </p>
      </div>
      <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <ShieldCheck className="size-3.5 text-primary" />
        Kein Upload · Keine Anmeldung · Läuft komplett auf deinem Gerät
      </p>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => go(e.target.files?.[0])}
      />
    </div>
  )
}
