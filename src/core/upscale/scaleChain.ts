/**
 * The ESRGAN-Slim models are released at 2x, 3x and 4x. Bigger factors are
 * composed by chaining passes (e.g. 8x = 4x then 2x) with real neural
 * inference at every step — never a single bicubic stretch.
 */
export const MODEL_FACTORS = [4, 3, 2] as const;

export function planScaleChain(scale: number): number[] {
  if (!Number.isFinite(scale) || scale < 2) {
    throw new Error(`Escala inválida: ${scale}. Use um fator inteiro maior ou igual a 2.`);
  }
  const target = Math.round(scale);
  if (Math.abs(target - scale) > 1e-6) {
    throw new Error('A escala precisa ser um número inteiro (2×, 3×, 4×...).');
  }

  // Breadth-first search for the shortest chain of model passes.
  const queue: Array<{ product: number; chain: number[] }> = [{ product: 1, chain: [] }];
  const visited = new Set<number>([1]);

  while (queue.length) {
    const current = queue.shift()!;
    if (current.product === target) return current.chain;
    if (current.chain.length >= 3) continue;
    for (const factor of MODEL_FACTORS) {
      const product = current.product * factor;
      if (product > target) continue;
      if (visited.has(product)) continue;
      visited.add(product);
      queue.push({ product, chain: [...current.chain, factor] });
    }
  }

  throw new Error(`A IA local não consegue atingir ${target}× com os modelos disponíveis (2×, 3×, 4×).`);
}

export function chainLabel(chain: number[]): string {
  return chain.map((factor) => `${factor}×`).join(' + ');
}

export function totalChainScale(chain: number[]): number {
  return chain.reduce((total, factor) => total * factor, 1);
}
