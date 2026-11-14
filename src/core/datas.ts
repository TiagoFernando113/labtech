/**
 * Datas civis ("AAAA-MM-DD"), sem horário nem fuso.
 * Datas de moldagem e de rompimento são guardadas assim: o dia combinado
 * não muda se o aparelho trocar de fuso ou de horário de verão.
 */
export type DataCivil = string;

const FORMATO = /^(\d{4})-(\d{2})-(\d{2})$/;
const p2 = (n: number) => String(n).padStart(2, '0');

export function dataCivilValida(s: string): s is DataCivil {
  const m = FORMATO.exec(s);
  if (!m) return false;
  const [a, me, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(a, me - 1, d));
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === me - 1 && dt.getUTCDate() === d;
}

function paraUTC(s: DataCivil): number {
  if (!dataCivilValida(s)) throw new Error(`Data inválida: ${s}`);
  const [a, m, d] = s.split('-').map(Number);
  return Date.UTC(a, m - 1, d);
}

function deUTC(ms: number): DataCivil {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
}

/** Soma dias de calendário. A conta é feita em UTC, onde todo dia tem 24 h. */
export function somarDias(data: DataCivil, dias: number): DataCivil {
  return deUTC(paraUTC(data) + dias * 86_400_000);
}

/** Dias de calendário de `de` até `ate` (negativo se `ate` for anterior). */
export function diasEntre(de: DataCivil, ate: DataCivil): number {
  return Math.round((paraUTC(ate) - paraUTC(de)) / 86_400_000);
}

/** Dia da semana: 0 = domingo … 6 = sábado. */
export function diaDaSemana(data: DataCivil): number {
  return new Date(paraUTC(data)).getUTCDay();
}

/** Data civil no relógio local do aparelho (o "hoje" de quem está na obra). */
export function hoje(agora: Date = new Date()): DataCivil {
  return `${agora.getFullYear()}-${p2(agora.getMonth() + 1)}-${p2(agora.getDate())}`;
}

/** Datas previstas de rompimento, calculadas uma única vez na moldagem e então gravadas. */
export function datasDeRompimento(moldagem: DataCivil, idades: number[]): { idade: number; data: DataCivil }[] {
  return [...new Set(idades)]
    .filter((i) => Number.isInteger(i) && i > 0)
    .sort((a, b) => a - b)
    .map((idade) => ({ idade, data: somarDias(moldagem, idade) }));
}

export function formatarData(data: DataCivil): string {
  const [a, m, d] = data.split('-');
  return `${d}/${m}/${a}`;
}
