// On-device person segmentation ("Hintergrund entfernen") – MediaPipe selfie
// segmenter, self-hosted model + wasm. Nothing leaves the device.
import type { ImageSegmenter } from "@mediapipe/tasks-vision"
import { boxBlurRGBA } from "./effects"

let segPromise: Promise<ImageSegmenter> | null = null

async function getSegmenter() {
  if (!segPromise) {
    segPromise = (async () => {
      const { ImageSegmenter, FilesetResolver } = await import("@mediapipe/tasks-vision")
      const fileset = await FilesetResolver.forVisionTasks("/mediapipe")
      const make = (delegate: "GPU" | "CPU") =>
        ImageSegmenter.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: "/models/selfie_segmenter.tflite", delegate },
          runningMode: "IMAGE",
          outputConfidenceMasks: true,
          outputCategoryMask: false,
        })
      return make("GPU").catch(() => make("CPU"))
    })()
    segPromise.catch(() => (segPromise = null))
  }
  return segPromise
}

/**
 * Returns a canvas (same size as `source`) whose alpha marks the BACKGROUND
 * (opaque = background → gets erased, transparent = person).
 */
export async function backgroundMask(source: HTMLCanvasElement): Promise<HTMLCanvasElement> {
  const seg = await getSegmenter()
  // the model works on a small square; feed a moderately sized copy
  const s = Math.min(1, 768 / Math.max(source.width, source.height))
  const inp = document.createElement("canvas")
  inp.width = Math.max(1, Math.round(source.width * s))
  inp.height = Math.max(1, Math.round(source.height * s))
  inp.getContext("2d")!.drawImage(source, 0, 0, inp.width, inp.height)
  const res = seg.segment(inp)
  const mask = res.confidenceMasks?.[0]
  if (!mask) throw new Error("Keine Maske")
  const conf = mask.getAsFloat32Array()
  const mw = mask.width
  const mh = mask.height
  const small = document.createElement("canvas")
  small.width = mw
  small.height = mh
  const sctx = small.getContext("2d", { willReadFrequently: true })!
  const img = sctx.createImageData(mw, mh)
  for (let i = 0; i < conf.length; i++) {
    // sharpen the soft confidence a bit, then invert (background = erase)
    const person = Math.min(1, Math.max(0, (conf[i] - 0.35) / 0.3))
    img.data[i * 4 + 3] = Math.round((1 - person) * 255)
  }
  // light smoothing removes the blockiness of the low-res mask
  boxBlurRGBA(img.data, mw, mh, 1, 2, true)
  sctx.putImageData(img, 0, 0)
  res.close?.()
  mask.close?.()
  const out = document.createElement("canvas")
  out.width = source.width
  out.height = source.height
  const o = out.getContext("2d")!
  o.imageSmoothingQuality = "high"
  o.drawImage(small, 0, 0, out.width, out.height)
  return out
}
