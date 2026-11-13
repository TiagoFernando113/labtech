import type { Db } from './tipos';

/**
 * Migrações do banco local. Nunca edite uma migração já publicada:
 * acrescente outra no fim. A posição na lista + 1 é o `user_version`.
 */
export const MIGRACOES: string[] = [
  // 1 — Fundação: configuração local, obras e infraestrutura de sincronização/auditoria.
  `
  CREATE TABLE config_local (
    chave TEXT PRIMARY KEY NOT NULL,
    valor TEXT NOT NULL
  );

  CREATE TABLE obras (
    id TEXT PRIMARY KEY NOT NULL,
    empresa_id TEXT,
    nome TEXT NOT NULL,
    codigo TEXT,
    endereco TEXT,
    ativa INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL,
    criado_por TEXT,
    atualizado_por TEXT,
    excluido_em TEXT,
    versao INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX obras_empresa ON obras (empresa_id, excluido_em);

  -- Fila de envio: toda gravação local entra aqui na mesma transação do dado.
  CREATE TABLE sync_fila (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT NOT NULL UNIQUE,
    tabela TEXT NOT NULL,
    registro_id TEXT NOT NULL,
    operacao TEXT NOT NULL CHECK (operacao IN ('salvar', 'excluir')),
    dados TEXT NOT NULL,
    versao_base INTEGER NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pendente' CHECK (estado IN ('pendente', 'enviado', 'conflito', 'erro')),
    tentativas INTEGER NOT NULL DEFAULT 0,
    ultimo_erro TEXT,
    criado_em TEXT NOT NULL
  );
  CREATE INDEX sync_fila_estado ON sync_fila (estado, seq);

  -- Cursor de recebimento: sequência do servidor, nunca relógio do aparelho.
  CREATE TABLE sync_cursor (
    tabela TEXT PRIMARY KEY NOT NULL,
    ultimo_seq INTEGER NOT NULL DEFAULT 0,
    ultimo_recebimento_em TEXT
  );

  -- Trilha de auditoria local: só recebe inserções.
  CREATE TABLE historico (
    id TEXT PRIMARY KEY NOT NULL,
    tabela TEXT NOT NULL,
    registro_id TEXT NOT NULL,
    acao TEXT NOT NULL CHECK (acao IN ('criar', 'alterar', 'excluir')),
    antes TEXT,
    depois TEXT,
    usuario_id TEXT,
    dispositivo_id TEXT NOT NULL,
    criado_em TEXT NOT NULL
  );
  CREATE INDEX historico_registro ON historico (tabela, registro_id, criado_em);
  `,
];

export async function versaoDoBanco(db: Db): Promise<number> {
  const linha = await db.primeiro<{ user_version: number }>('PRAGMA user_version');
  return linha?.user_version ?? 0;
}

/** Aplica as migrações pendentes, uma transação por migração. Devolve a versão final. */
export async function migrar(db: Db, migracoes: string[] = MIGRACOES): Promise<number> {
  await db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  let versao = await versaoDoBanco(db);
  if (versao > migracoes.length) {
    throw new Error(
      `Banco local na versão ${versao}, mas este aplicativo conhece até a ${migracoes.length}. Atualize o aplicativo.`,
    );
  }
  while (versao < migracoes.length) {
    const proxima = versao + 1;
    await db.transacao(async (tx) => {
      await tx.exec(migracoes[versao]);
      await tx.exec(`PRAGMA user_version = ${proxima}`);
    });
    versao = proxima;
  }
  return versao;
}
