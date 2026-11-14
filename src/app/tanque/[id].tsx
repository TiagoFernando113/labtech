import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';

import { hoje as dataDeHoje } from '@/core/datas';
import { dataCurta, dataHoraLocal } from '@/features/lab/apresentacao';
import { listarCps, listarTanques, retirarDoTanque, rotuloCb, type MotivoSaida } from '@/features/lab/lab.repo';
import { siglaDe } from '@/features/obras/obras.repo';
import { fmt } from '@/i18n/fmt';
import { useApp } from '@/services/app';
import { useConsulta } from '@/services/consulta';
import { Aviso, Botao, Linha, Lista, Secao, Segmento, Selo, Sigla, Tela } from '@/ui/componentes';
import { useTema } from '@/ui/tema';

export default function TanqueDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, ctx, t, idioma, pode } = useApp();
  const tema = useTema();
  const hoje = dataDeHoje();
  const [versao, setVersao] = useState(0);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [motivo, setMotivo] = useState<MotivoSaida>('ensaio');
  const [erro, setErro] = useState(false);
  const dados = useConsulta(
    useCallback(async () => {
      void versao;
      return { tanque: (await listarTanques(db, hoje)).find((x) => x.id === id), cps: await listarCps(db, { tanqueId: id, limite: 1000 }) };
    }, [db, id, hoje, versao]),
  );
  const cps = (dados?.cps ?? []).slice().sort((a, b) => (a.data_rompimento < b.data_rompimento ? -1 : a.data_rompimento > b.data_rompimento ? 1 : 0));
  const podeMover = pode('tanques.registrar');
  const alternar = (cp: string) => setMarcados((a) => (a.includes(cp) ? a.filter((x) => x !== cp) : [...a, cp]));

  async function retirar() {
    setErro(false);
    try {
      await retirarDoTanque(db, ctx, marcados, motivo);
      setMarcados([]);
      setVersao((n) => n + 1);
    } catch {
      setErro(true);
    }
  }

  return (
    <Tela
      rodape={
        podeMover ? (
          marcados.length ? (
            <>
              <Segmento
                valor={motivo}
                aoMudar={setMotivo}
                opcoes={[
                  { valor: 'ensaio', rotulo: t.motivos.ensaio },
                  { valor: 'transporte', rotulo: t.motivos.transporte },
                  { valor: 'outro', rotulo: t.motivos.outro },
                ]}
              />
              <Botao titulo={`${t.tanques.retirar} (${marcados.length})`} icone="exit" onPress={retirar} />
            </>
          ) : (
            <Botao
              titulo={fmt(t.tanques.guardarEm, { tanque: dados?.tanque?.nome ?? '' })}
              icone="enter"
              onPress={() => router.push({ pathname: '/guardar', params: { tanque: id } })}
            />
          )
        ) : undefined
      }>
      <Stack.Screen options={{ title: dados?.tanque?.nome ?? t.tanques.titulo }} />
      {erro ? <Aviso texto={t.comum.erroSalvar} icone="alert-circle" cor="perigo" /> : null}
      <Secao
        titulo={fmt(t.tanques.cps, { n: cps.length })}
        acao={podeMover && cps.length ? (marcados.length === cps.length ? t.comum.limpar : t.comum.selecionarTodos) : undefined}
        aoTocar={() => setMarcados(marcados.length === cps.length ? [] : cps.map((c) => c.id))}
      />
      <Lista vazio={dados ? t.tanques.semCps : t.comum.carregando}>
        {cps.map((c) => {
          const vencido = c.data_rompimento < hoje;
          const marcado = marcados.includes(c.id);
          return (
            <Linha
              key={c.id}
              selecionada={marcado}
              esquerda={
                podeMover ? (
                  <Ionicons name={marcado ? 'checkbox' : 'square-outline'} size={26} color={marcado ? tema.primaria : tema.textoSuave} />
                ) : (
                  <Sigla texto={siglaDe({ sigla: c.obra_sigla, nome: c.obra_nome })} tamanho="p" />
                )
              }
              titulo={`${siglaDe({ sigla: c.obra_sigla, nome: c.obra_nome })} · NF ${c.nf} · CB ${rotuloCb(c.cb)}`}
              detalhe={`${fmt(t.comum.dias, { n: c.idade_dias })} · ${fmt(t.tanques.entrada, { data: c.entrada_tanque_em ? dataHoraLocal(c.entrada_tanque_em) : '' })}`}
              direita={
                <Selo
                  texto={fmt(t.tanques.sai, { data: dataCurta(c.data_rompimento, hoje, t, idioma) })}
                  tom={vencido ? 'perigo' : c.data_rompimento === hoje ? 'alerta' : 'neutro'}
                />
              }
              aoTocar={() => (podeMover ? alternar(c.id) : router.push({ pathname: '/cp/[id]', params: { id: c.id } }))}
            />
          );
        })}
      </Lista>
    </Tela>
  );
}
