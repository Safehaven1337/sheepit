import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight, ChevronRight, ShieldCheck } from "lucide-react"
import { Spotlight } from "@/components/ui/spotlight-new"
import { DotPattern } from "@/components/ui/dot-pattern"
import { MagicCard } from "@/components/ui/magic-card"
import { ShimmerLink } from "@/components/marketing/shimmer-link"
import { HeroDrop } from "@/components/marketing/hero-drop"
import { Faq } from "@/components/marketing/faq"
import { JsonLd, SiteFooter, SiteHeader } from "@/components/marketing/site-chrome"
import { TOOLS, toolBySlug } from "@/lib/seo/tools"
import { SITE } from "@/lib/seo/site"

// every tool page is fully prerendered at build time (SEO)
export const ensureStatic = "navigation"

export function generateStaticParams() {
  return TOOLS.map((t) => ({ tool: t.slug }))
}

export async function generateMetadata({ params }: PageProps<"/[tool]">): Promise<Metadata> {
  const { tool } = await params
  const t = toolBySlug(tool)
  if (!t) return {}
  return {
    title: { absolute: `${t.title} | Sheepit` },
    description: t.description,
    keywords: t.keywords,
    alternates: { canonical: `/${t.slug}` },
    openGraph: { title: t.title, description: t.description, url: `/${t.slug}`, type: "website", locale: "de_DE" },
  }
}

export default async function ToolPage({ params }: PageProps<"/[tool]">) {
  const { tool } = await params
  const t = toolBySlug(tool)
  if (!t) notFound()
  const related = t.related.map(toolBySlug).filter(Boolean) as typeof TOOLS
  const [before, after] = t.h1.split(t.highlight)

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebApplication",
              name: `${t.label} – Sheepit`,
              url: `${SITE.url}/${t.slug}`,
              applicationCategory: "MultimediaApplication",
              operatingSystem: "Web",
              inLanguage: "de",
              offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
              description: t.description,
            },
            {
              "@type": "HowTo",
              name: t.h1,
              step: t.steps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, name: s.title, text: s.text })),
              tool: { "@type": "HowToTool", name: "Sheepit (Browser)" },
            },
            {
              "@type": "FAQPage",
              mainEntity: t.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Sheepit", item: SITE.url },
                { "@type": "ListItem", position: 2, name: t.label, item: `${SITE.url}/${t.slug}` },
              ],
            },
          ],
        }}
      />
      <SiteHeader />
      <main className="relative overflow-x-clip">
        <section className="relative isolate">
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <Spotlight
              gradientFirst="radial-gradient(68.54% 68.72% at 55.02% 31.46%, hsla(78, 90%, 70%, .09) 0, hsla(78, 90%, 55%, .03) 50%, hsla(78, 90%, 45%, 0) 80%)"
              gradientSecond="radial-gradient(50% 50% at 50% 50%, hsla(45, 60%, 90%, .06) 0, transparent 100%)"
              gradientThird="radial-gradient(50% 50% at 50% 50%, hsla(45, 60%, 90%, .04) 0, transparent 100%)"
            />
            <DotPattern className="[mask-image:radial-gradient(520px_circle_at_50%_20%,white,transparent)] text-white/[0.07]" />
          </div>
          <div className="mx-auto grid max-w-4xl gap-8 px-4 pt-10 pb-16 text-center md:px-6 md:pt-16">
            <nav aria-label="Breadcrumb" className="flex items-center justify-center gap-1 text-[13px] text-muted-foreground">
              <Link href="/" className="hover:text-foreground">
                Sheepit
              </Link>
              <ChevronRight className="size-3.5" />
              <span className="text-foreground/80">{t.label}</span>
            </nav>
            <h1 className="text-balance text-[2.6rem] leading-[1.04] font-semibold tracking-[-0.035em] md:text-6xl">
              {before}
              <span className="font-display font-normal tracking-[-0.01em] text-wool italic">{t.highlight}</span>
              {after}
            </h1>
            <p className="mx-auto max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">{t.lead}</p>
            <HeroDrop slug={t.slug} className="mx-auto w-full max-w-2xl text-left" />
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-16 md:px-6">
          <h2 className="mb-8 text-center text-3xl font-semibold tracking-[-0.03em]">So geht&apos;s – in 3 Schritten</h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {t.steps.map((s, i) => (
              <li key={s.title}>
                <MagicCard className="h-full rounded-3xl p-6" gradientFrom="#c6f432" gradientTo="#f6f1e4" gradientColor="#1d1d22">
                  <span className="font-display text-5xl leading-none text-primary italic">{i + 1}</span>
                  <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
                </MagicCard>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-y border-white/[0.06] bg-[oklch(0.16_0.008_285)]">
          <div className="mx-auto grid max-w-5xl gap-4 px-4 py-16 md:grid-cols-3 md:px-6">
            {t.benefits.map((b) => (
              <div key={b.title} className="grid content-start gap-2">
                <ShieldCheck className="size-5 text-primary" />
                <h3 className="font-semibold">{b.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{b.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl gap-10 px-4 py-20 md:px-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="grid content-start gap-3">
            <h2 className="text-3xl font-semibold tracking-[-0.03em]">Fragen zu „{t.label}“</h2>
            <p className="text-muted-foreground">Kurz & ehrlich beantwortet.</p>
          </div>
          <Faq items={t.faq} />
        </section>

        {related.length > 0 && (
          <section className="mx-auto max-w-5xl px-4 pb-20 md:px-6">
            <h2 className="mb-5 text-xl font-semibold">Das könnte dich auch interessieren</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/${r.slug}`}
                  className="group rounded-2xl border border-white/[0.07] bg-card/60 p-5 transition hover:border-primary/40"
                >
                  <span className="flex items-center justify-between font-medium">
                    {r.label}
                    <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                  </span>
                  <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{r.description}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mx-auto max-w-5xl px-4 pb-24 text-center md:px-6">
          <p className="mb-5 text-muted-foreground">Mehr als nur {t.label.toLowerCase()}? Der volle Editor wartet.</p>
          <ShimmerLink href={`/editor?tool=${t.slug}`} className="mx-auto h-12 px-7 text-[15px] font-semibold">
            Sheepit Editor öffnen <ArrowRight className="ml-2 size-4" />
          </ShimmerLink>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
