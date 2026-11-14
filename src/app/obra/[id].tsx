import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Switch, View } from 'react-native';

import { formatarData } from '@/core/datas';
import { listarRecebimentos } from '@/features/lab/lab.repo';
import { alterarObra, buscarObra, criarObra, ErroValidacao, excluirObra, siglaDe, sugerirSigla, type Obra } from '@/features/obras/obras.repo';
import { fmt } from '@/i18n/fmt';
import { useApp } from '@/services/app';
import { useConsulta } from '@/services/consulta';
import { Aviso, Botao, Campo, Cartao, Dado, Linha, Lista, Secao, Selo, Sigla, Tela, Texto } from '@/ui/componentes';
import { ALVO_TOQUE, Espaco } from '@/ui/tema';

export default function ObraDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const nova = id === 'nova';
  const { db, ctx, t, pode } = useApp();
  const gerencia = pode('obras.gerenciar');
  const [obra, setObra] = useState<Obra | null>(null);
  const [editando, setEditando] = useState(nova);
  const [nome, setNome] = useState('');
  const [sigla, setSigla] = useState('');
  const [cliente, setCliente] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [endereco, setEndereco] = useState('');
  const [ativa, setAtiva] = useState(true);
  const [erroNome, setErroNome] = useState<string | null>(null);
  const [erroSigla, setErroSigla] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const recebimentos = useConsulta(useCallback(() => (nova ? Promise.resolve([]) : listarRecebimentos(db, { obraId: id })), [db, id, nova]));

  useEffect(() => {
    if (nova) return;
    buscarObra(db, id).then((o) => {
      if (!o) return router.back();
      setObra(o);
      setNome(o.nome);
      setSigla(o.sigla ?? '');
      setCliente(o.cliente ?? '');
      setResponsavel(o.responsavel ?? '');
      setEndereco(o.endereco ?? '');
      setAtiva(o.ativa === 1);
    });
  }, [db, id, nova]);

  async function salvar() {
    setSalvando(true);
    setErroNome(null);
    setErroSigla(null);
    setErroGeral(null);
    try {
      const dados = { nome, sigla, cliente, responsavel, endereco, ativa };
      if (nova) {
        await criarObra(db, ctx, dados);
        router.back();
      } else {
        setObra(await alterarObra(db, ctx, id, dados));
        setEditando(false);
      }
    } catch (e) {
      if (e instanceof ErroValidacao && e.campo === 'nome') setErroNome(e.codigo === 'duplicado' ? t.obras.erroDuplicado : t.obras.erroObrigatorio);
      else if (e instanceof ErroValidacao && e.campo === 'sigla') setErroSigla(t.obras.erroSiglaDuplicada);
      else setErroGeral(t.comum.erroSalvar);
    }
    setSalvando(false);
  }

  async function excluir() {
    if (!confirmando) return setConfirmando(true);
    try {
      await excluirObra(db, ctx, id);
      router.back();
    } catch {
      setErroGeral(t.comum.erroSalvar);
    }
  }

  if (nova && !gerencia) {
    return (
      <Tela>
        <Aviso texto={t.comum.semPermissao} icone="lock-closed" cor="perigo" />
      </Tela>
    );
  }

  if (editando) {
    return (
      <Tela
        rodape={
          <>
            <Botao titulo={t.comum.salvar} icone="checkmark-circle" onPress={salvar} desabilitado={salvando} />
            {!nova ? (
              <Botao titulo={confirmando ? t.comum.confirmarExcluir : t.comum.excluir} icone="trash" variante="perigo" onPress={excluir} />
            ) : null}
          </>
        }>
        <Stack.Screen options={{ title: nova ? t.obras.nova : t.obras.editar }} />
        {erroGeral ? <Aviso texto={erroGeral} icone="alert-circle" cor="perigo" /> : null}
        <Campo rotulo={t.obras.nome} value={nome} onChangeText={setNome} erro={erroNome} autoFocus={nova} />
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: Espaco.m }}>
          <View style={{ flex: 1 }}>
            <Campo
              rotulo={t.obras.sigla}
              value={sigla}
              onChangeText={(v) => setSigla(v.toUpperCase())}
              erro={erroSigla}
              autoCapitalize="characters"
              maxLength={6}
              placeholder={nome.trim() ? sugerirSigla(nome) : ''}
            />
          </View>
          <View style={{ height: ALVO_TOQUE, justifyContent: 'center' }}>
            <Sigla texto={sigla.trim() || (nome.trim() ? sugerirSigla(nome) : '–')} tamanho="g" />
          </View>
        </View>
        <Texto tipo="pequeno" cor="textoSuave">
          {t.obras.siglaDica}
        </Texto>
        <Campo rotulo={t.obras.cliente} value={cliente} onChangeText={setCliente} />
        <Campo rotulo={t.obras.responsavel} value={responsavel} onChangeText={setResponsavel} />
        <Campo rotulo={t.obras.endereco} value={endereco} onChangeText={setEndereco} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: ALVO_TOQUE }}>
          <Texto>{t.obras.ativa}</Texto>
          <Switch value={ativa} onValueChange={setAtiva} accessibilityLabel={t.obras.ativa} />
        </View>
      </Tela>
    );
  }

  if (!obra) return <Tela>{<Texto cor="textoSuave">{t.comum.carregando}</Texto>}</Tela>;
  return (
    <Tela rodape={gerencia ? <Botao titulo={t.obras.editarDados} icone="create" variante="secundario" onPress={() => setEditando(true)} /> : undefined}>
      <Stack.Screen options={{ title: obra.nome }} />
      <Cartao style={{ gap: Espaco.m }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Espaco.m }}>
          <Sigla texto={siglaDe(obra)} tamanho="g" apagada={!obra.ativa} />
          <View style={{ flex: 1, gap: 4 }}>
            <Texto tipo="subtitulo">{obra.nome}</Texto>
            <Selo texto={obra.ativa ? t.obras.ativa : t.obras.encerrada} tom={obra.ativa ? 'ok' : 'alerta'} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Espaco.m }}>
          <Dado rotulo={t.obras.cliente} valor={obra.cliente} />
          <Dado rotulo={t.obras.responsavel} valor={obra.responsavel} />
          <Dado rotulo={t.obras.endereco.replace(/ \(.*\)/, '')} valor={obra.endereco} />
        </View>
      </Cartao>
      <Secao titulo={t.obras.concretagens} contador={recebimentos?.length} />
      <Lista vazio={recebimentos ? t.obras.semRegistros : t.comum.carregando}>
        {(recebimentos ?? []).map((r) => (
          <Linha
            key={r.id}
            titulo={`NF ${r.nf}`}
            detalhe={[formatarData(r.data_moldagem), r.peca, r.caminhao].filter(Boolean).join(' · ')}
            direita={<Selo texto={fmt(t.romp.parcial, { r: r.rompidos, t: r.total_cps })} tom={r.rompidos === r.total_cps && r.total_cps > 0 ? 'ok' : 'neutro'} />}
            aoTocar={() => router.push({ pathname: '/recebimento/[id]', params: { id: r.id } })}
          />
        ))}
      </Lista>
    </Tela>
  );
}
