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
}

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
  entrar: (email: string, senha: string) => Promise<boolean>;
  sair: () => Promise<void>;
}

const AppContexto = createContext<App | null>(null);

export function useApp(): App {
  const app = useContext(AppContexto);
  if (!app) throw new Error('useApp fora do AppProvider');
  return app;
}

const idiomaDoAparelho = (): Idioma => (getLocales()[0]?.languageCode === 'es' ? 'es' : 'pt');
const VAZIO: Vinculo = { usuarioId: null, empresaId: null, empresaNome: null, papel: null };

export function AppProvider({ children, aoFicarPronto }: { children: ReactNode; aoFicarPronto: () => void }) {
  const banco = useSQLiteContext();
  const db = useMemo(() => dbExpo(banco), [banco]);
  const [pronto, setPronto] = useState(false);
  const [idioma, setIdioma] = useState<Idioma>('pt');
  const [dispositivoId, setDispositivoId] = useState('');
  const [sessao, setSessao] = useState<Session | null>(null);
  const [vinculo, setVinculo] = useState<Vinculo>(VAZIO);

  // Abertura: tudo vem do aparelho, sem esperar a rede.
  useEffect(() => {
    let vivo = true;
    (async () => {
      const [id, idi, usuarioId, empresaId, empresaNome, papel] = await Promise.all([
        garantirDispositivoId(db, randomUUID),
        lerConfig(db, 'idioma'),
        lerConfig(db, 'usuario_id'),
        lerConfig(db, 'empresa_id'),
        lerConfig(db, 'empresa_nome'),
        lerConfig(db, 'papel'),
      ]);
      const s = supabase ? (await supabase.auth.getSession()).data.session : null;
      if (!vivo) return;
      setDispositivoId(id);
      setIdioma(idi === 'pt' || idi === 'es' ? idi : idiomaDoAparelho());
      setSessao(s);
      if (s && usuarioId === s.user.id) {
        setVinculo({ usuarioId, empresaId, empresaNome, papel: PAPEIS.includes(papel as Papel) ? (papel as Papel) : null });
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
        await Promise.all((['usuario_id', 'empresa_id', 'empresa_nome', 'papel'] as const).map((c) => gravarConfig(db, c, null)));
        return;
      }
      const { data, error } = await supabase
        .from('membros')
        .select('empresa_id, papel, empresas(nome)')
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
      };
      setVinculo(novo);
      await gravarConfig(db, 'usuario_id', novo.usuarioId);
      await gravarConfig(db, 'empresa_id', novo.empresaId);
      await gravarConfig(db, 'empresa_nome', novo.empresaNome);
      await gravarConfig(db, 'papel', novo.papel);
    })();
    return () => {
      vivo = false;
    };
  }, [db, pronto, usuarioSessao]);

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
      entrar,
      sair,
    }),
    [db, vinculo, dispositivoId, idioma, trocarIdioma, modoLocal, sessao, papel, entrar, sair],
  );

  if (!pronto) return null;
  return <AppContexto.Provider value={valor}>{children}</AppContexto.Provider>;
}
