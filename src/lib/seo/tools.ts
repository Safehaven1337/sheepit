import type { ToolId } from "@/lib/editor/types"

export interface EditorPreset {
  tool: ToolId | "adjust" | "looks"
  privacy?: { effect?: "blur" | "pixelate" | "redact" | "noise" | "glass"; region?: "rect" | "ellipse" | "brush"; invert?: boolean }
  autoFaces?: boolean
  invertBlur?: boolean
  look?: string
  openExport?: { format?: "image/png" | "image/jpeg" | "image/webp"; quality?: number }
  adjust?: Record<string, number | boolean>
}

export interface ToolPage {
  slug: string
  /** short label for menus */
  label: string
  category: "Privatsphäre" | "Bearbeiten" | "Konvertieren" | "Verbessern"
  title: string // <title>
  h1: string
  /** words in h1 to highlight */
  highlight: string
  description: string // meta description
  keywords: string[]
  lead: string
  steps: { title: string; text: string }[]
  benefits: { title: string; text: string }[]
  faq: { q: string; a: string }[]
  preset: EditorPreset
  related: string[]
}

const privacyBenefit = {
  title: "Kein Upload. Niemals.",
  text: "Dein Bild wird ausschließlich in deinem Browser verarbeitet. Es verlässt dein Gerät nicht – ideal für sensible Fotos, Ausweise oder Screenshots.",
}
const freeBenefit = {
  title: "Kostenlos & ohne Anmeldung",
  text: "Kein Konto, keine E-Mail, kein Wasserzeichen. Bild reinziehen, bearbeiten, herunterladen.",
}
const qualityBenefit = {
  title: "Volle Auflösung",
  text: "Export in Originalgröße als JPG, PNG, WebP oder AVIF – mit einstellbarer Qualität und Dateigröße.",
}

export const TOOLS: ToolPage[] = [
  {
    slug: "bild-verpixeln",
    label: "Bild verpixeln",
    category: "Privatsphäre",
    title: "Bild verpixeln – online, kostenlos & ohne Upload",
    h1: "Bild verpixeln in Sekunden",
    highlight: "verpixeln",
    description:
      "Bild online verpixeln: Gesichter, Kennzeichen oder Text mit einem Klick pixelig machen. Kostenlos, ohne Anmeldung – dein Foto bleibt auf deinem Gerät.",
    keywords: ["bild verpixeln", "foto verpixeln", "bild verpixeln online", "pixelig machen", "verpixeln app"],
    lead: "Ziehe einen Rahmen über die Stelle, die niemand sehen soll – Sheepit verpixelt sie sofort. Blockgröße frei wählbar, Bereiche als Rechteck, Ellipse oder mit dem Pinsel.",
    steps: [
      { title: "Bild öffnen", text: "Ziehe dein Foto in das Feld oder wähle es aus. Es wird nicht hochgeladen." },
      { title: "Bereich markieren", text: "Zieh ein Rechteck oder eine Ellipse auf – oder male mit dem Pinsel über die Stelle." },
      { title: "Stärke wählen & speichern", text: "Pixelgröße per Regler anpassen und das Bild als JPG oder PNG herunterladen." },
    ],
    benefits: [privacyBenefit, freeBenefit, { title: "Unumkehrbar", text: "Grobe Verpixelung zerstört die Bildinformation dauerhaft – sie lässt sich nicht zurückrechnen. Für maximale Sicherheit: Schwärzen." }],
    faq: [
      { q: "Wie kann ich ein Bild kostenlos verpixeln?", a: "Öffne Sheepit, lade dein Bild per Drag & Drop, wähle „Verpixeln“ und markiere den Bereich. Danach kannst du das Bild direkt kostenlos herunterladen." },
      { q: "Wird mein Bild auf einen Server hochgeladen?", a: "Nein. Sheepit verarbeitet alles lokal in deinem Browser. Es gibt keinen Upload und keine Speicherung auf unseren Servern." },
      { q: "Kann man Verpixelung rückgängig machen?", a: "In der exportierten Datei nicht, wenn die Pixel groß genug sind. Innerhalb von Sheepit bleibt jede Bearbeitung nicht-destruktiv, solange du am Projekt arbeitest." },
      { q: "Funktioniert das auch auf dem Handy?", a: "Ja, Sheepit läuft in jedem modernen Browser auf iPhone, Android, Tablet und Desktop." },
    ],
    preset: { tool: "privacy", privacy: { effect: "pixelate", region: "rect" } },
    related: ["gesicht-verpixeln", "foto-unkenntlich-machen", "kennzeichen-unkenntlich-machen"],
  },
  {
    slug: "gesicht-verpixeln",
    label: "Gesicht verpixeln",
    category: "Privatsphäre",
    title: "Gesicht verpixeln – automatisch erkennen & unkenntlich machen",
    h1: "Gesichter automatisch verpixeln",
    highlight: "automatisch",
    description:
      "Gesichter auf Fotos automatisch erkennen und verpixeln oder weichzeichnen – direkt im Browser, ohne Upload. DSGVO-freundlich, kostenlos, ohne Anmeldung.",
    keywords: ["gesicht verpixeln", "gesichter unkenntlich machen", "gesicht unscharf machen", "gesicht verpixeln app", "gesichtserkennung verpixeln"],
    lead: "Sheepit findet Gesichter mit einer KI, die vollständig auf deinem Gerät läuft, und legt automatisch einen Verpixelungs-Filter darüber. Perfekt für Kita-, Schul-, Vereins- und Eventfotos.",
    steps: [
      { title: "Foto öffnen", text: "Gruppenfoto reinziehen – die Verarbeitung passiert lokal." },
      { title: "Gesichter erkennen", text: "Ein Klick auf „Gesichter finden“ markiert alle erkannten Gesichter automatisch." },
      { title: "Anpassen & exportieren", text: "Effekt wählen (Pixel, Blur, Schwarz), einzelne Gesichter ergänzen oder entfernen, fertig." },
    ],
    benefits: [
      { title: "On-Device-KI", text: "Die Gesichtserkennung läuft als WebAssembly in deinem Browser. Kein Bild wird an eine Cloud geschickt." },
      privacyBenefit,
      freeBenefit,
    ],
    faq: [
      { q: "Muss ich Gesichter vor dem Posten verpixeln?", a: "Wenn erkennbare Personen nicht eingewilligt haben, ist das Verpixeln ein einfacher Weg, ihre Privatsphäre zu schützen. Das ersetzt keine Rechtsberatung." },
      { q: "Wie zuverlässig ist die automatische Erkennung?", a: "Frontale und gut sichtbare Gesichter werden sehr zuverlässig erkannt. Sehr kleine oder verdeckte Gesichter kannst du manuell ergänzen." },
      { q: "Werden meine Fotos für KI-Training verwendet?", a: "Nein. Deine Fotos verlassen nie dein Gerät – wir sehen sie gar nicht." },
      { q: "Kann ich statt Pixeln auch weichzeichnen?", a: "Ja. Du kannst zwischen Verpixeln, Weichzeichnen, Milchglas, Rauschen und Schwärzen wechseln." },
    ],
    preset: { tool: "privacy", privacy: { effect: "pixelate", region: "ellipse" }, autoFaces: true },
    related: ["bild-verpixeln", "foto-unkenntlich-machen", "bild-unscharf-machen"],
  },
  {
    slug: "foto-unkenntlich-machen",
    label: "Foto unkenntlich machen",
    category: "Privatsphäre",
    title: "Foto unkenntlich machen – Personen, Text & Daten sicher verbergen",
    h1: "Fotos unkenntlich machen – sicher & lokal",
    highlight: "unkenntlich",
    description:
      "Teile eines Fotos unkenntlich machen: schwärzen, verpixeln, weichzeichnen oder mit Rauschen zerstören. Online, kostenlos und ohne dass dein Bild hochgeladen wird.",
    keywords: ["foto unkenntlich machen", "bild unkenntlich machen", "person unkenntlich machen", "daten schwärzen bild", "screenshot schwärzen"],
    lead: "Ob Ausweis, Kontoauszug, Chat-Screenshot oder Personen im Hintergrund: Mit fünf Privacy-Effekten machst du alles unkenntlich, was nicht geteilt werden soll.",
    steps: [
      { title: "Bild laden", text: "Screenshot oder Foto in Sheepit ziehen – bleibt auf deinem Gerät." },
      { title: "Effekt wählen", text: "Schwärzen für 100 % Sicherheit, Pixel oder Rauschen für einen dezenteren Look." },
      { title: "Bereich markieren & speichern", text: "Rahmen ziehen oder mit dem Pinsel übermalen und exportieren." },
    ],
    benefits: [
      { title: "5 Privacy-Effekte", text: "Schwärzen, Verpixeln, Weichzeichnen, Milchglas und Rauschen – kombinierbar und jederzeit änderbar." },
      privacyBenefit,
      { title: "Metadaten entfernt", text: "Beim Export werden EXIF-Daten wie GPS-Standort automatisch verworfen." },
    ],
    faq: [
      { q: "Was ist die sicherste Methode, um etwas unkenntlich zu machen?", a: "Schwärzen (deckende Farbfläche). Weichzeichner mit kleinem Radius kann teilweise rekonstruiert werden – Schwärzen nicht." },
      { q: "Werden EXIF-Daten mitgespeichert?", a: "Nein, der Export erzeugt eine neue Bilddatei ohne GPS- oder Kameradaten." },
      { q: "Kann ich Text in Screenshots schwärzen?", a: "Ja – wähle „Schwärzen“, ziehe Rechtecke über den Text und exportiere als PNG für gestochen scharfe Screenshots." },
      { q: "Ist das wirklich kostenlos?", a: "Ja. Sheepit ist kostenlos und finanziert sich künftig über dezente Werbung – nie über deine Daten." },
    ],
    preset: { tool: "privacy", privacy: { effect: "redact", region: "rect" } },
    related: ["text-schwaerzen", "gesicht-verpixeln", "bild-verpixeln"],
  },
  {
    slug: "bild-unscharf-machen",
    label: "Bild unscharf machen",
    category: "Privatsphäre",
    title: "Bild unscharf machen – Weichzeichner online kostenlos",
    h1: "Bild unscharf machen & weichzeichnen",
    highlight: "unscharf",
    description:
      "Bild online unscharf machen: ganze Fotos oder einzelne Bereiche weichzeichnen. Gaußscher Weichzeichner mit weicher Kante – kostenlos, ohne Upload.",
    keywords: ["bild unscharf machen", "foto weichzeichnen", "bild verwischen", "blur online", "foto verschwommen machen"],
    lead: "Weichzeichnen mit weicher Kante – für Gesichter, Hintergründe oder das ganze Bild. Radius und Übergang stellst du stufenlos ein.",
    steps: [
      { title: "Foto öffnen", text: "Bild per Drag & Drop laden." },
      { title: "Weichzeichner auftragen", text: "Bereich aufziehen oder mit dem Pinsel übermalen. Kante weich machen für natürlichen Übergang." },
      { title: "Herunterladen", text: "In voller Auflösung als JPG, PNG oder WebP speichern." },
    ],
    benefits: [privacyBenefit, freeBenefit, qualityBenefit],
    faq: [
      { q: "Wie mache ich nur einen Teil des Bildes unscharf?", a: "Mit dem Privacy-Werkzeug „Weichzeichnen“ einen Bereich aufziehen oder mit dem Pinsel malen. Nur dieser Bereich wird verwischt." },
      { q: "Wie mache ich das ganze Bild unscharf?", a: "Zieh den Bereich über das ganze Bild oder aktiviere „Umkehren“ bei einem leeren Bereich." },
      { q: "Ist weichzeichnen sicher genug für sensible Daten?", a: "Für Text und Nummern empfehlen wir Schwärzen oder starkes Verpixeln, da schwacher Blur teilweise rekonstruierbar ist." },
    ],
    preset: { tool: "privacy", privacy: { effect: "blur", region: "brush" } },
    related: ["hintergrund-unscharf-machen", "bild-verpixeln", "gesicht-verpixeln"],
  },
  {
    slug: "hintergrund-unscharf-machen",
    label: "Hintergrund unscharf machen",
    category: "Verbessern",
    title: "Hintergrund unscharf machen – Bokeh-Effekt online",
    h1: "Hintergrund unscharf machen wie mit Profi-Kamera",
    highlight: "Hintergrund",
    description:
      "Hintergrund unscharf machen: Motiv markieren, Rest weichzeichnen – für einen Porträt- und Bokeh-Look. Kostenlos online, ohne App und ohne Upload.",
    keywords: ["hintergrund unscharf machen", "bokeh effekt online", "porträtmodus nachträglich", "hintergrund verschwommen"],
    lead: "Male über dein Motiv – Sheepit zeichnet alles andere weich. So bekommst du den Porträtmodus-Look auch für alte Fotos.",
    steps: [
      { title: "Foto laden", text: "Porträt oder Produktfoto öffnen." },
      { title: "Motiv übermalen", text: "Mit dem Pinsel über die Person oder das Objekt malen, das scharf bleiben soll." },
      { title: "Stärke & Kante anpassen", text: "Blur-Radius und weiche Kante regeln, dann exportieren." },
    ],
    benefits: [privacyBenefit, freeBenefit, qualityBenefit],
    faq: [
      { q: "Brauche ich dafür eine App?", a: "Nein, Sheepit läuft direkt im Browser – auch auf dem Smartphone." },
      { q: "Wie bekomme ich einen weichen Übergang?", a: "Erhöhe den Regler „Weiche Kante“, damit der Übergang zwischen scharf und unscharf natürlich wirkt." },
    ],
    preset: { tool: "privacy", privacy: { effect: "blur", region: "brush", invert: true }, invertBlur: true },
    related: ["bild-unscharf-machen", "foto-filter", "foto-aufhellen"],
  },
  {
    slug: "kennzeichen-unkenntlich-machen",
    label: "Kennzeichen unkenntlich machen",
    category: "Privatsphäre",
    title: "Kennzeichen unkenntlich machen – Nummernschild verpixeln",
    h1: "Kennzeichen unkenntlich machen",
    highlight: "Kennzeichen",
    description:
      "Nummernschild auf Foto verpixeln oder schwärzen – z. B. für Auto-Inserate oder Dashcam-Bilder. Kostenlos, online, ohne Upload.",
    keywords: ["kennzeichen unkenntlich machen", "nummernschild verpixeln", "kennzeichen verpixeln app", "autokennzeichen schwärzen"],
    lead: "Für Kleinanzeigen, mobile.de oder Social Media: Kennzeichen in Sekunden verpixeln oder schwärzen.",
    steps: [
      { title: "Autofoto öffnen", text: "Bild reinziehen – es wird nicht hochgeladen." },
      { title: "Kennzeichen markieren", text: "Rechteck über das Nummernschild ziehen." },
      { title: "Speichern", text: "Als JPG exportieren und direkt im Inserat verwenden." },
    ],
    benefits: [privacyBenefit, freeBenefit, qualityBenefit],
    faq: [
      { q: "Muss ich mein Kennzeichen im Inserat verpixeln?", a: "Es ist nicht vorgeschrieben, wird aber empfohlen, um Missbrauch (z. B. Kennzeichen-Dubletten) zu vermeiden." },
      { q: "Welcher Effekt ist am besten?", a: "Grobe Verpixelung oder Schwärzen. Beides ist nicht rekonstruierbar." },
    ],
    preset: { tool: "privacy", privacy: { effect: "pixelate", region: "rect" } },
    related: ["bild-verpixeln", "foto-unkenntlich-machen", "bild-komprimieren"],
  },
  {
    slug: "text-schwaerzen",
    label: "Text im Bild schwärzen",
    category: "Privatsphäre",
    title: "Text im Bild schwärzen – Screenshot zensieren online",
    h1: "Text in Bildern & Screenshots schwärzen",
    highlight: "schwärzen",
    description:
      "Namen, Nummern und Adressen in Screenshots oder Dokumentfotos schwärzen. 100 % lokal im Browser, kostenlos, keine Anmeldung.",
    keywords: ["text schwärzen bild", "screenshot zensieren", "dokument schwärzen online", "bild zensieren"],
    lead: "Deckende Balken in jeder Farbe – die sicherste Art, private Informationen in Bildern zu verbergen.",
    steps: [
      { title: "Screenshot öffnen", text: "Einfach per Drag & Drop oder aus der Zwischenablage (Strg+V)." },
      { title: "Balken ziehen", text: "Rechtecke über Text ziehen. Farbe frei wählbar." },
      { title: "Als PNG speichern", text: "PNG hält Text gestochen scharf." },
    ],
    benefits: [privacyBenefit, freeBenefit, { title: "Nicht rekonstruierbar", text: "Geschwärzte Pixel werden vollständig ersetzt – anders als bei schwachem Blur gibt es nichts zu rekonstruieren." }],
    faq: [
      { q: "Kann ich Bilder aus der Zwischenablage einfügen?", a: "Ja, drücke einfach Strg+V (bzw. Cmd+V) im Editor." },
      { q: "Ist Schwärzen sicherer als Verpixeln?", a: "Ja. Schwärzen ersetzt die Pixel vollständig." },
    ],
    preset: { tool: "privacy", privacy: { effect: "redact", region: "rect" } },
    related: ["foto-unkenntlich-machen", "bild-verpixeln", "png-in-jpg-umwandeln"],
  },
  {
    slug: "bild-zuschneiden",
    label: "Bild zuschneiden",
    category: "Bearbeiten",
    title: "Bild zuschneiden online – für Instagram, TikTok & Co.",
    h1: "Bild zuschneiden – pixelgenau",
    highlight: "zuschneiden",
    description:
      "Bild online zuschneiden mit Formatvorlagen für Instagram (1:1, 4:5), Stories (9:16), YouTube (16:9) und mehr. Begradigen, drehen, spiegeln – kostenlos.",
    keywords: ["bild zuschneiden", "foto zuschneiden online", "bild ausschneiden", "instagram format zuschneiden", "bild begradigen"],
    lead: "Seitenverhältnis wählen, Rahmen ziehen, fertig. Mit Begradigen-Regler und Drittel-Raster wie in Lightroom.",
    steps: [
      { title: "Bild öffnen", text: "Foto laden." },
      { title: "Format wählen", text: "Frei, 1:1, 4:5, 9:16, 16:9, 3:2 und mehr." },
      { title: "Anwenden & speichern", text: "Zuschnitt bleibt bis zum Export jederzeit änderbar." },
    ],
    benefits: [freeBenefit, privacyBenefit, qualityBenefit],
    faq: [
      { q: "Welches Format brauche ich für Instagram?", a: "Für den Feed 4:5 (1080×1350) oder 1:1 (1080×1080), für Stories und Reels 9:16 (1080×1920)." },
      { q: "Kann ich ein schiefes Foto gerade machen?", a: "Ja, mit dem Regler „Begradigen“ im Zuschneiden-Werkzeug – leere Ecken werden automatisch vermieden." },
    ],
    preset: { tool: "crop" },
    related: ["bild-drehen", "bild-groesse-aendern", "bild-komprimieren"],
  },
  {
    slug: "bild-drehen",
    label: "Bild drehen & spiegeln",
    category: "Bearbeiten",
    title: "Bild drehen & spiegeln online – kostenlos",
    h1: "Bild drehen, spiegeln & begradigen",
    highlight: "drehen",
    description: "Foto online um 90° drehen, horizontal oder vertikal spiegeln und schiefe Horizonte begradigen. Ohne Qualitätsverlust, ohne Upload.",
    keywords: ["bild drehen", "foto spiegeln", "bild spiegeln online", "foto drehen online"],
    lead: "Drehen in 90°-Schritten, spiegeln und stufenlos begradigen – mit einem Klick.",
    steps: [
      { title: "Foto laden", text: "Bild öffnen." },
      { title: "Drehen oder spiegeln", text: "Buttons im Zuschneiden-Werkzeug nutzen." },
      { title: "Exportieren", text: "In Originalqualität herunterladen." },
    ],
    benefits: [freeBenefit, privacyBenefit, qualityBenefit],
    faq: [{ q: "Verliert mein Bild beim Drehen an Qualität?", a: "Beim Drehen in 90°-Schritten nicht. Exportiere als PNG für verlustfreie Ergebnisse." }],
    preset: { tool: "crop" },
    related: ["bild-zuschneiden", "bild-groesse-aendern"],
  },
  {
    slug: "bild-groesse-aendern",
    label: "Bildgröße ändern",
    category: "Konvertieren",
    title: "Bildgröße ändern online – Pixel & Auflösung anpassen",
    h1: "Bildgröße ändern – schnell & verlustarm",
    highlight: "Bildgröße",
    description: "Bildgröße online ändern: Breite und Höhe in Pixeln oder Prozent festlegen. Bild verkleinern für E-Mail, Web oder Bewerbung. Kostenlos, ohne Upload.",
    keywords: ["bildgröße ändern", "bild verkleinern", "foto verkleinern", "auflösung ändern", "bild vergrößern"],
    lead: "Breite, Höhe oder Prozent eingeben – Seitenverhältnis bleibt erhalten. Die Dateigröße siehst du vor dem Download.",
    steps: [
      { title: "Bild öffnen", text: "Foto laden." },
      { title: "Größe eingeben", text: "Im Export-Dialog Breite oder Skalierung wählen." },
      { title: "Herunterladen", text: "Format und Qualität wählen, fertig." },
    ],
    benefits: [freeBenefit, privacyBenefit, { title: "Live-Dateigröße", text: "Du siehst vor dem Download, wie groß die Datei wird." }],
    faq: [{ q: "Wie verkleinere ich ein Bild für eine E-Mail?", a: "Wähle im Export z. B. 1600 px Breite und JPG mit 80 % Qualität – das ergibt meist unter 500 KB." }],
    preset: { tool: "adjust", openExport: { format: "image/jpeg", quality: 0.82 } },
    related: ["bild-komprimieren", "bild-zuschneiden", "png-in-jpg-umwandeln"],
  },
  {
    slug: "bild-komprimieren",
    label: "Bild komprimieren",
    category: "Konvertieren",
    title: "Bild komprimieren – JPG, PNG & WebP verkleinern",
    h1: "Bilder komprimieren ohne sichtbaren Qualitätsverlust",
    highlight: "komprimieren",
    description: "Bilddateien online komprimieren: JPG, PNG und WebP auf die gewünschte Dateigröße verkleinern. Mit Live-Vorschau der Dateigröße – kostenlos, lokal.",
    keywords: ["bild komprimieren", "jpg komprimieren", "png verkleinern", "dateigröße reduzieren", "foto kb verkleinern"],
    lead: "Qualitätsregler, moderne Formate wie WebP und AVIF und Live-Anzeige der Dateigröße – so triffst du jedes Upload-Limit.",
    steps: [
      { title: "Bild laden", text: "Foto öffnen." },
      { title: "Format & Qualität", text: "WebP oder JPG, Qualität per Regler, optional kleiner skalieren." },
      { title: "Speichern", text: "Komprimierte Datei herunterladen." },
    ],
    benefits: [freeBenefit, privacyBenefit, { title: "WebP & AVIF", text: "Moderne Formate sind oft 30–50 % kleiner als JPG bei gleicher Qualität." }],
    faq: [{ q: "Welches Format ist am kleinsten?", a: "Meist AVIF, dann WebP, dann JPG. PNG ist verlustfrei und daher größer." }],
    preset: { tool: "adjust", openExport: { format: "image/webp", quality: 0.78 } },
    related: ["bild-groesse-aendern", "png-in-jpg-umwandeln", "webp-in-jpg-umwandeln"],
  },
  {
    slug: "png-in-jpg-umwandeln",
    label: "PNG in JPG umwandeln",
    category: "Konvertieren",
    title: "PNG in JPG umwandeln – online & kostenlos",
    h1: "PNG in JPG umwandeln",
    highlight: "JPG",
    description: "PNG online in JPG konvertieren – mit wählbarer Hintergrundfarbe für Transparenz und einstellbarer Qualität. Ohne Upload, ohne Anmeldung.",
    keywords: ["png in jpg", "png zu jpg", "png in jpg umwandeln", "bild in jpg umwandeln"],
    lead: "Datei rein, JPG raus. Transparente Bereiche bekommen eine Hintergrundfarbe deiner Wahl.",
    steps: [
      { title: "PNG öffnen", text: "Datei reinziehen." },
      { title: "JPG wählen", text: "Im Export-Dialog JPG und Qualität einstellen." },
      { title: "Herunterladen", text: "Fertig." },
    ],
    benefits: [freeBenefit, privacyBenefit, qualityBenefit],
    faq: [{ q: "Was passiert mit transparenten Bereichen?", a: "JPG unterstützt keine Transparenz – sie werden mit der gewählten Hintergrundfarbe (Standard: Weiß) gefüllt." }],
    preset: { tool: "adjust", openExport: { format: "image/jpeg", quality: 0.9 } },
    related: ["webp-in-jpg-umwandeln", "bild-komprimieren", "jpg-in-png-umwandeln"],
  },
  {
    slug: "jpg-in-png-umwandeln",
    label: "JPG in PNG umwandeln",
    category: "Konvertieren",
    title: "JPG in PNG umwandeln – verlustfrei, online",
    h1: "JPG in PNG umwandeln",
    highlight: "PNG",
    description: "JPG online in PNG umwandeln – verlustfrei speichern, kostenlos und ohne dass dein Bild hochgeladen wird.",
    keywords: ["jpg in png", "jpg zu png", "jpeg in png umwandeln"],
    lead: "PNG speichert verlustfrei – ideal, wenn du das Bild weiterbearbeiten möchtest.",
    steps: [
      { title: "JPG öffnen", text: "Datei reinziehen." },
      { title: "PNG wählen", text: "Im Export-Dialog PNG wählen." },
      { title: "Herunterladen", text: "Fertig." },
    ],
    benefits: [freeBenefit, privacyBenefit, qualityBenefit],
    faq: [{ q: "Wird das Bild durch PNG besser?", a: "Nein, verlorene JPG-Details kommen nicht zurück – aber weitere Verluste werden vermieden." }],
    preset: { tool: "adjust", openExport: { format: "image/png" } },
    related: ["png-in-jpg-umwandeln", "webp-in-jpg-umwandeln"],
  },
  {
    slug: "webp-in-jpg-umwandeln",
    label: "WebP in JPG umwandeln",
    category: "Konvertieren",
    title: "WebP in JPG umwandeln – online & kostenlos",
    h1: "WebP in JPG umwandeln",
    highlight: "WebP",
    description: "WebP-Bilder online in JPG oder PNG konvertieren – direkt im Browser, ohne Upload und ohne Anmeldung.",
    keywords: ["webp in jpg", "webp zu jpg", "webp umwandeln", "webp in png"],
    lead: "Viele Programme können mit WebP nichts anfangen. Mit Sheepit wandelst du es in Sekunden um.",
    steps: [
      { title: "WebP öffnen", text: "Datei reinziehen." },
      { title: "Format wählen", text: "JPG oder PNG." },
      { title: "Herunterladen", text: "Fertig." },
    ],
    benefits: [freeBenefit, privacyBenefit, qualityBenefit],
    faq: [{ q: "Kann ich auch AVIF oder HEIC öffnen?", a: "AVIF ja (in modernen Browsern). HEIC wird von Safari unterstützt, in anderen Browsern ggf. nicht." }],
    preset: { tool: "adjust", openExport: { format: "image/jpeg", quality: 0.9 } },
    related: ["png-in-jpg-umwandeln", "bild-komprimieren"],
  },
  {
    slug: "schwarz-weiss-foto",
    label: "Schwarz-Weiß-Foto",
    category: "Verbessern",
    title: "Foto schwarz-weiß machen – mit Profi-S/W-Mixer",
    h1: "Fotos in Schwarz-Weiß verwandeln",
    highlight: "Schwarz-Weiß",
    description: "Foto online in Schwarz-Weiß umwandeln – mit Farbkanal-Mixer, Kontrast, Körnung und Sepia-Look wie in Lightroom. Kostenlos, ohne Upload.",
    keywords: ["foto schwarz weiß machen", "bild schwarz weiß", "schwarz weiß filter", "sepia filter online"],
    lead: "Nicht einfach entsättigen: Mit dem S/W-Mixer bestimmst du, wie hell Rot, Blau oder Grün in Grau umgesetzt werden.",
    steps: [
      { title: "Foto öffnen", text: "Bild laden." },
      { title: "Look wählen", text: "Klassisch, Hochkontrast, Silber oder Sepia." },
      { title: "Feintuning", text: "Kanäle, Kontrast und Körnung anpassen." },
    ],
    benefits: [freeBenefit, privacyBenefit, qualityBenefit],
    faq: [{ q: "Was ist ein S/W-Mixer?", a: "Er steuert, wie hell einzelne Farben im Graustufenbild erscheinen – z. B. Himmel dunkler, Haut heller." }],
    preset: { tool: "looks", look: "bw" },
    related: ["foto-filter", "foto-aufhellen", "bild-schaerfen"],
  },
  {
    slug: "foto-aufhellen",
    label: "Foto aufhellen",
    category: "Verbessern",
    title: "Foto aufhellen – dunkle Bilder online retten",
    h1: "Dunkle Fotos aufhellen",
    highlight: "aufhellen",
    description: "Zu dunkles Foto online aufhellen: Belichtung, Tiefen und Lichter wie in Lightroom anpassen. Kostenlos, ohne Anmeldung, ohne Upload.",
    keywords: ["foto aufhellen", "bild heller machen", "dunkles foto retten", "belichtung korrigieren online"],
    lead: "Belichtung, Tiefen, Lichter, Weiß und Schwarz – die Werkzeuge der Profis, verständlich erklärt.",
    steps: [
      { title: "Foto öffnen", text: "Dunkles Bild laden." },
      { title: "Tiefen & Belichtung", text: "Tiefen anheben, Belichtung erhöhen, Lichter schützen." },
      { title: "Speichern", text: "Ergebnis exportieren." },
    ],
    benefits: [freeBenefit, privacyBenefit, qualityBenefit],
    faq: [{ q: "Warum wird mein Bild beim Aufhellen grau?", a: "Hebe statt der Belichtung lieber die Tiefen an und erhöhe leicht den Kontrast oder Dunst entfernen." }],
    preset: { tool: "adjust", adjust: { exposure: 0.6, shadows: 40, highlights: -20 } },
    related: ["foto-filter", "bild-schaerfen", "schwarz-weiss-foto"],
  },
  {
    slug: "bild-schaerfen",
    label: "Bild schärfen",
    category: "Verbessern",
    title: "Bild schärfen online – unscharfe Fotos verbessern",
    h1: "Unscharfe Bilder schärfen",
    highlight: "schärfen",
    description: "Foto online schärfen mit Unscharf-Maskierung, Struktur und Klarheit. Plus Rauschreduzierung für Handyfotos. Kostenlos und lokal im Browser.",
    keywords: ["bild schärfen", "foto schärfen online", "unscharfes bild scharf machen", "rauschen entfernen"],
    lead: "Schärfe, Struktur und Klarheit wirken auf unterschiedliche Detailebenen – zusammen holen sie das Maximum aus deinem Foto.",
    steps: [
      { title: "Foto öffnen", text: "Bild laden." },
      { title: "Details anpassen", text: "Schärfen, Radius, Struktur und Rauschreduzierung regeln." },
      { title: "Exportieren", text: "In voller Auflösung speichern." },
    ],
    benefits: [freeBenefit, privacyBenefit, qualityBenefit],
    faq: [{ q: "Kann man ein komplett verwackeltes Foto retten?", a: "Nur begrenzt. Schärfen verstärkt vorhandene Kanten – fehlende Details kann es nicht erfinden." }],
    preset: { tool: "adjust", adjust: { sharpen: 45, texture: 15 } },
    related: ["foto-aufhellen", "foto-filter"],
  },
  {
    slug: "foto-filter",
    label: "Foto-Filter",
    category: "Verbessern",
    title: "Foto-Filter online – Film-Looks & Presets kostenlos",
    h1: "Foto-Filter & Film-Looks",
    highlight: "Film-Looks",
    description: "Über 20 Profi-Filter wie Portra, Velvia, Cinematic oder Teal & Orange – mit Intensitätsregler und voller Kontrolle. Kostenlos, ohne Upload.",
    keywords: ["foto filter online", "bild filter", "lightroom presets kostenlos", "film look foto", "vintage filter"],
    lead: "Jeder Look ist ein Startpunkt: Intensität regeln, dann mit allen Reglern weiter verfeinern.",
    steps: [
      { title: "Foto öffnen", text: "Bild laden." },
      { title: "Look wählen", text: "Vorschau direkt am eigenen Bild." },
      { title: "Intensität & Feinschliff", text: "Stärke regeln und Details anpassen." },
    ],
    benefits: [freeBenefit, privacyBenefit, qualityBenefit],
    faq: [{ q: "Kann ich Filter nachträglich ändern?", a: "Ja. Speichere dein Projekt als .sheepit-Datei, dann bleiben alle Bearbeitungen veränderbar." }],
    preset: { tool: "looks" },
    related: ["schwarz-weiss-foto", "foto-aufhellen", "bild-schaerfen"],
  },
  {
    slug: "text-auf-bild",
    label: "Text auf Bild schreiben",
    category: "Bearbeiten",
    title: "Text auf Bild schreiben – online mit schönen Schriften",
    h1: "Text auf Bilder schreiben",
    highlight: "Text",
    description: "Text auf Foto schreiben mit 12 Schriftarten, Kontur, Hintergrundbox und Schatten. Für Memes, Posts und Einladungen – kostenlos, ohne Anmeldung.",
    keywords: ["text auf bild schreiben", "text auf foto", "bild beschriften online", "meme erstellen"],
    lead: "Text tippen, Schrift wählen, positionieren. Mit Kontur, Hintergrundbox und Schatten wird er überall lesbar.",
    steps: [
      { title: "Bild öffnen", text: "Foto laden." },
      { title: "Text hinzufügen", text: "Ins Bild klicken und tippen." },
      { title: "Stylen & exportieren", text: "Schrift, Farbe, Kontur – dann speichern." },
    ],
    benefits: [freeBenefit, privacyBenefit, qualityBenefit],
    faq: [{ q: "Werden Schriften von Google geladen?", a: "Nein, alle Schriften werden von Sheepit selbst ausgeliefert – keine Verbindung zu Drittanbietern." }],
    preset: { tool: "text" },
    related: ["foto-filter", "bild-zuschneiden"],
  },
]

export const toolBySlug = (slug: string) => TOOLS.find((t) => t.slug === slug)
export const presetBySlug = (slug: string | null | undefined) => (slug ? toolBySlug(slug)?.preset : undefined)
