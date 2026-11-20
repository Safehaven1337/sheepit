import type { Metadata } from "next"
import { SiteFooter, SiteHeader } from "@/components/marketing/site-chrome"

export const metadata: Metadata = { title: "Impressum", robots: { index: false }, alternates: { canonical: "/impressum" } }

export default function Impressum() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid max-w-3xl gap-6 px-4 py-16 text-muted-foreground md:px-6">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">Impressum</h1>
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          Platzhalter – Angaben gemäß § 5 DDG (Name, Anschrift, Kontakt) vor dem Livegang ergänzen.
        </p>
      </main>
      <SiteFooter />
    </>
  )
}
