/**
 * Pure CPU image filters used as a fallback when WebGL is unavailable
 * (old GPUs, blocked drivers) and to keep color maths testable in Node.
 */

export interface RawImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/** 5-tap unsharp mask. `amount` 0..1 (UI 0..100). Alpha untouched. */
export function unsharpMask(image: RawImage, amount: number): RawImage {
  const { width, height, data } = image;
  if (amount <= 0 || width < 2 || height < 2) return image;
  const k = amount * 1.6;
  const output = new Uint8ClampedArray(data.length);

  for (let y = 0; y < height; y += 1) {
    const up = y > 0 ? y - 1 : y;
    const down = y < height - 1 ? y + 1 : y;
    for (let x = 0; x < width; x += 1) {
      const left = x > 0 ? x - 1 : x;
      const right = x < width - 1 ? x + 1 : x;
      const index = (y * width + x) * 4;

      for (let channel = 0; channel < 3; channel += 1) {
        const center = data[index + channel];
        const average =
          (data[(up * width + x) * 4 + channel] +
            data[(down * width + x) * 4 + channel] +
            data[(y * width + left) * 4 + channel] +
            data[(y * width + right) * 4 + channel]) /
          4;
        output[index + channel] = center + (center - average) * k;
      }
      output[index + 3] = data[index + 3];
    }
  }

  return { width, height, data: output };
}

/** CSS filter string equivalent to our WebGL color maths (used as fallback). */
export function cssFilterFor(brightness: number, contrast: number, saturation: number, grayscale: boolean): string {
  const b = 1 + (brightness / 100) * 0.35;
  const c = 1 + (contrast / 100) * 0.75;
  const s = 1 + saturation / 100;
  return `brightness(${b.toFixed(3)}) contrast(${c.toFixed(3)}) saturate(${Math.max(0, s).toFixed(3)}) grayscale(${grayscale ? 1 : 0})`;
}
