# Sheepit 🐑

Kostenloser Bildeditor im Browser – **ohne Login, ohne Upload, ohne Backend-Speicherung**. Alles läuft auf dem Gerät der Nutzer:innen.

## Start

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # Production-Build (alle SEO-Seiten statisch vorgerendert)
```

`NEXT_PUBLIC_SITE_URL` setzen (Default `https://sheepit.app`) – wird für Canonicals, Sitemap und OG genutzt.

## Architektur

| Bereich | Ort |
| --- | --- |
| Dokumentmodell (JSON, nicht-destruktiv) | `src/lib/editor/types.ts`, `defaults.ts` |
| State + Undo/Redo (zustand, Snapshot-History mit Coalescing) | `src/lib/editor/store.ts` |
| GPU-Entwicklung (WebGL2: Belichtung, Tonwerte, Kurven-LUT, HSL-Mixer, Color Grading, Klarheit, Dehaze, Schärfen, Entrauschen, Vignette, Korn) | `src/lib/editor/gl/` |
| Compositing (Ebenen, Text, Formen, Zeichnen, Füllmethoden) | `src/lib/editor/render.ts` |
| Privacy-Effekte (Verpixeln, Blur, Schwärzen, Milchglas, Rauschen; Rechteck/Ellipse/Pinsel, weiche Kante, Umkehren) | `src/lib/editor/effects.ts` |
| Gesichtserkennung on-device (MediaPipe, self-hosted in `public/mediapipe` + `public/models`) | `src/lib/editor/faces.ts` |
| Looks / Filter-Presets | `src/lib/editor/looks.ts` |
| `.sheepit` Projektformat + Export (JPG/PNG/WebP/AVIF) | `src/lib/editor/project.ts` |
| Editor-UI | `src/components/editor/` |
| SEO-Tool-Seiten (Inhalte + Editor-Presets) | `src/lib/seo/tools.ts` → `src/app/[tool]/page.tsx` |

### `.sheepit`-Format
ZIP-Archiv mit `manifest.json`, `document.json` (alle Bearbeitungen), `assets/<id>.<ext>` (Originalbilder) und `preview.jpg`.

### Neue SEO-Seite hinzufügen
Einen Eintrag in `TOOLS` (`src/lib/seo/tools.ts`) ergänzen – Seite, Sitemap, Footer-Links, JSON-LD (HowTo, FAQ, Breadcrumb) und Editor-Preset entstehen automatisch.

## UI-Bibliotheken
shadcn/ui (Base UI), Magic UI (Bento, Marquee, Border Beam, Shimmer Button, Number Ticker, Dot Pattern, Magic Card), Aceternity UI (Spotlight, Compare), shitui (Split FAQ).

## Vor dem Livegang
- Impressum & Datenschutz (`src/app/impressum`, `src/app/datenschutz`) sind Platzhalter.
- Werbung: Consent-Banner (TCF) nötig, sobald Ads eingebunden werden.
