import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';

import { alterarObra, buscarObra, criarObra, ErroValidacao, excluirObra } from '@/features/obras/obras.repo';
import { useApp } from '@/services/app';
import { Aviso, Botao, Campo, Tela, Texto } from '@/ui/componentes';
import { ALVO_TOQUE } from '@/ui/tema';

export default function ObraForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const nova = id === 'nova';
  const { db, ctx, t, pode } = useApp();
  const [nome, setNome] = useState('');
  const [codigo, setCodigo] = useState('');
  const [endereco, setEndereco] = useState('');
  const [ativa, setAtiva] = useState(true);
  const [erroNome, setErroNome] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    if (nova) return;
    buscarObra(db, id).then((o) => {
      if (!o) return router.back();
      setNome(o.nome);
      setCodigo(o.codigo ?? '');
      setEndereco(o.endereco ?? '');
      setAtiva(o.ativa === 1);
    });
  }, [db, id, nova]);

  if (!pode('obras.gerenciar')) {
    return (
      <Tela>
        <Aviso texto={t.comum.semPermissao} icone="lock-closed" cor="perigo" />
      </Tela>
    );
  }

  async function salvar() {
    setSalvando(true);
    setErroNome(null);
    setErroGeral(null);
    try {
      const dados = { nome, codigo, endereco, ativa };
      if (nova) await criarObra(db, ctx, dados);
      else await alterarObra(db, ctx, id, dados);
      router.back();
    } catch (e) {
      if (e instanceof ErroValidacao && e.campo === 'nome') {
        setErroNome(e.codigo === 'duplicado' ? t.obras.erroDuplicado : t.obras.erroObrigatorio);
      } else {
        setErroGeral(t.comum.erroSalvar);
      }
      setSalvando(false);
    }
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

  return (
    <Tela
      rodape={
        <>
          <Botao titulo={t.comum.salvar} icone="checkmark-circle" onPress={salvar} desabilitado={salvando} />
          {!nova ? (
            <Botao
              titulo={confirmando ? t.comum.confirmarExcluir : t.comum.excluir}
              icone="trash"
              variante="perigo"
              onPress={excluir}
            />
          ) : null}
        </>
      }>
      <Stack.Screen options={{ title: nova ? t.obras.nova : t.obras.editar }} />
      {erroGeral ? <Aviso texto={erroGeral} icone="alert-circle" cor="perigo" /> : null}
      <Campo rotulo={t.obras.nome} value={nome} onChangeText={setNome} erro={erroNome} autoFocus={nova} returnKeyType="next" />
      <Campo rotulo={t.obras.codigo} value={codigo} onChangeText={setCodigo} autoCapitalize="characters" />
      <Campo rotulo={t.obras.endereco} value={endereco} onChangeText={setEndereco} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: ALVO_TOQUE }}>
        <Texto>{t.obras.ativa}</Texto>
        <Switch value={ativa} onValueChange={setAtiva} accessibilityLabel={t.obras.ativa} />
      </View>
    </Tela>
  );
}
