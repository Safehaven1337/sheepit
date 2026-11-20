import { ImageResponse } from "next/og"

export const alt = "Sheepit – Fotos bearbeiten ohne Upload"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "radial-gradient(circle at 75% 20%, rgba(198,244,50,.22), transparent 55%), #121216",
          color: "#f6f1e4",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 40, fontWeight: 700 }}>
          <div style={{ width: 64, height: 64, borderRadius: 32, background: "#f6f1e4", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 30, height: 36, borderRadius: 18, background: "#15151a" }} />
          </div>
          sheep<span style={{ color: "#c6f432" }}>it</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.04, letterSpacing: -2 }}>Fotos bearbeiten, ohne dass sie dein Gerät verlassen.</div>
          <div style={{ fontSize: 30, color: "#a3a3ad" }}>Verpixeln · Unkenntlich machen · Lightroom-Regler · Kostenlos & ohne Anmeldung</div>
        </div>
      </div>
    ),
    size,
  )
}
