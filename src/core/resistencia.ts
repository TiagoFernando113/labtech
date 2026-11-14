/**
 * Resistência à compressão de corpos de prova cilíndricos.
 * Resistência individual = carga de ruptura ÷ área da seção. Não é o fck:
 * a resistência característica é uma estatística do lote, calculada à parte.
 */
export type UnidadeCarga = 'kN' | 'tf' | 'kgf' | 'N';

const PARA_KN: Record<UnidadeCarga, number> = {
  kN: 1,
  tf: 9.80665,
  kgf: 0.00980665,
  N: 0.001,
};

export function paraKn(valor: number, unidade: UnidadeCarga): number {
  return valor * PARA_KN[unidade];
}

/** Área da seção circular, em mm². */
export function areaMm2(diametroMm: number): number {
  if (!(diametroMm > 0)) throw new Error('Diâmetro inválido');
  return (Math.PI * diametroMm * diametroMm) / 4;
}

/** Resistência individual em MPa (N/mm²), a partir da carga em kN e do diâmetro em mm. */
export function resistenciaMpa(cargaKn: number, diametroMm: number): number {
  if (!(cargaKn > 0)) throw new Error('Carga inválida');
  return (cargaKn * 1000) / areaMm2(diametroMm);
}

export const arredondar = (n: number, casas = 1) => Math.round(n * 10 ** casas) / 10 ** casas;

/** Aceita vírgula ou ponto; devolve `null` se não for um número positivo. */
export function lerNumero(texto: string): number | null {
  const n = Number(texto.trim().replace(/\./g, (_, i, s) => (s.includes(',') ? '' : '.')).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function formatarMpa(mpa: number): string {
  return arredondar(mpa, 1).toFixed(1).replace('.', ',');
}

export function media(valores: number[]): number | null {
  return valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null;
}
