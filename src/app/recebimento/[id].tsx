import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { formatarData, hoje as dataDeHoje } from '@/core/datas';
import { formatarMpa } from '@/core/resistencia';
import { dataCurta, TOM_STATUS } from '@/features/lab/apresentacao';
import { adicionarFoto, buscarRecebimento, listarCps, listarFotos, rotuloCb, statusCp } from '@/features/lab/lab.repo';
import { siglaDe } from '@/features/obras/obras.repo';
import { fmt } from '@/i18n/fmt';
import { useApp } from '@/services/app';
import { useConsulta } from '@/services/consulta';
import { Botao, Cartao, Dado, FotoAmpliada, Galeria, Linha, Lista, Secao, Selo, Sigla, Tela, Texto } from '@/ui/componentes';
import { BotaoFoto } from '@/ui/foto';
import { Espaco } from '@/ui/tema';

export default function RecebimentoDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, ctx, t, idioma, pode } = useApp();
  const hoje = dataDeHoje();
  const [versao, setVersao] = useState(0);
  const [aberta, setAberta] = useState<string | null>(null);
  const dados = useConsulta(
    useCallback(async () => {
      void versao;
      const [r, cps, fotos] = await Promise.all([buscarRecebimento(db, id), listarCps(db, { recebimentoId: id }), listarFotos(db, 'recebimentos', id)]);
      return { r, cps, fotos };
    }, [db, id, versao]),
  );
  const r = dados?.r;
  if (!r) return <Tela>{dados ? <Texto cor="textoSuave">{t.recebimento.semRecebimentos}</Texto> : <Texto cor="textoSuave">{t.comum.carregando}</Texto>}</Tela>;
  const num = (n: number | null, sufixo = '') => (n === null ? null : `${String(n).replace('.', ',')}${sufixo}`);
  const fora = dados.cps.filter((c) => c.mpa === null && !c.tanque_id).length;

  return (
    <Tela
      rodape={
        fora > 0 && pode('tanques.registrar') ? (
          <Botao titulo={t.recebimento.guardar} icone="enter" onPress={() => router.push({ pathname: '/guardar', params: { recebimento: r.id } })} />
        ) : undefined
      }>
      <Cartao style={{ gap: Espaco.m }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Espaco.m }}>
          <Sigla texto={siglaDe({ sigla: r.obra_sigla, nome: r.obra_nome })} tamanho="g" />
          <View style={{ flex: 1 }}>
            <Texto tipo="subtitulo">{`NF ${r.nf}`}</Texto>
            <Texto tipo="pequeno" cor="textoSuave">
              {r.obra_nome}
            </Texto>
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Espaco.m }}>
          <Dado rotulo={t.obras.cliente} valor={r.cliente} />
          <Dado rotulo={t.recebimento.dataMoldagem} valor={formatarData(r.data_moldagem)} />
          <Dado rotulo={t.recebimento.caminhao} valor={r.caminhao} />
          <Dado rotulo={t.recebimento.concreteira} valor={r.concreteira} />
          <Dado rotulo={t.recebimento.fck} valor={num(r.fck)} />
          <Dado rotulo={t.recebimento.volume} valor={num(r.volume_m3)} />
          <Dado rotulo={t.recebimento.slumpEsp} valor={num(r.slump_especificado)} />
          <Dado rotulo={t.recebimento.slumpMed} valor={num(r.slump_medido)} />
          <Dado rotulo={t.recebimento.horarios} valor={[r.hora_chegada, r.hora_inicio, r.hora_fim].filter(Boolean).join(' · ')} />
          <Dado rotulo={t.recebimento.peca} valor={r.peca} />
          <Dado rotulo={t.recebimento.registradoPor} valor={r.criado_por_nome} />
          {r.observacao ? <Dado rotulo={t.comum.observacoes} valor={r.observacao} /> : null}
        </View>
      </Cartao>

      <Secao titulo={t.comum.fotos} contador={dados.fotos.length} />
      <Galeria fotos={dados.fotos.map((f) => f.dados)} aoAbrir={(i) => setAberta(dados.fotos[i].dados)} />
      {pode('fotos.registrar') ? (
        <BotaoFoto
          titulo={t.comum.adicionarFoto}
          aoCapturar={async (f) => {
            await adicionarFoto(db, ctx, 'recebimentos', r.id, f);
            setVersao((n) => n + 1);
          }}
        />
      ) : null}

      <Secao titulo={t.recebimento.cps} contador={dados.cps.length} />
      <Lista>
        {dados.cps.map((c) => {
          const s = statusCp(c, hoje);
          return (
            <Linha
              key={c.id}
              titulo={`CB ${rotuloCb(c.cb)} · ${fmt(t.comum.dias, { n: c.idade_dias })}`}
              detalhe={`${dataCurta(c.data_rompimento, hoje, t, idioma)} · ${formatarData(c.data_rompimento)}${c.tanque_nome ? ` · ${c.tanque_nome}` : ''}`}
              direita={<Selo texto={c.mpa !== null ? `${formatarMpa(c.mpa)} MPa` : t.cp[s]} tom={TOM_STATUS[s]} />}
              aoTocar={() => router.push({ pathname: '/cp/[id]', params: { id: c.id } })}
            />
          );
        })}
      </Lista>
      <FotoAmpliada foto={aberta} aoFechar={() => setAberta(null)} />
    </Tela>
  );
}
