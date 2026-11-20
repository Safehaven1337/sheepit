import {
  Inter,
  Playfair_Display,
  Bebas_Neue,
  Space_Grotesk,
  Caveat,
  Permanent_Marker,
  Montserrat,
  Oswald,
  Anton,
  DM_Serif_Display,
  Pacifico,
  JetBrains_Mono,
} from "next/font/google"

// Self-hosted at build time by next/font: no requests to Google at runtime (DSGVO-friendly).
const inter = Inter({ subsets: ["latin"], display: "swap", preload: false })
const playfair = Playfair_Display({ subsets: ["latin"], display: "swap", preload: false })
const bebas = Bebas_Neue({ weight: "400", subsets: ["latin"], display: "swap", preload: false })
const grotesk = Space_Grotesk({ subsets: ["latin"], display: "swap", preload: false })
const caveat = Caveat({ subsets: ["latin"], display: "swap", preload: false })
const marker = Permanent_Marker({ weight: "400", subsets: ["latin"], display: "swap", preload: false })
const montserrat = Montserrat({ subsets: ["latin"], display: "swap", preload: false })
const oswald = Oswald({ subsets: ["latin"], display: "swap", preload: false })
const anton = Anton({ weight: "400", subsets: ["latin"], display: "swap", preload: false })
const dmserif = DM_Serif_Display({ weight: "400", subsets: ["latin"], display: "swap", preload: false })
const pacifico = Pacifico({ weight: "400", subsets: ["latin"], display: "swap", preload: false })
const mono = JetBrains_Mono({ subsets: ["latin"], display: "swap", preload: false })

export const FONTS: { name: string; family: string; className: string }[] = [
  { name: "Inter", f: inter },
  { name: "Montserrat", f: montserrat },
  { name: "Space Grotesk", f: grotesk },
  { name: "Playfair Display", f: playfair },
  { name: "DM Serif", f: dmserif },
  { name: "Bebas Neue", f: bebas },
  { name: "Anton", f: anton },
  { name: "Oswald", f: oswald },
  { name: "Caveat", f: caveat },
  { name: "Permanent Marker", f: marker },
  { name: "Pacifico", f: pacifico },
  { name: "JetBrains Mono", f: mono },
].map(({ name, f }) => ({ name, family: f.style.fontFamily, className: f.className }))

export const fontFamilyFor = (name: string) =>
  FONTS.find((f) => f.name === name)?.family ?? `${name}, system-ui, sans-serif`

/** Make sure a font face is ready before drawing on canvas. */
export async function ensureFont(name: string, weight = 400, italic = false) {
  if (typeof document === "undefined" || !document.fonts) return
  const fam = fontFamilyFor(name)
  try {
    await document.fonts.load(`${italic ? "italic " : ""}${weight} 48px ${fam}`)
  } catch {
    /* ignore */
  }
}
