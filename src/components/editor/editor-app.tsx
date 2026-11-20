"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  Crop,
  Download,
  FolderOpen,
  Layers,
  Maximize,
  Minus,
  MousePointer2,
  Palette,
  PenLine,
  Plus,
  Redo2,
  ScanEye,
  Shapes,
  ShieldHalf,
  SlidersHorizontal,
  Type,
  Undo2,
  X,
  ChevronDown,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { SheepMark } from "@/components/brand/sheep-logo"
import { Viewport } from "./viewport"
import { DropScreen } from "./drop-screen"
import { AdjustPanel } from "./panels/adjust-panel"
import { LooksPanel } from "./panels/looks-panel"
import { PrivacyPanel } from "./panels/privacy-panel"
import { CropPanel } from "./panels/crop-panel"
import { DrawPanel, MovePanel, ShapesPanel, TextPanel } from "./panels/layer-panels"
import { LayersPanel } from "./layers-panel"
import { ExportDialog } from "./export-dialog"
import { useEditor } from "@/lib/editor/store"
import { addImageLayer, autoDetectFaces, openFile, switchTool } from "@/lib/editor/actions"
import { takePendingFile, ACCEPT } from "@/lib/editor/handoff"
import { presetBySlug, type EditorPreset } from "@/lib/seo/tools"
import { saveProject, downloadBlob, type ExportFormat } from "@/lib/editor/project"
import type { ToolId } from "@/lib/editor/types"
import { cn } from "@/lib/utils"

const TOOLS: { id: ToolId; label: string; icon: React.ElementType; key: string }[] = [
  { id: "move", label: "Auswählen", icon: MousePointer2, key: "v" },
  { id: "adjust", label: "Anpassen", icon: SlidersHorizontal, key: "a" },
  { id: "looks", label: "Looks", icon: Palette, key: "l" },
  { id: "crop", label: "Zuschneiden", icon: Crop, key: "c" },
  { id: "privacy", label: "Privatsphäre", icon: ShieldHalf, key: "p" },
  { id: "text", label: "Text", icon: Type, key: "t" },
  { id: "shapes", label: "Formen", icon: Shapes, key: "u" },
  { id: "draw", label: "Zeichnen", icon: PenLine, key: "b" },
]

const PANEL_TITLE: Record<ToolId, string> = {
  move: "Auswählen",
  adjust: "Anpassen",
  looks: "Looks & Filter",
  crop: "Zuschneiden & Drehen",
  privacy: "Unkenntlich machen",
  text: "Text",
  shapes: "Formen",
  draw: "Zeichnen",
  resize: "Größe",
}

function Panel({ tool }: { tool: ToolId }) {
  switch (tool) {
    case "adjust":
      return <AdjustPanel />
    case "looks":
      return <LooksPanel />
    case "crop":
      return <CropPanel />
    case "privacy":
      return <PrivacyPanel />
    case "text":
      return <TextPanel />
    case "shapes":
      return <ShapesPanel />
    case "draw":
      return <DrawPanel />
    default:
      return <MovePanel />
  }
}

function Tip({ label, kbd, children }: { label: string; kbd?: string; children: React.ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="bottom">
        {label}
        {kbd && <kbd className="ml-1.5 rounded bg-background/20 px-1 font-mono text-[10px]">{kbd}</kbd>}
      </TooltipContent>
    </Tooltip>
  )
}

export function EditorApp() {
  const params = useSearchParams()
  const presetSlug = params.get("tool")
  const preset = React.useMemo(() => presetBySlug(presetSlug), [presetSlug])
  const ready = useEditor((s) => s.ready)
  const tool = useEditor((s) => s.tool)
  const doc = useEditor((s) => s.doc)
  const canUndo = useEditor((s) => s.past.length > 0)
  const canRedo = useEditor((s) => s.future.length > 0)
  const zoom = useEditor((s) => s.zoom)
  const fitZoom = useEditor((s) => s.fitZoom)
  const dirty = useEditor((s) => s.dirty)
  const [exportOpen, setExportOpen] = React.useState(false)
  const [exportInit, setExportInit] = React.useState<{ format?: ExportFormat; quality?: number }>()
  const [layersOpen, setLayersOpen] = React.useState(true)
  const [mobilePanel, setMobilePanel] = React.useState(true)
  const fileInput = React.useRef<HTMLInputElement>(null)
  const appliedPreset = React.useRef<string | null>(null)

  // debugging handle in development
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") (window as unknown as Record<string, unknown>).__sheepit = { useEditor, saveProject, openFile, autoDetectFaces }
  }, [])

  // preset tool on load
  React.useEffect(() => {
    if (preset) {
      useEditor.getState().setTool(preset.tool)
      if (preset.privacy) useEditor.getState().setPrivacy(preset.privacy)
    }
  }, [preset])

  // pending file from landing/tool pages
  React.useEffect(() => {
    const f = takePendingFile()
    if (f) openFile(f)
  }, [])

  // apply preset effects once an image is open
  React.useEffect(() => {
    if (!ready || !preset || !doc.baseAssetId) return
    const key = `${presetSlug}:${doc.baseAssetId}`
    if (appliedPreset.current === key) return
    appliedPreset.current = key
    applyPreset(preset, setExportInit, setExportOpen)
  }, [ready, preset, presetSlug, doc.baseAssetId])

  // warn before leaving with unsaved edits
  React.useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (useEditor.getState().dirty) e.preventDefault()
    }
    window.addEventListener("beforeunload", h)
    return () => window.removeEventListener("beforeunload", h)
  }, [])

  // paste & global drop
  React.useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input,textarea")) return
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"))
      const f = item?.getAsFile()
      if (!f) return
      e.preventDefault()
      if (useEditor.getState().ready) addImageLayer(f, "Eingefügtes Bild")
      else openFile(new File([f], "Eingefügt.png", { type: f.type }))
    }
    const onDragOver = (e: DragEvent) => e.preventDefault()
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      const f = e.dataTransfer?.files[0]
      if (!f || !useEditor.getState().ready) return
      if (f.name.endsWith(".sheepit")) openFile(f)
      else if (f.type.startsWith("image/")) addImageLayer(f, f.name.replace(/\.[^.]+$/, ""))
    }
    window.addEventListener("paste", onPaste)
    window.addEventListener("dragover", onDragOver)
    window.addEventListener("drop", onDrop)
    return () => {
      window.removeEventListener("paste", onPaste)
      window.removeEventListener("dragover", onDragOver)
      window.removeEventListener("drop", onDrop)
    }
  }, [])

  // keyboard shortcuts
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest("input,textarea,select,[contenteditable]")) return
      const s = useEditor.getState()
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault()
        if (e.shiftKey) s.redo()
        else s.undo()
        return
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault()
        s.redo()
        return
      }
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault()
        if (s.ready) saveProject(s.doc, s.assets).then((b) => {
          downloadBlob(b, `${s.doc.name || "projekt"}.sheepit`)
          s.markSaved()
          toast.success(".sheepit-Projekt gespeichert")
        })
        return
      }
      if (mod && e.key.toLowerCase() === "e") {
        e.preventDefault()
        if (s.ready) setExportOpen(true)
        return
      }
      if (mod && e.key.toLowerCase() === "d" && s.selectedId) {
        e.preventDefault()
        s.duplicateLayer(s.selectedId)
        return
      }
      if (mod && (e.key === "0" || e.key === "1")) {
        e.preventDefault()
        s.setZoom(e.key === "0" ? 0 : 1)
        return
      }
      if (mod && (e.key === "+" || e.key === "=")) {
        e.preventDefault()
        s.setZoom((s.zoom || s.fitZoom) * 1.25)
        return
      }
      if (mod && e.key === "-") {
        e.preventDefault()
        s.setZoom((s.zoom || s.fitZoom) / 1.25)
        return
      }
      if ((e.key === "Delete" || e.key === "Backspace") && s.selectedId) {
        s.removeLayer(s.selectedId)
        return
      }
      if (e.key === "Escape") {
        s.select(null)
        return
      }
      if (e.key.startsWith("Arrow") && s.selectedId) {
        e.preventDefault()
        const d = e.shiftKey ? 10 : 1
        const dx = e.key === "ArrowLeft" ? -d : e.key === "ArrowRight" ? d : 0
        const dy = e.key === "ArrowUp" ? -d : e.key === "ArrowDown" ? d : 0
        const l = s.doc.layers.find((x) => x.id === s.selectedId)
        if (l && "x" in l) s.updateLayer(l.id, { x: l.x + dx, y: l.y + dy } as never, `nudge:${l.id}`)
        return
      }
      if (e.key === "\\" && !e.repeat) {
        s.setCompare(true)
        return
      }
      if (mod || e.altKey) return
      const tl = TOOLS.find((x) => x.key === e.key.toLowerCase())
      if (tl && s.ready) switchTool(tl.id)
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "\\") useEditor.getState().setCompare(false)
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("keyup", onKeyUp)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("keyup", onKeyUp)
    }
  }, [])

  const s = useEditor.getState
  const z = zoom || fitZoom

  return (
    <div className="fixed inset-0 flex flex-col bg-[oklch(0.12_0.006_285)] text-foreground">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center gap-1 border-b border-white/6 bg-background/80 px-2 backdrop-blur md:gap-2 md:px-3">
        <Link href="/" className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-muted/60" aria-label="Sheepit Startseite">
          <SheepMark className="size-7" />
          <span className="hidden text-[15px] font-semibold tracking-tight sm:inline">
            sheep<span className="text-primary">it</span>
          </span>
        </Link>
        <div className="mx-1 hidden h-5 w-px bg-white/10 md:block" />
        {ready && (
          <input
            value={doc.name}
            onChange={(e) => s().patch((d) => void (d.name = e.target.value), "name")}
            className="hidden h-8 w-44 truncate rounded-md bg-transparent px-2 text-[13px] text-muted-foreground outline-none hover:bg-muted/50 focus:bg-muted focus:text-foreground md:block"
            aria-label="Projektname"
          />
        )}
        {ready && dirty && <span className="hidden size-1.5 rounded-full bg-primary/70 md:block" title="Ungespeicherte Änderungen" />}
        <div className="flex-1" />
        {ready && (
          <>
            <Tip label="Rückgängig" kbd="Strg+Z">
              <Button variant="ghost" size="icon" disabled={!canUndo} onClick={() => s().undo()} aria-label="Rückgängig">
                <Undo2 />
              </Button>
            </Tip>
            <Tip label="Wiederholen" kbd="Strg+Y">
              <Button variant="ghost" size="icon" disabled={!canRedo} onClick={() => s().redo()} aria-label="Wiederholen">
                <Redo2 />
              </Button>
            </Tip>
            <div className="mx-1 hidden h-5 w-px bg-white/10 md:block" />
            <div className="hidden items-center md:flex">
              <Button variant="ghost" size="icon-sm" onClick={() => s().setZoom(z / 1.25)} aria-label="Verkleinern">
                <Minus />
              </Button>
              <button
                type="button"
                onClick={() => s().setZoom(zoom ? 0 : 1)}
                className="h-7 w-14 rounded-md font-mono text-[12px] text-muted-foreground hover:bg-muted/60"
                title="Einpassen / 100 %"
              >
                {Math.round(z * 100)}%
              </button>
              <Button variant="ghost" size="icon-sm" onClick={() => s().setZoom(z * 1.25)} aria-label="Vergrößern">
                <Plus />
              </Button>
              <Tip label="Einpassen" kbd="Strg+0">
                <Button variant="ghost" size="icon-sm" onClick={() => s().setZoom(0)} aria-label="Einpassen">
                  <Maximize />
                </Button>
              </Tip>
            </div>
            <Tip label="Vorher / Nachher (gedrückt halten)" kbd="\">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Vorher/Nachher vergleichen"
                onPointerDown={() => s().setCompare(true)}
                onPointerUp={() => s().setCompare(false)}
                onPointerLeave={() => s().setCompare(false)}
              >
                <ScanEye />
              </Button>
            </Tip>
          </>
        )}
        <Tip label="Bild oder .sheepit öffnen" kbd="">
          <Button variant="ghost" size="icon" onClick={() => fileInput.current?.click()} aria-label="Öffnen">
            <FolderOpen />
          </Button>
        </Tip>
        {ready && (
          <Tip label="Schließen">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Schließen"
              onClick={() => {
                if (!s().dirty || confirm("Ungespeicherte Änderungen verwerfen?")) s().close()
              }}
            >
              <X />
            </Button>
          </Tip>
        )}
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) openFile(f)
            e.target.value = ""
          }}
        />
        {ready && (
          <Button className="ml-1 h-8 gap-1.5 px-3 font-semibold" onClick={() => setExportOpen(true)}>
            <Download /> <span className="hidden sm:inline">Exportieren</span>
          </Button>
        )}
      </header>

      {!ready ? (
        <main className="min-h-0 flex-1">
          <DropScreen hint={presetSlug ? undefined : undefined} />
        </main>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Tool rail (desktop) */}
          <nav className="hidden w-[68px] shrink-0 flex-col items-center gap-1 border-r border-white/6 bg-background/60 py-2 md:flex" aria-label="Werkzeuge">
            {TOOLS.map(({ id, label, icon: Icon, key }) => (
              <Tip key={id} label={label} kbd={key.toUpperCase()}>
                <button
                  type="button"
                  onClick={() => switchTool(id)}
                  aria-pressed={tool === id}
                  className={cn(
                    "group grid w-14 place-items-center gap-1 rounded-xl py-2 text-muted-foreground transition hover:bg-muted/60 hover:text-foreground",
                    tool === id && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
                  )}
                >
                  <Icon className="size-[18px]" />
                  <span className="text-[9.5px] leading-none font-medium">{label}</span>
                </button>
              </Tip>
            ))}
          </nav>

          {/* Canvas */}
          <main className="relative min-h-0 min-w-0 flex-1">
            <Viewport className="absolute inset-0" />
          </main>

          {/* Right panel */}
          <aside
            className={cn(
              "flex min-h-0 shrink-0 flex-col border-white/6 bg-background/85 backdrop-blur md:w-[320px] md:border-l",
              "max-md:border-t",
              mobilePanel ? "max-md:h-[42vh]" : "max-md:h-11",
            )}
          >
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/6 px-4">
              <h2 className="text-[13px] font-semibold">{PANEL_TITLE[tool]}</h2>
              <button
                type="button"
                className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted md:hidden"
                onClick={() => setMobilePanel((o) => !o)}
                aria-label="Panel ein-/ausklappen"
              >
                <ChevronDown className={cn("size-4 transition", !mobilePanel && "rotate-180")} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-thin">
              <Panel tool={tool} />
            </div>
            <div className="hidden shrink-0 border-t border-white/6 md:block">
              <button
                type="button"
                onClick={() => setLayersOpen((o) => !o)}
                className="flex h-9 w-full items-center gap-2 px-4 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase hover:text-foreground"
              >
                <Layers className="size-3.5" /> Ebenen
                <span className="ml-auto rounded bg-muted px-1.5 font-mono text-[10px] normal-case">{doc.layers.length}</span>
                <ChevronDown className={cn("size-3.5 transition", !layersOpen && "-rotate-90")} />
              </button>
              {layersOpen && (
                <div className="max-h-[32vh] overflow-y-auto scrollbar-thin">
                  <LayersPanel />
                </div>
              )}
            </div>
          </aside>

          {/* Tool bar (mobile) */}
          <nav className="flex shrink-0 gap-1 overflow-x-auto border-t border-white/6 bg-background px-2 py-1.5 md:hidden" aria-label="Werkzeuge">
            {TOOLS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  switchTool(id)
                  setMobilePanel(true)
                }}
                className={cn(
                  "grid min-w-16 place-items-center gap-1 rounded-xl py-1.5 text-muted-foreground",
                  tool === id && "bg-primary/10 text-primary",
                )}
              >
                <Icon className="size-5" />
                <span className="text-[10px] leading-none">{label}</span>
              </button>
            ))}
          </nav>
        </div>
      )}

      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} initial={exportInit} />
    </div>
  )
}

async function applyPreset(
  p: EditorPreset,
  setInit: (v: { format?: ExportFormat; quality?: number }) => void,
  setOpen: (v: boolean) => void,
) {
  const s = useEditor.getState()
  s.setTool(p.tool)
  if (p.privacy) s.setPrivacy(p.privacy)
  if (p.look) s.patch((d) => void ((d.look = p.look!), (d.lookAmount = 1)))
  if (p.adjust)
    s.patch((d) => {
      for (const [k, v] of Object.entries(p.adjust!)) (d.adjustments as unknown as Record<string, unknown>)[k] = v
    })
  if (p.autoFaces) await autoDetectFaces()
  if (p.invertBlur) toast.info("Male über dein Motiv – alles andere wird weichgezeichnet.")
  if (p.openExport) {
    setInit(p.openExport)
    setOpen(true)
  }
}
