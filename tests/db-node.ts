import { DatabaseSync } from 'node:sqlite';

import type { Contexto, Db, SqlValor } from '@/core/db/tipos';

/** Mesmo contrato `Db` do app, sobre o SQLite embutido do Node, para testar o SQL de verdade. */
export function dbDeTeste(): Db {
  const banco = new DatabaseSync(':memory:');
  let emTransacao = false;
  const db: Db = {
    exec: async (sql) => {
      banco.exec(sql);
    },
    rodar: async (sql, params: SqlValor[] = []) => {
      const r = banco.prepare(sql).run(...params);
      return { alteradas: Number(r.changes) };
    },
    todos: async <T>(sql: string, params: SqlValor[] = []) => banco.prepare(sql).all(...params) as T[],
    primeiro: async <T>(sql: string, params: SqlValor[] = []) => (banco.prepare(sql).get(...params) as T) ?? null,
    transacao: async (tarefa) => {
      if (emTransacao) throw new Error('Transação aninhada não é suportada.');
      emTransacao = true;
      banco.exec('BEGIN');
      try {
        await tarefa(db);
        banco.exec('COMMIT');
      } catch (e) {
        banco.exec('ROLLBACK');
        throw e;
      } finally {
        emTransacao = false;
      }
    },
  };
  return db;
}

export function contextoDeTeste(parcial: Partial<Contexto> = {}): Contexto {
  let n = 0;
  let t = Date.UTC(2026, 10, 13, 12, 0, 0);
  return {
    usuarioId: 'usuario-1',
    empresaId: 'empresa-1',
    dispositivoId: 'aparelho-1',
    novoId: () => `id-${++n}`,
    agora: () => new Date((t += 1000)).toISOString(),
    ...parcial,
  };
}
