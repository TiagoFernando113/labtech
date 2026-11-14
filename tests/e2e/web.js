// Abre o web app exportado num navegador com tamanho de celular, servido como no
// GitHub Pages (subpasta, sem cabeçalhos especiais, 404.html para rotas internas),
// e percorre a rotina do laboratório em modo local, inclusive sem internet.
// Uso: node tests/e2e/web.js <pasta-exportada> <pasta-para-capturas>
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium, devices } = require('playwright');
const raiz = path.resolve(process.argv[2]), saida = process.argv[3] || raiz, BASE = '/labtech';
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.wasm': 'application/wasm', '.ico': 'image/x-icon', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  let p = u.startsWith(BASE) ? path.join(raiz, u.slice(BASE.length)) : null, status = 200;
  if (p && fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!p || !fs.existsSync(p)) { p = path.join(raiz, '404.html'); status = 404; }
  r.writeHead(status, { 'Content-Type': mime[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(r);
}).listen(8099);
const URL0 = `http://localhost:8099${BASE}/`;
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['Pixel 7'] });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  const ok = (c, n) => { console.log((c ? 'ok: ' : 'FALHOU: ') + n); if (!c) process.exitCode = 1; };
  const txt = async () => (await pg.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
  const tem = async (s) => (await txt()).includes(s);
  const toque = async (s, qual = 'last') => { await pg.getByText(s, { exact: true })[qual]().click(); await pg.waitForTimeout(900); };
  const foto = async (n) => pg.screenshot({ path: `${saida}/${n}.png`, fullPage: true });

  await pg.goto(URL0); await pg.waitForTimeout(6000);
  ok(await pg.evaluate(() => window.crossOriginIsolated), 'service worker isola a origem sem cabecalhos do servidor');
  ok(await tem('Rompem hoje') && await tem('Modo local'), 'painel abre com indicadores');
  ok(await tem('Comece cadastrando a primeira obra'), 'painel orienta o primeiro passo');

  // Obra com sigla
  await toque('Nova obra');
  await toque('Salvar');
  ok(await tem('Informe o nome da obra'), 'obra: valida nome obrigatorio');
  await pg.getByLabel('Nome da obra').fill('Residencial Ypê');
  await pg.getByLabel('Cliente').fill('Ypê Construtora');
  await pg.waitForTimeout(300);
  ok(await tem('RY'), 'obra: sigla sugerida aparece enquanto digita');
  await toque('Salvar');

  // Recebimento com foto, moldado 7 dias atrás (para o grupo de 7 dias cair hoje)
  await toque('Novo recebimento', 'first');
  for (let i = 0; i < 7; i++) await pg.getByLabel('Data de moldagem: -').click();
  await pg.getByLabel('Nº da nota fiscal').fill('5068/03');
  await pg.locator('input[type=file]').first().setInputFiles(path.join(__dirname, '../../assets/images/pwa-512.png'));
  await pg.getByLabel('fck (MPa)').fill('30');
  await pg.getByLabel('Caminhão (placa ou nº)').fill('ABC1D23');
  await pg.waitForTimeout(800);
  ok(await tem('6 CPs · CB 01 a 06'), 'recebimento: resumo de CPs e datas calculado na hora');
  await foto('2-recebimento');
  await toque('Salvar recebimento');
  ok(await tem('NF 5068/03') && await tem('CB 06') && await tem('Ypê Construtora'), 'recebimento salvo com 6 CPs herdando obra e cliente');
  ok(await pg.locator('img').count() >= 1, 'foto fica ligada ao recebimento');
  await foto('3-recebimento-detalhe');

  // Tanque: entrada em lote
  await toque('Guardar CPs no tanque');
  await pg.getByText('Tanque 01', { exact: false }).last().click(); await pg.waitForTimeout(500);
  await pg.getByText('Guardar em Tanque 01 (6)').click(); await pg.waitForTimeout(1200);

  // Painel com números reais
  await pg.goto(URL0); await pg.waitForTimeout(3500);
  let t = await txt();
  ok(/2 Rompem hoje/.test(t) && /6 Em cura/.test(t) && /6 CPs cadastrados/.test(t) && /1 Concretagens/.test(t), 'painel: indicadores saem dos registros');
  ok(t.includes('Recebimento NF 5068/03 · 6 CPs') && t.includes('entrou no Tanque 01'), 'painel: atividades recentes');
  await foto('1-painel');

  // Rompimento
  await toque('Ensaios');
  ok(await tem('Hoje 1'), 'rompimentos: grupo de 7 dias aparece em Hoje');
  await foto('4-rompimentos');
  await pg.getByText('NF 5068/03 · 7 dias').last().click(); await pg.waitForTimeout(1000);
  await pg.getByLabel('Carga do CB 01 (kN)').fill('235,62');
  await pg.getByLabel('Carga do CB 02 (kN)').fill('220');
  await pg.waitForTimeout(400);
  t = await txt();
  ok(t.includes('30,0') && t.includes('28,0') && t.includes('Média') && t.includes('29,0 MPa'), 'rompimento: MPa, maior valor e media calculados ao digitar');
  ok(t.includes('resistência característica'), 'rompimento: avisa que individual nao e fck');
  await foto('5-romper');
  await toque('Salvar resultados');

  // Busca e ficha do CP
  await toque('CPs');
  await pg.getByLabel('Sigla, NF, CB, data (29/10)…').fill('ry cb01'); await pg.waitForTimeout(900);
  t = await txt();
  const visiveis = (x) => pg.evaluate((alvo) => [...document.querySelectorAll('div')].filter((e) => e.children.length === 0 && e.textContent === alvo && e.checkVisibility() && e.getBoundingClientRect().width > 0).length, x);
  ok((await visiveis('NF 5068/03 · CB 01')) === 1 && (await visiveis('NF 5068/03 · CB 02')) === 0, 'busca de CP por sigla + numero');
  await foto('6-cps');
  await pg.getByText('NF 5068/03 · CB 01').last().click(); await pg.waitForTimeout(1200);
  t = await txt();
  ok(t.includes('Moldado e cadastrado') && t.includes('Entrou no Tanque 01') && t.includes('Saiu do Tanque 01 (ensaio)') && t.includes('Rompido: 30,0 MPa'), 'ficha do CP: historico completo');
  await foto('7-cp');

  // Tanques
  await pg.goto(URL0 + 'tanques'); await pg.waitForTimeout(3500);
  t = await txt();
  ok(/Tanque 01[^T]*4/.test(t), 'tanque: rompidos saem da contagem (4 restantes) e rota interna abre direto');
  await foto('8-tanques');

  // Sem internet
  await ctx.setOffline(true);
  await pg.goto(URL0).catch(() => {}); await pg.waitForTimeout(4000);
  ok(/4 Em cura/.test(await txt()), 'abre e mostra os dados SEM internet');
  await toque('Calculadora');
  await pg.getByLabel('Carga de ruptura (kN)').fill('530,14'); await toque('15 × 30 cm');
  ok((await txt()).includes('30,0'), 'calculadora funciona SEM internet');
  await ctx.setOffline(false);

  // Idioma
  await pg.goto(URL0 + 'mais'); await pg.waitForTimeout(3500);
  await toque('Español (Latinoamérica)');
  ok(await tem('Probetas') && await tem('Glosario técnico'.toUpperCase()), 'troca para espanhol na hora');
  await pg.reload(); await pg.waitForTimeout(4000);
  ok(await tem('Probetas'), 'idioma escolhido persiste');
  const man = await (await ctx.request.get(URL0 + 'manifest.webmanifest')).json();
  ok(man.display === 'standalone' && man.start_url === BASE + '/' && man.icons.length === 3, 'manifesto de web app instalavel');
  console.log(errs.slice(0, 8).join('\n') || 'sem erros de pagina');
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
