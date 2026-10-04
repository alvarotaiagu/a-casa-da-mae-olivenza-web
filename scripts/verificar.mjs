/* Verificación de la web con Playwright. Una comprobación por cada punto del
   checklist de web desde cero y de la entrega del prompt «La baldosa».

   node scripts/verificar.mjs              → comprobaciones
   node scripts/verificar.mjs --capturas   → además, capturas en screenshots/

   Levanta sus propios servidores (4271 la web, 4272 la copia de entrega), así
   que no depende de servir.mjs ni choca con otra sesión.
   Se baja por la página con mouse.wheel: con Lenis, scrollTo no dispara los
   ScrollTrigger. La cortina se pausa desde un enganche en addInitScript
   (window.__cortinaTl), una página nueva por fotograma.
*/
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CAPTURAS = process.argv.includes('--capturas');
const dirCap = path.join(raiz, 'screenshots');
fs.mkdirSync(dirCap, { recursive: true });

const tipos = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.json': 'application/json', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'
};
function servidor(base, puerto) {
  return new Promise(ok => {
    const s = http.createServer((req, res) => {
      const limpia = decodeURIComponent(req.url.split('?')[0]);
      const destino = path.join(base, limpia === '/' ? 'index.html' : limpia);
      if (!destino.startsWith(base) || !fs.existsSync(destino) || fs.statSync(destino).isDirectory()) {
        res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
        res.end(fs.existsSync(path.join(base, '404.html')) ? fs.readFileSync(path.join(base, '404.html')) : 'no');
        return;
      }
      res.writeHead(200, { 'content-type': tipos[path.extname(destino)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(fs.readFileSync(destino));
    }).listen(puerto, '127.0.0.1', () => ok(s));
  });
}

const resultados = [];
function ok(nombre, cond, detalle = '') {
  resultados.push({ nombre, cond: !!cond, detalle });
  console.log((cond ? '  ok   ' : '  FALLA') + '  ' + nombre + (detalle && !cond ? '  → ' + detalle : (detalle ? '  (' + detalle + ')' : '')));
}
const espera = ms => new Promise(r => setTimeout(r, ms));
/* límite por bloque: un evaluate colgado no bloquea todo */
async function conTope(nombre, ms, fn) {
  let t;
  try { await Promise.race([fn(), new Promise((_, no) => { t = setTimeout(() => no(new Error('tope de ' + ms / 1000 + ' s')), ms); })]); }
  catch (e) { ok(nombre + ': el bloque terminó', false, e.message.split('\n')[0]); }
  finally { clearTimeout(t); }
}

const srv = await servidor(raiz, 4271);
const URL = 'http://127.0.0.1:4271/';
const browser = await chromium.launch();

async function abrir(vp, opciones = {}) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, ...(opciones.ctx || {}) });
  if (opciones.cookiesAceptadas) await ctx.addInitScript(() => { try { localStorage.setItem('casadamae-cookies', 'ok'); } catch (e) {} });
  if (opciones.sinCdn) await ctx.route(/cdn\.jsdelivr\.net/, r => r.abort());
  if (opciones.sinMain) await ctx.route(/js\/main\.js/, r => r.abort());
  if (opciones.init) await ctx.addInitScript(opciones.init, opciones.arg);
  const page = await ctx.newPage();
  const errores = [], fallos = [];
  page.on('pageerror', e => errores.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/net::ERR_FAILED|Failed to load resource/.test(m.text())) errores.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) fallos.push(r.status() + ' ' + r.url()); });
  page.on('requestfailed', r => {
    if (opciones.sinCdn && /jsdelivr/.test(r.url())) return;
    if (opciones.sinMain && /main\.js/.test(r.url())) return;
    if (/google\.com\/maps/.test(r.url())) return;
    fallos.push('fallida ' + r.url());
  });
  await page.goto((opciones.url || URL) + (opciones.query || ''), { waitUntil: opciones.waitUntil || 'load' });
  return { ctx, page, errores, fallos };
}
async function trasCortina(page) {
  await page.waitForFunction(() => { const c = document.getElementById('cortina'); return !!c && getComputedStyle(c).display === 'none'; }, null, { timeout: 12000 });
  await page.waitForTimeout(400);
}
async function bajar(page, px, paso = 100, pausa = 35) {
  for (let y = 0; y < Math.abs(px); y += paso) { await page.mouse.wheel(0, Math.sign(px) * paso); await page.waitForTimeout(pausa); }
  await page.waitForTimeout(700);
}
async function bajarHasta(page, selector, margen = 120) {
  for (let i = 0; i < 90; i++) {
    const top = await page.evaluate(s => document.querySelector(s).getBoundingClientRect().top, selector);
    if (top <= margen && top > margen - 90) break;
    await page.mouse.wheel(0, top > 0 ? Math.min(400, top - margen + 10) : Math.max(-400, top - margen));
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(900);
}
async function cap(page, nombre, forzar = false) { if (CAPTURAS || forzar) await page.screenshot({ path: path.join(dirCap, nombre + '.png') }); }
const visibleTexto = t => t.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<[^>]*\salt="([^"]*)"[^>]*>/g, ' $1 ').replace(/<[^>]*\saria-label="([^"]*)"[^>]*>/g, ' $1 ').replace(/<[^>]+>/g, ' ');

/* ═══════════════ 0 · archivos y textos ═══════════════ */
console.log('\n0 · Archivos y textos');
const paginas = ['index.html', 'aviso-legal.html', 'privacidad.html', '404.html'];
for (const p of paginas) {
  const t = fs.readFileSync(path.join(raiz, p), 'utf8');
  const head = t.slice(t.indexOf('<head>'), t.indexOf('</head>'));
  ok(p + ': noindex justo detrás del charset', /<head>\s*<meta charset="utf-8">\s*<meta name="robots" content="noindex, nofollow">/.test(head));
}
for (const f of ['.nojekyll', 'manifest.json', 'assets/favicon.svg', 'assets/og-a-casa-da-mae.jpg', 'README.md', 'assets/baldosa.svg', 'screenshots/baldosa-vs-suelo.png', 'screenshots/logo-vs-png.png']) ok('existe ' + f, fs.existsSync(path.join(raiz, f)));
{
  const todo = paginas.map(p => fs.readFileSync(path.join(raiz, p), 'utf8')).join('\n');
  const visible = visibleTexto(todo);
  const prohibidos = [/hotel/i, /estrellas?\b/i, /desayuno incluido/i, /parking/i, /inolvidable/i, /con encanto/i, /four[- ]bedroom/i, /cuatro dormitorios/i,
    /vrbo/i, /\b4,8\b/, /para[ií]so/i, /experiencia [uú]nica/i, /desayuno buffet/i, /jard[ií]n/i, /terraza/i, /balc[oó]n/i, /piscina/i, /aparcamiento/i,
    /vistas a la Magdalena/i, /\bmadre\b|\babuela\b/i, /\[PENDIENTE\]|TODO|[Ll]orem ipsum/, /\bdesde\s*\d+\s*€/i];
  for (const r of prohibidos) ok('sin texto prohibido ' + r, !r.test(visible), (visible.match(r) || [''])[0]);
  ok('«casa rural» no nombra el conjunto', !/casa rural/i.test(visible), (visible.match(/.{30}casa rural.{30}/i) || [''])[0]);
  ok('«Francisco» solo dentro de una cita de Booking', (() => {
    const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
    const fuera = visibleTexto(html.replace(/<blockquote>[\s\S]*?<\/blockquote>/g, ' '));
    return /Francisco/.test(html) && !/Francisco/.test(fuera) && !/Francisco/.test(visibleTexto(paginas.slice(1).map(p => fs.readFileSync(path.join(raiz, p), 'utf8')).join(' ')));
  })());
  const cfg = JSON.parse(fs.readFileSync(path.join(raiz, 'data/config.json'), 'utf8'));
  const idx = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
  ok('licencias: el pie no las pinta mientras estén a null', cfg.licencias === null && !/AT-BA|TR-BA/.test(visibleTexto(idx)));
  const apt = JSON.parse(fs.readFileSync(path.join(raiz, 'data/apartamentos.json'), 'utf8'));
  ok('camas: sin confirmar y sin asignar a ninguna placa', apt.confirmado === false && !/literas[^<]{0,40}(Magdalena|Cadaval|Calvario|Santa Mar)/i.test(visibleTexto(idx)) && !/hasta 6[^<]{0,60}(Cadaval|Magdalena)/i.test(visibleTexto(idx)));
  ok('trato de usted: «Sean bienvenidos» y sin «vosotros»', /Sean bienvenidos/.test(visible) && !/\b(vosotros|vuestr[oa]s?|os preparamos|reservad|llamad)\b/i.test(visible));
  ok('portugués solo en rótulos: «Os apartamentos», «Bem-vindos», «Olivença»', /Os apartamentos/.test(visible) && /Bem-vindos/.test(visible) && /Olivença/.test(visible));
  const lug = JSON.parse(fs.readFileSync(path.join(raiz, 'data/lugares.json'), 'utf8'));
  ok('distancias: medidas con OSRM, con fuente y fecha', lug.lugares.length === 5 && lug.lugares.every(l => l.pie_osrm_m > 0 && l.minutos === Math.ceil(l.pie_osrm_m / 80)) && !!lug.fecha && /OSRM/.test(lug.metodo));
  ok('n.º 16 geolocalizado (no provisional)', lug.origen.provisional === false, lug.origen.metodo);
  ok('el botón principal lleva a su motor de reservas', /class="boton boton--azul iman" href="https:\/\/acasadamae\.com\/reservas-acasadamae\/"[^>]*>Consultar fechas/.test(idx));
  /* el plano: ortogonal, nada radial */
  const plano = (idx.match(/<figure class="plano">[\s\S]*?<\/figure>/) || [''])[0];
  ok('plano: sin rotate() ni nada radial en su SVG', plano.length > 200 && !/rotate|<circle|<ellipse|\sA[\d.]|polar|rumbo/i.test(plano));
  ok('baldosa: la flor no gira sobre su centro (sin rotate en el símbolo)', !/rotate/.test((idx.match(/<symbol id="baldosa"[\s\S]*?<\/symbol>/) || [''])[0]));
  /* fotos prohibidas */
  const fotos = JSON.parse(fs.readFileSync(path.join(raiz, 'data/fotos.json'), 'utf8')).fotos;
  ok('fotos: ninguna de «Visitar Olivenza», de la casa de campo ni de relleno', fotos.every(f => !/\/(40[6-9]|41\d|420|424|635|636)_|placeholder|logoskit|kit-digital|Texto-capa|poema/i.test(f.origen || '')), fotos.filter(f => /\/(40[6-9]|41\d|420|424|635|636)_|placeholder|poema/i.test(f.origen || '')).map(f => f.id).join(', '));
  ok('fotos: seis por apartamento', ['magdalena', 'cadaval', 'calvario', 'maria'].every(a => fotos.filter(f => f.estancia === a).length === 6));
}

/* ═══════════════ 1 · cortina «enlosar» ═══════════════ */
console.log('\n1 · Cortina');
/* el enganche: en cuanto la cortina crea su línea de tiempo, se le añade una pausa en el instante pedido */
const enganche = ({ paso, dentro }) => {
  window.__muestras = [];
  let tl = null;
  Object.defineProperty(window, '__cortinaTl', {
    configurable: true,
    get() { return tl; },
    set(v) {
      tl = v;
      if (paso) {
        const t = paso === 'final' ? v.duration() - 0.03 : v.labels[paso] + dentro;
        v.call(() => { v.pause(); window.__pausada = paso; }, null, t);
      }
      const tomar = () => {
        const tr = document.querySelector('#cortina-simbolo .traza');
        if (tr) window.__muestras.push(parseFloat(getComputedStyle(tr).strokeDashoffset));
        if (window.__muestras.length < 600 && !document.getElementById('cortina').hidden) requestAnimationFrame(tomar);
      };
      requestAnimationFrame(tomar);
    }
  });
};
const medirCortina = () => {
  const losas = [...document.querySelectorAll('.cortina__losa')];
  const m = el => new DOMMatrix(getComputedStyle(el).transform);
  const escalas = losas.map(l => m(l).a);
  const ops = losas.map(l => parseFloat(getComputedStyle(l).opacity));
  const giros = losas.map(l => { const t = getComputedStyle(l).transform; return t === 'none' ? 0 : Math.round(Math.acos(Math.max(-1, Math.min(1, m(l).m22))) * 180 / Math.PI); });
  const tr = document.querySelector('#cortina-simbolo .traza');
  const cuadro = document.getElementById('cortina-cuadro');
  const pieza = document.getElementById('cortina-pieza');
  const simb = document.getElementById('cortina-simbolo').getBoundingClientRect();
  const aro = document.querySelector('#cortina-simbolo .s-aro.relleno');
  const ra = aro ? aro.getBoundingClientRect() : null;
  return {
    losas: losas.length, crecidas: escalas.filter(s => s > 0.98).length, aMedias: escalas.filter(s => s > 0.05 && s < 0.95).length,
    levantandose: giros.filter(g => g > 5 && g < 85).length, levantadas: ops.filter(o => o < 0.05).length,
    dash: tr ? parseFloat(getComputedStyle(tr).strokeDashoffset) : null,
    cuadro: m(cuadro).a, pieza: m(pieza).a, fondo: parseFloat(getComputedStyle(document.getElementById('cortina-fondo')).opacity),
    simb: { x: simb.left + simb.width / 2, y: simb.top + simb.height / 2, w: simb.width, piezaW: pieza.getBoundingClientRect().width },
    aro: ra ? { x: ra.left + ra.width / 2, y: ra.top + ra.height / 2, w: ra.width } : null,
    vw: innerWidth, vh: innerHeight
  };
};
const PASOS = [['traza', 0.16, 'el trazo del símbolo'], ['encaja', 0.3, 'se encaja en su cuadrado'], ['replica', 0.55, 'se replica en retícula'], ['levanta', 0.35, 'las baldosas se levantan'], ['vuelo', 0.28, 'la central vuela al logo']];
for (const [paso, dentro, que] of PASOS) {
  await conTope('cortina ' + paso, 30000, async () => {
    const { ctx, page } = await abrir({ width: 1440, height: 900 }, { init: enganche, arg: { paso, dentro }, waitUntil: 'commit' });
    await page.waitForFunction(() => window.__pausada, null, { timeout: 12000 });
    await page.waitForTimeout(120);
    const r = await page.evaluate(medirCortina);
    let bien = false, det = '';
    if (paso === 'traza') { bien = r.dash > 0.05 && r.dash < 0.95; det = 'dashoffset ' + r.dash.toFixed(2); }
    if (paso === 'encaja') { bien = r.cuadro > 0.72 && r.cuadro < 0.999; det = 'cuadro a ' + r.cuadro.toFixed(2); }
    if (paso === 'replica') { bien = r.crecidas > 1 && r.crecidas < r.losas - 1 && r.losas <= 120; det = r.crecidas + ' de ' + r.losas + ' baldosas puestas'; }
    if (paso === 'levanta') { bien = r.levantandose > 0 && r.levantadas < r.losas - 1 && r.fondo === 0; det = r.levantandose + ' levantándose, ' + r.levantadas + ' fuera, fondo ' + r.fondo; }
    if (paso === 'vuelo') { bien = r.pieza < 1 && r.simb.w < 132; det = 'pieza a escala ' + r.pieza.toFixed(3); }
    ok('cortina: fotograma a medias · ' + que, bien, det);
    await page.screenshot({ path: path.join(dirCap, 'cortina-' + (PASOS.findIndex(p => p[0] === paso) + 1) + '-' + paso + '.png') });
    await ctx.close();
  });
}
await conTope('cortina completa', 40000, async () => {
  const { ctx, page, errores, fallos } = await abrir({ width: 1440, height: 900 }, { init: enganche, arg: { paso: 'final', dentro: 0 }, waitUntil: 'commit' });
  await page.waitForFunction(() => window.__pausada, null, { timeout: 12000 });
  const r = await page.evaluate(medirCortina);
  const logo = await page.evaluate(() => { const b = document.getElementById('marca-simbolo').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width * 0.96 }; });
  const d = Math.max(Math.abs(r.aro.x - logo.x), Math.abs(r.aro.y - logo.y), Math.abs(r.aro.w - logo.w));
  ok('cortina: la baldosa central acaba en el logo del menú (aro contra aro, ≤ 2 px)', d <= 2, 'desvío ' + d.toFixed(2) + ' px');
  ok('cortina: ≤ 120 baldosas en 1440×900', r.losas <= 120 && r.losas > 30, r.losas + ' baldosas');
  await page.evaluate(() => window.__cortinaTl.play());
  await trasCortina(page);
  const muestras = await page.evaluate(() => window.__muestras);
  ok('cortina: el trazo pasa por valores intermedios (autoRound:false)', muestras.filter(v => v > 0.05 && v < 0.95).length >= 4, muestras.filter(v => v > 0.05 && v < 0.95).length + ' muestras');
  ok('cortina: acaba en display:none y con [hidden]', await page.evaluate(() => { const c = document.getElementById('cortina'); return getComputedStyle(c).display === 'none' && c.hidden; }));
  ok('cortina: color distinto del fondo que destapa', await page.evaluate(() => getComputedStyle(document.getElementById('cortina-fondo')).backgroundColor !== getComputedStyle(document.body).backgroundColor));
  ok('cortina: sin filtros por fotograma', await page.evaluate(() => [...document.querySelectorAll('#cortina, #cortina *')].every(e => getComputedStyle(e).filter === 'none')));
  ok('carga: consola limpia', !errores.length, errores.join(' | '));
  ok('carga: sin 404 ni peticiones fallidas', !fallos.length, fallos.join(' | '));
  await ctx.close();
});
/* el dibujo medido en móviles de verdad (devices[]) */
for (const nombre of ['iPhone 13', 'Pixel 5']) {
  await conTope('cortina ' + nombre, 30000, async () => {
    for (const paso of ['traza', 'final']) {
      const ctx = await browser.newContext({ ...devices[nombre] });
      await ctx.addInitScript(enganche, { paso, dentro: 0.5 });
      const page = await ctx.newPage();
      await page.goto(URL, { waitUntil: 'commit' });
      await page.waitForFunction(() => window.__pausada, null, { timeout: 12000 });
      await page.waitForTimeout(100);
      const r = await page.evaluate(medirCortina);
      if (paso === 'traza') {
        const dx = Math.abs(r.simb.x - r.vw / 2), dy = Math.abs(r.simb.y - r.vh / 2);
        ok(`${nombre}: el símbolo se traza centrado y a su tamaño (sin max-width)`, dx <= 2 && dy <= 2 && Math.abs(r.simb.w - r.simb.piezaW) <= 1 && r.aro && Math.abs(r.aro.x - r.vw / 2) <= 2, `dx ${dx.toFixed(1)} dy ${dy.toFixed(1)} w ${r.simb.w.toFixed(0)}/${r.simb.piezaW.toFixed(0)}`);
        ok(`${nombre}: ≤ 120 baldosas y módulo mayor que en escritorio en proporción`, r.losas <= 120 && r.losas >= 15, r.losas + ' baldosas');
        await page.screenshot({ path: path.join(dirCap, 'cortina-movil-' + nombre.replace(/\s/g, '') + '.png') });
      } else {
        const logo = await page.evaluate(() => { const b = document.getElementById('marca-simbolo').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width * 0.96 }; });
        const d = Math.max(Math.abs(r.aro.x - logo.x), Math.abs(r.aro.y - logo.y), Math.abs(r.aro.w - logo.w));
        ok(`${nombre}: la baldosa central aterriza en el logo (≤ 2 px)`, d <= 2, 'desvío ' + d.toFixed(2));
      }
      await ctx.close();
    }
  });
}
await conTope('retiradas', 40000, async () => {
  {
    const { ctx, page, errores } = await abrir({ width: 1440, height: 900 }, { sinCdn: true });
    await page.waitForTimeout(600);
    ok('sin GSAP: la cortina se retira', await page.evaluate(() => getComputedStyle(document.getElementById('cortina')).display === 'none'));
    ok('sin GSAP: html.sin-movimiento (sin estados vacíos)', await page.evaluate(() => document.documentElement.classList.contains('sin-movimiento')));
    ok('sin GSAP: el titular se lee entero', await page.evaluate(() => { const l = document.querySelector('.hero__titulo .letra'); return !l || getComputedStyle(l).transform === 'none'; }));
    ok('sin GSAP: los arcos están abiertos y las dos plantas encendidas', await page.evaluate(() => getComputedStyle(document.querySelector('.arco')).getPropertyValue('--abre').trim() === '1' && document.querySelectorAll('.corte__planta.es-encendida').length === 2));
    ok('sin GSAP: sin errores de JS', !errores.length, errores.join(' | '));
    await cap(page, 'sin-gsap-1440');
    await ctx.close();
  }
  {
    const { ctx, page } = await abrir({ width: 1440, height: 900 }, { ctx: { reducedMotion: 'reduce' }, waitUntil: 'domcontentloaded' });
    ok('movimiento reducido: la cortina no llega a pintarse', await page.evaluate(() => getComputedStyle(document.getElementById('cortina')).display === 'none'));
    ok('movimiento reducido: html.sin-movimiento', await page.evaluate(() => document.documentElement.classList.contains('sin-movimiento')));
    await page.waitForTimeout(300);
    ok('movimiento reducido: el siglo está puesto (contenido, no viaje)', await page.evaluate(() => { const s = document.querySelector('[data-romano]'); s.scrollIntoView(); return true; }) && await page.waitForFunction(() => document.querySelector('[data-romano]').textContent === 'XVIII', null, { timeout: 3000 }).then(() => true, () => false));
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    const sr = await page.evaluate(() => { const r = document.getElementById('hero-suelo').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await page.mouse.move(sr[0], sr[1]); await page.mouse.move(sr[0] + 120, sr[1] + 40, { steps: 5 });
    await page.waitForTimeout(150);
    ok('movimiento reducido: la retícula del hero queda quieta', await page.evaluate(() => !document.querySelector('.reticula i.es-luz') && [...document.querySelectorAll('.reticula i')].every(i => getComputedStyle(i).transform === 'none')));
    await cap(page, 'reducido-1440');
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(URL);
    const disp = await page.$eval('#cortina', c => getComputedStyle(c).display).catch(() => 'error');
    ok('sin JS: cortina en display:none', disp === 'none', disp);
    await cap(page, 'sin-js-1440');
    await ctx.close();
  }
  {
    const { ctx, page } = await abrir({ width: 1440, height: 900 }, { sinMain: true });
    await page.waitForTimeout(7600);
    ok('sin main.js: el setTimeout del <head> retira la cortina a los 7 s', await page.evaluate(() => getComputedStyle(document.getElementById('cortina')).display === 'none'));
    await ctx.close();
  }
});

/* ═══════════════ 2 · escritorio, versión «La baldosa» ═══════════════ */
console.log('\n2 · Escritorio');
await conTope('escritorio', 180000, async () => {
  const { ctx, page, errores } = await abrir({ width: 1440, height: 900 });
  await trasCortina(page);
  await cap(page, '1440-01-hero');
  ok('cookies: el aviso sale la primera vez', await page.evaluate(() => getComputedStyle(document.getElementById('cookies')).display === 'flex'));
  await page.click('#cookies-aceptar');
  ok('cookies: «Entendido» lo cierra de verdad', await page.evaluate(() => getComputedStyle(document.getElementById('cookies')).display === 'none'));
  ok('mando: sin ?revision no existe a la vista', await page.evaluate(() => { const m = document.getElementById('mando'); return m.hidden && getComputedStyle(m).display === 'none'; }));
  /* cursor */
  await page.mouse.move(300, 300); await page.mouse.move(320, 310);
  await page.waitForTimeout(300);
  ok('cursor: el del sistema se oculta', await page.evaluate(() => getComputedStyle(document.body).cursor === 'none' && document.documentElement.classList.contains('con-cursor')));
  const b = await page.evaluate(() => { const r = document.querySelector('.hero__acciones .boton--azul').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await page.mouse.move(b[0], b[1]); await page.mouse.move(b[0] + 2, b[1] + 1);
  await page.waitForTimeout(500);
  const alfa = await page.evaluate(() => { const c = getComputedStyle(document.querySelector('.cursor')).backgroundColor; const m = c.match(/rgba?\(([^)]+)\)/); const p = m ? m[1].split(',').map(Number) : []; return p.length === 4 ? p[3] : (p.length === 3 ? 1 : 0); });
  ok('cursor: relleno activo ≥ .35 sobre un botón', alfa >= 0.35, 'alfa ' + alfa);
  ok('cursor: un solo aro y un solo punto', await page.evaluate(() => document.querySelectorAll('.cursor').length === 1 && document.querySelectorAll('.cursor-punto').length === 1));
  /* retícula del hero */
  const s = await page.evaluate(() => { const r = document.getElementById('hero-suelo').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; });
  await page.mouse.move(s[0] + s[2] * 0.5, s[1] + s[3] * 0.5);
  await page.mouse.move(s[0] + s[2] * 0.5 + 90, s[1] + s[3] * 0.5 + 10, { steps: 4 });
  await page.waitForTimeout(140);
  const ret = await page.evaluate(() => ({ luz: document.querySelectorAll('.reticula i.es-luz').length, ladeadas: [...document.querySelectorAll('.reticula i')].filter(i => getComputedStyle(i).transform !== 'none' && getComputedStyle(i).transform !== 'matrix(1, 0, 0, 1, 0, 0)').length }));
  ok('hero: la baldosa bajo el cursor se ilumina y las vecinas se ladean', ret.luz >= 1 && ret.ladeadas >= 3, JSON.stringify(ret));
  await cap(page, '1440-02-reticula');
  /* la casa: el siglo */
  await bajarHasta(page, '#la-casa', 120);
  await page.waitForTimeout(1800);
  ok('la casa: el siglo cuenta hasta XVIII', await page.evaluate(() => document.querySelector('[data-romano]').textContent === 'XVIII'));
  await cap(page, '1440-03-la-casa');
  /* dos plantas: anclada */
  ok('dos plantas: anclada en escritorio', await page.evaluate(() => window.LaMae.plantas.anclada() && !!document.querySelector('.pin-spacer #plantas, .pin-spacer')));
  const encendidas = () => page.evaluate(() => [document.getElementById('corte-baja').classList.contains('es-encendida'), document.getElementById('corte-alta').classList.contains('es-encendida'), document.getElementById('plantas').getBoundingClientRect().top, window.LaMae.plantas.progreso()]);
  await bajarHasta(page, '#plantas', 300);
  const e0 = await encendidas();
  /* avanzar a pasos cortos hasta cada tramo del anclaje */
  const hasta = async (min) => { for (let i = 0; i < 40; i++) { const e = await encendidas(); if (e[3] >= min) break; await page.mouse.wheel(0, 60); await page.waitForTimeout(90); } await page.waitForTimeout(500); return encendidas(); };
  const e1 = await hasta(0.25);
  await cap(page, '1440-04-plantas-baja');
  const e2 = await hasta(0.7);
  await cap(page, '1440-05-plantas-alta');
  ok('dos plantas: apagadas al llegar, luego la baja y después la alta', !e0[0] && !e0[1] && e1[0] && !e1[1] && e2[0] && e2[1], JSON.stringify([e0, e1, e2].map(e => e.map(v => typeof v === 'number' ? +v.toFixed(2) : v))));
  ok('dos plantas: la sección se queda arriba mientras', Math.abs(e1[2]) < 4 && Math.abs(e2[2]) < 4, 'top ' + e1[2].toFixed(1) + ' / ' + e2[2].toFixed(1));
  /* arcos: antes de entrar están cerrados; al entrar se abren (se mide también a medio camino) */
  const a0 = await page.evaluate(() => { const v = document.querySelector('.arco__ventana'); return [v.getBoundingClientRect().width, v.parentNode.getBoundingClientRect().width, document.querySelector('.arco').classList.contains('es-visible')]; });
  await bajarHasta(page, '.arcos', 300);
  await page.waitForTimeout(500);
  const aMedio = await page.evaluate(() => { const v = document.querySelector('.arco__ventana'); return v.getBoundingClientRect().width / v.parentNode.getBoundingClientRect().width; });
  await cap(page, '1440-06a-arcos-abriendose');
  await page.waitForTimeout(1800);
  const a1 = await page.evaluate(() => { const v = document.querySelector('.arco__ventana'); const r = v.getBoundingClientRect(), m = v.parentNode.getBoundingClientRect(); return [r.width / m.width, r.height / m.height, getComputedStyle(v).borderTopLeftRadius]; });
  ok('arcos: se abren al entrar (la ventana crece hasta el marco)', !a0[2] && a0[0] / a0[1] < 0.5 && aMedio > a0[0] / a0[1] && a1[0] > 0.99 && a1[1] > 0.99, `${(a0[0] / a0[1]).toFixed(2)} → ${aMedio.toFixed(2)} → ${a1[0].toFixed(2)}`);
  ok('arcos: sin clip-path (se anima un número)', await page.evaluate(() => [...document.querySelectorAll('.arco, .arco *')].every(e => getComputedStyle(e).clipPath === 'none')));
  await cap(page, '1440-06-planta-baja');
  /* galería de una estancia: Escape y foco */
  const est = await page.evaluate(() => { const b = document.querySelector('.estancia'); b.click(); return b.dataset.estancia; });
  await page.waitForTimeout(300);
  ok('galería: se abre con su estancia', await page.evaluate(() => document.getElementById('galeria').open && /de/.test(document.getElementById('galeria-cuenta').textContent)));
  await cap(page, '1440-07-galeria');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  ok('galería: Escape la cierra y el foco vuelve al botón', await page.evaluate(e => !document.getElementById('galeria').open && document.activeElement && document.activeElement.dataset.estancia === e, est));
  /* placas: ratón y foco */
  await bajarHasta(page, '#apartamentos', 90);
  await bajar(page, 260);
  const giro = sel => page.evaluate(s => { const g = document.querySelector(s + ' .placa__giro'); return new DOMMatrix(getComputedStyle(g).transform).m11; }, sel);
  const placas = ['magdalena', 'cadaval', 'calvario', 'maria'];
  let porRaton = 0;
  for (const p of placas) {
    const r = await page.evaluate(id => { const g = document.querySelector('.placa[data-apartamento="' + id + '"] .placa__giro').getBoundingClientRect(); return [g.x + g.width / 2, g.y + g.height / 2]; }, p);
    await page.mouse.move(r[0], r[1], { steps: 3 });
    await page.waitForTimeout(1000);
    if (await giro('.placa[data-apartamento="' + p + '"]') < -0.95) porRaton++;
    if (p === 'cadaval') await cap(page, '1440-08-placa-volteada');
  }
  ok('placas: las 4 se voltean con el ratón', porRaton === 4, porRaton + ' de 4');
  await page.mouse.move(5, 450);
  await page.waitForTimeout(1000);
  let porFoco = 0;
  for (const p of placas) {
    await page.focus('.placa[data-apartamento="' + p + '"] .placa__boton');
    await page.waitForTimeout(1000);
    if (await giro('.placa[data-apartamento="' + p + '"]') < -0.95) porFoco++;
  }
  ok('placas: las 4 se voltean con el foco', porFoco === 4, porFoco + ' de 4');
  await page.evaluate(() => document.querySelector('.placa[data-apartamento="calvario"] .placa__boton').click());
  await page.waitForTimeout(300);
  ok('placas: el botón abre su <dialog> con 6 fotos', await page.evaluate(() => document.getElementById('galeria').open && document.getElementById('galeria-titulo').textContent === 'Puerta del Calvario' && document.getElementById('galeria-cuenta').textContent === '1 de 6'));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  ok('placas: Escape cierra y el foco vuelve al botón de la placa', await page.evaluate(() => !document.getElementById('galeria').open && document.activeElement.classList.contains('placa__boton') && document.activeElement.dataset.estancia === 'calvario'));
  await page.evaluate(() => document.activeElement.blur());
  await bajar(page, 500);
  await cap(page, '1440-09-todos');
  /* a pie */
  await bajarHasta(page, '#a-pie', 100);
  await page.waitForTimeout(800);
  ok('a pie: 5 lugares y 4 marcados «da nombre a un apartamento»', await page.evaluate(() => document.querySelectorAll('.lugares li').length === 5 && document.querySelectorAll('.lugares li.es-apto').length === 4 && document.querySelectorAll('.plano__punto').length === 5));
  await cap(page, '1440-10-a-pie');
  /* opiniones */
  await bajarHasta(page, '#opiniones', 100);
  await page.waitForTimeout(1600);
  ok('opiniones: las 7 categorías se enlosan hasta su nota', await page.evaluate(() => document.querySelectorAll('.categorias li.es-visible').length === 7 && [...document.querySelectorAll('.categorias li:first-child .losas i')].filter(i => getComputedStyle(i, '::before').transform === 'none').length === 10));
  const x1 = await page.evaluate(() => new DOMMatrix(getComputedStyle(document.getElementById('citas-pista')).transform).m41);
  await page.waitForTimeout(600);
  const x2 = await page.evaluate(() => new DOMMatrix(getComputedStyle(document.getElementById('citas-pista')).transform).m41);
  ok('opiniones: el marquee corre', x2 < x1, x1.toFixed(1) + ' → ' + x2.toFixed(1));
  ok('opiniones: todas las citas firmadas «Opinión en Booking»', await page.evaluate(() => [...document.querySelectorAll('.citas__pista li span')].every(s => s.textContent === 'Opinión en Booking')));
  await cap(page, '1440-11-opiniones');
  /* formulario */
  await bajarHasta(page, '#fechas', 100);
  await page.evaluate(() => document.getElementById('reserva').requestSubmit());
  ok('formulario: sin datos avisa de fechas y nombre', await page.evaluate(() => !!document.getElementById('fechas-error').textContent && !!document.getElementById('reserva-error').textContent && document.getElementById('reserva-listo').hidden));
  await page.fill('#llegada', '2026-11-20'); await page.fill('#salida', '2026-11-18');
  await page.dispatchEvent('#salida', 'change');
  ok('formulario: la salida tiene que ir después de la llegada', await page.evaluate(() => /posterior/.test(document.getElementById('fechas-error').textContent)));
  await page.fill('#salida', '2026-11-22'); await page.dispatchEvent('#salida', 'change');
  await page.fill('#adultos', '2'); await page.fill('#ninos', '1');
  await page.check('input[name="planta"][value="alta"]');
  await page.fill('#nombre', 'Ana Prueba & Cía');
  await page.evaluate(() => document.getElementById('reserva').requestSubmit());
  await page.waitForTimeout(250);
  const f = await page.evaluate(() => ({ txt: document.getElementById('reserva-texto').textContent, wa: document.getElementById('reserva-whatsapp').getAttribute('href'), sms: document.getElementById('reserva-sms').getAttribute('href'), mail: document.getElementById('reserva-email').getAttribute('href'), visto: !document.getElementById('reserva-listo').hidden }));
  ok('formulario: compone el mensaje (fechas, personas, planta, nombre)', f.visto && /2 noches/.test(f.txt) && /2 adultos y 1 niño/.test(f.txt) && /planta alta/.test(f.txt) && /Ana Prueba & Cía$/.test(f.txt), f.txt.slice(0, 90));
  ok('formulario: WhatsApp al 34645902955 con el mensaje codificado', f.wa.startsWith('https://wa.me/34645902955?text=') && !/[\s&]/.test(f.wa.split('text=')[1]) && decodeURIComponent(f.wa.split('text=')[1]) === f.txt);
  ok('formulario: SMS y email con el mismo mensaje', f.sms.startsWith('sms:+34645902955?&body=') && decodeURIComponent(f.sms.split('body=')[1]) === f.txt && f.mail.startsWith('mailto:acasadamae.olivenza@gmail.com?subject=') && decodeURIComponent(f.mail.split('body=')[1]) === f.txt);
  ok('formulario: también hay Llamar y Copiar', await page.evaluate(() => !!document.querySelector('.listo a[href="tel:+34645902955"]') && !!document.getElementById('reserva-copiar')));
  await cap(page, '1440-12-fechas');
  /* mapa bajo clic */
  ok('mapa: no hay iframe antes del clic', await page.evaluate(() => !document.querySelector('iframe')));
  await page.evaluate(() => document.getElementById('mapa-boton').click());
  await page.waitForTimeout(200);
  ok('mapa: el clic carga el de Google, sin clave', await page.evaluate(() => { const f = document.querySelector('.contacto iframe'); return !!f && /google\.com\/maps\?q=.*output=embed/.test(f.src) && !/key=/.test(f.src); }));
  /* pie que se enlosa: antes de llegar no hay ninguna puesta */
  const p0 = await page.evaluate(() => { const i = [...document.querySelectorAll('#suelo-losas i')]; return [i.length, i.filter(x => new DOMMatrix(getComputedStyle(x).transform).a > 0.98).length]; });
  await bajar(page, 4000, 200, 25);
  await page.waitForTimeout(700);
  await cap(page, '1440-13a-pie-enlosandose');
  await page.waitForTimeout(2600);
  const p1 = await page.evaluate(() => { const i = [...document.querySelectorAll('#suelo-losas i')]; return [i.length, i.filter(x => new DOMMatrix(getComputedStyle(x).transform).a > 0.98).length, document.getElementById('suelo').classList.contains('es-visible')]; });
  ok('pie: el suelo se enlosa baldosa a baldosa', p1[2] && p1[0] > 20 && p1[1] === p1[0] && p0[1] === 0, `${p0[1]}/${p0[0]} → ${p1[1]}/${p1[0]}`);
  await cap(page, '1440-13-pie');
  ok('escritorio: consola limpia tras recorrerla', !errores.length, errores.join(' | '));
  await ctx.close();
});

/* ═══════════════ 3 · mando de densidades (?revision) ═══════════════ */
console.log('\n3 · Mando');
await conTope('mando', 120000, async () => {
  const { ctx, page, errores } = await abrir({ width: 1440, height: 900 }, { query: '?revision' });
  await trasCortina(page);
  ok('mando: se aparta mientras está el aviso de cookies', await page.evaluate(() => getComputedStyle(document.getElementById('mando')).visibility === 'hidden'));
  await page.click('#cookies-aceptar');
  await page.waitForTimeout(450);
  ok('mando: aparece al cerrar el aviso', await page.evaluate(() => getComputedStyle(document.getElementById('mando')).visibility === 'visible'));
  ok('mando: el aviso dice lo que falta por confirmar', await page.evaluate(() => /Camas por apartamento sin confirmar · licencias sin confirmar · n\.º 16 geolocalizado: sí/.test(document.querySelector('.mando__aviso').textContent)));
  await cap(page, '1440-baldosa-mando');
  await page.click('[data-densidad="sobria"]');
  await page.waitForTimeout(500);
  const s = await page.evaluate(() => ({
    clase: document.documentElement.classList.contains('densidad-sobria'),
    cenefas: [...document.querySelectorAll('.cenefa:not(.cenefa--hero)')].every(c => c.getBoundingClientRect().height <= 1.5),
    cenefaHero: document.querySelector('.cenefa--hero').getBoundingClientRect().height > 20,
    reticula: getComputedStyle(document.getElementById('reticula')).display === 'none',
    completa: getComputedStyle(document.getElementById('galeria-completa')).display === 'block' && document.querySelectorAll('#completa-rejilla li').length,
    total: JSON.parse(document.getElementById('datos-fotos').textContent).length,
    tabla: getComputedStyle(document.getElementById('puntuaciones')).display === 'table',
    categorias: getComputedStyle(document.querySelector('.categorias')).display === 'none',
    citas: getComputedStyle(document.getElementById('citas-pista')).display === 'grid',
    ancho: document.documentElement.scrollWidth <= innerWidth,
    guardada: localStorage.getItem('casadamae-densidad')
  }));
  ok('sobria: cambia la clase y se guarda', s.clase && s.guardada === 'sobria');
  ok('sobria: filetes rectos entre secciones; queda la cenefa bajo el hero', s.cenefas && s.cenefaHero);
  ok('sobria: la retícula del hero desaparece', s.reticula);
  ok('sobria: añade la galería completa', s.completa === s.total && s.total > 30, s.completa + ' de ' + s.total);
  ok('sobria: añade la tabla de puntuaciones (y quita las filas de baldosas)', s.tabla && s.categorias);
  ok('sobria: citas en rejilla quieta', s.citas);
  ok('sobria: sin desborde horizontal', s.ancho);
  /* filtros de la galería: planta baja, cada apartamento, patio */
  const filtros = await page.evaluate(() => [...document.querySelectorAll('#completa-filtros button')].map(b => b.textContent));
  ok('sobria: filtros planta baja, patio y los cuatro apartamentos', ['Planta baja', 'Patio', 'La Magdalena', 'Duques de Cadaval', 'Puerta del Calvario', 'Santa María del Castillo'].every(t => filtros.includes(t)), filtros.join(', '));
  await page.evaluate(() => [...document.querySelectorAll('#completa-filtros button')].find(b => b.textContent === 'La Magdalena').click());
  ok('sobria: el filtro deja solo las 6 de La Magdalena', await page.evaluate(() => [...document.querySelectorAll('#completa-rejilla li')].filter(l => !l.hidden).length === 6));
  await page.evaluate(() => document.querySelector('#completa-filtros button').click());
  /* placas quietas con la placa en una esquina */
  await bajarHasta(page, '#apartamentos', 90);
  await bajar(page, 260);
  const r = await page.evaluate(() => { const g = document.querySelector('.placa .placa__giro').getBoundingClientRect(); return [g.x + g.width / 2, g.y + g.height / 2]; });
  await page.mouse.move(r[0], r[1], { steps: 3 });
  await page.waitForTimeout(1000);
  ok('sobria: las placas no se voltean; la placa va pequeña en una esquina', await page.evaluate(() => {
    const g = document.querySelector('.placa .placa__giro'), fr = document.querySelector('.placa .placa__cara--frente').getBoundingClientRect(), gr = g.getBoundingClientRect();
    return getComputedStyle(g).transform === 'none' && fr.width < gr.width * 0.4 && fr.right > gr.right - 20 && fr.bottom > gr.bottom - 20;
  }));
  await cap(page, '1440-sobria-02-placas');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await cap(page, '1440-sobria-01-hero');
  await bajarHasta(page, '#galeria-completa', 80);
  await cap(page, '1440-sobria-03-galeria');
  await bajarHasta(page, '#opiniones', 80);
  await bajar(page, 300);
  await cap(page, '1440-sobria-04-opiniones');
  await bajar(page, 6000, 300, 20);
  await page.waitForTimeout(600);
  ok('sobria: el pie no se anima (suelo quieto de fondo)', await page.evaluate(() => getComputedStyle(document.getElementById('suelo-losas')).display === 'none' && getComputedStyle(document.getElementById('suelo')).backgroundImage.startsWith('url(')));
  await cap(page, '1440-sobria-05-pie');
  await page.reload();
  await page.waitForTimeout(150);
  ok('sobria: al recargar se aplica sin parpadeo', await page.evaluate(() => document.documentElement.classList.contains('densidad-sobria')));
  await trasCortina(page);
  await page.click('[data-densidad="baldosa"]');
  await page.waitForTimeout(500);
  ok('mando: se puede volver a «La baldosa»', await page.evaluate(() => document.documentElement.classList.contains('densidad-baldosa') && getComputedStyle(document.getElementById('reticula')).display !== 'none'));
  ok('mando: consola limpia', !errores.length, errores.join(' | '));
  await ctx.close();
});
await conTope('mando sin revision', 20000, async () => {
  const { ctx, page } = await abrir({ width: 1440, height: 900 }, { init: () => { try { localStorage.setItem('casadamae-densidad', 'sobria'); } catch (e) {} } });
  ok('mando: sin ?revision ignora la densidad guardada', await page.evaluate(() => document.documentElement.classList.contains('densidad-baldosa')));
  await ctx.close();
});

/* ═══════════════ 4 · móvil y anchos ═══════════════ */
console.log('\n4 · Móvil y anchos');
for (const vp of [{ width: 360, height: 640 }, { width: 375, height: 667 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
  await conTope(`${vp.width}×${vp.height}`, 150000, async () => {
    const movil = vp.width < 800;
    const { ctx, page, errores } = await abrir(vp, { cookiesAceptadas: true, ctx: movil ? { hasTouch: true, isMobile: true } : {} });
    await trasCortina(page);
    const r = await page.evaluate(() => {
      const cab = document.getElementById('cabecera').getBoundingClientRect(), tit = document.querySelector('.hero__titulo').getBoundingClientRect();
      return { bajoCabecera: tit.top >= cab.bottom - 1, ancho: document.documentElement.scrollWidth, vw: innerWidth };
    });
    ok(`${vp.width}×${vp.height}: el titular no queda bajo la cabecera`, r.bajoCabecera);
    /* desbordes a lo largo de toda la página */
    let maxAncho = r.ancho;
    const alto = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < alto; y += Math.round(vp.height * 0.8)) {
      await page.mouse.wheel(0, Math.round(vp.height * 0.8));
      await page.waitForTimeout(50);
      maxAncho = Math.max(maxAncho, await page.evaluate(() => document.documentElement.scrollWidth));
    }
    ok(`${vp.width}×${vp.height}: sin desborde horizontal en toda la página`, maxAncho <= r.vw, maxAncho + ' > ' + r.vw);
    await page.mouse.wheel(0, -100000);
    await page.waitForTimeout(900);
    await cap(page, `${vp.width}-01-hero`);
    if (vp.width === 390) {
      ok('móvil: «Dos plantas» sin anclar y con las dos encendidas', await page.evaluate(() => !window.LaMae.plantas.anclada() && !document.querySelector('.pin-spacer') && document.querySelectorAll('.corte__planta.es-encendida').length === 2));
      ok('móvil: la retícula del hero queda quieta (táctil)', await page.evaluate(() => [...document.querySelectorAll('.reticula i')].every(i => getComputedStyle(i).transform === 'none')));
      /* placas con toque */
      await bajarHasta(page, '#apartamentos', 70);
      let porToque = 0;
      for (const p of ['magdalena', 'cadaval', 'calvario', 'maria']) {
        const sel = '.placa[data-apartamento="' + p + '"] .placa__giro';
        await page.evaluate(s => document.querySelector(s).scrollIntoView({ block: 'center' }), sel);
        await page.waitForTimeout(300);
        await page.tap(sel);
        await page.waitForTimeout(1000);
        if (await page.evaluate(s => document.querySelector(s).closest('.placa').classList.contains('es-volteada') && new DOMMatrix(getComputedStyle(document.querySelector(s)).transform).m11 < -0.95, sel)) porToque++;
        if (p === 'magdalena') await cap(page, '390-placa-tocada');
      }
      ok('placas: las 4 se voltean con un toque', porToque === 4, porToque + ' de 4');
      await page.tap('.placa[data-apartamento="maria"] .placa__giro');
      await page.waitForTimeout(400);
      ok('placas: el segundo toque abre el apartamento', await page.evaluate(() => document.getElementById('galeria').open && document.getElementById('galeria-titulo').textContent === 'Santa María del Castillo'));
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      ok('móvil: la cabecera ya va fija', await page.evaluate(() => getComputedStyle(document.getElementById('cabecera')).position === 'fixed'));
      await page.click('#hamburguesa');
      await page.waitForTimeout(700);
      const menu = await page.evaluate(() => { const n = document.getElementById('menu').getBoundingClientRect(); return { alto: n.height, top: n.top, vh: innerHeight, exp: document.getElementById('hamburguesa').getAttribute('aria-expanded'), vis: getComputedStyle(document.getElementById('menu')).visibility }; });
      ok('menú móvil: abre a pantalla entera con la cabecera fija', menu.exp === 'true' && menu.vis === 'visible' && Math.abs(menu.alto - menu.vh) < 2 && Math.abs(menu.top) < 2, JSON.stringify(menu));
      await cap(page, '390-menu');
      await page.click('#hamburguesa');
      await page.waitForTimeout(700);
      ok('menú móvil: el mismo botón lo cierra', await page.evaluate(() => document.getElementById('hamburguesa').getAttribute('aria-expanded') === 'false' && getComputedStyle(document.getElementById('menu')).visibility === 'hidden'));
      if (CAPTURAS) {
        for (const [sel, nombre] of [['#la-casa', 'la-casa'], ['#plantas', 'plantas'], ['#planta-baja', 'planta-baja'], ['.arcos', 'arcos'], ['#apartamentos', 'apartamentos'], ['.todos', 'todos'], ['#bueno-saber', 'saber'], ['#a-pie', 'a-pie'], ['.lugares', 'lugares'], ['#opiniones', 'opiniones'], ['#fechas', 'fechas'], ['#contacto', 'contacto'], ['.pie', 'pie']]) {
          await bajarHasta(page, sel, 70);
          await page.waitForTimeout(900);
          await cap(page, '390-' + nombre);
        }
      }
    }
    ok(`${vp.width}×${vp.height}: consola limpia`, !errores.length, errores.join(' | '));
    await ctx.close();
  });
}

/* ═══════════════ 5 · contraste ═══════════════ */
console.log('\n5 · Contraste');
await conTope('contraste', 30000, async () => {
  const { ctx, page } = await abrir({ width: 1440, height: 900 }, { cookiesAceptadas: true, ctx: { reducedMotion: 'reduce' } });
  const res = await page.evaluate(() => {
    const css = getComputedStyle(document.documentElement);
    const hex = n => css.getPropertyValue(n).trim();
    const rgbHex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const c = (a, b) => { const x = lum(rgbHex(hex(a))), y = lum(rgbHex(hex(b))); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    return [['--azul', '--cal'], ['--azul', '--aguada'], ['--verde-texto', '--cal'], ['--verde-texto', '--aguada'], ['--apagado', '--cal'], ['--apagado', '--aguada'], ['--tinta', '--cal'], ['--cal', '--azul'], ['--azul-claro', '--tinta'], ['--apagado-tinta', '--tinta'], ['--cal', '--campo']].map(([a, b]) => [a + ' sobre ' + b, c(a, b)]);
  });
  for (const [n, v] of res) ok('contraste AA ' + n, v >= 4.5, v.toFixed(2));
  const reales = await page.evaluate(() => {
    const rgb = c => { const m = c.match(/rgba?\(([^)]+)\)/); return m ? m[1].split(',').map(Number) : [0, 0, 0, 0]; };
    const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const fondo = el => { for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.length === 3 || c[3] > 0.9) return c; } return [247, 245, 240]; };
    const sel = ['.hero__sub', '.hero__datos dt', '.antetitulo', '.casa__texto p:not(.antetitulo)', '.siglo__pie', '.plantas__item p', '.plantas__piso', '.rasgos li', '.estancia span', '.placa__linea', '.placa__pie', '.dormir__lista span', '.saber__lista dt', '.lugares__linea', '.lugares__etiqueta', '.lugares__dist small', '.nota-grande span', '.categorias span', '.citas__pista span', '.fechas__cabeza p:not(.antetitulo)', '.fechas .antetitulo', '.campo label', '.boton--azul', '.cabecera__nav a', '.contacto address a', '.pie__lugar', '.pie__bienvenida', '.pie__legal', 'figcaption', '.nota'];
    return sel.map(s => { const el = document.querySelector(s); if (!el) return [s, null]; const a = lum(rgb(getComputedStyle(el).color)), b = lum(fondo(el)); return [s, (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)]; });
  });
  for (const [s, c] of reales) ok('contraste AA (texto real) ' + s, c != null && c >= 4.5, c == null ? 'no está' : c.toFixed(2));
  await ctx.close();
});

/* ═══════════════ 6 · páginas legales y 404 ═══════════════ */
console.log('\n6 · Legales y 404');
for (const p of ['aviso-legal.html', 'privacidad.html', '404.html']) {
  await conTope(p, 20000, async () => {
    const { ctx, page, errores, fallos } = await abrir({ width: 1440, height: 900 }, { url: URL + p });
    ok(p + ': carga sin errores', !errores.length && !fallos.filter(x => !/404 .*404\.html/.test(x)).length, errores.concat(fallos).join(' | '));
    ok(p + ': sin desborde a 360', await (async () => { await page.setViewportSize({ width: 360, height: 640 }); await page.waitForTimeout(200); return page.evaluate(() => document.documentElement.scrollWidth <= innerWidth); })());
    await cap(page, 'legal-' + p.replace('.html', ''));
    await ctx.close();
  });
}
{
  const r = await fetch(URL + 'no-existe');
  ok('404: responde 404 con su página', r.status === 404 && /falta una baldosa/.test(await r.text()));
}

/* ═══════════════ 7 · entrega: quitar el mando ═══════════════ */
console.log('\n7 · Entrega');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'casadamae-'));
await conTope('entrega', 60000, async () => {
  const destino = path.join(tmp, 'entrega');
  execFileSync(process.execPath, [path.join(raiz, 'scripts/quitar-mando.mjs'), destino], { stdio: 'ignore' });
  let limpio = true;
  try { execFileSync(process.execPath, [path.join(raiz, 'scripts/comprobar-borrado.mjs'), destino], { stdio: 'ignore' }); } catch (e) { limpio = false; }
  ok('entrega: comprobar-borrado no encuentra rastros del mando', limpio);
  const s2 = await servidor(destino, 4272);
  const { ctx, page, errores, fallos } = await abrir({ width: 1440, height: 900 }, { url: 'http://127.0.0.1:4272/', query: '?revision' });
  await trasCortina(page);
  ok('entrega: carga sin errores ni 404', !errores.length && !fallos.length, errores.concat(fallos).join(' | '));
  ok('entrega: sin mando aunque lleve ?revision', await page.evaluate(() => !document.getElementById('mando') && !document.getElementById('galeria-completa') && !document.getElementById('puntuaciones')));
  ok('entrega: sigue siendo «La baldosa» (retícula y placas que se voltean)', await page.evaluate(() => document.documentElement.classList.contains('densidad-baldosa') && document.querySelectorAll('.reticula i').length > 10));
  await ctx.close(); s2.close();
});
fs.rmSync(tmp, { recursive: true, force: true });

await browser.close();
srv.close();
const fallan = resultados.filter(r => !r.cond);
console.log('\n' + (resultados.length - fallan.length) + '/' + resultados.length + ' comprobaciones bien.');
if (fallan.length) { console.log('Fallan:\n' + fallan.map(f => '  · ' + f.nombre + (f.detalle ? ' → ' + f.detalle : '')).join('\n')); process.exitCode = 1; }
