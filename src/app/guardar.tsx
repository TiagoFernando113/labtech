import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';

import { hoje as dataDeHoje } from '@/core/datas';
import { dataCurta, diaMes } from '@/features/lab/apresentacao';
import { guardarNoTanque, listarCps, listarTanques, rotuloCb } from '@/features/lab/lab.repo';
import { siglaDe } from '@/features/obras/obras.repo';
import { fmt } from '@/i18n/fmt';
import { useApp } from '@/services/app';
import { useConsulta } from '@/services/consulta';
import { Aviso, Botao, Linha, Lista, Pastilhas, Secao, Tela } from '@/ui/componentes';
import { useTema } from '@/ui/tema';

/** Entrada em lote: escolhe os CPs que estão fora dos tanques e o tanque de destino. */
export default function Guardar() {
  const params = useLocalSearchParams<{ tanque?: string; recebimento?: string }>();
  const { db, ctx, t, idioma, pode } = useApp();
  const tema = useTema();
  const hoje = dataDeHoje();
  const dados = useConsulta(
    useCallback(
      async () => ({
        tanques: await listarTanques(db, hoje),
        cps: await listarCps(db, { foraDoTanque: true, recebimentoId: params.recebimento, limite: 1000 }),
      }),
      [db, hoje, params.recebimento],
    ),
  );
  const [tanque, setTanque] = useState<string | null>(params.tanque ?? null);
  const [escolha, setEscolha] = useState<string[] | null>(null);
  const [erro, setErro] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const cps = dados?.cps ?? [];
  // Vindo de um recebimento, todos os CPs dele já chegam marcados.
  const marcados = escolha ?? (params.recebimento ? cps.map((c) => c.id) : []);
  const alternar = (id: string) => setEscolha(marcados.includes(id) ? marcados.filter((x) => x !== id) : [...marcados, id]);

  if (!pode('tanques.registrar')) {
    return (
      <Tela>
        <Aviso texto={t.comum.semPermissao} icone="lock-closed" cor="perigo" />
      </Tela>
    );
  }

  async function salvar() {
    if (!tanque) return;
    setSalvando(true);
    setErro(false);
    try {
      await guardarNoTanque(db, ctx, marcados, tanque);
      router.back();
    } catch {
      setErro(true);
      setSalvando(false);
    }
  }
  const nomeTanque = dados?.tanques.find((x) => x.id === tanque)?.nome;

  return (
    <Tela
      rodape={
        <Botao
          titulo={nomeTanque ? `${fmt(t.tanques.guardarEm, { tanque: nomeTanque })} (${marcados.length})` : t.tanques.escolha}
          icone="enter"
          onPress={salvar}
          desabilitado={salvando || !tanque || !marcados.length}
        />
      }>
      {erro ? <Aviso texto={t.comum.erroSalvar} icone="alert-circle" cor="perigo" /> : null}
      <Secao titulo={t.tanques.escolha} />
      <Pastilhas
        opcoes={(dados?.tanques ?? []).map((x) => ({ valor: x.id, rotulo: `${x.nome} · ${x.quantidade}` }))}
        selecionadas={tanque ? [tanque] : []}
        aoTocar={setTanque}
      />
      <Secao
        titulo={t.tanques.foraTitulo}
        contador={cps.length}
        acao={cps.length ? (marcados.length === cps.length ? t.comum.limpar : t.comum.selecionarTodos) : undefined}
        aoTocar={() => setEscolha(marcados.length === cps.length ? [] : cps.map((c) => c.id))}
      />
      <Lista vazio={dados ? t.tanques.semFora : t.comum.carregando}>
        {cps.map((c) => {
          const marcado = marcados.includes(c.id);
          return (
            <Linha
              key={c.id}
              selecionada={marcado}
              esquerda={<Ionicons name={marcado ? 'checkbox' : 'square-outline'} size={26} color={marcado ? tema.primaria : tema.textoSuave} />}
              titulo={`${siglaDe({ sigla: c.obra_sigla, nome: c.obra_nome })} · NF ${c.nf} · CB ${rotuloCb(c.cb)}`}
              detalhe={`${fmt(t.comum.dias, { n: c.idade_dias })} · ${diaMes(c.data_moldagem)} → ${dataCurta(c.data_rompimento, hoje, t, idioma)}`}
              direita={<></>}
              aoTocar={() => alternar(c.id)}
            />
          );
        })}
      </Lista>
    </Tela>
  );
}
