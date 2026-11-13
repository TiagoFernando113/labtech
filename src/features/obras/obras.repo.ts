import type { Contexto, Db, RegistroSync } from '@/core/db/tipos';
import { registrarMudanca } from '@/core/sync/fila';

export interface Obra extends RegistroSync {
  nome: string;
  codigo: string | null;
  endereco: string | null;
  /** 1 = ativa, 0 = encerrada (SQLite não tem booleano). */
  ativa: number;
}

export interface DadosObra {
  nome: string;
  codigo?: string | null;
  endereco?: string | null;
  ativa?: boolean;
}

export class ErroValidacao extends Error {
  constructor(public campo: string, public codigo: 'obrigatorio' | 'duplicado' | 'nao_encontrado') {
    super(`${campo}: ${codigo}`);
  }
}

const TABELA = 'obras';
const limpar = (s: string | null | undefined) => {
  const t = (s ?? '').trim();
  return t === '' ? null : t;
};

async function validar(db: Db, dados: DadosObra, ctx: Contexto, ignorarId: string | null): Promise<string> {
  const nome = limpar(dados.nome);
  if (!nome) throw new ErroValidacao('nome', 'obrigatorio');
  const igual = await db.primeiro<{ id: string }>(
    `SELECT id FROM obras WHERE excluido_em IS NULL AND lower(nome) = lower(?) AND empresa_id IS ? AND id <> ?`,
    [nome, ctx.empresaId, ignorarId ?? ''],
  );
  if (igual) throw new ErroValidacao('nome', 'duplicado');
  return nome;
}

export function listarObras(db: Db, opcoes: { incluirEncerradas?: boolean } = {}): Promise<Obra[]> {
  const filtro = opcoes.incluirEncerradas ? '' : 'AND ativa = 1';
  return db.todos<Obra>(
    `SELECT * FROM obras WHERE excluido_em IS NULL ${filtro} ORDER BY ativa DESC, nome COLLATE NOCASE`,
  );
}

export function buscarObra(db: Db, id: string): Promise<Obra | null> {
  return db.primeiro<Obra>('SELECT * FROM obras WHERE id = ? AND excluido_em IS NULL', [id]);
}

export async function contarObrasAtivas(db: Db): Promise<number> {
  const r = await db.primeiro<{ n: number }>('SELECT COUNT(*) AS n FROM obras WHERE excluido_em IS NULL AND ativa = 1');
  return r?.n ?? 0;
}

export async function criarObra(db: Db, ctx: Contexto, dados: DadosObra): Promise<Obra> {
  const nome = await validar(db, dados, ctx, null);
  const agora = ctx.agora();
  const obra: Obra = {
    id: ctx.novoId(),
    empresa_id: ctx.empresaId,
    nome,
    codigo: limpar(dados.codigo),
    endereco: limpar(dados.endereco),
    ativa: dados.ativa === false ? 0 : 1,
    criado_em: agora,
    atualizado_em: agora,
    criado_por: ctx.usuarioId,
    atualizado_por: ctx.usuarioId,
    excluido_em: null,
    versao: 0,
  };
  await db.transacao(async (tx) => {
    await tx.rodar(
      `INSERT INTO obras (id, empresa_id, nome, codigo, endereco, ativa, criado_em, atualizado_em, criado_por, atualizado_por, excluido_em, versao)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0)`,
      [obra.id, obra.empresa_id, obra.nome, obra.codigo, obra.endereco, obra.ativa, agora, agora, obra.criado_por, obra.atualizado_por],
    );
    await registrarMudanca(tx, ctx, {
      tabela: TABELA,
      registroId: obra.id,
      operacao: 'salvar',
      acao: 'criar',
      antes: null,
      depois: obra,
      versaoBase: 0,
    });
  });
  return obra;
}

export async function alterarObra(db: Db, ctx: Contexto, id: string, dados: DadosObra): Promise<Obra> {
  const antes = await buscarObra(db, id);
  if (!antes) throw new ErroValidacao('id', 'nao_encontrado');
  const nome = await validar(db, dados, ctx, id);
  const depois: Obra = {
    ...antes,
    nome,
    codigo: limpar(dados.codigo),
    endereco: limpar(dados.endereco),
    ativa: dados.ativa === undefined ? antes.ativa : dados.ativa ? 1 : 0,
    atualizado_em: ctx.agora(),
    atualizado_por: ctx.usuarioId,
  };
  await db.transacao(async (tx) => {
    await tx.rodar(
      `UPDATE obras SET nome = ?, codigo = ?, endereco = ?, ativa = ?, atualizado_em = ?, atualizado_por = ? WHERE id = ?`,
      [depois.nome, depois.codigo, depois.endereco, depois.ativa, depois.atualizado_em, depois.atualizado_por, id],
    );
    await registrarMudanca(tx, ctx, {
      tabela: TABELA,
      registroId: id,
      operacao: 'salvar',
      acao: 'alterar',
      antes,
      depois,
      versaoBase: antes.versao,
    });
  });
  return depois;
}

/** Exclusão lógica: o registro some das telas, mas fica no banco e no histórico. */
export async function excluirObra(db: Db, ctx: Contexto, id: string): Promise<void> {
  const antes = await buscarObra(db, id);
  if (!antes) throw new ErroValidacao('id', 'nao_encontrado');
  const agora = ctx.agora();
  const depois: Obra = { ...antes, excluido_em: agora, atualizado_em: agora, atualizado_por: ctx.usuarioId };
  await db.transacao(async (tx) => {
    await tx.rodar('UPDATE obras SET excluido_em = ?, atualizado_em = ?, atualizado_por = ? WHERE id = ?', [
      agora,
      agora,
      ctx.usuarioId,
      id,
    ]);
    await registrarMudanca(tx, ctx, {
      tabela: TABELA,
      registroId: id,
      operacao: 'excluir',
      acao: 'excluir',
      antes,
      depois,
      versaoBase: antes.versao,
    });
  });
}
