import type { Metadata } from "next"
import { Suspense } from "react"
import { EditorApp } from "@/components/editor/editor-app"

export const metadata: Metadata = {
  title: "Bildeditor online – Foto bearbeiten im Browser",
  description:
    "Der Sheepit Editor: Fotos bearbeiten wie in Lightroom & Photoshop – direkt im Browser, ohne Anmeldung und ohne Upload.",
  alternates: { canonical: "/editor" },
}

export default function EditorPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-background" />}>
      <EditorApp />
    </Suspense>
  )
}
