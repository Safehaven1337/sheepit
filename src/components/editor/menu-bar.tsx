"use client"

import * as React from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useEditor } from "@/lib/editor/store"
import { autoDetectFaces, flip, rotate90, switchTool } from "@/lib/editor/actions"
import {
  copyLayer,
  copyToNewLayer,
  cropToSelection,
  deleteSelectedLayer,
  deleteSelection,
  fillSelection,
  flattenImage,
  invertSelection,
  mergeDown,
  newLayer,
  pasteLayer,
  privacyFromSelection,
  rasterizeLayer,
  removeBackground,
  selectAll,
} from "@/lib/editor/ops"
import { currentTarget, patchDevelop } from "@/lib/editor/target"
import type { Filters } from "@/lib/editor/types"
import { autoEnhance } from "./panels/adjust-panel"
import { BASE_ID } from "@/lib/editor/types"

export type UiCommand = "new" | "open" | "place" | "save" | "export" | "close" | "help"
export const ui = (cmd: UiCommand) => window.dispatchEvent(new CustomEvent("sheepit:ui", { detail: cmd }))

type Item = { label: string; kbd?: string; run: () => void; disabled?: boolean } | "-" | { sub: string; items: Item[] }

function Menu({ label, items }: { label: string; items: Item[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="h-7 rounded-md px-2.5 text-[12.5px] text-muted-foreground transition hover:bg-muted hover:text-foreground data-popup-open:bg-muted data-popup-open:text-foreground">
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72" align="start">
        {items.map((it, i) => <MenuItem key={i} it={it} />)}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MenuItem({ it }: { it: Item }) {
  if (it === "-") return <DropdownMenuSeparator />
  if ("sub" in it)
    return (
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>{it.sub}</DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-64">
          {it.items.map((x, i) => <MenuItem key={i} it={x} />)}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    )
  return (
    <DropdownMenuItem disabled={it.disabled} onClick={it.run}>
      {it.label}
      {it.kbd && <DropdownMenuShortcut>{it.kbd}</DropdownMenuShortcut>}
    </DropdownMenuItem>
  )
}

export function MenuBar() {
  const ready = useEditor((s) => s.ready)
  const hasSel = useEditor((s) => !!s.selection)
  const layerSel = useEditor((s) => !!s.selectedId && s.selectedId !== BASE_ID)
  const hasPhoto = useEditor((s) => !!s.doc.baseAssetId)
  const canUndo = useEditor((s) => s.past.length > 0)
  const canRedo = useEditor((s) => s.future.length > 0)
  const clip = useEditor((s) => !!s.clipboard)
  const showGrid = useEditor((s) => s.showGrid)
  const st = useEditor.getState
  const z = () => st().zoom || st().fitZoom

  const file: Item[] = [
    { label: "Neu …", kbd: "Alt+N", run: () => ui("new") },
    { label: "Öffnen …", kbd: "Strg+O", run: () => ui("open") },
    { label: "Bild als Ebene platzieren …", run: () => ui("place"), disabled: !ready },
    "-",
    { label: "Projekt speichern (.sheepit)", kbd: "Strg+S", run: () => ui("save"), disabled: !ready },
    { label: "Exportieren …", kbd: "Strg+Umschalt+S", run: () => ui("export"), disabled: !ready },
    "-",
    { label: "Schließen", run: () => ui("close"), disabled: !ready },
  ]
  const edit: Item[] = [
    { label: "Rückgängig", kbd: "Strg+Z", run: () => st().undo(), disabled: !canUndo },
    { label: "Wiederholen", kbd: "Strg+Y", run: () => st().redo(), disabled: !canRedo },
    "-",
    { label: "Ebene ausschneiden", kbd: "Strg+X", run: () => copyLayer(true), disabled: !layerSel },
    { label: "Ebene kopieren", kbd: "Strg+C", run: () => copyLayer(), disabled: !layerSel },
    { label: "Einfügen", kbd: "Strg+V", run: () => pasteLayer(), disabled: !clip },
    { label: "Löschen", kbd: "Entf", run: () => (st().selection ? deleteSelection() : deleteSelectedLayer()) },
    "-",
    { label: "Fläche füllen (Vordergrundfarbe)", kbd: "Alt+Entf", run: () => fillSelection(), disabled: !ready },
    { label: "Fläche füllen (Hintergrundfarbe)", kbd: "Strg+Entf", run: () => fillSelection(st().bg), disabled: !ready },
    { label: "Frei transformieren", kbd: "Strg+T", run: () => switchTool("move"), disabled: !layerSel },
  ]
  const image: Item[] = [
    { label: "Auto-Verbessern (aktive Ebene)", kbd: "Strg+Umschalt+L", run: autoEnhance, disabled: !ready },
    { label: "Anpassungen …", run: () => st().setPanelTab("adjust"), disabled: !ready },
    { label: "Looks & Filter …", run: () => st().setPanelTab("looks"), disabled: !ready },
    "-",
    { label: "90° im Uhrzeigersinn drehen", run: () => rotate90(1), disabled: !hasPhoto },
    { label: "90° gegen den Uhrzeigersinn", run: () => rotate90(-1), disabled: !hasPhoto },
    { label: "Horizontal spiegeln", run: () => flip("h"), disabled: !hasPhoto },
    { label: "Vertikal spiegeln", run: () => flip("v"), disabled: !hasPhoto },
    "-",
    { label: "Hintergrund entfernen (Person)", run: () => void removeBackground(), disabled: !ready },
    "-",
    { label: "Freistellen-Werkzeug", kbd: "C", run: () => switchTool("crop"), disabled: !hasPhoto },
    { label: "Auf Auswahl freistellen", run: cropToSelection, disabled: !hasSel },
  ]
  const layer: Item[] = [
    { label: "Neue Ebene", kbd: "Strg+Umschalt+N", run: newLayer, disabled: !ready },
    { label: hasSel ? "Ebene durch Kopie (Auswahl)" : "Ebene duplizieren", kbd: "Strg+J", run: () => copyToNewLayer(), disabled: !ready },
    { label: "Ebene durch Ausschneiden", kbd: "Strg+Umschalt+J", run: () => copyToNewLayer(true), disabled: !hasSel },
    { label: "Ebene löschen", run: deleteSelectedLayer, disabled: !layerSel },
    "-",
    { label: "Ebene rastern", run: () => st().selectedId && rasterizeLayer(st().selectedId!), disabled: !layerSel },
    { label: "Auf eine Ebene reduzieren", kbd: "Strg+E", run: mergeDown, disabled: !layerSel },
    { label: "Auf Hintergrundebene reduzieren", run: flattenImage, disabled: !ready },
    "-",
    {
      sub: "Anordnen",
      items: [
        { label: "In den Vordergrund", kbd: "Strg+Umschalt+]", run: () => st().selectedId && st().moveLayer(st().selectedId!, "top"), disabled: !layerSel },
        { label: "Schrittweise vorwärts", kbd: "Strg+]", run: () => st().selectedId && st().moveLayer(st().selectedId!, 1), disabled: !layerSel },
        { label: "Schrittweise rückwärts", kbd: "Strg+[", run: () => st().selectedId && st().moveLayer(st().selectedId!, -1), disabled: !layerSel },
        { label: "In den Hintergrund", kbd: "Strg+Umschalt+[", run: () => st().selectedId && st().moveLayer(st().selectedId!, "bottom"), disabled: !layerSel },
      ],
    },
  ]
  const select: Item[] = [
    { label: "Alles auswählen", kbd: "Strg+A", run: selectAll, disabled: !ready },
    { label: "Auswahl aufheben", kbd: "Strg+D", run: () => st().setSelection(null), disabled: !hasSel },
    { label: "Auswahl umkehren", kbd: "Strg+Umschalt+I", run: invertSelection, disabled: !ready },
    "-",
    { label: "Auswahl unkenntlich machen", run: privacyFromSelection, disabled: !hasSel },
    { label: "Gesichter automatisch finden", run: () => void autoDetectFaces(), disabled: !hasPhoto },
  ]
  const setFilter = (p: Partial<Filters>) => {
    const t = currentTarget()
    if (!t) return
    patchDevelop(t, (d) => void (d.filters = { ...d.filters, ...p }))
    st().openFilters()
  }
  const filter: Item[] = [
    { label: "Gaußscher Weichzeichner …", run: () => setFilter({ blur: 6 }), disabled: !ready },
    { label: "Mosaik (Verpixeln) …", run: () => setFilter({ pixelate: 16 }), disabled: !ready },
    { label: "Tontrennung …", run: () => setFilter({ posterize: 5 }), disabled: !ready },
    { label: "Rauschen hinzufügen …", run: () => setFilter({ noise: 20 }), disabled: !ready },
    { label: "Umkehren", kbd: "Strg+I", run: () => {
      const t = currentTarget()
      if (t) patchDevelop(t, (d) => void (d.filters = { ...d.filters, invert: !d.filters.invert }))
    }, disabled: !ready },
    "-",
    { label: "Schwarz-Weiß", run: () => {
      const t = currentTarget()
      if (t) patchDevelop(t, (d) => void (d.adjustments = { ...d.adjustments, monochrome: !d.adjustments.monochrome }))
    }, disabled: !ready },
    { label: "Scharfzeichnen", run: () => {
      const t = currentTarget()
      if (t) patchDevelop(t, (d) => void (d.adjustments = { ...d.adjustments, sharpen: Math.min(150, d.adjustments.sharpen + 40) }))
    }, disabled: !ready },
    "-",
    { label: "Alle Filter dieser Ebene …", run: () => st().openFilters(), disabled: !ready },
  ]
  const help: Item[] = [
    { label: "Tastenkürzel", kbd: "?", run: () => ui("help") },
  ]
  const view: Item[] = [
    { label: "Einzoomen", kbd: "Strg++", run: () => st().setZoom(z() * 1.25), disabled: !ready },
    { label: "Auszoomen", kbd: "Strg+-", run: () => st().setZoom(z() / 1.25), disabled: !ready },
    { label: "Ganzes Bild", kbd: "Strg+0", run: () => st().setZoom(0), disabled: !ready },
    { label: "100 %", kbd: "Strg+1", run: () => st().setZoom(1), disabled: !ready },
    "-",
    { label: showGrid ? "Raster ausblenden" : "Raster einblenden", kbd: "Strg+#", run: () => st().setShowGrid(!showGrid), disabled: !ready },
    { label: "Protokoll", run: () => st().setPanelTab("history"), disabled: !ready },
  ]

  return (
    <nav aria-label="Menü" className="hidden items-center md:flex">
      <Menu label="Datei" items={file} />
      <Menu label="Bearbeiten" items={edit} />
      <Menu label="Bild" items={image} />
      <Menu label="Ebene" items={layer} />
      <Menu label="Auswahl" items={select} />
      <Menu label="Filter" items={filter} />
      <Menu label="Ansicht" items={view} />
      <Menu label="Hilfe" items={help} />
    </nav>
  )
}
