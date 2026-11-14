import type { Db } from '@/core/db/tipos';

export type ChaveConfig = 'idioma' | 'dispositivo_id' | 'empresa_id' | 'empresa_nome' | 'papel' | 'usuario_id' | 'usuario_nome';

export async function lerConfig(db: Db, chave: ChaveConfig): Promise<string | null> {
  const r = await db.primeiro<{ valor: string }>('SELECT valor FROM config_local WHERE chave = ?', [chave]);
  return r?.valor ?? null;
}

export async function gravarConfig(db: Db, chave: ChaveConfig, valor: string | null): Promise<void> {
  if (valor === null) {
    await db.rodar('DELETE FROM config_local WHERE chave = ?', [chave]);
    return;
  }
  await db.rodar(
    'INSERT INTO config_local (chave, valor) VALUES (?, ?) ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor',
    [chave, valor],
  );
}

/** Identificador estável deste aparelho, criado na primeira abertura. */
export async function garantirDispositivoId(db: Db, novoId: () => string): Promise<string> {
  const atual = await lerConfig(db, 'dispositivo_id');
  if (atual) return atual;
  const id = novoId();
  await gravarConfig(db, 'dispositivo_id', id);
  return id;
}
