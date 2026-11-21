"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: "Werkzeuge",
    items: [
      ["V", "Verschieben"],
      ["M", "Auswahl (Rechteck/Ellipse/Lasso)"],
      ["C", "Freistellen"],
      ["I", "Pipette"],
      ["B", "Pinsel"],
      ["E", "Radierer"],
      ["G", "Verlauf (nochmal G = Füllen)"],
      ["K", "Farbeimer"],
      ["S", "Kopierstempel"],
      ["J", "Bereichsreparatur"],
      ["T", "Text"],
      ["U", "Formen"],
      ["P", "Unkenntlich machen"],
      ["H / Leertaste", "Hand"],
      ["Z", "Zoom"],
    ],
  },
  {
    title: "Bearbeiten",
    items: [
      ["Strg+Z / Strg+Y", "Rückgängig / Wiederholen"],
      ["Strg+C / X / V", "Ebene kopieren / ausschneiden / einfügen"],
      ["Strg+J", "Ebene durch Kopie"],
      ["Strg+Umschalt+J", "Ebene durch Ausschneiden"],
      ["Strg+Umschalt+N", "Neue Ebene"],
      ["Strg+E", "Auf eine Ebene reduzieren"],
      ["Strg+T", "Frei transformieren"],
      ["Entf", "Löschen (Auswahl oder Ebene)"],
      ["Alt+Entf / Strg+Entf", "Mit Vorder-/Hintergrundfarbe füllen"],
      ["Strg+] / Strg+[", "Ebene vor / zurück"],
      ["Pfeiltasten (+Shift)", "Um 1 px (10 px) verschieben"],
    ],
  },
  {
    title: "Auswahl & Ansicht",
    items: [
      ["Strg+A / Strg+D", "Alles auswählen / Auswahl aufheben"],
      ["Strg+Umschalt+I", "Auswahl umkehren"],
      ["Strg+0 / Strg+1", "Ganzes Bild / 100 %"],
      ["Strg++ / Strg+-", "Ein-/Auszoomen"],
      ["Strg+#", "Raster ein/aus"],
      ["\\ (halten)", "Vorher / Nachher"],
    ],
  },
  {
    title: "Pinsel & Farben",
    items: [
      ["[ / ]", "Pinselgröße"],
      ["Shift+[ / ]", "Härte"],
      ["1 … 0", "Deckkraft 10 … 100 %"],
      ["Alt+Klick", "Farbe aufnehmen"],
      ["Shift+Klick", "Gerade Linie"],
      ["X / D", "Farben tauschen / Schwarz-Weiß"],
      ["Rechtsklick", "Kontextmenü (z. B. Pinselspitze)"],
    ],
  },
  {
    title: "Datei",
    items: [
      ["Alt+N", "Neues Dokument"],
      ["Strg+O", "Öffnen"],
      ["Strg+S", "Als .sheepit speichern"],
      ["Strg+Umschalt+S", "Exportieren"],
      ["Strg+Umschalt+L", "Auto-Verbessern"],
      ["?", "Diese Übersicht"],
    ],
  },
]

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Tastenkürzel</DialogTitle>
          <DialogDescription>Sheepit folgt den Photoshop-Kürzeln, wo es geht. Auf dem Mac gilt ⌘ statt Strg.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 sm:grid-cols-2">
          {GROUPS.map((g) => (
            <section key={g.title} className="grid content-start gap-1.5">
              <h3 className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{g.title}</h3>
              {g.items.map(([k, v]) => (
                <div key={k + v} className="flex items-center justify-between gap-3 text-[12.5px]">
                  <span className="text-foreground/85">{v}</span>
                  <kbd className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{k}</kbd>
                </div>
              ))}
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
