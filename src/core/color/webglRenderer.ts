import type { ColorAdjustments } from '../types';
import { FRAGMENT_SHADER, VERTEX_SHADER } from './shaders';

interface Uniforms {
  image: WebGLUniformLocation | null;
  texel: WebGLUniformLocation | null;
  brightness: WebGLUniformLocation | null;
  contrast: WebGLUniformLocation | null;
  saturation: WebGLUniformLocation | null;
  grayscale: WebGLUniformLocation | null;
  sharpen: WebGLUniformLocation | null;
}

/**
 * A tiny, reusable WebGL1 pipeline that applies brightness, contrast,
 * saturation, grayscale and sharpening with a single full-screen pass.
 * One instance is shared by the whole app to avoid GPU context churn.
 */
export class ColorGLRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private uniforms: Uniforms | null = null;
  private texture: WebGLTexture | null = null;
  private buffer: WebGLBuffer | null = null;
  private failed = false;

  isAvailable(): boolean {
    return this.ensure() !== null;
  }

  /** Returns null when a source is too large for the GPU or GL is unavailable. */
  process(source: HTMLCanvasElement, adjustments: ColorAdjustments): HTMLCanvasElement | null {
    const gl = this.ensure();
    if (!gl || !this.program || !this.uniforms || !this.canvas) return null;

    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    if (source.width > maxTextureSize || source.height > maxTextureSize) return null;

    if (this.canvas.width !== source.width || this.canvas.height !== source.height) {
      this.canvas.width = source.width;
      this.canvas.height = source.height;
    }

    gl.viewport(0, 0, source.width, source.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);

    const { uniforms } = this;
    gl.uniform1i(uniforms.image, 0);
    gl.uniform2f(uniforms.texel, 1 / source.width, 1 / source.height);
    gl.uniform1f(uniforms.brightness, adjustments.brightness / 100);
    gl.uniform1f(uniforms.contrast, adjustments.contrast / 100);
    gl.uniform1f(uniforms.saturation, adjustments.saturation / 100);
    gl.uniform1f(uniforms.grayscale, adjustments.grayscale ? 1 : 0);
    gl.uniform1f(uniforms.sharpen, adjustments.sharpness / 100);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return this.canvas;
  }

  private ensure(): WebGLRenderingContext | null {
    if (this.gl) return this.gl;
    if (this.failed) return null;
    try {
      const canvas = document.createElement('canvas');
      const gl =
        canvas.getContext('webgl', {
          premultipliedAlpha: false,
          preserveDrawingBuffer: true,
          antialias: false,
          alpha: true,
        }) ||
        (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
      if (!gl) {
        this.failed = true;
        return null;
      }

      const program = buildProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
      if (!program) {
        this.failed = true;
        return null;
      }
      gl.useProgram(program);

      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
        gl.STATIC_DRAW,
      );
      const position = gl.getAttribLocation(program, 'aPosition');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.disable(gl.BLEND);
      gl.disable(gl.DEPTH_TEST);

      this.canvas = canvas;
      this.gl = gl;
      this.program = program;
      this.texture = texture;
      this.buffer = buffer;
      this.uniforms = {
        image: gl.getUniformLocation(program, 'uImage'),
        texel: gl.getUniformLocation(program, 'uTexel'),
        brightness: gl.getUniformLocation(program, 'uBrightness'),
        contrast: gl.getUniformLocation(program, 'uContrast'),
        saturation: gl.getUniformLocation(program, 'uSaturation'),
        grayscale: gl.getUniformLocation(program, 'uGrayscale'),
        sharpen: gl.getUniformLocation(program, 'uSharpen'),
      };

      gl.canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        this.failed = true;
        this.gl = null;
        this.program = null;
        this.texture = null;
      });
      return gl;
    } catch {
      this.failed = true;
      return null;
    }
  }
}

function buildProgram(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram | null {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertex || !fragment) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

let sharedRenderer: ColorGLRenderer | null = null;

export function getColorRenderer(): ColorGLRenderer {
  if (!sharedRenderer) sharedRenderer = new ColorGLRenderer();
  return sharedRenderer;
}
