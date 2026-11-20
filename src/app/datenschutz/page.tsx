import type { Metadata } from "next"
import { SiteFooter, SiteHeader } from "@/components/marketing/site-chrome"

export const metadata: Metadata = { title: "Datenschutz", alternates: { canonical: "/datenschutz" } }

export default function Datenschutz() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid max-w-3xl gap-6 px-4 py-16 leading-relaxed text-muted-foreground md:px-6 [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">Datenschutz</h1>
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          Platzhalter – bitte vor dem Livegang durch eine vollständige, rechtlich geprüfte Datenschutzerklärung ersetzen (inkl. Hosting-Anbieter und ggf. Werbepartner).
        </p>
        <h2>Deine Bilder</h2>
        <p>
          Sheepit verarbeitet Bilder ausschließlich lokal in deinem Browser. Bilder, Projektdateien (.sheepit) und Bearbeitungen werden nicht an unsere Server übertragen und nicht gespeichert.
        </p>
        <h2>Schriften & KI-Modelle</h2>
        <p>
          Alle Schriftarten sowie das Modell zur Gesichtserkennung werden von unserem eigenen Server ausgeliefert. Es werden dafür keine Verbindungen zu Drittanbietern wie Google aufgebaut.
        </p>
        <h2>Server-Logs</h2>
        <p>Beim Abruf der Website können technisch notwendige Zugriffsdaten (z. B. IP-Adresse, Zeitpunkt) vom Hosting-Anbieter verarbeitet werden.</p>
      </main>
      <SiteFooter />
    </>
  )
}
