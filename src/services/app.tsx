import type { Session } from '@supabase/supabase-js';
import { randomUUID } from 'expo-crypto';
import { getLocales } from 'expo-localization';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { dbExpo } from '@/core/db/expo';
import type { Contexto, Db } from '@/core/db/tipos';
import { pode as podePapel, type Acao, type Papel } from '@/core/permissoes';
import { garantirDispositivoId, gravarConfig, lerConfig } from '@/features/config/config.repo';
import { es } from '@/i18n/es';
import { pt, type Textos } from '@/i18n/pt';

import { supabase, supabaseConfigurado } from './supabase';

export type Idioma = 'pt' | 'es';
const TEXTOS: Record<Idioma, Textos> = { pt, es };
const PAPEIS: Papel[] = ['admin', 'laboratorista', 'ajudante'];

interface Vinculo {
  usuarioId: string | null;
  empresaId: string | null;
  empresaNome: string | null;
  papel: Papel | null;
  nome: string | null;
}

/** `nenhum` = o servidor confirmou que a conta ainda não pertence a uma empresa. */
type EstadoVinculo = 'carregando' | 'ok' | 'nenhum';
export type ResultadoConta = 'ok' | 'confirmar_email' | 'ja_existe' | 'senha_fraca' | 'erro';

interface App {
  db: Db;
  /** Carimbo de autoria usado em toda gravação. */
  ctx: Contexto;
  t: Textos;
  idioma: Idioma;
  trocarIdioma: (i: Idioma) => Promise<void>;
  /** Sem projeto Supabase configurado: tudo funciona, só neste aparelho. */
  modoLocal: boolean;
  logado: boolean;
  email: string | null;
  empresaNome: string | null;
  papel: Papel | null;
  pode: (acao: Acao) => boolean;
  dispositivoId: string;
  /** Nome do funcionário logado, quando informado. */
  nome: string | null;
  estadoVinculo: EstadoVinculo;
  entrar: (email: string, senha: string) => Promise<boolean>;
  criarConta: (email: string, senha: string) => Promise<ResultadoConta>;
  /** Primeira pessoa da empresa: cria a empresa e vira administradora. */
  criarEmpresa: (nomeEmpresa: string, nomeUsuario: string) => Promise<boolean>;
  sair: () => Promise<void>;
}

const AppContexto = createContext<App | null>(null);

export function useApp(): App {
  const app = useContext(AppContexto);
  if (!app) throw new Error('useApp fora do AppProvider');
  return app;
}

const idiomaDoAparelho = (): Idioma => (getLocales()[0]?.languageCode === 'es' ? 'es' : 'pt');
const VAZIO: Vinculo = { usuarioId: null, empresaId: null, empresaNome: null, papel: null, nome: null };

export function AppProvider({ children, aoFicarPronto }: { children: ReactNode; aoFicarPronto: () => void }) {
  const banco = useSQLiteContext();
  const db = useMemo(() => dbExpo(banco), [banco]);
  const [pronto, setPronto] = useState(false);
  const [idioma, setIdioma] = useState<Idioma>('pt');
  const [dispositivoId, setDispositivoId] = useState('');
  const [sessao, setSessao] = useState<Session | null>(null);
  const [vinculo, setVinculo] = useState<Vinculo>(VAZIO);
  const [estadoVinculo, setEstadoVinculo] = useState<EstadoVinculo>('carregando');
  const [recarga, setRecarga] = useState(0);

  // Abertura: tudo vem do aparelho, sem esperar a rede.
  useEffect(() => {
    let vivo = true;
    (async () => {
      const [id, idi, usuarioId, empresaId, empresaNome, papel, nome] = await Promise.all([
        garantirDispositivoId(db, randomUUID),
        lerConfig(db, 'idioma'),
        lerConfig(db, 'usuario_id'),
        lerConfig(db, 'empresa_id'),
        lerConfig(db, 'empresa_nome'),
        lerConfig(db, 'papel'),
        lerConfig(db, 'usuario_nome'),
      ]);
      const s = supabase ? (await supabase.auth.getSession()).data.session : null;
      if (!vivo) return;
      setDispositivoId(id);
      setIdioma(idi === 'pt' || idi === 'es' ? idi : idiomaDoAparelho());
      setSessao(s);
      if (s && usuarioId === s.user.id) {
        const p = PAPEIS.includes(papel as Papel) ? (papel as Papel) : null;
        setVinculo({ usuarioId, empresaId, empresaNome, papel: p, nome });
        if (p) setEstadoVinculo('ok');
      }
      setPronto(true);
      aoFicarPronto();
    })();
    return () => {
      vivo = false;
    };
  }, [db, aoFicarPronto]);

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSessao(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // Com sessão e internet, confirma empresa e função no servidor e guarda para uso offline.
  const usuarioSessao = sessao?.user.id ?? null;
  useEffect(() => {
    if (!supabase || !pronto) return;
    let vivo = true;
    (async () => {
      if (!usuarioSessao) {
        setVinculo(VAZIO);
        setEstadoVinculo('carregando');
        await Promise.all(
          (['usuario_id', 'empresa_id', 'empresa_nome', 'papel', 'usuario_nome'] as const).map((c) => gravarConfig(db, c, null)),
        );
        return;
      }
      const { data, error } = await supabase
        .from('membros')
        .select('empresa_id, papel, nome, empresas(nome)')
        .eq('usuario_id', usuarioSessao)
        .eq('ativo', true)
        .limit(1)
        .maybeSingle();
      if (!vivo || error) return; // sem rede: fica com o que já estava guardado
      const empresa = data?.empresas as { nome?: string } | { nome?: string }[] | null | undefined;
      const novo: Vinculo = {
        usuarioId: usuarioSessao,
        empresaId: data?.empresa_id ?? null,
        empresaNome: (Array.isArray(empresa) ? empresa[0]?.nome : empresa?.nome) ?? null,
        papel: PAPEIS.includes(data?.papel) ? data?.papel : null,
        nome: data?.nome ?? null,
      };
      setVinculo(novo);
      setEstadoVinculo(novo.papel ? 'ok' : 'nenhum');
      await gravarConfig(db, 'usuario_id', novo.usuarioId);
      await gravarConfig(db, 'empresa_id', novo.empresaId);
      await gravarConfig(db, 'empresa_nome', novo.empresaNome);
      await gravarConfig(db, 'papel', novo.papel);
      await gravarConfig(db, 'usuario_nome', novo.nome);
    })();
    return () => {
      vivo = false;
    };
  }, [db, pronto, usuarioSessao, recarga]);

  const trocarIdioma = useCallback(
    async (i: Idioma) => {
      setIdioma(i);
      await gravarConfig(db, 'idioma', i);
    },
    [db],
  );

  const entrar = useCallback(async (email: string, senha: string) => {
    if (!supabase) return false;
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    return !error;
  }, []);

  const criarConta = useCallback(async (email: string, senha: string): Promise<ResultadoConta> => {
    if (!supabase) return 'erro';
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: senha });
    if (error) {
      if (error.code === 'user_already_exists' || error.code === 'email_exists') return 'ja_existe';
      if (error.code === 'weak_password') return 'senha_fraca';
      return 'erro';
    }
    // Com confirmação de e-mail ligada no Supabase não vem sessão (e e-mail repetido vem sem identidades).
    if (!data.session) return data.user?.identities?.length === 0 ? 'ja_existe' : 'confirmar_email';
    return 'ok';
  }, []);

  const criarEmpresa = useCallback(async (nomeEmpresa: string, nomeUsuario: string) => {
    if (!supabase) return false;
    const { error } = await supabase.rpc('criar_empresa', { nome_empresa: nomeEmpresa, nome_usuario: nomeUsuario });
    if (error) return false;
    setRecarga((n) => n + 1);
    return true;
  }, []);

  const sair = useCallback(async () => {
    await supabase?.auth.signOut();
  }, []);

  const modoLocal = !supabaseConfigurado;
  const papel: Papel | null = modoLocal ? 'admin' : vinculo.papel;

  const valor = useMemo<App>(
    () => ({
      db,
      ctx: {
        usuarioId: vinculo.usuarioId,
        usuarioNome: vinculo.nome ?? sessao?.user.email?.split('@')[0] ?? null,
        empresaId: vinculo.empresaId,
        dispositivoId,
        novoId: randomUUID,
        agora: () => new Date().toISOString(),
      },
      t: TEXTOS[idioma],
      idioma,
      trocarIdioma,
      modoLocal,
      logado: modoLocal || sessao !== null,
      email: sessao?.user.email ?? null,
      empresaNome: vinculo.empresaNome,
      papel,
      pode: (acao) => podePapel(papel, acao),
      dispositivoId,
      nome: vinculo.nome,
      estadoVinculo: modoLocal ? 'ok' : estadoVinculo,
      entrar,
      criarConta,
      criarEmpresa,
      sair,
    }),
    [db, vinculo, dispositivoId, idioma, trocarIdioma, modoLocal, sessao, papel, estadoVinculo, entrar, criarConta, criarEmpresa, sair],
  );

  if (!pronto) return null;
  return <AppContexto.Provider value={valor}>{children}</AppContexto.Provider>;
}
