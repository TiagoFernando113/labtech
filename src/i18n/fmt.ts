/** Troca {chave} pelos valores: fmt('{n} CPs', { n: 6 }) → '6 CPs'. */
export function fmt(modelo: string, valores: Record<string, string | number>): string {
  return modelo.replace(/\{(\w+)\}/g, (_, k: string) => String(valores[k] ?? ''));
}
