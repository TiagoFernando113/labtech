// Transforma a exportação web do Expo em um web app instalável (PWA) que funciona
// em hospedagem estática simples (GitHub Pages), inclusive offline.
// Uso: node scripts/pwa.mjs <pasta-exportada>
import { copyFileSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';

const dist = process.argv[2] ?? 'dist';
const app = JSON.parse(readFileSync('app.json', 'utf8')).expo;
const base = `${(app.experiments?.baseUrl ?? '').replace(/\/$/, '')}/`;

for (const f of ['pwa-192.png', 'pwa-512.png', 'pwa-maskable-512.png']) copyFileSync(join('assets/images', f), join(dist, f));

writeFileSync(
  join(dist, 'manifest.webmanifest'),
  JSON.stringify({
    name: 'LABTECH',
    short_name: 'LABTECH',
    description: 'Controle tecnológico de concreto',
    lang: 'pt-BR',
    start_url: base,
    scope: base,
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0B1F3F',
    theme_color: '#0B1F3F',
    icons: [
      { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }),
);

// Lista de arquivos do app, para funcionar sem internet depois da primeira abertura.
const arquivos = [];
(function andar(dir) {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) andar(p);
    else if (!/(^|\/)(sw\.js|404\.html|metadata\.json)$/.test(p)) arquivos.push(relative(dist, p).split('\\').join('/'));
  }
})(dist);

let html = readFileSync(join(dist, 'index.html'), 'utf8');
const cabeca = `<link rel="manifest" href="${base}manifest.webmanifest"><meta name="theme-color" content="#0B1F3F"><link rel="apple-touch-icon" href="${base}pwa-192.png"><meta name="apple-mobile-web-app-capable" content="yes">`;
// O banco local (SQLite) precisa de "isolamento de origem", que depende de cabeçalhos HTTP.
// Hospedagem estática não envia esses cabeçalhos; o service worker os acrescenta.
// Na primeira visita a página recarrega uma vez para passar a ser servida por ele.
const registro = `<script>(function(){if(!('serviceWorker' in navigator))return;navigator.serviceWorker.register('${base}sw.js',{scope:'${base}'}).then(function(){if(window.crossOriginIsolated)return;var k='labtech-sw-recarga';if(sessionStorage.getItem(k))return;function r(){sessionStorage.setItem(k,'1');location.reload()}if(navigator.serviceWorker.controller)r();else navigator.serviceWorker.addEventListener('controllerchange',r)})})();</script>`;
html = html.replace('</head>', `${cabeca}</head>`).replace('<body>', `<body>${registro}`);
if (!html.includes(registro)) throw new Error('Não foi possível inserir o registro do service worker no index.html');
writeFileSync(join(dist, 'index.html'), html);
// GitHub Pages devolve 404.html para rotas internas (ex.: /obras): mesma página, o app resolve a rota.
writeFileSync(join(dist, '404.html'), html);

const versao = createHash('sha256').update(html).update(arquivos.join('|')).digest('hex').slice(0, 12);
writeFileSync(
  join(dist, 'sw.js'),
  `// Gerado por scripts/pwa.mjs
const CACHE = 'labtech-${versao}';
const BASE = ${JSON.stringify(base)};
const ARQUIVOS = ${JSON.stringify(arquivos)};

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(ARQUIVOS.map((a) => c.add(BASE + a)))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

function isolar(resposta) {
  if (!resposta || resposta.status === 0) return resposta;
  const h = new Headers(resposta.headers);
  h.set('Cross-Origin-Embedder-Policy', 'require-corp');
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  h.set('Cross-Origin-Resource-Policy', 'same-origin');
  return new Response(resposta.body, { status: resposta.status, statusText: resposta.statusText, headers: h });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Só os arquivos do próprio app; chamadas ao servidor de dados passam direto.
  if (req.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      if (req.mode === 'navigate') {
        try {
          const r = await fetch(BASE + 'index.html', { cache: 'no-cache' });
          if (r.ok) {
            cache.put(BASE + 'index.html', r.clone());
            return isolar(r);
          }
        } catch {}
        return isolar(await cache.match(BASE + 'index.html'));
      }
      const guardado = await cache.match(req, { ignoreSearch: true });
      if (guardado) return isolar(guardado);
      const r = await fetch(req);
      if (r.ok) cache.put(req, r.clone());
      return isolar(r);
    })(),
  );
});
`,
);
console.log(`PWA pronto em ${dist} (base ${base}, ${arquivos.length} arquivos, cache labtech-${versao})`);
