import Link from "next/link"
import { SheepWordmark } from "@/components/brand/sheep-logo"
import { TOOLS } from "@/lib/seo/tools"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 md:px-6">
        <Link href="/" aria-label="Sheepit Startseite">
          <SheepWordmark />
        </Link>
        <nav className="hidden items-center gap-1 text-sm text-muted-foreground md:flex" aria-label="Hauptnavigation">
          <Link href="/#funktionen" className="rounded-lg px-3 py-2 hover:bg-muted/60 hover:text-foreground">
            Funktionen
          </Link>
          <Link href="/#tools" className="rounded-lg px-3 py-2 hover:bg-muted/60 hover:text-foreground">
            Tools
          </Link>
          <Link href="/gesicht-verpixeln" className="rounded-lg px-3 py-2 hover:bg-muted/60 hover:text-foreground">
            Gesicht verpixeln
          </Link>
          <Link href="/#faq" className="rounded-lg px-3 py-2 hover:bg-muted/60 hover:text-foreground">
            FAQ
          </Link>
        </nav>
        <div className="flex-1" />
        <Link
          href="/editor"
          className="inline-flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
        >
          Editor öffnen
        </Link>
      </div>
    </header>
  )
}

export function SiteFooter() {
  const cats = [...new Set(TOOLS.map((t) => t.category))]
  return (
    <footer className="border-t border-white/[0.06] bg-[oklch(0.12_0.006_285)]">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[1.2fr_repeat(4,1fr)] md:px-6">
        <div className="grid content-start gap-3">
          <SheepWordmark />
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            Der kostenlose Bildeditor, der deine Fotos nie hochlädt. Gebaut für Privatsphäre – und für richtig gute Bilder.
          </p>
        </div>
        {cats.map((c) => (
          <div key={c} className="grid content-start gap-2.5">
            <p className="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">{c}</p>
            {TOOLS.filter((t) => t.category === c).map((t) => (
              <Link key={t.slug} href={`/${t.slug}`} className="text-sm text-foreground/80 hover:text-primary">
                {t.label}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-xs text-muted-foreground md:px-6">
          <p>© Sheepit · Alle Bilder bleiben auf deinem Gerät.</p>
          <div className="flex gap-4">
            <Link href="/datenschutz" className="hover:text-foreground">
              Datenschutz
            </Link>
            <Link href="/impressum" className="hover:text-foreground">
              Impressum
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />
}
