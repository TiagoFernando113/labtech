// Abre o web app exportado num navegador com tamanho de celular, servido como no
// GitHub Pages (subpasta, sem cabeçalhos especiais, 404.html para rotas internas),
// e exercita os fluxos principais em modo local, inclusive sem internet.
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
  const has = async (t) => await pg.getByText(t, { exact: false }).first().isVisible().catch(() => false);
  const txt = async () => await pg.evaluate(() => document.body.innerText);
  await pg.goto(URL0); await pg.waitForTimeout(6000);
  ok(await pg.evaluate(() => window.crossOriginIsolated), 'service worker isola a origem sem cabecalhos do servidor');
  ok(await has('Obras ativas'), 'painel abre com indicadores');
  ok(await has('Modo local'), 'aviso de modo local');
  await pg.screenshot({ path: saida + '/1-painel.png' });
  await pg.getByText('Nova obra').first().click(); await pg.waitForTimeout(800);
  await pg.getByText('Salvar').click(); await pg.waitForTimeout(500);
  ok(await has('Informe o nome da obra'), 'valida nome obrigatorio');
  await pg.getByLabel('Nome da obra').fill('Oceana'); await pg.getByLabel('Endereço (opcional)').fill('Av. Atlântica, 100');
  await pg.getByText('Salvar').click(); await pg.waitForTimeout(1200);
  let t = await txt();
  ok(/1\s*\n?\s*Obras ativas/.test(t), 'painel conta 1 obra ativa');
  ok(/1\s*\n?\s*Guardado no aparelho/.test(t), 'painel mostra 1 envio pendente');
  await pg.getByText('Ver obras').click(); await pg.waitForTimeout(1000);
  ok(await has('Oceana'), 'obra aparece na lista');
  await pg.screenshot({ path: saida + '/3-obras.png' });
  await pg.getByText('Nova obra').last().click(); await pg.waitForTimeout(800);
  await pg.getByLabel('Nome da obra').fill('oceana'); await pg.getByText('Salvar').click(); await pg.waitForTimeout(600);
  ok(await has('Já existe uma obra com esse nome'), 'recusa nome duplicado');
  await pg.goto(URL0 + 'obras'); await pg.waitForTimeout(4000);
  ok(await has('Oceana'), 'rota interna abre direto (404.html) e o dado persiste');
  await ctx.setOffline(true);
  await pg.goto(URL0).catch(() => {}); await pg.waitForTimeout(4000);
  t = await txt();
  ok(/1\s*\n?\s*Obras ativas/.test(t), 'abre e mostra os dados SEM internet');
  await pg.getByText('Nova obra').first().click(); await pg.waitForTimeout(800);
  await pg.getByLabel('Nome da obra').fill('Obra Offline'); await pg.getByText('Salvar').click(); await pg.waitForTimeout(1200);
  ok(/2\s*\n?\s*Obras ativas/.test(await txt()), 'cadastra obra SEM internet');
  await ctx.setOffline(false);
  await pg.getByText('Ajustes').last().click(); await pg.waitForTimeout(800);
  await pg.getByText('Español (Latinoamérica)').click(); await pg.waitForTimeout(600);
  ok(await has('Glosario técnico'), 'troca para espanhol na hora');
  await pg.reload(); await pg.waitForTimeout(4000);
  ok(/glosario|obras activas|hola/i.test(await txt()), 'idioma escolhido persiste');
  const man = await (await ctx.request.get(URL0 + 'manifest.webmanifest')).json();
  ok(man.display === 'standalone' && man.start_url === BASE + '/' && man.icons.length === 3, 'manifesto de web app instalavel');
  console.log(errs.slice(0, 8).join('\n') || 'sem erros de pagina');
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
