import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { formatarData, hoje as dataDeHoje } from '@/core/datas';
import { formatarMpa } from '@/core/resistencia';
import { dataHoraLocal, TOM_STATUS } from '@/features/lab/apresentacao';
import { adicionarFoto, buscarCp, historicoDoCp, listarFotos, rotuloCb, statusCp, type EventoCp } from '@/features/lab/lab.repo';
import { siglaDe } from '@/features/obras/obras.repo';
import { fmt } from '@/i18n/fmt';
import { useApp } from '@/services/app';
import { useConsulta } from '@/services/consulta';
import { Botao, Cartao, Dado, FotoAmpliada, Galeria, Secao, Selo, Sigla, Tela, Texto, type NomeIcone } from '@/ui/componentes';
import { BotaoFoto } from '@/ui/foto';
import { Espaco, useTema } from '@/ui/tema';

const ICONE: Record<EventoCp['tipo'], NomeIcone> = {
  moldagem: 'cube',
  entrada: 'enter',
  saida: 'exit',
  rompimento: 'checkmark-done',
  correcao: 'create',
  foto: 'camera',
};

export default function FichaCp() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, ctx, t, pode } = useApp();
  const tema = useTema();
  const hoje = dataDeHoje();
  const [versao, setVersao] = useState(0);
  const [aberta, setAberta] = useState<string | null>(null);
  const dados = useConsulta(
    useCallback(async () => {
      void versao;
      const cp = await buscarCp(db, id);
      if (!cp) return { cp: null, fotos: [], fotosLote: [], eventos: [] };
      const [fotos, fotosLote, eventos] = await Promise.all([
        listarFotos(db, 'corpos_de_prova', id),
        listarFotos(db, 'recebimentos', cp.recebimento_id),
        historicoDoCp(db, cp),
      ]);
      return { cp, fotos, fotosLote, eventos };
    }, [db, id, versao]),
  );
  const cp = dados?.cp;
  if (!cp) return <Tela>{<Texto cor="textoSuave">{dados ? t.cp.vazioBusca : t.comum.carregando}</Texto>}</Tela>;
  const s = statusCp(cp, hoje);
  const todasFotos = [...dados.fotos, ...dados.fotosLote].map((f) => f.dados);

  const descrever = (e: EventoCp) =>
    e.tipo === 'moldagem'
      ? t.cp.evMoldagem
      : e.tipo === 'entrada'
        ? fmt(t.cp.evEntrada, { tanque: e.tanque_nome ?? '' })
        : e.tipo === 'saida'
          ? fmt(t.cp.evSaida, { tanque: e.tanque_nome ?? '', motivo: t.motivos[(e.motivo ?? 'outro') as keyof typeof t.motivos] ?? e.motivo ?? '' })
          : e.tipo === 'rompimento'
            ? fmt(t.cp.evRompimento, { mpa: formatarMpa(e.mpa ?? 0) })
            : e.tipo === 'correcao'
              ? fmt(t.cp.evCorrecao, { mpa: formatarMpa(e.mpa ?? 0), antes: formatarMpa(e.mpa_anterior ?? 0) })
              : t.cp.evFoto;

  return (
    <Tela
      rodape={
        pode('ensaios.registrar') ? (
          <Botao
            titulo={t.cp.registrarRompimento}
            icone="speedometer"
            variante={cp.mpa === null ? 'primario' : 'secundario'}
            onPress={() => router.push({ pathname: '/romper', params: { recebimento: cp.recebimento_id, idade: String(cp.idade_dias) } })}
          />
        ) : undefined
      }>
      <Cartao style={{ gap: Espaco.m }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Espaco.m }}>
          <Sigla texto={siglaDe({ sigla: cp.obra_sigla, nome: cp.obra_nome })} tamanho="g" />
          <View style={{ flex: 1, gap: 4 }}>
            <Texto tipo="subtitulo">{`CB ${rotuloCb(cp.cb)} · NF ${cp.nf}`}</Texto>
            <Selo texto={cp.mpa !== null ? `${t.cp.rompido} · ${formatarMpa(cp.mpa)} MPa` : t.cp[s]} tom={TOM_STATUS[s]} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Espaco.m }}>
          <Dado rotulo={t.recebimento.obra} valor={cp.obra_nome} />
          <Dado rotulo={t.obras.cliente} valor={cp.cliente} />
          <Dado rotulo={t.cp.moldagem} valor={formatarData(cp.data_moldagem)} />
          <Dado rotulo={t.cp.idade} valor={fmt(t.comum.dias, { n: cp.idade_dias })} />
          <Dado rotulo={t.cp.rompimentoPrevisto} valor={formatarData(cp.data_rompimento)} />
          <Dado rotulo={t.cp.tanque} valor={cp.tanque_nome ?? (cp.mpa === null ? t.cp.foraDoTanque : null)} />
          <Dado rotulo={t.recebimento.caminhao} valor={cp.caminhao} />
          <Dado rotulo={t.cp.moldadoPor} valor={cp.moldado_por_nome} />
        </View>
        <Botao
          titulo={t.cp.verRecebimento}
          icone="document-text"
          variante="secundario"
          onPress={() => router.push({ pathname: '/recebimento/[id]', params: { id: cp.recebimento_id } })}
        />
      </Cartao>

      {cp.mpa !== null ? (
        <>
          <Secao titulo={t.cp.resultado} />
          <Cartao style={{ gap: Espaco.m }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Espaco.m }}>
              <Dado rotulo={t.cp.resistencia} valor={`${formatarMpa(cp.mpa)} MPa`} />
              <Dado rotulo={t.cp.carga} valor={`${String(Math.round((cp.carga_kn ?? 0) * 100) / 100).replace('.', ',')} kN`} />
              <Dado rotulo={t.romp.molde} valor={cp.diametro_mm === 150 ? t.romp.m150 : t.romp.m100} />
              <Dado rotulo={t.cp.rompidoPor} valor={cp.rompido_por_nome} />
              {cp.observacao_ensaio ? <Dado rotulo={t.comum.observacoes} valor={cp.observacao_ensaio} /> : null}
            </View>
          </Cartao>
        </>
      ) : null}

      <Secao titulo={t.comum.fotos} contador={todasFotos.length} />
      <Galeria fotos={todasFotos} aoAbrir={(i) => setAberta(todasFotos[i])} />
      {pode('fotos.registrar') ? (
        <BotaoFoto
          titulo={t.comum.adicionarFoto}
          aoCapturar={async (f) => {
            await adicionarFoto(db, ctx, 'corpos_de_prova', cp.id, f);
            setVersao((n) => n + 1);
          }}
        />
      ) : null}

      <Secao titulo={t.cp.historico} />
      <Cartao style={{ gap: 0, paddingVertical: Espaco.p }}>
        {dados.eventos.map((e, k) => (
          <View key={k} style={{ flexDirection: 'row', gap: Espaco.m, paddingVertical: 8 }}>
            <View style={{ alignItems: 'center', width: 30 }}>
              <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: tema.primariaSuave }}>
                <Ionicons name={ICONE[e.tipo]} size={15} color={tema.primaria} />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: tema.texto, fontSize: 15, fontWeight: '700' }}>{descrever(e)}</Text>
              <Text style={{ color: tema.textoSuave, fontSize: 13 }}>
                {[dataHoraLocal(e.em), e.por_nome ? fmt(t.comum.por, { nome: e.por_nome }) : null].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </View>
        ))}
      </Cartao>
      <FotoAmpliada foto={aberta} aoFechar={() => setAberta(null)} />
    </Tela>
  );
}
