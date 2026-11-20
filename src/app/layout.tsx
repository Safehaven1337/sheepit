import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google"
import { Toaster } from "sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SITE } from "@/lib/seo/site"
import "./globals.css"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })
const instrument = Instrument_Serif({
  variable: "--font-instrument",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "Sheepit – Kostenloser Bildeditor online, ohne Anmeldung",
    template: "%s | Sheepit",
  },
  description: SITE.description,
  applicationName: "Sheepit",
  keywords: [
    "Bildeditor online",
    "Foto bearbeiten kostenlos",
    "Bild verpixeln",
    "Foto unkenntlich machen",
    "Bild weichzeichnen",
    "Fotobearbeitung ohne Anmeldung",
  ],
  openGraph: {
    type: "website",
    locale: "de_DE",
    siteName: "Sheepit",
    url: SITE.url,
  },
  twitter: { card: "summary_large_image" },
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor: "#121216",
  colorScheme: "dark",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="de"
      className={`dark ${geistSans.variable} ${geistMono.variable} ${instrument.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background">
        <TooltipProvider delay={250}>{children}</TooltipProvider>
        <Toaster theme="dark" position="bottom-center" richColors closeButton />
      </body>
    </html>
  )
}
