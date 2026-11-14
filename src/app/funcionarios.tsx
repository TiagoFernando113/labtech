import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Switch, View } from 'react-native';

import type { Papel } from '@/core/permissoes';
import { useApp } from '@/services/app';
import { clienteAvulso, supabase } from '@/services/supabase';
import { Aviso, Botao, Campo, Cartao, Tela, Texto } from '@/ui/componentes';
import { ALVO_TOQUE, Espaco } from '@/ui/tema';

interface Membro {
  usuario_id: string;
  nome: string | null;
  email: string | null;
  papel: Papel;
  ativo: boolean;
}

const PAPEIS: Papel[] = ['ajudante', 'laboratorista', 'admin'];

function EscolhaPapel({ valor, aoMudar, desabilitado }: { valor: Papel; aoMudar: (p: Papel) => void; desabilitado?: boolean }) {
  const { t } = useApp();
  return (
    <View style={{ gap: Espaco.p }}>
      {PAPEIS.map((p) => (
        <Botao
          key={p}
          titulo={t.papeis[p]}
          icone={valor === p ? 'radio-button-on' : 'radio-button-off'}
          variante={valor === p ? 'primario' : 'secundario'}
          desabilitado={desabilitado}
          onPress={() => aoMudar(p)}
        />
      ))}
    </View>
  );
}

/** Gestão de funcionários pelo administrador. Precisa de internet: contas vivem no servidor. */
export default function Funcionarios() {
  const { t, ctx, pode } = useApp();
  const [membros, setMembros] = useState<Membro[] | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [papel, setPapel] = useState<Papel>('ajudante');
  const [erro, setErro] = useState<string | null>(null);
  const [criado, setCriado] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const empresaId = ctx.empresaId;

  const carregar = useCallback(async () => {
    if (!supabase || !empresaId) return;
    const { data, error } = await supabase
      .from('membros')
      .select('usuario_id, nome, email, papel, ativo')
      .eq('empresa_id', empresaId)
      .order('criado_em');
    setFalhou(!!error);
    if (!error) setMembros(data as Membro[]);
  }, [empresaId]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  if (!pode('funcionarios.gerenciar')) {
    return (
      <Tela>
        <Aviso texto={t.comum.semPermissao} icone="lock-closed" cor="perigo" />
      </Tela>
    );
  }

  async function cadastrar() {
    setErro(null);
    setCriado(null);
    const avulso = clienteAvulso();
    if (!nome.trim() || !email.includes('@') || senha.length < 6) return setErro(t.funcionarios.erroCampos);
    if (!avulso || !supabase || !empresaId) return setErro(t.funcionarios.precisaInternet);
    setEnviando(true);
    const { data, error } = await avulso.auth.signUp({ email: email.trim(), password: senha });
    const usuarioId = data.user?.id;
    if (error || !usuarioId || data.user?.identities?.length === 0) {
      setErro(
        error?.code === 'weak_password'
          ? t.entrar.erroSenha
          : error && error.code !== 'user_already_exists' && error.code !== 'email_exists'
            ? t.entrar.erroCriar
            : t.entrar.erroJaExiste,
      );
    } else if (!data.session) {
      setErro(t.funcionarios.erroConfirmacao);
    } else {
      const { error: erroVinculo } = await supabase
        .from('membros')
        .insert({ usuario_id: usuarioId, empresa_id: empresaId, papel, nome: nome.trim(), email: email.trim() });
      if (erroVinculo) setErro(t.funcionarios.erroVinculo);
      else {
        setCriado(`${email.trim()} · ${senha}`);
        setNome('');
        setEmail('');
        setSenha('');
        setPapel('ajudante');
        await carregar();
      }
    }
    setEnviando(false);
  }

  async function alterar(m: Membro, mudanca: Partial<Pick<Membro, 'papel' | 'ativo'>>) {
    if (!supabase || !empresaId) return;
    const { error } = await supabase.from('membros').update(mudanca).eq('usuario_id', m.usuario_id).eq('empresa_id', empresaId);
    if (error) setErro(t.comum.erroSalvar);
    await carregar();
  }

  const semRede = falhou || !supabase || !empresaId;
  const outros = membros?.filter((m) => m.usuario_id !== ctx.usuarioId) ?? [];

  return (
    <Tela>
      {semRede ? <Aviso texto={t.funcionarios.precisaInternet} icone="cloud-offline" /> : null}
      {erro ? <Aviso texto={erro} icone="alert-circle" cor="perigo" /> : null}
      {criado ? <Aviso texto={`${t.funcionarios.criado} ${criado}`} icone="checkmark-circle" cor="ok" /> : null}

      <Texto tipo="rotulo" cor="textoSuave">
        {t.funcionarios.novo}
      </Texto>
      <Campo rotulo={t.funcionarios.nome} value={nome} onChangeText={setNome} />
      <Campo rotulo={t.entrar.email} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Campo rotulo={t.entrar.senhaDica} value={senha} onChangeText={setSenha} autoCapitalize="none" />
      <EscolhaPapel valor={papel} aoMudar={setPapel} />
      <Botao titulo={t.funcionarios.cadastrar} icone="person-add" onPress={cadastrar} desabilitado={enviando} />

      <Texto tipo="rotulo" cor="textoSuave">
        {t.funcionarios.titulo}
      </Texto>
      {membros === null && !semRede ? <Texto cor="textoSuave">{t.comum.carregando}</Texto> : null}
      {membros !== null && outros.length === 0 ? <Texto cor="textoSuave">{t.funcionarios.vazio}</Texto> : null}
      {outros.map((m) => (
        <Cartao key={m.usuario_id} style={{ gap: Espaco.m }}>
          <View style={{ gap: 2 }}>
            <Texto tipo="forte">{m.nome || m.email || '–'}</Texto>
            <Texto tipo="pequeno" cor={m.ativo ? 'textoSuave' : 'perigo'}>
              {[m.ativo ? t.papeis[m.papel] : t.funcionarios.desativado, m.email].filter(Boolean).join(' · ')}
            </Texto>
          </View>
          <Botao
            titulo={t.funcionarios.funcao}
            icone={aberto === m.usuario_id ? 'chevron-up' : 'chevron-down'}
            variante="secundario"
            onPress={() => setAberto(aberto === m.usuario_id ? null : m.usuario_id)}
          />
          {aberto === m.usuario_id ? (
            <>
              <EscolhaPapel valor={m.papel} aoMudar={(p) => alterar(m, { papel: p })} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: ALVO_TOQUE }}>
                <Texto>{t.funcionarios.ativo}</Texto>
                <Switch value={m.ativo} onValueChange={(v) => alterar(m, { ativo: v })} accessibilityLabel={t.funcionarios.ativo} />
              </View>
            </>
          ) : null}
        </Cartao>
      ))}
    </Tela>
  );
}
