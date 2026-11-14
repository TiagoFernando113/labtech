import { useState } from 'react';
import { View } from 'react-native';

import { useApp } from '@/services/app';
import { Aviso, Botao, Campo, Tela, Texto } from '@/ui/componentes';
import { Espaco } from '@/ui/tema';

/** Primeiro acesso de quem criou a conta: nomeia a empresa e vira administrador. */
export default function Empresa() {
  const { t, criarEmpresa, sair, email } = useApp();
  const [empresa, setEmpresa] = useState('');
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setEnviando(true);
    setErro(false);
    if (!(await criarEmpresa(empresa, nome))) {
      setErro(true);
      setEnviando(false);
    }
  }

  return (
    <Tela>
      <View style={{ gap: Espaco.xs, marginTop: Espaco.xg }}>
        <Texto tipo="titulo">{t.empresa.titulo}</Texto>
        <Texto cor="textoSuave">{t.empresa.dica}</Texto>
      </View>
      {erro ? <Aviso texto={t.empresa.erro} icone="alert-circle" cor="perigo" /> : null}
      <Campo rotulo={t.empresa.nomeEmpresa} value={empresa} onChangeText={setEmpresa} />
      <Campo rotulo={t.empresa.seuNome} value={nome} onChangeText={setNome} autoComplete="name" />
      <Botao
        titulo={t.empresa.criar}
        icone="checkmark-circle"
        onPress={enviar}
        desabilitado={enviando || !empresa.trim() || !nome.trim()}
      />
      <Aviso texto={`${t.entrar.semVinculo} (${email ?? ''})`} />
      <Botao titulo={t.ajustes.sair} icone="log-out" variante="secundario" onPress={sair} />
    </Tela>
  );
}
