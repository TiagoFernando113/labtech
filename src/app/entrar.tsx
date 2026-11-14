import { useState } from 'react';
import { View } from 'react-native';

import { useApp } from '@/services/app';
import { Aviso, Botao, Campo, Tela, Texto } from '@/ui/componentes';
import { Espaco } from '@/ui/tema';

export default function Entrar() {
  const { t, entrar, criarConta } = useApp();
  const [novo, setNovo] = useState(false);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setEnviando(true);
    setErro(null);
    setAviso(null);
    // Com sucesso, a navegação troca sozinha (rotas protegidas).
    if (!novo) {
      if (!(await entrar(email, senha))) setErro(t.entrar.erro);
    } else {
      const r = await criarConta(email, senha);
      if (r === 'ja_existe') setErro(t.entrar.erroJaExiste);
      else if (r === 'senha_fraca') setErro(t.entrar.erroSenha);
      else if (r === 'erro') setErro(t.entrar.erroCriar);
      else if (r === 'confirmar_email') {
        setAviso(t.entrar.confirmarEmail);
        setNovo(false);
      }
    }
    setEnviando(false);
  }

  const pronto = email.includes('@') && senha.length >= (novo ? 6 : 1);

  return (
    <Tela>
      <View style={{ gap: Espaco.xs, marginTop: Espaco.xg }}>
        <Texto tipo="titulo">{novo ? t.entrar.criarContaTitulo : t.entrar.titulo}</Texto>
        <Texto cor="textoSuave">{novo ? t.entrar.criarContaDica : t.app.subtitulo}</Texto>
      </View>
      {erro ? <Aviso texto={erro} icone="alert-circle" cor="perigo" /> : null}
      {aviso ? <Aviso texto={aviso} icone="mail" cor="ok" /> : null}
      <Campo
        rotulo={t.entrar.email}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      <Campo
        rotulo={novo ? t.entrar.senhaDica : t.entrar.senha}
        value={senha}
        onChangeText={setSenha}
        secureTextEntry
        autoComplete={novo ? 'new-password' : 'current-password'}
      />
      <Botao
        titulo={novo ? t.entrar.criarConta : t.entrar.entrar}
        icone={novo ? 'person-add' : 'log-in'}
        onPress={enviar}
        desabilitado={enviando || !pronto}
      />
      <Botao
        titulo={novo ? t.entrar.jaTenhoConta : t.entrar.souNovo}
        variante="secundario"
        onPress={() => {
          setNovo(!novo);
          setErro(null);
        }}
      />
    </Tela>
  );
}
