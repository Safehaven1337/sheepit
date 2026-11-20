// On-device face detection (MediaPipe, self-hosted wasm + model — nothing leaves the device).
import type { FaceDetector } from "@mediapipe/tasks-vision"

let detectorPromise: Promise<FaceDetector> | null = null

async function create(delegate: "GPU" | "CPU") {
  const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision")
  const fileset = await FilesetResolver.forVisionTasks("/mediapipe")
  return FaceDetector.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: "/models/blaze_face_short_range.tflite", delegate },
    runningMode: "IMAGE",
    minDetectionConfidence: 0.5,
    minSuppressionThreshold: 0.3,
  })
}

async function getDetector() {
  if (!detectorPromise) {
    detectorPromise = create("GPU").catch(() => create("CPU"))
    detectorPromise.catch(() => (detectorPromise = null))
  }
  return detectorPromise
}

export interface FaceBox {
  x: number
  y: number
  w: number
  h: number
  score: number
  /** how many other windows/scales agreed */
  support?: number
}

/** model input is 128px; we feed tiles at this size (bigger buys nothing) */
const TILE_PX = 256
const DEBUG = process.env.NODE_ENV !== "production"

/**
 * BlazeFace (short range) works on a 128×128 input, so small faces in group
 * photos vanish when the whole image is scaled down. We therefore scan an image
 * pyramid of overlapping windows – from the full frame down to windows that are
 * ~8 % of the shorter side – and merge the hits with score-based NMS.
 */
export async function detectFaces(
  source: HTMLCanvasElement,
  onProgress?: (done: number, total: number) => void,
): Promise<FaceBox[]> {
  const det = await getDetector()
  const W = source.width
  const H = source.height
  const m = Math.min(W, H)

  const windows: { x: number; y: number; s: number }[] = []
  const add = (s: number) => {
    const stride = s * 0.5
    const nx = Math.max(1, Math.ceil((W - s) / stride) + 1)
    const ny = Math.max(1, Math.ceil((H - s) / stride) + 1)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++)
        windows.push({ x: Math.min(i * stride, Math.max(0, W - s)), y: Math.min(j * stride, Math.max(0, H - s)), s })
  }
  // whole frame (letterboxed square) first, then the pyramid
  windows.push({ x: (W - Math.max(W, H)) / 2, y: (H - Math.max(W, H)) / 2, s: Math.max(W, H) })
  for (let s = m; s >= Math.max(96, m * 0.08); s *= 0.55) add(Math.round(s))

  const tile = document.createElement("canvas")
  tile.width = tile.height = TILE_PX
  const tctx = tile.getContext("2d", { willReadFrequently: false })!
  const boxes: FaceBox[] = []
  let last = performance.now()

  for (let k = 0; k < windows.length; k++) {
    const { x, y, s } = windows[k]
    const k2 = TILE_PX / s
    tctx.fillStyle = "#000"
    tctx.fillRect(0, 0, TILE_PX, TILE_PX)
    tctx.drawImage(source, x, y, s, s, 0, 0, TILE_PX, TILE_PX)
    const res = det.detect(tile)
    for (const d of res.detections) {
      const b = d.boundingBox
      if (!b) continue
      const score = d.categories?.[0]?.score ?? 0
      // faces cut by the window edge are found again by an overlapping window
      const edge = 2
      const cut =
        (b.originX < edge && x > 0) ||
        (b.originY < edge && y > 0) ||
        (b.originX + b.width > TILE_PX - edge && x + s < W) ||
        (b.originY + b.height > TILE_PX - edge && y + s < H)
      if (cut) continue
      // tiny relative boxes are mostly noise
      if (b.width < TILE_PX * 0.06) continue
      boxes.push({ x: x + b.originX / k2, y: y + b.originY / k2, w: b.width / k2, h: b.height / k2, score })
    }
    // keep the UI responsive
    if (performance.now() - last > 40) {
      onProgress?.(k + 1, windows.length)
      await new Promise((r) => setTimeout(r, 0))
      last = performance.now()
    }
  }
  return nms(boxes)
}

function iou(a: FaceBox, b: FaceBox) {
  const x0 = Math.max(a.x, b.x)
  const y0 = Math.max(a.y, b.y)
  const x1 = Math.min(a.x + a.w, b.x + b.w)
  const y1 = Math.min(a.y + a.h, b.y + b.h)
  const inter = Math.max(0, x1 - x0) * Math.max(0, y1 - y0)
  return { iou: inter / (a.w * a.h + b.w * b.h - inter), overSmaller: inter / Math.min(a.w * a.h, b.w * b.h) }
}

/** score-sorted NMS; also suppresses boxes mostly inside a stronger one */
function nms(list: FaceBox[]) {
  // a face seen at several scales is more trustworthy: boost by agreement
  const support = list.map((a) => list.filter((b) => b !== a && iou(a, b).iou > 0.35).length)
  const ranked = list
    .map((b, i) => ({ ...b, rank: b.score + Math.min(3, support[i]) * 0.05, support: support[i] }))
    .sort((p, q) => q.rank - p.rank)
  const out: (FaceBox & { support: number })[] = []
  for (const b of ranked) {
    if (out.some((o) => { const r = iou(o, b); return r.iou > 0.3 || r.overSmaller > 0.6 })) continue
    if (DEBUG) (globalThis as unknown as { __faceDebug?: unknown[] }).__faceDebug?.push({ x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), s: +b.score.toFixed(3), sup: b.support })
    // Faces are confirmed by overlapping windows/scales; texture false positives
    // (knitwear, crowds, foliage) usually are not. Recall matters more than
    // precision for privacy, so the bar stays fairly low.
    const keep = b.support >= 2 || (b.support === 1 && b.score >= 0.6) || b.score >= 0.8
    if (!keep) continue
    out.push(b)
  }
  return out.map(({ x, y, w, h, score, support }) => ({ x, y, w, h, score, support }))
}
