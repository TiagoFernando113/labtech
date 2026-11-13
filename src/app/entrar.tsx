import { useState } from 'react';
import { View } from 'react-native';

import { useApp } from '@/services/app';
import { Aviso, Botao, Campo, Tela, Texto } from '@/ui/componentes';
import { Espaco } from '@/ui/tema';

export default function Entrar() {
  const { t, entrar } = useApp();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setEnviando(true);
    setErro(false);
    const ok = await entrar(email, senha);
    // Com sucesso, a navegação troca sozinha para o app (rota protegida).
    if (!ok) {
      setErro(true);
      setEnviando(false);
    }
  }

  return (
    <Tela>
      <View style={{ gap: Espaco.xs, marginTop: Espaco.xg }}>
        <Texto tipo="titulo">{t.entrar.titulo}</Texto>
        <Texto cor="textoSuave">{t.app.subtitulo}</Texto>
      </View>
      {erro ? <Aviso texto={t.entrar.erro} icone="alert-circle" cor="perigo" /> : null}
      <Campo
        rotulo={t.entrar.email}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      <Campo rotulo={t.entrar.senha} value={senha} onChangeText={setSenha} secureTextEntry autoComplete="password" />
      <Botao titulo={t.entrar.entrar} icone="log-in" onPress={enviar} desabilitado={enviando || !email || !senha} />
    </Tela>
  );
}
