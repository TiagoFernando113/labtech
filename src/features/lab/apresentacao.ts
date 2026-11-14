import { diaDaSemana, diasEntre, type DataCivil } from '@/core/datas';
import type { Textos } from '@/i18n/pt';
import type { Tom } from '@/ui/componentes';

import type { StatusCp } from './lab.repo';

const DIAS = { pt: ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'], es: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'] };

export const diaMes = (d: DataCivil) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** "Hoje", "Amanhã", "Ontem" ou "qui 26/11". */
export function dataCurta(d: DataCivil, hoje: DataCivil, t: Textos, idioma: 'pt' | 'es'): string {
  const dif = diasEntre(hoje, d);
  if (dif === 0) return t.comum.hoje;
  if (dif === 1) return t.comum.amanha;
  if (dif === -1) return t.comum.ontem;
  return `${DIAS[idioma][diaDaSemana(d)]} ${diaMes(d)}`;
}

export const diaSemanaCurto = (d: DataCivil, idioma: 'pt' | 'es') => DIAS[idioma][diaDaSemana(d)];

export const TOM_STATUS: Record<StatusCp, Tom> = {
  rompido: 'ok',
  atrasado: 'perigo',
  hoje: 'alerta',
  em_cura: 'destaque',
  moldado: 'neutro',
};

/** Hora local "14:32" de um instante ISO. */
export function horaLocal(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "13/11 14:32" no relógio do aparelho. */
export function dataHoraLocal(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${horaLocal(iso)}`;
}
