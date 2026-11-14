/**
 * Contrato mínimo de banco usado por repositórios e pela sincronização.
 * No app é implementado sobre expo-sqlite; nos testes, sobre node:sqlite.
 */
export type SqlValor = string | number | null;

export interface Db {
  exec(sql: string): Promise<void>;
  rodar(sql: string, params?: SqlValor[]): Promise<{ alteradas: number }>;
  todos<T>(sql: string, params?: SqlValor[]): Promise<T[]>;
  primeiro<T>(sql: string, params?: SqlValor[]): Promise<T | null>;
  /** Executa tudo ou nada. O `tx` recebido é o único que pode ser usado dentro da tarefa. */
  transacao(tarefa: (tx: Db) => Promise<void>): Promise<void>;
}

/** Colunas comuns a todo registro sincronizável. */
export interface RegistroSync {
  id: string;
  empresa_id: string | null;
  criado_em: string;
  atualizado_em: string;
  criado_por: string | null;
  atualizado_por: string | null;
  excluido_em: string | null;
  /** Última versão confirmada pelo servidor (0 = nunca sincronizado). */
  versao: number;
}

/** Quem está operando o aparelho; carimbado em cada gravação. */
export interface Contexto {
  usuarioId: string | null;
  /** Nome de quem opera, gravado junto aos registros para leitura offline. */
  usuarioNome?: string | null;
  empresaId: string | null;
  dispositivoId: string;
  novoId: () => string;
  agora: () => string;
}
