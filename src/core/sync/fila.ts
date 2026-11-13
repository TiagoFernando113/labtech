import type { Contexto, Db } from '../db/tipos';

export type Operacao = 'salvar' | 'excluir';
export type AcaoHistorico = 'criar' | 'alterar' | 'excluir';

export interface ItemFila {
  seq: number;
  id: string;
  tabela: string;
  registro_id: string;
  operacao: Operacao;
  dados: string;
  versao_base: number;
  estado: 'pendente' | 'enviado' | 'conflito' | 'erro';
  tentativas: number;
  ultimo_erro: string | null;
  criado_em: string;
}

interface Mudanca {
  tabela: string;
  registroId: string;
  operacao: Operacao;
  acao: AcaoHistorico;
  antes: object | null;
  depois: object | null;
  /** Versão do servidor sobre a qual esta alteração foi feita (detecção de conflito). */
  versaoBase: number;
}

/**
 * Registra uma alteração na fila de envio e no histórico.
 * Deve ser chamada com o `tx` da mesma transação que gravou o dado:
 * assim não existe dado local sem item na fila, nem o contrário.
 */
export async function registrarMudanca(tx: Db, ctx: Contexto, m: Mudanca): Promise<void> {
  const agora = ctx.agora();
  await tx.rodar(
    `INSERT INTO sync_fila (id, tabela, registro_id, operacao, dados, versao_base, criado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [ctx.novoId(), m.tabela, m.registroId, m.operacao, JSON.stringify(m.depois ?? m.antes ?? {}), m.versaoBase, agora],
  );
  await tx.rodar(
    `INSERT INTO historico (id, tabela, registro_id, acao, antes, depois, usuario_id, dispositivo_id, criado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ctx.novoId(),
      m.tabela,
      m.registroId,
      m.acao,
      m.antes ? JSON.stringify(m.antes) : null,
      m.depois ? JSON.stringify(m.depois) : null,
      ctx.usuarioId,
      ctx.dispositivoId,
      agora,
    ],
  );
}

export async function contarPendentes(db: Db): Promise<number> {
  const r = await db.primeiro<{ n: number }>(`SELECT COUNT(*) AS n FROM sync_fila WHERE estado <> 'enviado'`);
  return r?.n ?? 0;
}

export function listarPendentes(db: Db, limite = 50): Promise<ItemFila[]> {
  return db.todos<ItemFila>(`SELECT * FROM sync_fila WHERE estado = 'pendente' ORDER BY seq LIMIT ?`, [limite]);
}
