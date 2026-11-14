import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const chave = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Guarda a sessão no cofre do sistema (Keychain / Keystore).
 * O cofre limita o tamanho de cada item, então o valor é dividido em partes.
 */
const TAMANHO_PARTE = 1800;
const limpa = (k: string) => k.replace(/[^A-Za-z0-9._-]/g, '_');
const nomeParte = (k: string, i: number) => `${limpa(k)}.${i}`;
const nomeTotal = (k: string) => `${limpa(k)}.n`;

const cofre = {
  async getItem(k: string): Promise<string | null> {
    const n = Number((await SecureStore.getItemAsync(nomeTotal(k))) ?? 0);
    if (!n) return null;
    const partes: string[] = [];
    for (let i = 0; i < n; i++) {
      const p = await SecureStore.getItemAsync(nomeParte(k, i));
      if (p === null) return null;
      partes.push(p);
    }
    return partes.join('');
  },
  async setItem(k: string, v: string): Promise<void> {
    await cofre.removeItem(k);
    const n = Math.ceil(v.length / TAMANHO_PARTE);
    for (let i = 0; i < n; i++) {
      await SecureStore.setItemAsync(nomeParte(k, i), v.slice(i * TAMANHO_PARTE, (i + 1) * TAMANHO_PARTE));
    }
    await SecureStore.setItemAsync(nomeTotal(k), String(n));
  },
  async removeItem(k: string): Promise<void> {
    const n = Number((await SecureStore.getItemAsync(nomeTotal(k))) ?? 0);
    for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(nomeParte(k, i));
    await SecureStore.deleteItemAsync(nomeTotal(k));
  },
};

export const supabaseConfigurado = Boolean(url && chave);

/** `null` enquanto as chaves do projeto não forem informadas no `.env` (modo local). */
export const supabase: SupabaseClient | null =
  url && chave
    ? createClient(url, chave, {
        auth: {
          storage: Platform.OS === 'web' ? undefined : cofre,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

/**
 * Cliente sem sessão guardada, usado pelo administrador para criar a conta de um
 * funcionário sem sair da própria conta.
 */
export function clienteAvulso(): SupabaseClient | null {
  if (!url || !chave) return null;
  return createClient(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'labtech-avulso' },
  });
}
