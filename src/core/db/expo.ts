import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import type { Db, SqlValor } from './tipos';

type Conexao = Pick<SQLiteDatabase, 'execAsync' | 'runAsync' | 'getAllAsync' | 'getFirstAsync'>;

function envolver(con: Conexao, transacao: Db['transacao']): Db {
  return {
    exec: (sql) => con.execAsync(sql),
    rodar: async (sql, params: SqlValor[] = []) => {
      const r = await con.runAsync(sql, params);
      return { alteradas: r.changes };
    },
    todos: <T>(sql: string, params: SqlValor[] = []) => con.getAllAsync<T>(sql, params),
    primeiro: <T>(sql: string, params: SqlValor[] = []) => con.getFirstAsync<T>(sql, params),
    transacao,
  };
}

/** Adapta o banco do expo-sqlite ao contrato `Db`. */
export function dbExpo(banco: SQLiteDatabase): Db {
  const aninhada: Db['transacao'] = () => {
    throw new Error('Transação aninhada não é suportada.');
  };
  const db: Db = envolver(banco, async (tarefa) => {
    if (Platform.OS === 'web') {
      // A web não tem conexão exclusiva; a transação comum é o melhor disponível.
      await banco.withTransactionAsync(() => tarefa({ ...db, transacao: aninhada }));
      return;
    }
    // Conexão exclusiva: nenhuma outra consulta do app entra no meio da transação.
    await banco.withExclusiveTransactionAsync((txn) => tarefa(envolver(txn, aninhada)));
  });
  return db;
}
