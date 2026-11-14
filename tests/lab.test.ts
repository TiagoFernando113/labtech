import assert from 'node:assert/strict';
import { test } from 'node:test';

import { migrar } from '@/core/db/migracoes';
import { areaMm2, formatarMpa, lerNumero, paraKn, resistenciaMpa } from '@/core/resistencia';
import { contarPendentes } from '@/core/sync/fila';
import {
  adicionarFoto, atividadesRecentes, buscarCp, criarRecebimento, gravarIdades, guardarNoTanque, historicoDoCp, lerIdades,
  lerIndicadores, listarCps, listarFotos, listarRecebimentos, listarTanques, montarAgenda, previsaoPorDia, registrarRompimento,
  resumoPorObra, retirarDoTanque, statusCp,
} from '@/features/lab/lab.repo';
import { alterarObra, criarObra, ErroValidacao, sugerirSigla } from '@/features/obras/obras.repo';

import { contextoDeTeste, dbDeTeste } from './db-node';

async function cenario() {
  const db = dbDeTeste();
  await migrar(db);
  const ctx = contextoDeTeste({ usuarioNome: 'Ana Lab' });
  const obra = await criarObra(db, ctx, { nome: 'Residencial Ypê', cliente: 'Ypê Construtora' });
  const { recebimento, cps } = await criarRecebimento(db, ctx, {
    obraId: obra.id, nf: '5068/03', dataMoldagem: '2026-10-29', idades: [28, 7, 63], cpsPorIdade: 2, fck: 30, caminhao: 'ABC-1234',
  });
  return { db, ctx, obra, recebimento, cps };
}

test('resistência: fórmula, unidades e leitura de número', () => {
  assert.ok(Math.abs(areaMm2(100) - 7853.98) < 0.01);
  assert.ok(Math.abs(resistenciaMpa(235.62, 100) - 30) < 0.01); // 235,62 kN em CP 10x20 = 30 MPa
  assert.ok(Math.abs(resistenciaMpa(530.14, 150) - 30) < 0.01); // 530,14 kN em CP 15x30 = 30 MPa
  assert.ok(Math.abs(paraKn(24, 'tf') - 235.36) < 0.01);
  assert.ok(Math.abs(paraKn(24000, 'kgf') - 235.36) < 0.01);
  assert.equal(paraKn(235000, 'N'), 235);
  assert.throws(() => resistenciaMpa(0, 100));
  assert.throws(() => resistenciaMpa(100, 0));
  assert.equal(lerNumero('235,6'), 235.6);
  assert.equal(lerNumero('235.6'), 235.6);
  assert.equal(lerNumero('1.235,6'), 1235.6);
  assert.equal(lerNumero('abc'), null);
  assert.equal(lerNumero('-5'), null);
  assert.equal(formatarMpa(29.96), '30,0');
});

test('obra: sigla sugerida, normalizada e única', async () => {
  assert.equal(sugerirSigla('Residencial Ypê'), 'RY');
  assert.equal(sugerirSigla('Oceana'), 'OCE');
  assert.equal(sugerirSigla('Lado 37'), 'L3');
  const { db, ctx, obra } = await cenario();
  assert.equal(obra.sigla, 'RY');
  const b = await criarObra(db, ctx, { nome: 'Oceana', sigla: ' oc-1 ' });
  assert.equal(b.sigla, 'OC1');
  await assert.rejects(() => criarObra(db, ctx, { nome: 'Outra', sigla: 'ry' }), (e: ErroValidacao) => e.campo === 'sigla' && e.codigo === 'duplicado');
  const c = await alterarObra(db, ctx, b.id, { nome: 'Oceana Torre B' });
  assert.equal(c.sigla, 'OC1', 'editar o nome não troca a sigla já definida');
});

test('recebimento: cria um registro por CP, com CB em sequência e data de rompimento por idade', async () => {
  const { db, cps, recebimento } = await cenario();
  assert.equal(cps.length, 6);
  assert.deepEqual(cps.map((c) => [c.cb, c.idade_dias, c.data_rompimento]), [
    [1, 7, '2026-11-05'], [2, 7, '2026-11-05'], [3, 28, '2026-11-26'], [4, 28, '2026-11-26'], [5, 63, '2026-12-31'], [6, 63, '2026-12-31'],
  ]);
  const visao = await listarCps(db, { recebimentoId: recebimento.id });
  assert.equal(visao.length, 6);
  assert.deepEqual([visao[0].obra_sigla, visao[0].nf, visao[0].cliente, visao[0].caminhao, visao[0].fck, visao[0].moldado_por_nome],
    ['RY', '5068/03', 'Ypê Construtora', 'ABC-1234', 30, 'Ana Lab'], 'CP herda os dados do recebimento e da obra');
  assert.equal(await contarPendentes(db), 1 + 1 + 6, 'obra + recebimento + 6 CPs na fila de envio');
  const [r] = await listarRecebimentos(db);
  assert.deepEqual([r.total_cps, r.rompidos, r.obra_sigla], [6, 0, 'RY']);
});

test('recebimento: valida NF, idades, quantidade, obra e duplicata', async () => {
  const { db, ctx, obra } = await cenario();
  const ok = { obraId: obra.id, nf: '1', dataMoldagem: '2026-10-29', idades: [7], cpsPorIdade: 2 };
  await assert.rejects(() => criarRecebimento(db, ctx, { ...ok, nf: ' ' }), (e: ErroValidacao) => e.campo === 'nf');
  await assert.rejects(() => criarRecebimento(db, ctx, { ...ok, idades: [] }), (e: ErroValidacao) => e.campo === 'idades');
  await assert.rejects(() => criarRecebimento(db, ctx, { ...ok, cpsPorIdade: 0 }), (e: ErroValidacao) => e.campo === 'cps');
  await assert.rejects(() => criarRecebimento(db, ctx, { ...ok, dataMoldagem: '29/10/2026' }), (e: ErroValidacao) => e.campo === 'data');
  await assert.rejects(() => criarRecebimento(db, ctx, { ...ok, obraId: 'x' }), (e: ErroValidacao) => e.campo === 'obra');
  await assert.rejects(() => criarRecebimento(db, ctx, { ...ok, nf: '5068/03' }), (e: ErroValidacao) => e.codigo === 'duplicado');
  assert.equal((await listarRecebimentos(db)).length, 1, 'nenhuma tentativa recusada deixou registro');
});

test('busca de CPs: sigla, NF, número do CB, cliente e data', async () => {
  const { db, ctx } = await cenario();
  const outra = await criarObra(db, ctx, { nome: 'Oceana' });
  await criarRecebimento(db, ctx, { obraId: outra.id, nf: '777', dataMoldagem: '2026-11-10', idades: [7], cpsPorIdade: 2 });
  const n = async (busca: string) => (await listarCps(db, { busca })).length;
  assert.equal(await n(''), 8);
  assert.equal(await n('ry'), 6);
  assert.equal(await n('OCE'), 2);
  assert.equal(await n('5068'), 6);
  assert.equal(await n('ry cb02'), 1);
  assert.equal(await n('construtora'), 6);
  assert.equal(await n('29/10'), 6, 'data de moldagem');
  assert.equal(await n('05/11'), 2, 'data de rompimento');
  assert.equal(await n('17/11/2026'), 2);
  assert.equal(await n('ry 777'), 0, 'todas as palavras precisam bater');
});

test('agenda e status: atrasados, hoje, próximos e realizados', async () => {
  const { db, ctx, cps } = await cenario();
  let a = await montarAgenda(db, '2026-11-05');
  assert.deepEqual([a.atrasados.length, a.hoje.length, a.proximos.length, a.realizados.length], [0, 1, 1, 0], '63 dias fica fora da janela de 30 dias');
  assert.deepEqual(a.hoje[0].cbs, [1, 2]);
  a = await montarAgenda(db, '2026-11-27');
  assert.deepEqual([a.atrasados.length, a.hoje.length, a.proximos.length], [2, 0, 0]);
  assert.equal(statusCp(cps[0], '2026-11-04'), 'moldado');
  assert.equal(statusCp(cps[0], '2026-11-05'), 'hoje');
  assert.equal(statusCp(cps[0], '2026-11-06'), 'atrasado');

  await registrarRompimento(db, ctx, cps[0].id, { cargaKn: 200, diametroMm: 100 });
  a = await montarAgenda(db, '2026-11-05');
  assert.equal(a.hoje.length, 1, 'grupo continua em hoje enquanto faltar CP');
  assert.equal(a.hoje[0].rompidos, 1);
  await registrarRompimento(db, ctx, cps[1].id, { cargaKn: 220, diametroMm: 100, observacao: ' ruptura cônica ' });
  a = await montarAgenda(db, '2026-11-05');
  assert.deepEqual([a.hoje.length, a.realizados.length], [0, 1]);
  assert.ok(Math.abs(a.realizados[0].maior_mpa! - 28.01) < 0.01);
  assert.ok(Math.abs(a.realizados[0].media_mpa! - 26.74) < 0.01);
  const cp = await buscarCp(db, cps[1].id);
  assert.equal(statusCp(cp!, '2026-12-01'), 'rompido');
  assert.deepEqual([cp!.observacao_ensaio, cp!.rompido_por_nome], ['ruptura cônica', 'Ana Lab']);
  await assert.rejects(() => registrarRompimento(db, ctx, cps[2].id, { cargaKn: 0, diametroMm: 100 }));
});

test('tanques: três de início, entrada em lote, transferência, retirada e saída automática no rompimento', async () => {
  const { db, ctx, cps } = await cenario();
  let t = await listarTanques(db, '2026-11-01');
  assert.deepEqual(t.map((x) => [x.nome, x.quantidade]), [['Tanque 01', 0], ['Tanque 02', 0], ['Tanque 03', 0]]);
  assert.equal((await listarCps(db, { foraDoTanque: true })).length, 6);

  assert.equal(await guardarNoTanque(db, ctx, cps.map((c) => c.id), 'tanque-01'), 6);
  assert.equal(await guardarNoTanque(db, ctx, [cps[0].id], 'tanque-01'), 0, 'já está lá: não duplica movimento');
  assert.equal(await guardarNoTanque(db, ctx, [cps[4].id, cps[5].id], 'tanque-03'), 2, 'transferência');
  t = await listarTanques(db, '2026-11-06');
  assert.deepEqual(t.map((x) => [x.quantidade, x.vencidos, x.proxima_saida]), [[4, 2, '2026-11-05'], [0, 0, null], [2, 0, '2026-12-31']]);
  assert.equal(statusCp((await buscarCp(db, cps[4].id))!, '2026-11-06'), 'em_cura');
  assert.equal((await listarCps(db, { tanqueId: 'tanque-03' })).length, 2);

  assert.equal(await retirarDoTanque(db, ctx, [cps[2].id], 'transporte'), 1);
  await registrarRompimento(db, ctx, cps[0].id, { cargaKn: 200, diametroMm: 100 });
  t = await listarTanques(db, '2026-11-06');
  assert.equal(t[0].quantidade, 2, 'rompido e retirado saem da contagem');
  await assert.rejects(() => guardarNoTanque(db, ctx, [cps[0].id], 'tanque-02'), ErroValidacao, 'CP rompido não volta para tanque');
  await assert.rejects(() => guardarNoTanque(db, ctx, [cps[1].id], 'nao-existe'), ErroValidacao);

  const h = await historicoDoCp(db, (await buscarCp(db, cps[0].id))!);
  assert.deepEqual(h.map((e) => e.tipo), ['moldagem', 'entrada', 'saida', 'rompimento']);
  assert.deepEqual([h[1].tanque_nome, h[2].motivo, h[1].por_nome], ['Tanque 01', 'ensaio', 'Ana Lab']);
  const h5 = await historicoDoCp(db, (await buscarCp(db, cps[4].id))!);
  assert.deepEqual(h5.map((e) => [e.tipo, e.tanque_nome ?? null, e.motivo ?? null]), [
    ['moldagem', null, null], ['entrada', 'Tanque 01', null], ['saida', 'Tanque 01', 'transferencia'], ['entrada', 'Tanque 03', null],
  ]);
});

test('rompimento corrigido: novo valor vale, o anterior fica no histórico', async () => {
  const { db, ctx, cps } = await cenario();
  await registrarRompimento(db, ctx, cps[0].id, { cargaKn: 200, diametroMm: 100 });
  await registrarRompimento(db, ctx, cps[0].id, { cargaKn: 230, diametroMm: 100 });
  const cp = (await buscarCp(db, cps[0].id))!;
  assert.ok(Math.abs(cp.mpa! - 29.28) < 0.01);
  const h = await historicoDoCp(db, cp);
  assert.deepEqual(h.map((e) => e.tipo), ['moldagem', 'rompimento', 'correcao']);
  assert.ok(Math.abs(h[2].mpa_anterior! - 25.46) < 0.01);
});

test('fotos: ficam ligadas ao recebimento e ao CP, e aparecem no histórico', async () => {
  const { db, ctx, obra, cps } = await cenario();
  const foto = 'data:image/jpeg;base64,AAAA';
  const { recebimento } = await criarRecebimento(db, ctx, { obraId: obra.id, nf: '9', dataMoldagem: '2026-11-01', idades: [7], cpsPorIdade: 1, fotos: [foto, foto] });
  assert.equal((await listarFotos(db, 'recebimentos', recebimento.id)).length, 2);
  await adicionarFoto(db, ctx, 'corpos_de_prova', cps[0].id, foto);
  const fotos = await listarFotos(db, 'corpos_de_prova', cps[0].id);
  assert.deepEqual([fotos.length, fotos[0].criado_por_nome], [1, 'Ana Lab']);
  await assert.rejects(() => adicionarFoto(db, ctx, 'corpos_de_prova', cps[0].id, 'http://x/y.jpg'));
  const h = await historicoDoCp(db, (await buscarCp(db, cps[0].id))!);
  assert.ok(h.some((e) => e.tipo === 'foto'));
});

test('painel: indicadores, previsão por dia, atividades e resumo por obra saem dos registros', async () => {
  const { db, ctx, obra, cps } = await cenario();
  await guardarNoTanque(db, ctx, [cps[2].id, cps[3].id, cps[4].id], 'tanque-02');
  await registrarRompimento(db, ctx, cps[0].id, { cargaKn: 200, diametroMm: 100 });
  const i = await lerIndicadores(db, '2026-11-26');
  assert.deepEqual([i.obrasAtivas, i.recebimentos, i.cps, i.emCura, i.aguardando, i.hoje, i.atrasados, i.rompidos], [1, 1, 6, 3, 3, 2, 1, 1]);
  assert.ok(i.pendentesEnvio > 0);
  const p = await previsaoPorDia(db, '2026-11-26', 7);
  assert.equal(p.length, 7);
  assert.deepEqual([p[0].data, p[0].pendentes, p[1].pendentes], ['2026-11-26', 2, 0]);
  const at = await atividadesRecentes(db, 10);
  assert.deepEqual(at.map((a) => a.tipo), ['rompimento', 'entrada', 'entrada', 'entrada', 'recebimento']);
  assert.deepEqual([at[4].total_cps, at[4].obra_sigla, at[0].cb], [6, 'RY', 1]);
  assert.deepEqual((await resumoPorObra(db)).map((r) => ({ ...r })), [{ obra_id: obra.id, recebimentos: 1, cps: 6, pendentes: 5 }]);
});

test('idades configuráveis: padrão 7/28/63, grava limpas e em ordem', async () => {
  const { db } = await cenario();
  assert.deepEqual(await lerIdades(db), [7, 28, 63]);
  assert.deepEqual(await gravarIdades(db, [56, 7, 7, 14, 0, 28, 63]), [7, 14, 28, 56, 63]);
  assert.deepEqual(await lerIdades(db), [7, 14, 28, 56, 63]);
  await assert.rejects(() => gravarIdades(db, [0, -1]));
});
