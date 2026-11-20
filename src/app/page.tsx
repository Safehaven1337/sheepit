import Link from "next/link"
import {
  ArrowRight,
  Crop,
  FileArchive,
  Layers,
  Lock,
  ScanFace,
  SlidersHorizontal,
  Sparkles,
  Type,
  WifiOff,
} from "lucide-react"
import { Spotlight } from "@/components/ui/spotlight-new"
import { AnimatedGradientText } from "@/components/ui/animated-gradient-text"
import { Marquee } from "@/components/ui/marquee"
import { BentoCard, BentoGrid } from "@/components/ui/bento-grid"
import { NumberTicker } from "@/components/ui/number-ticker"
import { DotPattern } from "@/components/ui/dot-pattern"
import { Compare } from "@/components/ui/compare"
import { HeroDrop } from "@/components/marketing/hero-drop"
import { Faq } from "@/components/marketing/faq"
import { JsonLd, SiteFooter, SiteHeader } from "@/components/marketing/site-chrome"
import { TOOLS } from "@/lib/seo/tools"
import { SITE } from "@/lib/seo/site"

const FAQ = [
  {
    q: "Ist Sheepit wirklich kostenlos?",
    a: "Ja. Alle Werkzeuge sind kostenlos, ohne Anmeldung und ohne Wasserzeichen. Sheepit finanziert sich künftig über dezente Werbung – niemals über deine Bilder oder Daten.",
  },
  {
    q: "Werden meine Bilder hochgeladen?",
    a: "Nein. Sheepit läuft vollständig in deinem Browser. Deine Fotos werden auf deinem Gerät verarbeitet und nie an einen Server gesendet – nicht einmal für die Gesichtserkennung.",
  },
  {
    q: "Was ist eine .sheepit-Datei?",
    a: "Eine Projektdatei mit deinem Originalbild und allen Bearbeitungen (Regler, Ebenen, Text, Privacy-Bereiche). Öffne sie später einfach wieder in Sheepit und mach genau dort weiter, wo du aufgehört hast.",
  },
  {
    q: "Wie kann ich Gesichter automatisch verpixeln?",
    a: "Öffne dein Foto, wähle „Privatsphäre“ und klicke auf „Gesichter automatisch finden“. Eine KI auf deinem Gerät markiert alle Gesichter – du wählst Pixel, Blur oder Schwärzen.",
  },
  {
    q: "Funktioniert Sheepit auf dem Handy?",
    a: "Ja. Sheepit läuft in jedem modernen Browser auf iPhone, Android, Tablet, Mac und PC – ganz ohne App-Installation.",
  },
  {
    q: "In welchen Formaten kann ich speichern?",
    a: "JPG, PNG, WebP und AVIF – mit Qualitätsregler, Größenänderung und Live-Anzeige der Dateigröße. Oder als .sheepit-Projekt.",
  },
]

export default function Home() {
  const featured = TOOLS.slice(0, 12)
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebApplication",
              name: "Sheepit",
              url: SITE.url,
              applicationCategory: "MultimediaApplication",
              operatingSystem: "Web",
              browserRequirements: "Requires a modern browser with WebGL2",
              inLanguage: "de",
              offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
              description: SITE.description,
              featureList: TOOLS.map((t) => t.label),
            },
            {
              "@type": "FAQPage",
              mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
            },
          ],
        }}
      />
      <SiteHeader />
      <main className="relative overflow-x-clip">
        {/* HERO */}
        <section className="relative isolate">
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <Spotlight
              gradientFirst="radial-gradient(68.54% 68.72% at 55.02% 31.46%, hsla(78, 90%, 70%, .10) 0, hsla(78, 90%, 55%, .03) 50%, hsla(78, 90%, 45%, 0) 80%)"
              gradientSecond="radial-gradient(50% 50% at 50% 50%, hsla(45, 60%, 90%, .07) 0, hsla(45, 60%, 80%, .02) 80%, transparent 100%)"
              gradientThird="radial-gradient(50% 50% at 50% 50%, hsla(45, 60%, 90%, .05) 0, hsla(45, 60%, 70%, .02) 80%, transparent 100%)"
            />
            <DotPattern className="[mask-image:radial-gradient(600px_circle_at_50%_30%,white,transparent)] text-white/[0.07]" />
            <div className="grain-overlay absolute inset-0 opacity-[0.06] mix-blend-overlay" />
          </div>

          <div className="mx-auto grid max-w-6xl gap-12 px-4 pt-16 pb-20 md:px-6 md:pt-24 lg:grid-cols-[1.05fr_1fr] lg:items-center">
            <div className="grid gap-7">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[13px]">
                <Lock className="size-3.5 text-primary" />
                <AnimatedGradientText colorFrom="#c6f432" colorTo="#f6f1e4" className="font-medium">
                  100 % im Browser · 0 Uploads · 0 Accounts
                </AnimatedGradientText>
              </div>
              <h1 className="text-balance text-[2.75rem] leading-[1.02] font-semibold tracking-[-0.035em] md:text-6xl lg:text-[4.4rem]">
                Fotos bearbeiten,{" "}
                <span className="font-display font-normal tracking-[-0.01em] text-wool italic">ohne</span> dass sie dein
                Gerät verlassen.
              </h1>
              <p className="max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
                Sheepit ist der kostenlose Bildeditor mit Lightroom-Reglern, Ebenen und Text – plus den Werkzeugen, die du
                wirklich suchst: <strong className="font-medium text-foreground">verpixeln</strong>,{" "}
                <strong className="font-medium text-foreground">weichzeichnen</strong> und{" "}
                <strong className="font-medium text-foreground">unkenntlich machen</strong>. Ohne Anmeldung. Ohne Upload.
              </p>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {["Gesichter automatisch verpixeln", "RAW-artige Entwicklung", ".sheepit-Projekte"].map((t) => (
                  <span key={t} className="inline-flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-primary" /> {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-10 -z-10 rounded-full bg-primary/10 blur-3xl" />
              <HeroDrop />
              <div className="mt-4 flex flex-wrap justify-center gap-2 text-[13px]">
                <span className="text-muted-foreground">Direkt zu:</span>
                {["bild-verpixeln", "gesicht-verpixeln", "bild-zuschneiden", "bild-komprimieren"].map((s) => {
                  const t = TOOLS.find((x) => x.slug === s)!
                  return (
                    <Link key={s} href={`/${s}`} className="text-foreground/80 underline-offset-4 hover:text-primary hover:underline">
                      {t.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        {/* TOOL MARQUEE */}
        <section aria-label="Beliebte Werkzeuge" className="border-y border-white/[0.06] bg-white/[0.015] py-4">
          <Marquee pauseOnHover className="[--duration:45s] [--gap:0.75rem]">
            {TOOLS.map((t) => (
              <Link
                key={t.slug}
                href={`/${t.slug}`}
                className="rounded-full border border-white/10 bg-card px-4 py-2 text-sm whitespace-nowrap text-foreground/85 transition hover:border-primary/50 hover:text-primary"
              >
                {t.label}
              </Link>
            ))}
          </Marquee>
        </section>

        {/* BEFORE / AFTER */}
        <section className="mx-auto max-w-6xl px-4 py-24 md:px-6">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div className="grid gap-5">
              <p className="text-sm font-semibold tracking-[0.12em] text-primary uppercase">Entwickeln wie ein Profi</p>
              <h2 className="text-balance text-4xl font-semibold tracking-[-0.03em] md:text-5xl">
                Lightroom-Regler. <span className="font-display font-normal text-wool italic">Auf der GPU.</span>
              </h2>
              <p className="text-lg leading-relaxed text-muted-foreground">
                Belichtung, Lichter, Tiefen, Gradationskurven, 8-Kanal-Farbmischer, Color Grading, Klarheit, Dunst
                entfernen, Rauschreduzierung – berechnet in Echtzeit mit WebGL. Nicht-destruktiv, jederzeit änderbar.
              </p>
              <ul className="grid gap-2 text-sm text-foreground/85 sm:grid-cols-2">
                {["Gradationskurven (RGB + Kanäle)", "Farbmischer HSL & S/W-Mixer", "Color Grading 3-Wege", "20+ Film-Looks", "Schärfen & Entrauschen", "Histogramm mit Clipping"].map((x) => (
                  <li key={x} className="flex items-center gap-2">
                    <span className="grid size-4 place-items-center rounded-full bg-primary/15 text-[10px] text-primary">✓</span> {x}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-card p-2 shadow-2xl">
              <Compare
                firstImage="/demo/demo-before.jpg"
                secondImage="/demo/demo-after.jpg"
                firstImageClassName="object-cover"
                secondImageClassname="object-cover"
                className="aspect-[16/10] h-auto w-full rounded-[22px]"
                slideMode="hover"
                autoplay
              />
            </div>
          </div>
        </section>

        {/* BENTO FEATURES */}
        <section id="funktionen" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-24 md:px-6">
          <div className="mb-10 grid max-w-2xl gap-4">
            <p className="text-sm font-semibold tracking-[0.12em] text-primary uppercase">Alles drin</p>
            <h2 className="text-balance text-4xl font-semibold tracking-[-0.03em] md:text-5xl">
              Ein Editor. <span className="font-display font-normal text-wool italic">Keine Kompromisse.</span>
            </h2>
          </div>
          <BentoGrid className="auto-rows-[20rem] md:grid-cols-3">
            <BentoCard
              name="Gesichter automatisch unkenntlich"
              description="On-Device-KI findet Gesichter in Sekunden. Verpixeln, weichzeichnen, Milchglas oder schwärzen."
              href="/gesicht-verpixeln"
              cta="Gesicht verpixeln"
              Icon={ScanFace}
              className="md:col-span-2"
              background={
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/demo/privacy-after.jpg" alt="" className="absolute inset-0 size-full object-cover opacity-30 transition duration-500 [mask-image:linear-gradient(to_bottom,black,transparent_85%)] group-hover:scale-105 group-hover:opacity-45" />
              }
            />
            <BentoCard
              name="Profi-Entwicklung"
              description="Kurven, HSL, Color Grading, Dehaze – in Echtzeit."
              href="/foto-filter"
              cta="Looks ansehen"
              Icon={SlidersHorizontal}
              className="md:col-span-1"
              background={
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/demo/demo-after.jpg" alt="" className="absolute inset-0 size-full object-cover opacity-35 transition duration-500 [mask-image:linear-gradient(to_bottom,black,transparent_80%)] group-hover:scale-105 group-hover:opacity-55" />
              }
            />
            <BentoCard
              name=".sheepit-Projekte"
              description="Speichere Bild + alle Bearbeitungen in einer Datei. Später weitermachen – ohne Cloud."
              href="/editor"
              cta="Editor öffnen"
              Icon={FileArchive}
              className="md:col-span-1"
              background={
                <div className="absolute inset-x-0 top-6 flex justify-center">
                  <div className="relative h-36 w-28 transition duration-500 group-hover:-translate-y-1">
                    <div className="absolute inset-0 translate-x-5 rotate-6 rounded-2xl border border-white/10 bg-white/[0.03]" />
                    <div className="absolute inset-0 translate-x-2.5 rotate-3 rounded-2xl border border-white/10 bg-white/[0.05]" />
                    <div className="absolute inset-0 grid place-items-center rounded-2xl border border-white/15 bg-card">
                      <span className="font-mono text-xs text-primary">.sheepit</span>
                    </div>
                  </div>
                </div>
              }
            />
            <BentoCard
              name="Ebenen, Text & Formen"
              description="12 lokal ausgelieferte Schriften, Konturen, Pfeile, Füllmethoden – wie in Photoshop, nur einfacher."
              href="/text-auf-bild"
              cta="Text aufs Bild"
              Icon={Type}
              className="md:col-span-2"
              background={
                <div className="absolute inset-0 grid place-items-center opacity-60 transition group-hover:opacity-90">
                  <span className="font-display text-[7rem] leading-none text-white/[0.06] italic select-none">Aa</span>
                </div>
              }
            />
          </BentoGrid>
        </section>

        {/* PRIVACY NUMBERS */}
        <section className="relative border-y border-white/[0.06] bg-[oklch(0.16_0.008_285)]">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 md:px-6 lg:grid-cols-[1fr_1.2fr] lg:items-center">
            <div className="grid gap-5">
              <p className="text-sm font-semibold tracking-[0.12em] text-primary uppercase">Privatsphäre by Design</p>
              <h2 className="text-balance text-4xl font-semibold tracking-[-0.03em]">
                Deine Bilder sind <span className="font-display font-normal text-wool italic">deine</span> Sache.
              </h2>
              <p className="text-lg leading-relaxed text-muted-foreground">
                Andere Online-Editoren laden dein Foto auf ihre Server. Sheepit nicht. Alles – von der Farbkorrektur bis
                zur Gesichtserkennung – passiert lokal. Funktioniert sogar offline, sobald die Seite geladen ist.
              </p>
              <div className="flex flex-wrap gap-3 text-sm">
                {[
                  { i: WifiOff, t: "Offline-fähig" },
                  { i: Lock, t: "Kein Tracking deiner Bilder" },
                  { i: Sparkles, t: "EXIF/GPS wird entfernt" },
                ].map(({ i: I, t }) => (
                  <span key={t} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5">
                    <I className="size-3.5 text-primary" /> {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { v: 0, l: "Bilder auf unseren Servern", suf: "" },
                { v: 0, l: "Konten oder E-Mails nötig", suf: "" },
                { v: 100, l: "Verarbeitung auf deinem Gerät", suf: "%" },
                { v: 40, l: "Regler & Werkzeuge", suf: "+" },
              ].map((s) => (
                <div key={s.l} className="rounded-3xl border border-white/[0.08] bg-card p-6">
                  <div className="font-display text-6xl leading-none text-wool">
                    {s.v === 0 ? "0" : <NumberTicker value={s.v} className="text-wool" />}
                    <span className="text-primary">{s.suf}</span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{s.l}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* TOOLS GRID (internal links for SEO) */}
        <section id="tools" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 md:px-6">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div className="grid gap-4">
              <p className="text-sm font-semibold tracking-[0.12em] text-primary uppercase">Werkzeuge</p>
              <h2 className="text-balance text-4xl font-semibold tracking-[-0.03em] md:text-5xl">Was willst du heute tun?</h2>
            </div>
            <Link href="/editor" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
              Zum vollen Editor <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map((t) => {
              const Icon =
                t.category === "Privatsphäre" ? ScanFace : t.category === "Bearbeiten" ? Crop : t.category === "Konvertieren" ? Layers : SlidersHorizontal
              return (
                <Link
                  key={t.slug}
                  href={`/${t.slug}`}
                  className="group flex items-start gap-4 rounded-2xl border border-white/[0.07] bg-card/60 p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/[0.04] text-muted-foreground transition group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="size-5" />
                  </span>
                  <span className="grid gap-1">
                    <span className="font-medium">{t.label}</span>
                    <span className="line-clamp-2 text-sm text-muted-foreground">{t.description}</span>
                  </span>
                </Link>
              )
            })}
          </div>
          <p className="sr-only">{featured.map((t) => t.label).join(", ")}</p>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto grid max-w-6xl scroll-mt-20 gap-10 px-4 pb-24 md:px-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="grid content-start gap-4">
            <p className="text-sm font-semibold tracking-[0.12em] text-primary uppercase">FAQ</p>
            <h2 className="text-balance text-4xl font-semibold tracking-[-0.03em]">Häufige Fragen</h2>
            <p className="text-muted-foreground">Alles, was du über Sheepit wissen musst.</p>
          </div>
          <Faq items={FAQ} />
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-4 pb-24 md:px-6">
          <div className="relative overflow-hidden rounded-[36px] border border-white/10 bg-primary px-6 py-16 text-center text-primary-foreground md:py-20">
            <div className="grain-overlay absolute inset-0 opacity-20 mix-blend-multiply" />
            <h2 className="relative mx-auto max-w-3xl text-balance text-4xl font-semibold tracking-[-0.035em] md:text-6xl">
              Schnapp dir dein Bild. <span className="font-display font-normal italic">Sheep it.</span>
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-lg opacity-75">Kostenlos, privat und sofort startklar – kein Konto nötig.</p>
            <Link
              href="/editor"
              className="relative mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-ink px-7 text-[15px] font-semibold text-wool transition hover:scale-[1.03]"
            >
              Editor öffnen <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
