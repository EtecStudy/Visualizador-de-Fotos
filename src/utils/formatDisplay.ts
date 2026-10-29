const numberFormatter = new Intl.NumberFormat('pt-BR');

export function formatNumber(value: number): string {
  return numberFormatter.format(Math.round(value));
}

export function formatDimensions(width: number, height: number): string {
  return `${formatNumber(width)} × ${formatNumber(height)}`;
}

export function formatMegapixels(width: number, height: number): string {
  const megapixels = (width * height) / 1_000_000;
  if (megapixels < 1) return `${Math.round(width * height).toLocaleString('pt-BR')} px`;
  return `${megapixels.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MP`;
}

