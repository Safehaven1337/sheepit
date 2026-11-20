import { buildCurveLut, isIdentityCurve } from "../curves"
import { HSL_CHANNELS, type Adjustments, type GradeWheel } from "../types"
import { BLUR_FRAG, COPY_FRAG, DEVELOP_FRAG, VERT } from "./shaders"

type Prog = { p: WebGLProgram; u: Map<string, WebGLUniformLocation | null> }
type Target = { tex: WebGLTexture; fbo: WebGLFramebuffer; w: number; h: number }

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0), f(8), f(4)]
}

function wheelOffset(w: GradeWheel): [number, number, number] {
  const [r, g, b] = hslToRgb(w.hue, 1, 0.5)
  const s = w.sat / 100
  const m = (r + g + b) / 3
  return [(r - m) * s, (g - m) * s, (b - m) * s]
}

/**
 * GPU "develop" pipeline: one WebGL2 context renders all photographic
 * adjustments (Lightroom style) in a few passes.
 */
export class DevelopRenderer {
  readonly canvas: HTMLCanvasElement
  private gl: WebGL2RenderingContext
  private copy: Prog
  private blur: Prog
  private dev: Prog
  private src: WebGLTexture
  private lut: WebGLTexture
  private srcW = 0
  private srcH = 0
  private small: [Target, Target] | null = null
  private large: [Target, Target] | null = null
  private lastLutKey = ""
  readonly maxSize: number

  static create(): DevelopRenderer | null {
    try {
      return new DevelopRenderer()
    } catch (e) {
      console.warn("WebGL2 unavailable", e)
      return null
    }
  }

  private constructor() {
    this.canvas = document.createElement("canvas")
    const gl = this.canvas.getContext("webgl2", {
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
      antialias: false,
    })
    if (!gl) throw new Error("no webgl2")
    this.gl = gl
    this.maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    this.copy = this.program(COPY_FRAG)
    this.blur = this.program(BLUR_FRAG)
    this.dev = this.program(DEVELOP_FRAG)
    this.src = this.texture()
    this.lut = this.texture()
  }

  private program(frag: string): Prog {
    const gl = this.gl
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader")
      return s
    }
    const p = gl.createProgram()!
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT))
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, frag))
    gl.bindAttribLocation(p, 0, "a_pos")
    gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || "link")
    return { p, u: new Map() }
  }

  private loc(pr: Prog, name: string) {
    if (!pr.u.has(name)) pr.u.set(name, this.gl.getUniformLocation(pr.p, name))
    return pr.u.get(name)!
  }

  private texture() {
    const gl = this.gl
    const t = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return t
  }

  private target(w: number, h: number): Target {
    const gl = this.gl
    const tex = this.texture()
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    const fbo = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    return { tex, fbo, w, h }
  }

  private freeTargets() {
    const gl = this.gl
    for (const t of [...(this.small ?? []), ...(this.large ?? [])]) {
      gl.deleteTexture(t.tex)
      gl.deleteFramebuffer(t.fbo)
    }
    this.small = this.large = null
  }

  /** Upload the (already geometry-transformed) source. */
  setSource(source: TexImageSource, w: number, h: number) {
    const gl = this.gl
    gl.bindTexture(gl.TEXTURE_2D, this.src)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source)
    if (w !== this.srcW || h !== this.srcH) {
      this.freeTargets()
      this.srcW = w
      this.srcH = h
      this.small = [this.target(w, h), this.target(w, h)]
      const lw = Math.max(1, Math.round(w / 4))
      const lh = Math.max(1, Math.round(h / 4))
      this.large = [this.target(lw, lh), this.target(lw, lh)]
    }
    this.blurDirty = true
  }

  private blurDirty = true
  private lastBlurKey = ""

  private draw(pr: Prog, target: Target | null, flip = false) {
    const gl = this.gl
    gl.useProgram(pr.p)
    if (target) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo)
      gl.viewport(0, 0, target.w, target.h)
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    }
    gl.uniform1f(this.loc(pr, "u_flipY"), flip ? 1 : 0)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  private bind(pr: Prog, name: string, unit: number, tex: WebGLTexture) {
    const gl = this.gl
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.uniform1i(this.loc(pr, name), unit)
  }

  private gauss(from: WebGLTexture, a: Target, b: Target, sigma: number) {
    const gl = this.gl
    gl.useProgram(this.blur.p)
    this.bind(this.blur, "u_tex", 0, from)
    gl.uniform2f(this.loc(this.blur, "u_dir"), 1 / a.w, 0)
    gl.uniform1f(this.loc(this.blur, "u_sigma"), sigma)
    this.draw(this.blur, a)
    this.bind(this.blur, "u_tex", 0, a.tex)
    gl.uniform2f(this.loc(this.blur, "u_dir"), 0, 1 / a.h)
    this.draw(this.blur, b)
  }

  /** Renders adjustments. `pxScale` = render px per document px (for radii). */
  render(a: Adjustments, pxScale: number, seed = 0.37): HTMLCanvasElement {
    const gl = this.gl
    const w = this.srcW
    const h = this.srcH
    if (!w || !this.small || !this.large) return this.canvas
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
    }

    // blur pyramids (only recompute when needed)
    const minDim = Math.min(w, h)
    const sigS = Math.max(0.6, a.sharpenRadius * 1.2 * Math.max(pxScale, 0.35))
    const sigL = Math.max(1, (minDim * 0.018) / 4)
    const blurKey = `${sigS}|${sigL}`
    if (this.blurDirty || blurKey !== this.lastBlurKey) {
      this.gauss(this.src, this.small[0], this.small[1], sigS)
      // downsample then blur
      gl.useProgram(this.copy.p)
      this.bind(this.copy, "u_tex", 0, this.src)
      this.draw(this.copy, this.large[1])
      this.gauss(this.large[1].tex, this.large[0], this.large[1], sigL)
      this.blurDirty = false
      this.lastBlurKey = blurKey
    }

    // curves LUT
    const lutKey = JSON.stringify(a.curves)
    const useLut = !(
      isIdentityCurve(a.curves.rgb) &&
      isIdentityCurve(a.curves.r) &&
      isIdentityCurve(a.curves.g) &&
      isIdentityCurve(a.curves.b)
    )
    if (useLut && lutKey !== this.lastLutKey) {
      gl.bindTexture(gl.TEXTURE_2D, this.lut)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, buildCurveLut(a.curves))
      this.lastLutKey = lutKey
    }

    const p = this.dev
    gl.useProgram(p.p)
    this.bind(p, "u_src", 0, this.src)
    this.bind(p, "u_blurS", 1, this.small[1].tex)
    this.bind(p, "u_blurL", 2, this.large[1].tex)
    this.bind(p, "u_lut", 3, this.lut)
    const f = (n: string, v: number) => gl.uniform1f(this.loc(p, n), v)
    gl.uniform2f(this.loc(p, "u_texel"), 1 / w, 1 / h)
    gl.uniform2f(this.loc(p, "u_size"), w, h)
    f("u_exposure", a.exposure)
    f("u_contrast", a.contrast / 100)
    f("u_highlights", a.highlights / 100)
    f("u_shadows", a.shadows / 100)
    f("u_whites", a.whites / 100)
    f("u_blacks", a.blacks / 100)
    f("u_temp", a.temperature / 100)
    f("u_tint", a.tint / 100)
    f("u_vibrance", a.vibrance / 100)
    f("u_saturation", a.saturation / 100)
    f("u_texture", a.texture / 100)
    f("u_clarity", a.clarity / 100)
    f("u_dehaze", a.dehaze / 100)
    f("u_sharpen", a.sharpen / 100)
    f("u_denoise", a.denoise / 100)
    f("u_vignette", a.vignette / 100)
    f("u_vigMid", a.vignetteMidpoint / 100)
    f("u_vigFeather", a.vignetteFeather / 100)
    f("u_grain", a.grain / 100)
    f("u_grainSize", a.grainSize / 100)
    f("u_fade", a.fade / 100)
    f("u_seed", seed * 100)
    f("u_mono", a.monochrome ? 1 : 0)
    f("u_useLut", useLut ? 1 : 0)
    const hsl = new Float32Array(24)
    HSL_CHANNELS.forEach((c, i) => {
      hsl[i * 3] = a.hsl[c].hue / 100
      hsl[i * 3 + 1] = a.hsl[c].sat / 100
      hsl[i * 3 + 2] = a.hsl[c].lum / 100
    })
    gl.uniform3fv(this.loc(p, "u_hsl"), hsl)
    gl.uniform3fv(this.loc(p, "u_gShadow"), wheelOffset(a.gradeShadows))
    gl.uniform3fv(this.loc(p, "u_gMid"), wheelOffset(a.gradeMidtones))
    gl.uniform3fv(this.loc(p, "u_gHigh"), wheelOffset(a.gradeHighlights))
    gl.uniform3f(
      this.loc(p, "u_gLum"),
      a.gradeShadows.lum / 100,
      a.gradeMidtones.lum / 100,
      a.gradeHighlights.lum / 100,
    )
    f("u_gBalance", a.gradeBalance / 100)
    f("u_gBlend", a.gradeBlending / 100)
    this.draw(p, null, true)
    return this.canvas
  }

  dispose() {
    this.freeTargets()
    this.gl.getExtension("WEBGL_lose_context")?.loseContext()
  }
}
