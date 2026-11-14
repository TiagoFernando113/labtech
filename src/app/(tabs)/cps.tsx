import { router } from 'expo-router';
import { useCallback, useState } from 'react';

import { hoje as dataDeHoje } from '@/core/datas';
import { formatarMpa } from '@/core/resistencia';
import { dataCurta, diaMes, TOM_STATUS } from '@/features/lab/apresentacao';
import { listarCps, rotuloCb, statusCp } from '@/features/lab/lab.repo';
import { siglaDe } from '@/features/obras/obras.repo';
import { fmt } from '@/i18n/fmt';
import { useApp } from '@/services/app';
import { useConsulta } from '@/services/consulta';
import { Botao, Linha, Lista, Pesquisa, Segmento, Selo, Sigla, Tela } from '@/ui/componentes';

type Filtro = 'todos' | 'pendentes' | 'emCura' | 'rompidos';

export default function Cps() {
  const { db, t, idioma, pode } = useApp();
  const hoje = dataDeHoje();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const todos = useConsulta(useCallback(() => listarCps(db, { busca }), [db, busca]));
  const cps = todos?.filter((c) => {
    const s = statusCp(c, hoje);
    if (filtro === 'pendentes') return s !== 'rompido';
    if (filtro === 'emCura') return c.tanque_id !== null;
    if (filtro === 'rompidos') return s === 'rompido';
    return true;
  });

  return (
    <Tela
      rodape={
        pode('cps.identificar') ? <Botao titulo={t.recebimento.novo} icone="add-circle" onPress={() => router.push('/recebimento/novo')} /> : undefined
      }>
      <Pesquisa valor={busca} aoMudar={setBusca} dica={t.cp.buscar} />
      <Segmento
        valor={filtro}
        aoMudar={setFiltro}
        opcoes={[
          { valor: 'todos', rotulo: t.cp.todos },
          { valor: 'pendentes', rotulo: t.cp.pendentes },
          { valor: 'emCura', rotulo: t.cp.emCura },
          { valor: 'rompidos', rotulo: t.cp.rompidos },
        ]}
      />
      <Lista vazio={cps === undefined ? t.comum.carregando : busca || filtro !== 'todos' ? t.cp.vazioBusca : t.cp.vazio}>
        {(cps ?? []).map((c) => {
          const s = statusCp(c, hoje);
          return (
            <Linha
              key={c.id}
              esquerda={<Sigla texto={siglaDe({ sigla: c.obra_sigla, nome: c.obra_nome })} />}
              titulo={`NF ${c.nf} · CB ${rotuloCb(c.cb)}`}
              detalhe={`${fmt(t.comum.dias, { n: c.idade_dias })} · ${diaMes(c.data_moldagem)} → ${dataCurta(c.data_rompimento, hoje, t, idioma)}${c.tanque_nome ? ` · ${c.tanque_nome}` : ''}`}
              direita={<Selo texto={c.mpa !== null ? `${formatarMpa(c.mpa)} MPa` : t.cp[s]} tom={TOM_STATUS[s]} />}
              aoTocar={() => router.push({ pathname: '/cp/[id]', params: { id: c.id } })}
            />
          );
        })}
      </Lista>
    </Tela>
  );
}
