import assert from 'node:assert/strict';
import { test } from 'node:test';

import { datasDeRompimento, dataCivilValida, diaDaSemana, diasEntre, somarDias } from '@/core/datas';
import { MIGRACOES, migrar, versaoDoBanco } from '@/core/db/migracoes';
import { pode } from '@/core/permissoes';
import { contarPendentes, listarPendentes } from '@/core/sync/fila';
import { garantirDispositivoId, gravarConfig, lerConfig } from '@/features/config/config.repo';
import {
  alterarObra,
  buscarObra,
  contarObrasAtivas,
  criarObra,
  ErroValidacao,
  excluirObra,
  listarObras,
} from '@/features/obras/obras.repo';
import { es } from '@/i18n/es';
import { GLOSSARIO } from '@/i18n/glossario';
import { pt } from '@/i18n/pt';

import { contextoDeTeste, dbDeTeste } from './db-node';

async function bancoMigrado() {
  const db = dbDeTeste();
  await migrar(db);
  return db;
}

test('migrações: aplicam do zero, são idempotentes e recusam banco mais novo', async () => {
  const db = dbDeTeste();
  assert.equal(await migrar(db), MIGRACOES.length);
  assert.equal(await migrar(db), MIGRACOES.length);
  assert.equal(await versaoDoBanco(db), MIGRACOES.length);
  await db.exec(`PRAGMA user_version = ${MIGRACOES.length + 1}`);
  await assert.rejects(() => migrar(db), /Atualize o aplicativo/);
});

test('migrações: uma migração com erro não deixa o banco pela metade', async () => {
  const db = dbDeTeste();
  await assert.rejects(() => migrar(db, ['CREATE TABLE a (x); CREATE TABLE a (x);']));
  assert.equal(await versaoDoBanco(db), 0);
  const t = await db.todos(`SELECT name FROM sqlite_master WHERE name = 'a'`);
  assert.equal(t.length, 0);
});

test('obras: criar grava o dado, a fila de envio e o histórico juntos', async () => {
  const db = await bancoMigrado();
  const ctx = contextoDeTeste();
  const obra = await criarObra(db, ctx, { nome: '  Oceana  ', endereco: '' });
  assert.equal(obra.nome, 'Oceana');
  assert.equal(obra.endereco, null);
  assert.equal(obra.empresa_id, 'empresa-1');
  assert.equal(await contarObrasAtivas(db), 1);

  const fila = await listarPendentes(db);
  assert.equal(fila.length, 1);
  assert.equal(fila[0].tabela, 'obras');
  assert.equal(fila[0].registro_id, obra.id);
  assert.equal(fila[0].operacao, 'salvar');
  assert.equal(fila[0].versao_base, 0);
  assert.equal(JSON.parse(fila[0].dados).nome, 'Oceana');

  const hist = await db.todos<{ acao: string; usuario_id: string; dispositivo_id: string }>('SELECT * FROM historico');
  assert.deepEqual(
    hist.map((h) => [h.acao, h.usuario_id, h.dispositivo_id]),
    [['criar', 'usuario-1', 'aparelho-1']],
  );
});

test('obras: nome obrigatório e sem duplicata (ignora maiúsculas)', async () => {
  const db = await bancoMigrado();
  const ctx = contextoDeTeste();
  await assert.rejects(() => criarObra(db, ctx, { nome: '   ' }), (e: ErroValidacao) => e.codigo === 'obrigatorio');
  await criarObra(db, ctx, { nome: 'Oceana' });
  await assert.rejects(() => criarObra(db, ctx, { nome: 'OCEANA' }), (e: ErroValidacao) => e.codigo === 'duplicado');
  assert.equal(await contarPendentes(db), 1, 'tentativas recusadas não entram na fila');
});

test('obras: alterar guarda antes/depois e a versão base para detectar conflito', async () => {
  const db = await bancoMigrado();
  const ctx = contextoDeTeste();
  const obra = await criarObra(db, ctx, { nome: 'Oceana' });
  await db.rodar('UPDATE obras SET versao = 3 WHERE id = ?', [obra.id]); // como se o servidor já tivesse confirmado
  const nova = await alterarObra(db, ctx, obra.id, { nome: 'Oceana Torre B', ativa: false });
  assert.equal(nova.ativa, 0);
  assert.equal(await contarObrasAtivas(db), 0);
  assert.equal((await listarObras(db)).length, 0);
  assert.equal((await listarObras(db, { incluirEncerradas: true })).length, 1);
  const fila = await listarPendentes(db);
  assert.equal(fila[1].versao_base, 3);
  const h = await db.primeiro<{ antes: string; depois: string }>(`SELECT * FROM historico WHERE acao = 'alterar'`);
  assert.equal(JSON.parse(h!.antes).nome, 'Oceana');
  assert.equal(JSON.parse(h!.depois).nome, 'Oceana Torre B');
  // Salvar a própria obra com o mesmo nome não é duplicata.
  await alterarObra(db, ctx, obra.id, { nome: 'Oceana Torre B' });
});

test('obras: excluir é lógico, entra na fila e libera o nome', async () => {
  const db = await bancoMigrado();
  const ctx = contextoDeTeste();
  const obra = await criarObra(db, ctx, { nome: 'Oceana' });
  await excluirObra(db, ctx, obra.id);
  assert.equal(await buscarObra(db, obra.id), null);
  const bruto = await db.primeiro<{ excluido_em: string }>('SELECT excluido_em FROM obras WHERE id = ?', [obra.id]);
  assert.ok(bruto?.excluido_em, 'a linha continua no banco');
  const fila = await listarPendentes(db);
  assert.deepEqual(fila.map((f) => f.operacao), ['salvar', 'excluir']);
  await criarObra(db, ctx, { nome: 'Oceana' });
  await assert.rejects(() => excluirObra(db, ctx, 'nao-existe'), (e: ErroValidacao) => e.codigo === 'nao_encontrado');
});

test('obras: falha no meio da gravação desfaz tudo (sem dado órfão nem fila órfã)', async () => {
  const db = await bancoMigrado();
  let n = 0;
  const ctx = contextoDeTeste({ novoId: () => (++n === 3 ? (null as unknown as string) : `id-${n}`) }); // 3º id quebra o histórico
  await assert.rejects(() => criarObra(db, ctx, { nome: 'Oceana' }));
  assert.equal((await listarObras(db)).length, 0);
  assert.equal(await contarPendentes(db), 0);
});

test('config local: grava, sobrescreve, apaga e mantém o id do aparelho', async () => {
  const db = await bancoMigrado();
  assert.equal(await lerConfig(db, 'idioma'), null);
  await gravarConfig(db, 'idioma', 'es');
  await gravarConfig(db, 'idioma', 'pt');
  assert.equal(await lerConfig(db, 'idioma'), 'pt');
  await gravarConfig(db, 'idioma', null);
  assert.equal(await lerConfig(db, 'idioma'), null);
  const id = await garantirDispositivoId(db, () => 'ap-1');
  assert.equal(await garantirDispositivoId(db, () => 'ap-2'), id);
});

test('datas civis: somam dias sem depender de fuso nem de horário de verão', () => {
  assert.equal(somarDias('2026-11-13', 7), '2026-11-20');
  assert.equal(somarDias('2026-11-13', 28), '2026-12-11');
  assert.equal(somarDias('2026-11-13', 63), '2027-01-15');
  assert.equal(somarDias('2028-02-28', 1), '2028-02-29'); // bissexto
  assert.equal(somarDias('2026-03-07', 2), '2026-03-09'); // atravessa mudança de horário nos EUA
  assert.equal(diasEntre('2026-11-13', '2026-12-11'), 28);
  assert.equal(diasEntre('2026-12-11', '2026-11-13'), -28);
  assert.equal(diaDaSemana('2026-11-13'), 5); // sexta-feira
  assert.ok(!dataCivilValida('2026-02-30'));
  assert.ok(!dataCivilValida('13/11/2026'));
  assert.throws(() => somarDias('2026-13-01', 1));
  assert.deepEqual(datasDeRompimento('2026-11-13', [28, 7, 7, 0, 63]), [
    { idade: 7, data: '2026-11-20' },
    { idade: 28, data: '2026-12-11' },
    { idade: 63, data: '2027-01-15' },
  ]);
});

test('datas civis: mesmo resultado em qualquer fuso do aparelho', () => {
  const original = process.env.TZ;
  for (const tz of ['America/Sao_Paulo', 'America/Santiago', 'Pacific/Kiritimati', 'UTC']) {
    process.env.TZ = tz;
    assert.equal(somarDias('2026-09-05', 1), '2026-09-06', tz); // Chile adianta o relógio à meia-noite deste dia
    assert.equal(somarDias('2026-11-13', 28), '2026-12-11', tz);
  }
  process.env.TZ = original;
});

test('permissões por função', () => {
  assert.ok(pode('admin', 'obras.gerenciar'));
  assert.ok(!pode('laboratorista', 'obras.gerenciar'));
  assert.ok(pode('laboratorista', 'ensaios.registrar'));
  assert.ok(!pode('ajudante', 'ensaios.registrar'));
  assert.ok(pode('ajudante', 'fotos.registrar'));
  assert.ok(!pode(null, 'obras.ver'));
});

test('idiomas: espanhol tem exatamente as mesmas chaves do português, sem texto vazio', () => {
  const chaves = (o: object, p = ''): string[] =>
    Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? chaves(v, `${p}${k}.`) : [`${p}${k}`]));
  assert.deepEqual(chaves(es).sort(), chaves(pt).sort());
  const vazios = (o: object): boolean => Object.values(o).some((v) => (typeof v === 'object' ? vazios(v) : !String(v).trim()));
  assert.ok(!vazios(pt) && !vazios(es));
  assert.ok(GLOSSARIO.length >= 8 && GLOSSARIO.every((g) => g.pt && g.es));
});
