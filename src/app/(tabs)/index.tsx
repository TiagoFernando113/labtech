import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';

import { hoje as dataDeHoje } from '@/core/datas';
import { formatarMpa } from '@/core/resistencia';
import { dataCurta, dataHoraLocal, diaMes, diaSemanaCurto } from '@/features/lab/apresentacao';
import { atividadesRecentes, lerIndicadores, montarAgenda, previsaoPorDia, rotuloCb, type Atividade, type GrupoAgenda } from '@/features/lab/lab.repo';
import { siglaDe } from '@/features/obras/obras.repo';
import { fmt } from '@/i18n/fmt';
import { useApp } from '@/services/app';
import { useConsulta } from '@/services/consulta';
import { Aviso, Botao, Kpi, Linha, Lista, Secao, Selo, Sigla, Tela, Texto, type NomeIcone } from '@/ui/componentes';
import { Espaco, Raio, useTema } from '@/ui/tema';

function Atalho({ titulo, icone, aoTocar }: { titulo: string; icone: NomeIcone; aoTocar: () => void }) {
  const tema = useTema();
  return (
    <Pressable
      onPress={aoTocar}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexBasis: '30%',
        flexGrow: 1,
        minHeight: 72,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        padding: 8,
        borderRadius: Raio.m,
        borderWidth: 1,
        borderColor: tema.borda,
        backgroundColor: tema.superficie,
        opacity: pressed ? 0.7 : 1,
      })}>
      <Ionicons name={icone} size={24} color={tema.primaria} />
      <Text numberOfLines={2} style={{ color: tema.texto, fontSize: 12.5, fontWeight: '700', textAlign: 'center' }}>
        {titulo}
      </Text>
    </Pressable>
  );
}

export default function Painel() {
  const { db, t, idioma, modoLocal, pode, empresaNome, papel, nome } = useApp();
  const tema = useTema();
  const hoje = dataDeHoje();
  const dados = useConsulta(
    useCallback(async () => {
      const [ind, agenda, semana, atividades] = await Promise.all([
        lerIndicadores(db, hoje),
        montarAgenda(db, hoje),
        previsaoPorDia(db, hoje, 7),
        atividadesRecentes(db, 8),
      ]);
      return { ind, agenda, semana, atividades };
    }, [db, hoje]),
  );
  const i = dados?.ind;
  const v = (n: number | undefined) => n ?? '–';
  const proximos: (GrupoAgenda & { tom: 'perigo' | 'alerta' | 'neutro' })[] = dados
    ? [
        ...dados.agenda.atrasados.map((g) => ({ ...g, tom: 'perigo' as const })),
        ...dados.agenda.hoje.filter((g) => g.rompidos < g.total).map((g) => ({ ...g, tom: 'alerta' as const })),
        ...dados.agenda.proximos.map((g) => ({ ...g, tom: 'neutro' as const })),
      ].slice(0, 6)
    : [];
  const maximo = Math.max(1, ...(dados?.semana.map((d) => d.pendentes) ?? [1]));
  const irRompimentos = () => router.push('/rompimentos');

  const descrever = (a: Atividade) =>
    a.tipo === 'recebimento'
      ? fmt(t.painel.atRecebimento, { nf: a.nf, n: a.total_cps ?? 0 })
      : fmt(a.tipo === 'rompimento' ? t.painel.atRompimento : a.tipo === 'entrada' ? t.painel.atEntrada : t.painel.atSaida, {
          nf: a.nf,
          cb: rotuloCb(a.cb ?? 0),
          mpa: a.mpa ? formatarMpa(a.mpa) : '',
          tanque: a.tanque_nome ?? '',
        });
  const ICONE: Record<Atividade['tipo'], NomeIcone> = { recebimento: 'document-text', rompimento: 'checkmark-done', entrada: 'enter', saida: 'exit' };

  return (
    <Tela>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: Espaco.m }}>
        <View style={{ flex: 1 }}>
          <Texto tipo="subtitulo">{nome ? `${t.painel.ola}, ${nome.split(' ')[0]}` : t.painel.ola}</Texto>
          <Texto tipo="pequeno" cor="textoSuave">
            {[empresaNome, papel ? t.papeis[papel] : null].filter(Boolean).join(' · ') || t.app.subtitulo}
          </Texto>
        </View>
        <Texto tipo="pequeno" cor="textoSuave">
          {`${diaSemanaCurto(hoje, idioma)} ${diaMes(hoje)}`}
        </Texto>
      </View>

      {modoLocal ? <Aviso texto={t.painel.avisoLocal} icone="phone-portrait" /> : null}
      {i && i.obrasAtivas === 0 ? (
        <>
          <Aviso texto={t.painel.semObra} icone="business" cor="primaria" />
          {pode('obras.gerenciar') ? <Botao titulo={t.painel.novaObra} icone="add-circle" onPress={() => router.push('/obra/nova')} /> : null}
        </>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Espaco.p }}>
        <Kpi valor={v(i?.hoje)} legenda={t.painel.hoje} tom="alerta" aoTocar={irRompimentos} />
        <Kpi valor={v(i?.atrasados)} legenda={t.painel.atrasados} tom="perigo" aoTocar={irRompimentos} />
        <Kpi valor={v(i?.aguardando)} legenda={t.painel.aguardando} aoTocar={irRompimentos} />
        <Kpi valor={v(i?.emCura)} legenda={t.painel.emCura} tom="destaque" aoTocar={() => router.push('/tanques')} />
        <Kpi valor={v(i?.cps)} legenda={t.painel.cps} aoTocar={() => router.push('/cps')} />
        <Kpi valor={v(i?.recebimentos)} legenda={t.painel.recebimentos} />
        <Kpi valor={v(i?.obrasAtivas)} legenda={t.painel.obrasAtivas} aoTocar={() => router.push('/obras')} />
        <Kpi valor={v(i?.pendentesEnvio)} legenda={t.painel.pendentesEnvio} />
      </View>

      <Secao titulo={t.painel.atalhos} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Espaco.p }}>
        {pode('cps.identificar') ? <Atalho titulo={t.painel.novoRecebimento} icone="add-circle" aoTocar={() => router.push('/recebimento/novo')} /> : null}
        <Atalho titulo={t.painel.localizarCp} icone="search" aoTocar={() => router.push('/cps')} />
        <Atalho titulo={t.painel.rompimentos} icone="calendar" aoTocar={irRompimentos} />
        <Atalho titulo={t.painel.tanques} icone="water" aoTocar={() => router.push('/tanques')} />
        <Atalho titulo={t.painel.obras} icone="business" aoTocar={() => router.push('/obras')} />
        <Atalho titulo={t.painel.calculadora} icone="calculator" aoTocar={() => router.push('/calculadora')} />
      </View>

      <Secao titulo={t.painel.semana} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, backgroundColor: tema.superficie, borderColor: tema.borda, borderWidth: 1, borderRadius: Raio.m, padding: Espaco.m }}>
        {(dados?.semana ?? []).map((d, k) => (
          <View key={d.data} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <Text style={{ color: d.pendentes ? tema.texto : tema.textoSuave, fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{d.pendentes}</Text>
            <View style={{ width: '100%', height: 56, justifyContent: 'flex-end' }}>
              <View
                style={{
                  height: Math.max(3, Math.round((d.pendentes / maximo) * 56)),
                  borderRadius: 4,
                  backgroundColor: d.pendentes === 0 ? tema.borda : k === 0 ? tema.alerta : tema.primaria,
                }}
              />
            </View>
            <Text style={{ color: k === 0 ? tema.texto : tema.textoSuave, fontSize: 11, fontWeight: k === 0 ? '800' : '600' }}>
              {k === 0 ? t.comum.hoje : diaSemanaCurto(d.data, idioma)}
            </Text>
            <Text style={{ color: tema.textoSuave, fontSize: 10 }}>{diaMes(d.data)}</Text>
          </View>
        ))}
      </View>

      <Secao titulo={t.painel.proximos} acao={t.painel.verTodos} aoTocar={irRompimentos} />
      <Lista vazio={dados ? t.painel.semCompromisso : t.comum.carregando}>
        {proximos.map((g) => (
          <Linha
            key={`${g.recebimento_id}-${g.idade_dias}`}
            esquerda={<Sigla texto={siglaDe({ sigla: g.obra_sigla, nome: g.obra_nome })} />}
            titulo={`NF ${g.nf} · ${fmt(t.comum.dias, { n: g.idade_dias })}`}
            detalhe={`${fmt(t.romp.cbs, { lista: g.cbs.map(rotuloCb).join(', ') })} · ${g.obra_nome}`}
            direita={<Selo texto={dataCurta(g.data_rompimento, hoje, t, idioma)} tom={g.tom} />}
            aoTocar={() => router.push({ pathname: '/romper', params: { recebimento: g.recebimento_id, idade: String(g.idade_dias) } })}
          />
        ))}
      </Lista>

      <Secao titulo={t.painel.atividades} />
      <Lista vazio={dados ? t.painel.semAtividade : t.comum.carregando}>
        {(dados?.atividades ?? []).map((a, k) => (
          <Linha
            key={k}
            esquerda={
              <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: tema.faixa }}>
                <Ionicons name={ICONE[a.tipo]} size={18} color={tema.primaria} />
              </View>
            }
            titulo={`${siglaDe({ sigla: a.obra_sigla, nome: a.obra_nome })} · ${descrever(a)}`}
            detalhe={[dataHoraLocal(a.em), a.por_nome ? fmt(t.comum.por, { nome: a.por_nome }) : null].filter(Boolean).join(' · ')}
            aoTocar={() =>
              a.cp_id
                ? router.push({ pathname: '/cp/[id]', params: { id: a.cp_id } })
                : router.push({ pathname: '/recebimento/[id]', params: { id: a.recebimento_id } })
            }
          />
        ))}
      </Lista>
    </Tela>
  );
}
