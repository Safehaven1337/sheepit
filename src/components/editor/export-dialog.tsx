"use client"

import * as React from "react"
import { Copy, Download, Share2, FileArchive, Loader2, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AdjustSlider } from "./adjust-slider"
import { useEditor } from "@/lib/editor/store"
import { docSize } from "@/lib/editor/render"
import { downloadBlob, exportImage, saveProject, supportsFormat, type ExportFormat } from "@/lib/editor/project"
import { cn } from "@/lib/utils"

const FORMATS: { id: ExportFormat; label: string; ext: string; lossy: boolean; hint: string }[] = [
  { id: "image/jpeg", label: "JPG", ext: "jpg", lossy: true, hint: "Fotos, überall kompatibel" },
  { id: "image/png", label: "PNG", ext: "png", lossy: false, hint: "Verlustfrei, Transparenz" },
  { id: "image/webp", label: "WebP", ext: "webp", lossy: true, hint: "Klein, fürs Web" },
  { id: "image/avif", label: "AVIF", ext: "avif", lossy: true, hint: "Am kleinsten" },
]

const fmtBytes = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(2)} MB` : `${Math.round(b / 1e3)} KB`)

export function ExportDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  initial?: { format?: ExportFormat; quality?: number }
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">{open && <ExportBody initial={initial} />}</DialogContent>
    </Dialog>
  )
}

function ExportBody({ initial }: { initial?: { format?: ExportFormat; quality?: number } }) {
  const open = true
  const doc = useEditor((s) => s.doc)
  const assets = useEditor((s) => s.assets)
  const { w, h } = docSize(doc)
  const [format, setFormat] = React.useState<ExportFormat>(initial?.format ?? "image/jpeg")
  const [quality, setQuality] = React.useState(Math.round((initial?.quality ?? 0.9) * 100))
  const [width, setWidth] = React.useState(w)
  const [bg, setBg] = React.useState("#ffffff")
  const [result, setResult] = React.useState<{ key: string; bytes: number } | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [supported, setSupported] = React.useState<Record<string, boolean>>({})
  const blobRef = React.useRef<Blob | null>(null)

  React.useEffect(() => {
    Promise.all(FORMATS.map(async (f) => [f.id, await supportsFormat(f.id)] as const)).then((r) =>
      setSupported(Object.fromEntries(r)),
    )
  }, [])

  const scale = Math.min(1, Math.max(0.01, width / w))
  const outW = Math.round(w * scale)
  const outH = Math.round(h * scale)
  const fmt = FORMATS.find((f) => f.id === format)!
  const filename = `${(doc.name || "sheepit").replace(/[^\w\-äöüÄÖÜß ]+/g, "").trim() || "sheepit"}-sheepit.${fmt.ext}`

  // live size estimate (debounced)
  const exportKey = `${format}|${quality}|${scale}|${bg}`
  const size = result && result.key === exportKey ? result.bytes : null
  React.useEffect(() => {
    if (!open) return
    blobRef.current = null
    const key = `${format}|${quality}|${scale}|${bg}`
    const t = setTimeout(async () => {
      try {
        const b = await exportImage(doc, assets, { format, quality: quality / 100, scale, background: format === "image/jpeg" ? bg : null })
        blobRef.current = b
        setResult({ key, bytes: b.size })
      } catch {
        setResult({ key, bytes: -1 })
      }
    }, 350)
    return () => clearTimeout(t)
  }, [open, doc, assets, format, quality, scale, bg])

  const getBlob = async () =>
    blobRef.current ??
    (await exportImage(doc, assets, { format, quality: quality / 100, scale, background: format === "image/jpeg" ? bg : null }))

  const download = async () => {
    setBusy(true)
    try {
      downloadBlob(await getBlob(), filename)
      toast.success("Bild gespeichert")
    } catch (e) {
      toast.error((e as Error).message)
    }
    setBusy(false)
  }

  const share = async () => {
    try {
      const b = await getBlob()
      const file = new File([b], filename, { type: b.type })
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: doc.name })
      else toast.info("Teilen wird von diesem Browser nicht unterstützt – lade das Bild herunter.")
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("Teilen fehlgeschlagen")
    }
  }

  const copy = async () => {
    try {
      const b = await exportImage(doc, assets, { format: "image/png", quality: 1, scale })
      await navigator.clipboard.write([new ClipboardItem({ "image/png": b })])
      toast.success("In die Zwischenablage kopiert")
    } catch {
      toast.error("Kopieren wird von diesem Browser nicht unterstützt")
    }
  }

  const saveSheepit = async () => {
    setBusy(true)
    try {
      const b = await saveProject(doc, assets)
      downloadBlob(b, `${(doc.name || "projekt").replace(/[^\w\-äöüÄÖÜß ]+/g, "").trim() || "projekt"}.sheepit`)
      useEditor.getState().markSaved()
      toast.success(".sheepit-Projekt gespeichert – öffne es später, um weiterzumachen.")
    } catch (e) {
      toast.error((e as Error).message)
    }
    setBusy(false)
  }

  return (
    <>
        <DialogHeader>
          <DialogTitle>Exportieren</DialogTitle>
          <DialogDescription className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-primary" /> Wird lokal erzeugt – ohne Upload, ohne EXIF/GPS-Daten.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-4 gap-1.5">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                type="button"
                disabled={supported[f.id] === false}
                onClick={() => setFormat(f.id)}
                className={cn(
                  "grid gap-0.5 rounded-xl bg-muted/60 px-2 py-2.5 text-center ring-1 ring-transparent transition hover:bg-muted disabled:opacity-35",
                  format === f.id && "bg-primary/12 ring-primary/60",
                )}
              >
                <span className={cn("text-sm font-semibold", format === f.id && "text-primary")}>{f.label}</span>
                <span className="text-[10px] leading-tight text-muted-foreground">{f.hint}</span>
              </button>
            ))}
          </div>

          {fmt.lossy && (
            <AdjustSlider label="Qualität" value={quality} min={10} max={100} neutral={90} format={(v) => `${Math.round(v)}%`} onChange={setQuality} />
          )}

          <div className="grid gap-1.5">
            <div className="flex items-center justify-between text-[12px] text-muted-foreground">
              <span>Größe</span>
              <span className="font-mono">
                {outW} × {outH} px
              </span>
            </div>
            <div className="flex gap-1.5">
              {[1, 0.75, 0.5, 0.25].map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setWidth(Math.round(w * k))}
                  className={cn(
                    "h-7 flex-1 rounded-md bg-muted/60 text-[12px] text-muted-foreground hover:bg-muted",
                    Math.abs(scale - k) < 0.005 && "bg-primary/12 text-primary ring-1 ring-primary/50",
                  )}
                >
                  {k * 100}%
                </button>
              ))}
              <input
                type="number"
                min={16}
                max={w}
                value={width}
                onChange={(e) => setWidth(Math.min(w, Math.max(1, Number(e.target.value) || 1)))}
                className="h-7 w-20 rounded-md border border-input bg-background px-1.5 text-right font-mono text-[12px]"
                aria-label="Breite in Pixeln"
              />
            </div>
          </div>

          {format === "image/jpeg" && (
            <label className="flex items-center justify-between text-[12px] text-muted-foreground">
              Hintergrund für Transparenz
              <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="h-7 w-12 rounded border border-input bg-transparent" />
            </label>
          )}

          <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2.5">
            <span className="text-[12px] text-muted-foreground">Dateigröße</span>
            <span className="font-mono text-sm">
              {size === null ? <Loader2 className="size-4 animate-spin" /> : size < 0 ? "–" : fmtBytes(size)}
            </span>
          </div>

          <Button size="lg" className="h-11 text-[15px]" onClick={download} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Download />} {fmt.label} herunterladen
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={share}>
              <Share2 /> Teilen
            </Button>
            <Button variant="secondary" onClick={copy}>
              <Copy /> Kopieren
            </Button>
          </div>
          <div className="rounded-xl border border-dashed border-white/12 p-3">
            <div className="flex items-start gap-3">
              <FileArchive className="mt-0.5 size-5 shrink-0 text-primary" />
              <div className="grid flex-1 gap-1">
                <p className="text-sm font-medium">Als .sheepit-Projekt speichern</p>
                <p className="text-[12px] leading-snug text-muted-foreground">
                  Enthält Originalbild + alle Bearbeitungen. Später einfach wieder öffnen und weitermachen.
                </p>
              </div>
            </div>
            <Button variant="outline" className="mt-3 w-full" onClick={saveSheepit} disabled={busy}>
              .sheepit herunterladen
            </Button>
          </div>
        </div>
    </>
  )
}
