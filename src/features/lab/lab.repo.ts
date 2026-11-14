import { dataCivilValida, datasDeRompimento, somarDias, type DataCivil } from '@/core/datas';
import type { Contexto, Db, RegistroSync, SqlValor } from '@/core/db/tipos';
import { resistenciaMpa } from '@/core/resistencia';
import { contarPendentes, registrarMudanca } from '@/core/sync/fila';
import { gravarConfig, lerConfig } from '@/features/config/config.repo';
import { ErroValidacao } from '@/features/obras/obras.repo';

// ── Tipos ────────────────────────────────────────────────────────────────────

/** Recebimento de concreto: um caminhão / uma nota fiscal. */
export interface Recebimento extends RegistroSync {
  obra_id: string;
  nf: string;
  caminhao: string | null;
  concreteira: string | null;
  data_moldagem: DataCivil;
  hora_chegada: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
  volume_m3: number | null;
  fck: number | null;
  slump_especificado: number | null;
  slump_medido: number | null;
  peca: string | null;
  observacao: string | null;
  criado_por_nome: string | null;
}

export interface RecebimentoVisao extends Recebimento {
  obra_nome: string;
  obra_sigla: string | null;
  cliente: string | null;
  total_cps: number;
  rompidos: number;
}

export interface CorpoDeProva extends RegistroSync {
  recebimento_id: string;
  cb: number;
  idade_dias: number;
  data_rompimento: DataCivil;
  tanque_id: string | null;
  entrada_tanque_em: string | null;
  carga_kn: number | null;
  diametro_mm: number | null;
  mpa: number | null;
  observacao_ensaio: string | null;
  rompido_em: string | null;
  rompido_por: string | null;
  rompido_por_nome: string | null;
}

/** Corpo de prova com os dados herdados do recebimento e da obra. */
export interface CpVisao extends CorpoDeProva {
  obra_id: string;
  obra_nome: string;
  obra_sigla: string | null;
  cliente: string | null;
  nf: string;
  caminhao: string | null;
  data_moldagem: DataCivil;
  fck: number | null;
  moldado_por_nome: string | null;
  tanque_nome: string | null;
}

export type StatusCp = 'rompido' | 'atrasado' | 'hoje' | 'em_cura' | 'moldado';

/** Situação atual de um corpo de prova, derivada dos registros (nunca digitada). */
export function statusCp(cp: Pick<CorpoDeProva, 'mpa' | 'data_rompimento' | 'tanque_id'>, hoje: DataCivil): StatusCp {
  if (cp.mpa !== null) return 'rompido';
  if (cp.data_rompimento < hoje) return 'atrasado';
  if (cp.data_rompimento === hoje) return 'hoje';
  return cp.tanque_id ? 'em_cura' : 'moldado';
}

export const rotuloCb = (cb: number) => String(cb).padStart(2, '0');

export interface DadosRecebimento {
  obraId: string;
  nf: string;
  dataMoldagem: DataCivil;
  idades: number[];
  cpsPorIdade: number;
  caminhao?: string | null;
  concreteira?: string | null;
  horaChegada?: string | null;
  horaInicio?: string | null;
  horaFim?: string | null;
  volumeM3?: number | null;
  fck?: number | null;
  slumpEspecificado?: number | null;
  slumpMedido?: number | null;
  peca?: string | null;
  observacao?: string | null;
  /** Fotos já reduzidas (data URL): etiqueta, lote, nota fiscal. */
  fotos?: string[];
}

// ── Idades de rompimento (configurável) ─────────────────────────────────────

export const IDADES_PADRAO = [7, 28, 63];
export const IDADES_COMUNS = [3, 7, 14, 28, 56, 63, 91];

export async function lerIdades(db: Db): Promise<number[]> {
  try {
    const v = JSON.parse((await lerConfig(db, 'idades')) ?? 'null');
    if (Array.isArray(v) && v.length && v.every((n) => Number.isInteger(n) && n > 0)) return v;
  } catch {}
  return IDADES_PADRAO;
}

export async function gravarIdades(db: Db, idades: number[]): Promise<number[]> {
  const limpas = [...new Set(idades.filter((n) => Number.isInteger(n) && n > 0 && n <= 730))].sort((a, b) => a - b);
  if (!limpas.length) throw new ErroValidacao('idades', 'obrigatorio');
  await gravarConfig(db, 'idades', JSON.stringify(limpas));
  return limpas;
}

// ── Recebimentos ─────────────────────────────────────────────────────────────

const limpar = (s: string | null | undefined) => (s ?? '').trim() || null;

function base(ctx: Contexto, agora: string) {
  return {
    empresa_id: ctx.empresaId,
    criado_em: agora,
    atualizado_em: agora,
    criado_por: ctx.usuarioId,
    atualizado_por: ctx.usuarioId,
    excluido_em: null,
    versao: 0,
  };
}

export async function criarRecebimento(
  db: Db,
  ctx: Contexto,
  d: DadosRecebimento,
): Promise<{ recebimento: Recebimento; cps: CorpoDeProva[] }> {
  const nf = d.nf.trim();
  if (!nf) throw new ErroValidacao('nf', 'obrigatorio');
  if (!dataCivilValida(d.dataMoldagem)) throw new ErroValidacao('data', 'obrigatorio');
  const datas = datasDeRompimento(d.dataMoldagem, d.idades);
  if (!datas.length) throw new ErroValidacao('idades', 'obrigatorio');
  const porIdade = Math.floor(d.cpsPorIdade);
  if (!(porIdade >= 1 && porIdade <= 10)) throw new ErroValidacao('cps', 'obrigatorio');
  const obra = await db.primeiro<{ id: string }>('SELECT id FROM obras WHERE id = ? AND excluido_em IS NULL', [d.obraId]);
  if (!obra) throw new ErroValidacao('obra', 'nao_encontrado');
  const repetido = await db.primeiro<{ id: string }>(
    'SELECT id FROM recebimentos WHERE excluido_em IS NULL AND obra_id = ? AND lower(nf) = lower(?) AND data_moldagem = ?',
    [obra.id, nf, d.dataMoldagem],
  );
  if (repetido) throw new ErroValidacao('nf', 'duplicado');

  const agora = ctx.agora();
  const r: Recebimento = {
    id: ctx.novoId(),
    ...base(ctx, agora),
    obra_id: obra.id,
    nf,
    caminhao: limpar(d.caminhao),
    concreteira: limpar(d.concreteira),
    data_moldagem: d.dataMoldagem,
    hora_chegada: limpar(d.horaChegada),
    hora_inicio: limpar(d.horaInicio),
    hora_fim: limpar(d.horaFim),
    volume_m3: d.volumeM3 ?? null,
    fck: d.fck ?? null,
    slump_especificado: d.slumpEspecificado ?? null,
    slump_medido: d.slumpMedido ?? null,
    peca: limpar(d.peca),
    observacao: limpar(d.observacao),
    criado_por_nome: ctx.usuarioNome ?? null,
  };
  let cb = 0;
  const cps: CorpoDeProva[] = datas.flatMap(({ idade, data }) =>
    Array.from({ length: porIdade }, () => ({
      id: ctx.novoId(),
      ...base(ctx, agora),
      recebimento_id: r.id,
      cb: ++cb,
      idade_dias: idade,
      data_rompimento: data,
      tanque_id: null,
      entrada_tanque_em: null,
      carga_kn: null,
      diametro_mm: null,
      mpa: null,
      observacao_ensaio: null,
      rompido_em: null,
      rompido_por: null,
      rompido_por_nome: null,
    })),
  );

  await db.transacao(async (tx) => {
    await tx.rodar(
      `INSERT INTO recebimentos (id, empresa_id, obra_id, nf, caminhao, concreteira, data_moldagem, hora_chegada, hora_inicio, hora_fim,
         volume_m3, fck, slump_especificado, slump_medido, peca, observacao, criado_por_nome, criado_em, atualizado_em, criado_por, atualizado_por, excluido_em, versao)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0)`,
      [r.id, r.empresa_id, r.obra_id, r.nf, r.caminhao, r.concreteira, r.data_moldagem, r.hora_chegada, r.hora_inicio, r.hora_fim,
        r.volume_m3, r.fck, r.slump_especificado, r.slump_medido, r.peca, r.observacao, r.criado_por_nome, agora, agora, r.criado_por, r.atualizado_por],
    );
    await registrarMudanca(tx, ctx, { tabela: 'recebimentos', registroId: r.id, operacao: 'salvar', acao: 'criar', antes: null, depois: r, versaoBase: 0 });
    for (const c of cps) {
      await tx.rodar(
        `INSERT INTO corpos_de_prova (id, empresa_id, recebimento_id, cb, idade_dias, data_rompimento, criado_em, atualizado_em, criado_por, atualizado_por, excluido_em, versao)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0)`,
        [c.id, c.empresa_id, c.recebimento_id, c.cb, c.idade_dias, c.data_rompimento, agora, agora, c.criado_por, c.atualizado_por],
      );
      await registrarMudanca(tx, ctx, { tabela: 'corpos_de_prova', registroId: c.id, operacao: 'salvar', acao: 'criar', antes: null, depois: c, versaoBase: 0 });
    }
    for (const foto of d.fotos ?? []) await inserirFoto(tx, ctx, 'recebimentos', r.id, foto, agora);
  });
  return { recebimento: r, cps };
}

const SELECT_RECEBIMENTO = `
  SELECT r.*, o.nome AS obra_nome, o.sigla AS obra_sigla, o.cliente AS cliente,
         (SELECT COUNT(*) FROM corpos_de_prova c WHERE c.recebimento_id = r.id AND c.excluido_em IS NULL) AS total_cps,
         (SELECT COUNT(*) FROM corpos_de_prova c WHERE c.recebimento_id = r.id AND c.excluido_em IS NULL AND c.mpa IS NOT NULL) AS rompidos
  FROM recebimentos r JOIN obras o ON o.id = r.obra_id
  WHERE r.excluido_em IS NULL`;

export function listarRecebimentos(db: Db, filtro: { obraId?: string; limite?: number } = {}): Promise<RecebimentoVisao[]> {
  return db.todos<RecebimentoVisao>(
    `${SELECT_RECEBIMENTO} ${filtro.obraId ? 'AND r.obra_id = ?' : ''} ORDER BY r.data_moldagem DESC, r.criado_em DESC LIMIT ?`,
    filtro.obraId ? [filtro.obraId, filtro.limite ?? 200] : [filtro.limite ?? 200],
  );
}

export function buscarRecebimento(db: Db, id: string): Promise<RecebimentoVisao | null> {
  return db.primeiro<RecebimentoVisao>(`${SELECT_RECEBIMENTO} AND r.id = ?`, [id]);
}

// ── Corpos de prova ──────────────────────────────────────────────────────────

const SELECT_CP = `
  SELECT c.*, r.obra_id, o.nome AS obra_nome, o.sigla AS obra_sigla, o.cliente AS cliente, r.nf, r.caminhao, r.data_moldagem, r.fck,
         r.criado_por_nome AS moldado_por_nome, t.nome AS tanque_nome
  FROM corpos_de_prova c
  JOIN recebimentos r ON r.id = c.recebimento_id
  JOIN obras o ON o.id = r.obra_id
  LEFT JOIN tanques t ON t.id = c.tanque_id
  WHERE c.excluido_em IS NULL AND r.excluido_em IS NULL`;

export interface FiltroCps {
  /** Texto livre: sigla, obra, cliente, NF, "cb 02", data "29/10". Todas as palavras precisam bater. */
  busca?: string;
  recebimentoId?: string;
  obraId?: string;
  tanqueId?: string;
  idade?: number;
  /** Só os que ainda não romperam e não estão em nenhum tanque. */
  foraDoTanque?: boolean;
  limite?: number;
}

export function listarCps(db: Db, f: FiltroCps = {}): Promise<CpVisao[]> {
  const onde: string[] = [];
  const params: SqlValor[] = [];
  for (const palavra of (f.busca ?? '').toLowerCase().split(/\s+/).filter(Boolean)) {
    const data = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(palavra);
    if (data) {
      const dm = `-${data[2].padStart(2, '0')}-${data[1].padStart(2, '0')}`;
      onde.push('(r.data_moldagem LIKE ? OR c.data_rompimento LIKE ?)');
      const padrao = data[3] ? `${data[3].length === 2 ? '20' + data[3] : data[3]}${dm}` : `%${dm}`;
      params.push(padrao, padrao);
    } else {
      onde.push(
        `(lower(COALESCE(o.sigla, '') || ' ' || o.nome || ' ' || COALESCE(o.cliente, '') || ' ' || r.nf || ' ' || COALESCE(r.caminhao, '') || ' cb' || printf('%02d', c.cb) || ' ' || c.cb) LIKE ?)`,
      );
      params.push(`%${palavra}%`);
    }
  }
  if (f.recebimentoId) {
    onde.push('c.recebimento_id = ?');
    params.push(f.recebimentoId);
  }
  if (f.obraId) {
    onde.push('r.obra_id = ?');
    params.push(f.obraId);
  }
  if (f.tanqueId) {
    onde.push('c.tanque_id = ?');
    params.push(f.tanqueId);
  }
  if (f.idade) {
    onde.push('c.idade_dias = ?');
    params.push(f.idade);
  }
  if (f.foraDoTanque) onde.push('c.tanque_id IS NULL AND c.mpa IS NULL');
  params.push(f.limite ?? 300);
  return db.todos<CpVisao>(
    `${SELECT_CP} ${onde.map((o) => `AND ${o}`).join(' ')} ORDER BY r.data_moldagem DESC, r.criado_em DESC, c.cb LIMIT ?`,
    params,
  );
}

export function buscarCp(db: Db, id: string): Promise<CpVisao | null> {
  return db.primeiro<CpVisao>(`${SELECT_CP} AND c.id = ?`, [id]);
}

// ── Rompimentos ──────────────────────────────────────────────────────────────

/** Um grupo = os CPs de um recebimento que rompem na mesma idade. É a unidade de trabalho na prensa. */
export interface GrupoAgenda {
  recebimento_id: string;
  idade_dias: number;
  data_rompimento: DataCivil;
  obra_nome: string;
  obra_sigla: string | null;
  nf: string;
  fck: number | null;
  total: number;
  rompidos: number;
  cbs: number[];
  /** Maior resistência individual do grupo, quando já há rompimento. Não é o fck. */
  maior_mpa: number | null;
  media_mpa: number | null;
}

export interface Agenda {
  atrasados: GrupoAgenda[];
  hoje: GrupoAgenda[];
  proximos: GrupoAgenda[];
  realizados: GrupoAgenda[];
}

export async function montarAgenda(db: Db, hoje: DataCivil, diasAFrente = 30): Promise<Agenda> {
  const linhas = await db.todos<Omit<GrupoAgenda, 'cbs'> & { cbs: string }>(
    `SELECT c.recebimento_id, c.idade_dias, c.data_rompimento, o.nome AS obra_nome, o.sigla AS obra_sigla, r.nf, r.fck,
            COUNT(*) AS total, SUM(c.mpa IS NOT NULL) AS rompidos, GROUP_CONCAT(c.cb) AS cbs, MAX(c.mpa) AS maior_mpa, AVG(c.mpa) AS media_mpa
     FROM corpos_de_prova c JOIN recebimentos r ON r.id = c.recebimento_id JOIN obras o ON o.id = r.obra_id
     WHERE c.excluido_em IS NULL AND r.excluido_em IS NULL AND c.data_rompimento <= ?
     GROUP BY c.recebimento_id, c.idade_dias
     ORDER BY c.data_rompimento, o.nome, r.nf`,
    [somarDias(hoje, diasAFrente)],
  );
  const agenda: Agenda = { atrasados: [], hoje: [], proximos: [], realizados: [] };
  for (const l of linhas) {
    const g: GrupoAgenda = { ...l, cbs: l.cbs.split(',').map(Number).sort((a, b) => a - b) };
    const pendente = g.rompidos < g.total;
    if (!pendente) agenda.realizados.push(g);
    else if (g.data_rompimento === hoje) agenda.hoje.push(g);
    else if (g.data_rompimento < hoje) agenda.atrasados.push(g);
    else agenda.proximos.push(g);
  }
  agenda.realizados.reverse();
  return agenda;
}

/**
 * Registra o resultado do rompimento de um corpo de prova e, se ele estava em um tanque,
 * a saída para ensaio. Corrigir um resultado é permitido; o valor anterior fica no histórico.
 */
export async function registrarRompimento(
  db: Db,
  ctx: Contexto,
  cpId: string,
  r: { cargaKn: number; diametroMm: number; observacao?: string | null },
): Promise<CorpoDeProva> {
  const antes = await db.primeiro<CorpoDeProva>('SELECT * FROM corpos_de_prova WHERE id = ? AND excluido_em IS NULL', [cpId]);
  if (!antes) throw new ErroValidacao('cp', 'nao_encontrado');
  if (!(r.cargaKn > 0) || !(r.diametroMm > 0)) throw new ErroValidacao('carga', 'obrigatorio');
  const agora = ctx.agora();
  const depois: CorpoDeProva = {
    ...antes,
    carga_kn: r.cargaKn,
    diametro_mm: r.diametroMm,
    mpa: resistenciaMpa(r.cargaKn, r.diametroMm),
    observacao_ensaio: limpar(r.observacao),
    rompido_em: agora,
    rompido_por: ctx.usuarioId,
    rompido_por_nome: ctx.usuarioNome ?? null,
    tanque_id: null,
    entrada_tanque_em: null,
    atualizado_em: agora,
    atualizado_por: ctx.usuarioId,
  };
  await db.transacao(async (tx) => {
    await tx.rodar(
      `UPDATE corpos_de_prova SET carga_kn = ?, diametro_mm = ?, mpa = ?, observacao_ensaio = ?, rompido_em = ?, rompido_por = ?, rompido_por_nome = ?,
         tanque_id = NULL, entrada_tanque_em = NULL, atualizado_em = ?, atualizado_por = ? WHERE id = ?`,
      [depois.carga_kn, depois.diametro_mm, depois.mpa, depois.observacao_ensaio, agora, depois.rompido_por, depois.rompido_por_nome, agora, depois.atualizado_por, cpId],
    );
    if (antes.tanque_id) await inserirMovimento(tx, ctx, cpId, antes.tanque_id, 'saida', 'ensaio', agora);
    await registrarMudanca(tx, ctx, { tabela: 'corpos_de_prova', registroId: cpId, operacao: 'salvar', acao: 'alterar', antes, depois, versaoBase: antes.versao });
  });
  return depois;
}

// ── Tanques de cura ──────────────────────────────────────────────────────────

export interface Tanque {
  id: string;
  nome: string;
  ordem: number;
  /** Corpos de prova armazenados agora. */
  quantidade: number;
  /** Quantos deles já passaram da data de rompimento. */
  vencidos: number;
  proxima_saida: DataCivil | null;
}

export function listarTanques(db: Db, hoje: DataCivil): Promise<Tanque[]> {
  return db.todos<Tanque>(
    `SELECT t.id, t.nome, t.ordem, COUNT(c.id) AS quantidade,
            COALESCE(SUM(c.data_rompimento < ?), 0) AS vencidos, MIN(c.data_rompimento) AS proxima_saida
     FROM tanques t LEFT JOIN corpos_de_prova c ON c.tanque_id = t.id AND c.excluido_em IS NULL
     WHERE t.excluido_em IS NULL GROUP BY t.id ORDER BY t.ordem`,
    [hoje],
  );
}

export async function renomearTanque(db: Db, ctx: Contexto, id: string, nome: string): Promise<void> {
  const novo = nome.trim();
  if (!novo) throw new ErroValidacao('nome', 'obrigatorio');
  const antes = await db.primeiro<{ id: string; nome: string; versao: number }>('SELECT id, nome, versao FROM tanques WHERE id = ?', [id]);
  if (!antes) throw new ErroValidacao('tanque', 'nao_encontrado');
  const agora = ctx.agora();
  await db.transacao(async (tx) => {
    await tx.rodar('UPDATE tanques SET nome = ?, atualizado_em = ?, atualizado_por = ? WHERE id = ?', [novo, agora, ctx.usuarioId, id]);
    await registrarMudanca(tx, ctx, { tabela: 'tanques', registroId: id, operacao: 'salvar', acao: 'alterar', antes, depois: { ...antes, nome: novo }, versaoBase: antes.versao });
  });
}

export type MotivoSaida = 'ensaio' | 'transporte' | 'outro';

async function inserirMovimento(tx: Db, ctx: Contexto, cpId: string, tanqueId: string, tipo: 'entrada' | 'saida', motivo: string | null, agora: string) {
  const m = { id: ctx.novoId(), empresa_id: ctx.empresaId, cp_id: cpId, tanque_id: tanqueId, tipo, motivo, em: agora, por: ctx.usuarioId, por_nome: ctx.usuarioNome ?? null };
  await tx.rodar(
    'INSERT INTO tanque_movimentos (id, empresa_id, cp_id, tanque_id, tipo, motivo, em, por, por_nome) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [m.id, m.empresa_id, m.cp_id, m.tanque_id, m.tipo, m.motivo, m.em, m.por, m.por_nome],
  );
  await registrarMudanca(tx, ctx, { tabela: 'tanque_movimentos', registroId: m.id, operacao: 'salvar', acao: 'criar', antes: null, depois: m, versaoBase: 0 });
}

/**
 * Coloca um ou vários corpos de prova em um tanque, com histórico individual.
 * Quem já está em outro tanque sai de lá (transferência). Rompidos são recusados.
 */
export async function guardarNoTanque(db: Db, ctx: Contexto, cpIds: string[], tanqueId: string): Promise<number> {
  if (!cpIds.length) return 0;
  const tanque = await db.primeiro<{ id: string }>('SELECT id FROM tanques WHERE id = ? AND excluido_em IS NULL', [tanqueId]);
  if (!tanque) throw new ErroValidacao('tanque', 'nao_encontrado');
  const agora = ctx.agora();
  let movidos = 0;
  await db.transacao(async (tx) => {
    for (const id of cpIds) {
      const antes = await tx.primeiro<CorpoDeProva>('SELECT * FROM corpos_de_prova WHERE id = ? AND excluido_em IS NULL', [id]);
      if (!antes) throw new ErroValidacao('cp', 'nao_encontrado');
      if (antes.mpa !== null) throw new ErroValidacao('cp', 'duplicado');
      if (antes.tanque_id === tanqueId) continue;
      if (antes.tanque_id) await inserirMovimento(tx, ctx, id, antes.tanque_id, 'saida', 'transferencia', agora);
      await inserirMovimento(tx, ctx, id, tanqueId, 'entrada', null, agora);
      const depois = { ...antes, tanque_id: tanqueId, entrada_tanque_em: agora, atualizado_em: agora, atualizado_por: ctx.usuarioId };
      await tx.rodar('UPDATE corpos_de_prova SET tanque_id = ?, entrada_tanque_em = ?, atualizado_em = ?, atualizado_por = ? WHERE id = ?', [
        tanqueId, agora, agora, ctx.usuarioId, id,
      ]);
      await registrarMudanca(tx, ctx, { tabela: 'corpos_de_prova', registroId: id, operacao: 'salvar', acao: 'alterar', antes, depois, versaoBase: antes.versao });
      movidos++;
    }
  });
  return movidos;
}

export async function retirarDoTanque(db: Db, ctx: Contexto, cpIds: string[], motivo: MotivoSaida): Promise<number> {
  const agora = ctx.agora();
  let retirados = 0;
  await db.transacao(async (tx) => {
    for (const id of cpIds) {
      const antes = await tx.primeiro<CorpoDeProva>('SELECT * FROM corpos_de_prova WHERE id = ? AND excluido_em IS NULL', [id]);
      if (!antes?.tanque_id) continue;
      await inserirMovimento(tx, ctx, id, antes.tanque_id, 'saida', motivo, agora);
      const depois = { ...antes, tanque_id: null, entrada_tanque_em: null, atualizado_em: agora, atualizado_por: ctx.usuarioId };
      await tx.rodar('UPDATE corpos_de_prova SET tanque_id = NULL, entrada_tanque_em = NULL, atualizado_em = ?, atualizado_por = ? WHERE id = ?', [
        agora, ctx.usuarioId, id,
      ]);
      await registrarMudanca(tx, ctx, { tabela: 'corpos_de_prova', registroId: id, operacao: 'salvar', acao: 'alterar', antes, depois, versaoBase: antes.versao });
      retirados++;
    }
  });
  return retirados;
}

// ── Histórico do corpo de prova ──────────────────────────────────────────────

export interface EventoCp {
  em: string;
  tipo: 'moldagem' | 'entrada' | 'saida' | 'rompimento' | 'correcao' | 'foto';
  por_nome: string | null;
  tanque_nome?: string | null;
  motivo?: string | null;
  mpa?: number | null;
  mpa_anterior?: number | null;
}

/** Linha do tempo completa: moldagem, fotos, tanque e resultados, inclusive correções. */
export async function historicoDoCp(db: Db, cp: CpVisao): Promise<EventoCp[]> {
  const eventos: EventoCp[] = [{ em: cp.criado_em, tipo: 'moldagem', por_nome: cp.moldado_por_nome }];
  const movs = await db.todos<{ em: string; tipo: 'entrada' | 'saida'; motivo: string | null; por_nome: string | null; tanque_nome: string }>(
    `SELECT m.em, m.tipo, m.motivo, m.por_nome, t.nome AS tanque_nome FROM tanque_movimentos m JOIN tanques t ON t.id = m.tanque_id WHERE m.cp_id = ?`,
    [cp.id],
  );
  eventos.push(...movs);
  const alteracoes = await db.todos<{ antes: string; depois: string; criado_em: string }>(
    `SELECT antes, depois, criado_em FROM historico WHERE tabela = 'corpos_de_prova' AND registro_id = ? AND acao = 'alterar'`,
    [cp.id],
  );
  for (const a of alteracoes) {
    const antes = JSON.parse(a.antes) as CorpoDeProva;
    const depois = JSON.parse(a.depois) as CorpoDeProva;
    if (depois.mpa !== null && depois.rompido_em !== antes.rompido_em) {
      eventos.push({
        em: a.criado_em,
        tipo: antes.mpa === null ? 'rompimento' : 'correcao',
        por_nome: depois.rompido_por_nome,
        mpa: depois.mpa,
        mpa_anterior: antes.mpa,
      });
    }
  }
  const fotos = await db.todos<{ criado_em: string; criado_por_nome: string | null }>(
    `SELECT criado_em, criado_por_nome FROM fotos WHERE tabela = 'corpos_de_prova' AND registro_id = ?`,
    [cp.id],
  );
  eventos.push(...fotos.map((f) => ({ em: f.criado_em, tipo: 'foto' as const, por_nome: f.criado_por_nome })));
  const ordem = { moldagem: 0, foto: 1, entrada: 3, saida: 2, rompimento: 4, correcao: 5 };
  return eventos.sort((a, b) => (a.em < b.em ? -1 : a.em > b.em ? 1 : ordem[a.tipo] - ordem[b.tipo]));
}

// ── Fotos ────────────────────────────────────────────────────────────────────

export type TabelaFoto = 'recebimentos' | 'corpos_de_prova' | 'obras';

async function inserirFoto(tx: Db, ctx: Contexto, tabela: TabelaFoto, registroId: string, dados: string, agora: string): Promise<string> {
  const id = ctx.novoId();
  await tx.rodar(
    'INSERT INTO fotos (id, empresa_id, tabela, registro_id, dados, criado_em, criado_por, criado_por_nome, enviada) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)',
    [id, ctx.empresaId, tabela, registroId, dados, agora, ctx.usuarioId, ctx.usuarioNome ?? null],
  );
  return id;
}

export async function adicionarFoto(db: Db, ctx: Contexto, tabela: TabelaFoto, registroId: string, dados: string): Promise<string> {
  if (!dados.startsWith('data:image/')) throw new ErroValidacao('foto', 'obrigatorio');
  return inserirFoto(db, ctx, tabela, registroId, dados, ctx.agora());
}

export interface Foto {
  id: string;
  dados: string;
  criado_em: string;
  criado_por_nome: string | null;
}

export function listarFotos(db: Db, tabela: TabelaFoto, registroId: string): Promise<Foto[]> {
  return db.todos<Foto>('SELECT id, dados, criado_em, criado_por_nome FROM fotos WHERE tabela = ? AND registro_id = ? ORDER BY criado_em', [
    tabela,
    registroId,
  ]);
}

// ── Painel ───────────────────────────────────────────────────────────────────

export interface Indicadores {
  obrasAtivas: number;
  recebimentos: number;
  cps: number;
  emCura: number;
  aguardando: number;
  hoje: number;
  atrasados: number;
  rompidos: number;
  pendentesEnvio: number;
}

export async function lerIndicadores(db: Db, hoje: DataCivil): Promise<Indicadores> {
  const n = async (sql: string, p: SqlValor[] = []) => (await db.primeiro<{ n: number }>(sql, p))?.n ?? 0;
  const vivos = `FROM corpos_de_prova c JOIN recebimentos r ON r.id = c.recebimento_id WHERE c.excluido_em IS NULL AND r.excluido_em IS NULL`;
  return {
    obrasAtivas: await n('SELECT COUNT(*) AS n FROM obras WHERE excluido_em IS NULL AND ativa = 1'),
    recebimentos: await n('SELECT COUNT(*) AS n FROM recebimentos WHERE excluido_em IS NULL'),
    cps: await n(`SELECT COUNT(*) AS n ${vivos}`),
    emCura: await n(`SELECT COUNT(*) AS n ${vivos} AND c.tanque_id IS NOT NULL`),
    aguardando: await n(`SELECT COUNT(*) AS n ${vivos} AND c.mpa IS NULL AND c.data_rompimento <= ?`, [hoje]),
    hoje: await n(`SELECT COUNT(*) AS n ${vivos} AND c.mpa IS NULL AND c.data_rompimento = ?`, [hoje]),
    atrasados: await n(`SELECT COUNT(*) AS n ${vivos} AND c.mpa IS NULL AND c.data_rompimento < ?`, [hoje]),
    rompidos: await n(`SELECT COUNT(*) AS n ${vivos} AND c.mpa IS NOT NULL`),
    pendentesEnvio: await contarPendentes(db),
  };
}

/** Quantos corpos de prova têm rompimento previsto em cada um dos próximos dias (hoje incluso). */
export async function previsaoPorDia(db: Db, hoje: DataCivil, dias = 7): Promise<{ data: DataCivil; pendentes: number }[]> {
  const linhas = await db.todos<{ data: DataCivil; n: number }>(
    `SELECT c.data_rompimento AS data, COUNT(*) AS n FROM corpos_de_prova c JOIN recebimentos r ON r.id = c.recebimento_id
     WHERE c.excluido_em IS NULL AND r.excluido_em IS NULL AND c.mpa IS NULL AND c.data_rompimento >= ? AND c.data_rompimento < ?
     GROUP BY c.data_rompimento`,
    [hoje, somarDias(hoje, dias)],
  );
  const mapa = new Map(linhas.map((l) => [l.data, l.n]));
  return Array.from({ length: dias }, (_, i) => {
    const data = somarDias(hoje, i);
    return { data, pendentes: mapa.get(data) ?? 0 };
  });
}

export interface Atividade {
  em: string;
  tipo: 'recebimento' | 'rompimento' | 'entrada' | 'saida';
  por_nome: string | null;
  obra_sigla: string | null;
  obra_nome: string;
  nf: string;
  cb: number | null;
  total_cps: number | null;
  mpa: number | null;
  tanque_nome: string | null;
  /** Para abrir o registro ao tocar. */
  recebimento_id: string;
  cp_id: string | null;
}

export function atividadesRecentes(db: Db, limite = 8): Promise<Atividade[]> {
  return db.todos<Atividade>(
    `SELECT * FROM (
       SELECT r.criado_em AS em, 'recebimento' AS tipo, r.criado_por_nome AS por_nome, o.sigla AS obra_sigla, o.nome AS obra_nome, r.nf,
              NULL AS cb, (SELECT COUNT(*) FROM corpos_de_prova c WHERE c.recebimento_id = r.id) AS total_cps, NULL AS mpa, NULL AS tanque_nome,
              r.id AS recebimento_id, NULL AS cp_id
       FROM recebimentos r JOIN obras o ON o.id = r.obra_id WHERE r.excluido_em IS NULL
       UNION ALL
       SELECT c.rompido_em, 'rompimento', c.rompido_por_nome, o.sigla, o.nome, r.nf, c.cb, NULL, c.mpa, NULL, r.id, c.id
       FROM corpos_de_prova c JOIN recebimentos r ON r.id = c.recebimento_id JOIN obras o ON o.id = r.obra_id
       WHERE c.rompido_em IS NOT NULL AND c.excluido_em IS NULL
       UNION ALL
       SELECT m.em, m.tipo, m.por_nome, o.sigla, o.nome, r.nf, c.cb, NULL, NULL, t.nome, r.id, c.id
       FROM tanque_movimentos m JOIN corpos_de_prova c ON c.id = m.cp_id JOIN recebimentos r ON r.id = c.recebimento_id
       JOIN obras o ON o.id = r.obra_id JOIN tanques t ON t.id = m.tanque_id
       WHERE NOT (m.tipo = 'saida' AND m.motivo = 'ensaio')
     ) ORDER BY em DESC LIMIT ?`,
    [limite],
  );
}

export interface ResumoObra {
  obra_id: string;
  recebimentos: number;
  cps: number;
  pendentes: number;
}

export function resumoPorObra(db: Db): Promise<ResumoObra[]> {
  return db.todos<ResumoObra>(
    `SELECT r.obra_id, COUNT(DISTINCT r.id) AS recebimentos, COUNT(c.id) AS cps, COALESCE(SUM(c.id IS NOT NULL AND c.mpa IS NULL), 0) AS pendentes
     FROM recebimentos r LEFT JOIN corpos_de_prova c ON c.recebimento_id = r.id AND c.excluido_em IS NULL
     WHERE r.excluido_em IS NULL GROUP BY r.obra_id`,
  );
}
