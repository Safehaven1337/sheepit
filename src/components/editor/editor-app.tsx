"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ChevronDown, Download, Redo2, ScanEye, Undo2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { SheepMark } from "@/components/brand/sheep-logo"
import { Viewport } from "./viewport"
import { DropScreen } from "./drop-screen"
import { AdjustPanel, autoEnhance } from "./panels/adjust-panel"
import { LooksPanel } from "./panels/looks-panel"
import { PropertiesPanel } from "./properties-panel"
import { LayersPanel } from "./layers-panel"
import { ExportDialog } from "./export-dialog"
import { NewDocDialog } from "./new-doc-dialog"
import { ContextMenuHost } from "./context-menu"
import { MenuBar, type UiCommand } from "./menu-bar"
import { OptionsBar } from "./options-bar"
import { Toolbar, TOOLS } from "./toolbar"
import { useEditor, type PanelTab } from "@/lib/editor/store"
import { addImageLayer, autoDetectFaces, finishTextEdit, openFile, switchTool } from "@/lib/editor/actions"
import {
  copyLayer,
  copyToNewLayer,
  deleteSelectedLayer,
  deleteSelection,
  fillSelection,
  invertSelection,
  mergeDown,
  newLayer,
  pasteLayer,
  selectAll,
} from "@/lib/editor/ops"
import { takePendingFile, ACCEPT } from "@/lib/editor/handoff"
import { presetBySlug, type EditorPreset } from "@/lib/seo/tools"
import { saveProject, downloadBlob, type ExportFormat } from "@/lib/editor/project"
import { docSize } from "@/lib/editor/render"
import { targetOf } from "@/lib/editor/target"
import { BASE_ID, type Layer } from "@/lib/editor/types"
import { cn } from "@/lib/utils"

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

async function saveSheepit() {
  const s = useEditor.getState()
  if (!s.ready) return
  const b = await saveProject(s.doc, s.assets)
  downloadBlob(b, `${(s.doc.name || "projekt").replace(/[^\w\-äöüÄÖÜß ]+/g, "").trim() || "projekt"}.sheepit`)
  s.markSaved()
  toast.success(".sheepit-Projekt gespeichert – öffne es später, um weiterzumachen.")
}

export function EditorApp() {
  const params = useSearchParams()
  const presetSlug = params.get("tool")
  const preset = React.useMemo(() => presetBySlug(presetSlug), [presetSlug])
  const ready = useEditor((s) => s.ready)
  const doc = useEditor((s) => s.doc)
  const canUndo = useEditor((s) => s.past.length > 0)
  const canRedo = useEditor((s) => s.future.length > 0)
  const dirty = useEditor((s) => s.dirty)
  const panelTab = useEditor((s) => s.panelTab)
  const selectedId = useEditor((s) => s.selectedId)
  const [exportOpen, setExportOpen] = React.useState(false)
  const [newOpen, setNewOpen] = React.useState(false)
  const [exportInit, setExportInit] = React.useState<{ format?: ExportFormat; quality?: number }>()
  const [mobilePanel, setMobilePanel] = React.useState(false)
  const [mobileLayers, setMobileLayers] = React.useState(false)
  const openInput = React.useRef<HTMLInputElement>(null)
  const placeInput = React.useRef<HTMLInputElement>(null)
  const appliedPreset = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production")
      (window as unknown as Record<string, unknown>).__sheepit = { useEditor, saveProject, openFile, autoDetectFaces }
  }, [])

  // UI commands from menus
  React.useEffect(() => {
    const on = (e: Event) => {
      const cmd = (e as CustomEvent<UiCommand>).detail
      if (cmd === "new") setNewOpen(true)
      if (cmd === "open") openInput.current?.click()
      if (cmd === "place") placeInput.current?.click()
      if (cmd === "save") saveSheepit()
      if (cmd === "export") setExportOpen(true)
      if (cmd === "close" && (!useEditor.getState().dirty || confirm("Ungespeicherte Änderungen verwerfen?"))) useEditor.getState().close()
    }
    window.addEventListener("sheepit:ui", on)
    return () => window.removeEventListener("sheepit:ui", on)
  }, [])

  // properties follow the selection (photo → adjustments, layer → properties)
  React.useEffect(() => {
    const s = useEditor.getState()
    if (!selectedId) return
    // background → adjustments; layers keep the current tab (adjustments now work per layer)
    if (selectedId === BASE_ID && s.panelTab === "props" && s.doc.baseAssetId) s.setPanelTab("adjust")
    const l = s.doc.layers.find((x) => x.id === selectedId)
    if (l?.type === "effect") s.setPanelTab("props")
  }, [selectedId])

  React.useEffect(() => {
    const f = takePendingFile()
    if (f) openFile(f)
  }, [])

  React.useEffect(() => {
    if (!ready || !preset || !doc.baseAssetId) return
    const key = `${presetSlug}:${doc.baseAssetId}`
    if (appliedPreset.current === key) return
    appliedPreset.current = key
    applyPreset(preset, setExportInit, setExportOpen)
  }, [ready, preset, presetSlug, doc.baseAssetId])

  React.useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (useEditor.getState().dirty) e.preventDefault()
    }
    window.addEventListener("beforeunload", h)
    return () => window.removeEventListener("beforeunload", h)
  }, [])

  // paste & drop
  React.useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input,textarea")) return
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"))
      const f = item?.getAsFile()
      e.preventDefault()
      if (f) {
        if (useEditor.getState().ready) addImageLayer(f, "Eingefügtes Bild")
        else openFile(new File([f], "Eingefügt.png", { type: f.type }))
        return
      }
      if (useEditor.getState().ready) pasteLayer()
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

  // Photoshop keyboard shortcuts
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t?.closest?.("input,textarea,select,[contenteditable]")) return
      if (t?.closest?.("[role=menu],[role=dialog]")) return
      const s = useEditor.getState()
      const mod = e.metaKey || e.ctrlKey
      const k = e.key.toLowerCase()
      const run = (fn: () => void) => {
        e.preventDefault()
        fn()
      }
      if (e.altKey && !mod && k === "n") return run(() => setNewOpen(true))
      if (mod && k === "o") return run(() => openInput.current?.click())
      if (!s.ready) return
      if (mod && k === "z") return run(() => (e.shiftKey ? s.redo() : s.undo()))
      if (mod && k === "y") return run(() => s.redo())
      if (mod && k === "s") return run(() => (e.shiftKey ? setExportOpen(true) : void saveSheepit()))
      if (mod && k === "c") return run(() => copyLayer())
      if (mod && k === "x") return run(() => copyLayer(true))
      if (mod && k === "j") return run(() => void copyToNewLayer(e.shiftKey))
      if (mod && e.shiftKey && k === "n") return run(() => newLayer())
      if (mod && k === "e") return run(() => void mergeDown())
      if (mod && k === "t") return run(() => switchTool("move"))
      if (mod && k === "a") return run(selectAll)
      if (mod && k === "d") return run(() => s.setSelection(null))
      if (mod && e.shiftKey && k === "i") return run(invertSelection)
      if (mod && e.shiftKey && k === "l") return run(autoEnhance)
      if (mod && (e.key === "0" || e.key === "1")) return run(() => s.setZoom(e.key === "0" ? 0 : 1))
      if (mod && (e.key === "+" || e.key === "=")) return run(() => s.setZoom((s.zoom || s.fitZoom) * 1.25))
      if (mod && e.key === "-") return run(() => s.setZoom((s.zoom || s.fitZoom) / 1.25))
      if (mod && (e.key === "]" || e.key === "[") && s.selectedId && s.selectedId !== BASE_ID) {
        const id = s.selectedId
        return run(() => s.moveLayer(id, e.key === "]" ? (e.shiftKey ? "top" : 1) : e.shiftKey ? "bottom" : -1))
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (e.altKey) return run(() => fillSelection())
        if (mod) return run(() => fillSelection(s.bg))
        return run(() => (s.selection ? deleteSelection() : deleteSelectedLayer()))
      }
      if (e.key === "Enter" && s.tool === "crop") return run(() => switchTool("move"))
      if (e.key === "Escape") {
        if (s.editingText) return finishTextEdit()
        if (s.selection) return s.setSelection(null)
        if (s.tool === "crop") return s.setTool("move")
        return s.select(null)
      }
      if (e.key.startsWith("Arrow")) {
        e.preventDefault()
        const d = e.shiftKey ? 10 : 1
        const dx = e.key === "ArrowLeft" ? -d : e.key === "ArrowRight" ? d : 0
        const dy = e.key === "ArrowUp" ? -d : e.key === "ArrowDown" ? d : 0
        if (s.selection && s.tool === "select") {
          const o = s.selection
          return s.setSelection(o.kind === "lasso" ? { ...o, points: o.points.map((v, i) => v + (i % 2 ? dy : dx)) } : { ...o, x: o.x + dx, y: o.y + dy })
        }
        const l = s.doc.layers.find((x) => x.id === s.selectedId)
        if (l && "x" in l && !l.locked) s.updateLayer(l.id, { x: l.x + dx, y: l.y + dy } as Partial<Layer>, `nudge:${l.id}`)
        return
      }
      if (e.key === "\\" && !e.repeat) return s.setCompare(true)
      if (mod || e.altKey) return
      // brush size / hardness / opacity
      const brushTool = s.tool === "brush" || s.tool === "eraser" || s.tool === "privacy"
      if (brushTool && (e.key === "[" || e.key === "]" || e.key === "{" || e.key === "}")) {
        const up = e.key === "]" || e.key === "}"
        const hardness = e.shiftKey || e.key === "{" || e.key === "}"
        if (s.tool === "privacy") return s.setPrivacy({ brushSize: Math.max(2, s.privacy.brushSize * (up ? 1.15 : 1 / 1.15)) })
        const set = s.tool === "eraser" ? s.setEraser : s.setBrush
        const cur = s.tool === "eraser" ? s.eraser : s.brush
        if (hardness) return set({ hardness: Math.min(1, Math.max(0, cur.hardness + (up ? 0.25 : -0.25))) })
        return set({ size: Math.min(500, Math.max(1, Math.round(cur.size * (up ? 1.15 : 1 / 1.15)))) })
      }
      if ((s.tool === "brush" || s.tool === "eraser") && /^[0-9]$/.test(e.key)) {
        const v = e.key === "0" ? 1 : Number(e.key) / 10
        return (s.tool === "eraser" ? s.setEraser : s.setBrush)({ opacity: v })
      }
      if (k === "x") return s.setColors({ fg: s.bg, bg: s.fg })
      if (k === "d") return s.setColors({ fg: "#000000", bg: "#ffffff" })
      const tl = TOOLS.find((x) => x.key === k)
      if (tl) switchTool(tl.id)
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
  const hasTarget = !!targetOf(doc, selectedId)
  const tabs: { id: PanelTab; label: string; disabled?: boolean }[] = [
    { id: "adjust", label: "Anpassen", disabled: !hasTarget },
    { id: "looks", label: "Looks", disabled: !hasTarget },
    { id: "props", label: "Eigenschaften" },
  ]
  const tab = !hasTarget && panelTab !== "props" ? "props" : panelTab

  return (
    <div className="fixed inset-0 flex flex-col bg-[oklch(0.12_0.006_285)] text-foreground">
      <header className="flex h-11 shrink-0 items-center gap-1 border-b border-white/6 bg-background/80 px-2 backdrop-blur">
        <Link href="/" className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-muted/60" aria-label="Sheepit Startseite">
          <SheepMark className="size-6" />
          <span className="hidden text-[14px] font-semibold tracking-tight lg:inline">
            sheep<span className="text-primary">it</span>
          </span>
        </Link>
        <MenuBar />
        {ready && (
          <>
            <div className="mx-1 hidden h-5 w-px bg-white/10 md:block" />
            <input
              value={doc.name}
              onChange={(e) => s().patch((d) => void (d.name = e.target.value), "name")}
              className="hidden h-7 w-40 truncate rounded-md bg-transparent px-2 text-[12px] text-muted-foreground outline-none hover:bg-muted/50 focus:bg-muted focus:text-foreground lg:block"
              aria-label="Projektname"
            />
            {dirty && <span className="hidden size-1.5 rounded-full bg-primary/70 lg:block" title="Ungespeicherte Änderungen" />}
          </>
        )}
        <div className="flex-1" />
        {ready && (
          <>
            <Tip label="Rückgängig" kbd="Strg+Z">
              <Button variant="ghost" size="icon-sm" disabled={!canUndo} onClick={() => s().undo()} aria-label="Rückgängig"><Undo2 /></Button>
            </Tip>
            <Tip label="Wiederholen" kbd="Strg+Y">
              <Button variant="ghost" size="icon-sm" disabled={!canRedo} onClick={() => s().redo()} aria-label="Wiederholen"><Redo2 /></Button>
            </Tip>
            {doc.baseAssetId && (
              <Tip label="Vorher / Nachher (gedrückt halten)" kbd="\">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Vorher/Nachher vergleichen"
                  onPointerDown={() => s().setCompare(true)}
                  onPointerUp={() => s().setCompare(false)}
                  onPointerLeave={() => s().setCompare(false)}
                >
                  <ScanEye />
                </Button>
              </Tip>
            )}
            <Button className="ml-1 h-7 gap-1.5 px-3 text-[12px] font-semibold" onClick={() => setExportOpen(true)}>
              <Download /> <span className="hidden sm:inline">Exportieren</span>
            </Button>
          </>
        )}
        {!ready && (
          <Button variant="ghost" size="sm" onClick={() => setNewOpen(true)}>
            Neu …
          </Button>
        )}
      </header>

      <input
        ref={openInput}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) openFile(f)
          e.target.value = ""
        }}
      />
      <input
        ref={placeInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) addImageLayer(f, f.name.replace(/\.[^.]+$/, ""))
          e.target.value = ""
        }}
      />

      {!ready ? (
        <main className="min-h-0 flex-1">
          <DropScreen onNew={() => setNewOpen(true)} />
        </main>
      ) : (
        <>
          <OptionsBar />
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            <div className="hidden md:flex">
              <Toolbar />
            </div>

            <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
              <Viewport className="min-h-0 flex-1" />
              <StatusBar />
            </main>

            <aside
              className={cn(
                "flex min-h-0 shrink-0 flex-col border-white/6 bg-background/85 backdrop-blur md:w-[300px] md:border-l lg:w-[320px]",
                "max-md:border-t",
                mobilePanel ? "max-md:h-[46vh]" : "max-md:h-10",
              )}
            >
              <div className="flex h-10 shrink-0 items-center gap-0.5 border-b border-white/6 px-1.5">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={t.disabled}
                    onClick={() => {
                      s().setPanelTab(t.id)
                      setMobilePanel(true)
                      setMobileLayers(false)
                    }}
                    className={cn(
                      "h-7 rounded-md px-2.5 text-[12px] font-medium text-muted-foreground transition hover:text-foreground disabled:opacity-35",
                      tab === t.id && !mobileLayers && "bg-muted text-foreground",
                      tab === t.id && mobileLayers && "md:bg-muted md:text-foreground",
                    )}
                  >
                    {t.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setMobileLayers(true)
                    setMobilePanel(true)
                  }}
                  className={cn(
                    "h-7 rounded-md px-2.5 text-[12px] font-medium text-muted-foreground md:hidden",
                    mobileLayers && "bg-muted text-foreground",
                  )}
                >
                  Ebenen
                </button>
                <button
                  type="button"
                  className="ml-auto grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted md:hidden"
                  onClick={() => setMobilePanel((o) => !o)}
                  aria-label="Panel ein-/ausklappen"
                >
                  <ChevronDown className={cn("size-4 transition", !mobilePanel && "rotate-180")} />
                </button>
              </div>
              {mobileLayers && (
                <div className="flex min-h-0 flex-1 flex-col md:hidden">
                  <LayersPanel />
                </div>
              )}
              <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-thin", mobileLayers && "max-md:hidden")}>
                {tab === "adjust" && <AdjustPanel />}
                {tab === "looks" && <LooksPanel />}
                {tab === "props" && <PropertiesPanel />}
              </div>
              <div className="flex h-[42%] min-h-56 shrink-0 flex-col border-t border-white/6 max-md:hidden">
                <div className="flex h-8 shrink-0 items-center px-3 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                  Ebenen
                </div>
                <LayersPanel />
              </div>
            </aside>

            <div className="md:hidden">
              <Toolbar orientation="horizontal" />
            </div>
          </div>
        </>
      )}

      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} initial={exportInit} />
      <NewDocDialog open={newOpen} onOpenChange={setNewOpen} />
      <ContextMenuHost />
    </div>
  )
}

const TOOL_HINT: Partial<Record<string, string>> = {
  move: "Klicken = Ebene wählen · Ziehen = verschieben · Doppelklick auf Text = bearbeiten",
  select: "Ziehen = Auswahl · in Auswahl ziehen = verschieben · Entf = löschen · Strg+J = neue Ebene",
  brush: "Malen · [ ] Größe · Shift+[ ] Härte · 1–0 Deckkraft · Alt = Pipette",
  eraser: "Radiert auf der aktiven Ebene oder dem Hintergrund",
  text: "Klicken und tippen · Esc = fertig",
  crop: "Rahmen anpassen · Enter übernimmt · Esc bricht ab",
}

function StatusBar() {
  const tool = useEditor((s) => s.tool)
  const zoom = useEditor((s) => s.zoom)
  const fit = useEditor((s) => s.fitZoom)
  const doc = useEditor((s) => s.doc)
  const setZoom = useEditor((s) => s.setZoom)
  const [pos, setPos] = React.useState<{ x: number; y: number } | null>(null)
  React.useEffect(() => {
    const on = (e: Event) => setPos((e as CustomEvent<{ x: number; y: number }>).detail)
    window.addEventListener("sheepit:cursor", on)
    return () => window.removeEventListener("sheepit:cursor", on)
  }, [])
  const { w, h } = docSize(doc)
  return (
    <div className="flex h-6 shrink-0 items-center gap-3 overflow-hidden border-t border-white/6 bg-background/70 px-3 font-mono whitespace-nowrap text-[10.5px] text-muted-foreground max-md:hidden">
      <button type="button" onClick={() => setZoom(zoom ? 0 : 1)} className="hover:text-foreground" title="Ganzes Bild / 100 %">
        {Math.round((zoom || fit) * 100)} %
      </button>
      <span>{w} × {h} px</span>
      {pos && (
        <span>
          X {Math.round(pos.x)} · Y {Math.round(pos.y)}
        </span>
      )}
      <span className="ml-auto truncate font-sans">{TOOL_HINT[tool] ?? ""}</span>
    </div>
  )
}

async function applyPreset(
  p: EditorPreset,
  setInit: (v: { format?: ExportFormat; quality?: number }) => void,
  setOpen: (v: boolean) => void,
) {
  const s = useEditor.getState()
  if (p.tool === "adjust" || p.tool === "looks") {
    s.setTool("move")
    s.setPanelTab(p.tool)
  } else s.setTool(p.tool)
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
