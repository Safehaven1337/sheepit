import { strFromU8, strToU8, unzip, zip } from "fflate"
import { blobToAsset } from "./store"
import { docSize, invalidateRenderCache, renderDoc } from "./render"
import type { Asset, SheepDoc } from "./types"

/*
 * .sheepit = zip archive
 *   manifest.json  { format: "sheepit", version: 1, app, created }
 *   document.json  SheepDoc (all non-destructive edits)
 *   assets/<id>.<ext>  original image bytes
 *   preview.jpg   small thumbnail
 */

export const SHEEPIT_MIME = "application/x-sheepit"

const extFor = (mime: string) =>
  ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif", "image/gif": "gif" })[
    mime
  ] ?? "bin"

export async function saveProject(doc: SheepDoc, assets: Map<string, Asset>): Promise<Blob> {
  const files: Record<string, Uint8Array> = {}
  const used = new Set<string>()
  if (doc.baseAssetId) used.add(doc.baseAssetId)
  for (const l of doc.layers) if (l.type === "image") used.add(l.assetId)
  const index: Record<string, { file: string; mime: string; width: number; height: number }> = {}
  for (const id of used) {
    const a = assets.get(id)
    if (!a) continue
    const file = `assets/${id}.${extFor(a.mime)}`
    files[file] = new Uint8Array(await a.blob.arrayBuffer())
    index[id] = { file, mime: a.mime, width: a.width, height: a.height }
  }
  files["manifest.json"] = strToU8(
    JSON.stringify({ format: "sheepit", version: 1, app: "Sheepit", created: new Date().toISOString(), assets: index }),
  )
  files["document.json"] = strToU8(JSON.stringify(doc))
  // preview
  try {
    const { w, h } = docSize(doc)
    const scale = Math.min(1, 512 / Math.max(w, h))
    const c = renderDoc(doc, assets, { scale, background: "#ffffff" })
    invalidateRenderCache()
    const prev = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.8))
    if (prev) files["preview.jpg"] = new Uint8Array(await prev.arrayBuffer())
  } catch {
    /* preview optional */
  }
  const data = await new Promise<Uint8Array>((res, rej) =>
    zip(files, { level: 0 }, (err, out) => (err ? rej(err) : res(out))),
  )
  return new Blob([data as BlobPart], { type: SHEEPIT_MIME })
}

export async function loadProject(file: Blob): Promise<{ doc: SheepDoc; assets: Asset[] }> {
  const buf = new Uint8Array(await file.arrayBuffer())
  const files = await new Promise<Record<string, Uint8Array>>((res, rej) =>
    unzip(buf, (err, out) => (err ? rej(err) : res(out))),
  )
  if (!files["manifest.json"] || !files["document.json"]) throw new Error("Keine gültige .sheepit-Datei")
  const manifest = JSON.parse(strFromU8(files["manifest.json"]))
  if (manifest.format !== "sheepit") throw new Error("Keine gültige .sheepit-Datei")
  const doc = JSON.parse(strFromU8(files["document.json"])) as SheepDoc
  const assets: Asset[] = []
  for (const [id, meta] of Object.entries(manifest.assets as Record<string, { file: string; mime: string }>)) {
    const bytes = files[meta.file]
    if (!bytes) continue
    assets.push(await blobToAsset(new Blob([bytes as BlobPart], { type: meta.mime }), id))
  }
  return { doc, assets }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export type ExportFormat = "image/png" | "image/jpeg" | "image/webp" | "image/avif"

export async function supportsFormat(mime: string) {
  const c = document.createElement("canvas")
  c.width = c.height = 2
  const b = await new Promise<Blob | null>((r) => c.toBlob(r, mime))
  return !!b && b.type === mime
}

export async function exportImage(
  doc: SheepDoc,
  assets: Map<string, Asset>,
  opts: { format: ExportFormat; quality: number; scale: number; background?: string | null },
): Promise<Blob> {
  const bg = opts.format === "image/jpeg" ? (opts.background ?? "#ffffff") : (opts.background ?? undefined)
  const c = renderDoc(doc, assets, { scale: opts.scale, background: bg })
  invalidateRenderCache()
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, opts.format, opts.quality))
  if (!blob) throw new Error("Export fehlgeschlagen")
  return blob
}
