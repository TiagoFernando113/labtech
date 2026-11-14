import { router } from 'expo-router';
import { useCallback, useState } from 'react';

import { hoje as dataDeHoje } from '@/core/datas';
import { formatarMpa } from '@/core/resistencia';
import { dataCurta } from '@/features/lab/apresentacao';
import { montarAgenda, rotuloCb, type Agenda } from '@/features/lab/lab.repo';
import { siglaDe } from '@/features/obras/obras.repo';
import { fmt } from '@/i18n/fmt';
import { useApp } from '@/services/app';
import { useConsulta } from '@/services/consulta';
import { Linha, Lista, Segmento, Selo, Sigla, Tela } from '@/ui/componentes';

type Aba = keyof Agenda;

export default function Rompimentos() {
  const { db, t, idioma } = useApp();
  const hoje = dataDeHoje();
  const agenda = useConsulta(useCallback(() => montarAgenda(db, hoje, 365), [db, hoje]));
  const [escolhida, setEscolhida] = useState<Aba | null>(null);
  // Abre na lista que pede atenção primeiro.
  const aba: Aba = escolhida ?? (agenda?.hoje.length ? 'hoje' : agenda?.atrasados.length ? 'atrasados' : 'hoje');
  const n = (a: Aba) => (agenda ? ` ${agenda[a].length}` : '');
  const grupos = agenda?.[aba] ?? [];

  return (
    <Tela>
      <Segmento
        valor={aba}
        aoMudar={setEscolhida}
        opcoes={[
          { valor: 'hoje', rotulo: t.romp.hoje + n('hoje') },
          { valor: 'atrasados', rotulo: t.romp.atrasados + n('atrasados') },
          { valor: 'proximos', rotulo: t.romp.proximos + n('proximos') },
          { valor: 'realizados', rotulo: t.romp.realizados },
        ]}
      />
      <Lista vazio={agenda ? t.romp.vazio : t.comum.carregando}>
        {grupos.map((g) => {
          const completo = g.rompidos === g.total;
          const tom = completo ? 'ok' : aba === 'atrasados' ? 'perigo' : aba === 'hoje' ? 'alerta' : 'neutro';
          const selo = completo
            ? `${formatarMpa(g.maior_mpa ?? 0)} MPa`
            : g.rompidos > 0
              ? fmt(t.romp.parcial, { r: g.rompidos, t: g.total })
              : dataCurta(g.data_rompimento, hoje, t, idioma);
          return (
            <Linha
              key={`${g.recebimento_id}-${g.idade_dias}`}
              esquerda={<Sigla texto={siglaDe({ sigla: g.obra_sigla, nome: g.obra_nome })} />}
              titulo={`NF ${g.nf} · ${fmt(t.comum.dias, { n: g.idade_dias })}`}
              detalhe={`${fmt(t.romp.cbs, { lista: g.cbs.map(rotuloCb).join(', ') })} · ${g.obra_nome}${completo ? ` · ${dataCurta(g.data_rompimento, hoje, t, idioma)}` : ''}`}
              direita={<Selo texto={selo} tom={tom} />}
              aoTocar={() => router.push({ pathname: '/romper', params: { recebimento: g.recebimento_id, idade: String(g.idade_dias) } })}
            />
          );
        })}
      </Lista>
    </Tela>
  );
}
