import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sheepit – Bildeditor ohne Upload",
    short_name: "Sheepit",
    description: "Fotos bearbeiten, verpixeln und unkenntlich machen – komplett im Browser.",
    start_url: "/editor",
    display: "standalone",
    background_color: "#121216",
    theme_color: "#121216",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
    file_handlers: [
      { action: "/editor", accept: { "application/x-sheepit": [".sheepit"], "image/*": [".jpg", ".jpeg", ".png", ".webp", ".avif"] } },
    ],
  } as MetadataRoute.Manifest
}
