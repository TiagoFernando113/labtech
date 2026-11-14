import type { Contexto, Db, RegistroSync } from '@/core/db/tipos';
import { registrarMudanca } from '@/core/sync/fila';

export interface Obra extends RegistroSync {
  nome: string;
  /** Abreviação curta que identifica a obra em etiquetas e listas. */
  sigla: string | null;
  cliente: string | null;
  responsavel: string | null;
  codigo: string | null;
  endereco: string | null;
  /** 1 = ativa, 0 = encerrada (SQLite não tem booleano). */
  ativa: number;
}

export interface DadosObra {
  nome: string;
  sigla?: string | null;
  cliente?: string | null;
  responsavel?: string | null;
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

async function validar(db: Db, dados: DadosObra, ctx: Contexto, ignorarId: string | null): Promise<{ nome: string; sigla: string }> {
  const nome = limpar(dados.nome);
  if (!nome) throw new ErroValidacao('nome', 'obrigatorio');
  const igual = await db.primeiro<{ id: string }>(
    `SELECT id FROM obras WHERE excluido_em IS NULL AND lower(nome) = lower(?) AND empresa_id IS ? AND id <> ?`,
    [nome, ctx.empresaId, ignorarId ?? ''],
  );
  if (igual) throw new ErroValidacao('nome', 'duplicado');
  const sigla = normalizarSigla(dados.sigla) ?? sugerirSigla(nome);
  const mesmaSigla = await db.primeiro<{ id: string }>(
    `SELECT id FROM obras WHERE excluido_em IS NULL AND upper(sigla) = ? AND empresa_id IS ? AND id <> ?`,
    [sigla, ctx.empresaId, ignorarId ?? ''],
  );
  if (mesmaSigla) throw new ErroValidacao('sigla', 'duplicado');
  return { nome, sigla };
}

/** Maiúsculas, sem espaços, até 6 caracteres. */
export function normalizarSigla(s: string | null | undefined): string | null {
  const t = (s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  return t === '' ? null : t;
}

/** Iniciais das palavras; para nome de uma palavra só, as três primeiras letras. */
export function sugerirSigla(nome: string): string {
  const semAcento = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const palavras = semAcento.split(/[^A-Z0-9]+/).filter((p) => p.length > 2 || /\d/.test(p));
  const base = palavras.length >= 2 ? palavras.map((p) => p[0]).join('') : (palavras[0] ?? semAcento.replace(/[^A-Z0-9]/g, ''));
  return (base.slice(0, palavras.length >= 2 ? 4 : 3) || 'OBR').padEnd(2, 'X');
}

/** Sigla exibida mesmo para obras antigas sem sigla gravada. */
export const siglaDe = (o: { sigla: string | null; nome: string }) => o.sigla || sugerirSigla(o.nome);

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
  const { nome, sigla } = await validar(db, dados, ctx, null);
  const agora = ctx.agora();
  const obra: Obra = {
    id: ctx.novoId(),
    empresa_id: ctx.empresaId,
    nome,
    sigla,
    cliente: limpar(dados.cliente),
    responsavel: limpar(dados.responsavel),
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
      `INSERT INTO obras (id, empresa_id, nome, sigla, cliente, responsavel, codigo, endereco, ativa, criado_em, atualizado_em, criado_por, atualizado_por, excluido_em, versao)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0)`,
      [obra.id, obra.empresa_id, obra.nome, obra.sigla, obra.cliente, obra.responsavel, obra.codigo, obra.endereco, obra.ativa, agora, agora, obra.criado_por, obra.atualizado_por],
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
  const { nome, sigla } = await validar(db, { ...dados, sigla: dados.sigla ?? antes.sigla }, ctx, id);
  const depois: Obra = {
    ...antes,
    nome,
    sigla,
    cliente: dados.cliente === undefined ? antes.cliente : limpar(dados.cliente),
    responsavel: dados.responsavel === undefined ? antes.responsavel : limpar(dados.responsavel),
    codigo: limpar(dados.codigo),
    endereco: limpar(dados.endereco),
    ativa: dados.ativa === undefined ? antes.ativa : dados.ativa ? 1 : 0,
    atualizado_em: ctx.agora(),
    atualizado_por: ctx.usuarioId,
  };
  await db.transacao(async (tx) => {
    await tx.rodar(
      `UPDATE obras SET nome = ?, sigla = ?, cliente = ?, responsavel = ?, codigo = ?, endereco = ?, ativa = ?, atualizado_em = ?, atualizado_por = ? WHERE id = ?`,
      [depois.nome, depois.sigla, depois.cliente, depois.responsavel, depois.codigo, depois.endereco, depois.ativa, depois.atualizado_em, depois.atualizado_por, id],
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
