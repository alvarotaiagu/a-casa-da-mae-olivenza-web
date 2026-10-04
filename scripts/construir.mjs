/* Construye las partes generadas de la web desde los datos. Idempotente: la
   segunda pasada no cambia nada.

   - index.html, entre <!-- GENERADO:x --> … <!-- /GENERADO:x -->:
       piezas        el símbolo del logo (assets/logo/piezas.svg) dentro de <symbol id="simbolo">
       baldosa       la baldosa (scripts/baldosa.mjs) dentro de <symbol id="baldosa">
       arcos         las tres fotos de la planta baja en arco de medio punto
       estancias     un <button> por estancia de la planta baja con fotos
       placas        las cuatro placas de los apartamentos (data/apartamentos.json + data/lugares.json)
       plano         el plano en retícula ortogonal (data/lugares.json)
       lista-a-pie   la lista con metros y minutos
       categorias    las siete puntuaciones de Booking como filas de baldosas (data/config.json)
       puntuaciones  la tabla de la versión sobria
       licencias     el pie solo las pinta si data/config.json no las tiene a null
       aviso-mando   lo que está sin confirmar (camas, licencias, n.º 16)
   - cada <picture data-foto="ID" …></picture> con sus fuentes AVIF/WebP/JPG (data/fotos.json)
   - <script id="datos-fotos">: los datos de las fotos (la galería funciona también con file://)
   - css/estilos.css, entre las marcas GENERADO:losa: el data-URI de la baldosa (--losa)

   node scripts/construir.mjs
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { simboloBaldosa, dataUri, MEDALLON } from './baldosa.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = f => JSON.parse(fs.readFileSync(path.join(raiz, f), 'utf8'));
const FOTOS = leer('data/fotos.json').fotos;
const fotos = Object.fromEntries(FOTOS.map(f => [f.id, f]));
const config = leer('data/config.json');
const lugares = leer('data/lugares.json');
const aptos = leer('data/apartamentos.json');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const attr = (t, n) => { const m = t.match(new RegExp('\\s' + n + '="([^"]*)"')); return m ? m[1] : null; };
const num = (v, d = 1) => v.toFixed(d).replace('.', ',');

export function picture(id, { sizes = '100vw', carga = 'lazy', alt = null, sangria = '' } = {}) {
  const f = fotos[id];
  if (!f) throw new Error('No está en data/fotos.json: ' + id);
  const set = ext => f.anchos.map(a => `assets/fotos/${id}-${a}.${ext} ${a}w`).join(', ');
  const mayor = f.anchos[f.anchos.length - 1];
  const alto = Math.round(f.h * mayor / f.w);
  const extra = carga === 'eager' ? ' fetchpriority="high"' : ' loading="lazy"';
  const foco = f.foco ? ` style="object-position: ${f.foco}"` : '';
  return [
    `<source type="image/avif" srcset="${set('avif')}" sizes="${sizes}">`,
    `<source type="image/webp" srcset="${set('webp')}" sizes="${sizes}">`,
    `<img src="assets/fotos/${id}-${mayor}.jpg" srcset="${set('jpg')}" sizes="${sizes}" width="${mayor}" height="${alto}" alt="${esc(alt ?? f.alt)}" decoding="async"${extra}${foco}>`
  ].map(l => sangria + l).join('\n');
}
const pic = (id, sizes, extra = '') => `<picture data-foto="${id}" data-sizes="${sizes}"${extra}></picture>`;
const deEstancia = e => FOTOS.filter(f => f.estancia === e);

/* ───────────── bloques ───────────── */
function bPiezas() {
  const svg = fs.readFileSync(path.join(raiz, 'assets/logo/piezas.svg'), 'utf8');
  return ['s-disco', 's-flor', 's-cruz', 's-puntos', 's-aro', 's-bolas'].map(id => {
    const m = svg.match(new RegExp('<path id="' + id + '"([^>]*?) d="([^"]+)"'));
    if (!m) throw new Error('Falta ' + id + ' en piezas.svg');
    const regla = /fill-rule="evenodd"/.test(m[1]) ? ' fill-rule="evenodd"' : '';
    return `    <path id="${id}" class="${id}"${regla} d="${m[2]}"/>`;
  }).join('\n');
}

const ESTANCIAS_PB = [
  ['habitaciones', 'Habitaciones'], ['salon', 'Salón comedor'], ['cocina', 'Cocina'],
  ['lectura', 'Sala de lectura'], ['patio', 'Patio'], ['banos', 'Baños'], ['casa', 'La casa']
];
function bArcos() {
  const elegir = (preferida, estancia) => fotos[preferida] ? preferida : (deEstancia(estancia)[0] || {}).id;
  const tres = [
    [elegir('boveda-salon', 'salon'), 'El salón comedor, bajo las bóvedas'],
    [deEstancia('habitaciones')[0]?.id, 'Una de las tres habitaciones'],
    [elegir('patio', 'patio'), 'El patio, con su fuente']
  ].filter(([id]) => id);
  return '    <div class="arcos">\n' + tres.map(([id, pie]) =>
    `      <figure class="arco">\n        <div class="arco__marco"><div class="arco__ventana">${pic(id, '(max-width: 640px) 92vw, 30vw')}</div></div>\n        <figcaption>${pie}</figcaption>\n      </figure>`).join('\n') + '\n    </div>';
}
function bEstancias() {
  const items = ESTANCIAS_PB.filter(([e]) => deEstancia(e).length).map(([e, nombre]) => {
    const n = deEstancia(e).length;
    return `        <li><button class="estancia" type="button" data-estancia="${e}">${pic(deEstancia(e)[0].id, '64px', ' data-alt=""')}<b>${nombre}</b><span>${n} ${n === 1 ? 'foto' : 'fotos'}</span></button></li>`;
  });
  return '      <ul class="estancias__lista">\n' + items.join('\n') + '\n      </ul>';
}
const lugar = id => lugares.lugares.find(l => l.id === id);
function bPlacas() {
  const placaDe = { magdalena: 'placa-magdalena', cadaval: 'placa-cadaval', calvario: 'placa-calvario', maria: 'placa-santamaria' };
  return '    <ul class="placas">\n' + aptos.apartamentos.map(a => {
    const l = lugar(a.lugar);
    const n = deEstancia(a.id).length;
    return `      <li class="placa" data-apartamento="${a.id}">
        <div class="placa__marco">
          <div class="placa__giro">
            <div class="placa__cara placa__cara--frente">${pic(placaDe[a.id], '(max-width: 420px) 90vw, (max-width: 1180px) 45vw, 22vw')}</div>
            <div class="placa__cara placa__cara--tras">${pic(a.id + '-1', '(max-width: 420px) 90vw, (max-width: 1180px) 45vw, 22vw')}</div>
          </div>
        </div>
        <h3>${esc(a.nombre)}</h3>
        <p class="placa__linea">${esc(l.linea)}</p>
        <p class="placa__pie" data-lugar="${l.id}">A ${l.pie_m} m · ${l.minutos} min a pie</p>
        <button class="placa__boton" type="button" data-estancia="${a.id}">Ver el apartamento<span class="visualmente-oculto"> ${esc(a.nombre)}</span> · ${n} fotos</button>
      </li>`;
  }).join('\n') + '\n    </ul>';
}
const ordenados = () => [...lugares.lugares].sort((a, b) => a.pie_m - b.pie_m);
function bPlano() {
  const M = 25, C = 30;                                   /* 25 m por baldosa, 30 px por celda */
  const celda = l => [Math.round(l.x_m / M), Math.round(-l.y_m / M)];
  const ls = ordenados().map((l, i) => ({ ...l, n: i + 1, c: celda(l) }));
  const xs = [0, ...ls.map(l => l.c[0])], ys = [0, ...ls.map(l => l.c[1])];
  const x0 = Math.min(...xs) - 1, x1 = Math.max(...xs) + 1, y0 = Math.min(...ys) - 1, y1 = Math.max(...ys) + 1;
  const W = (x1 - x0 + 1) * C, H = (y1 - y0 + 1) * C;
  const px = c => (c - x0) * C, py = c => (c - y0) * C;
  const juntas = [];
  for (let x = 0; x <= W; x += C) juntas.push(`M${x} 0V${H}`);
  for (let y = 0; y <= H; y += C) juntas.push(`M0 ${y}H${W}`);
  const puntos = ls.map(l => {
    const apto = l.apartamento ? ' plano__punto--apto' : '';
    return `<g class="plano__punto${apto}"><rect x="${px(l.c[0]) + 3}" y="${py(l.c[1]) + 3}" width="${C - 6}" height="${C - 6}"/><text x="${px(l.c[0]) + C / 2}" y="${py(l.c[1]) + C / 2 + 1}">${l.n}</text></g>`;
  }).join('\n          ');
  const titulo = 'Plano en retícula: la casa y cinco lugares, ' + ls.map(l => `${l.n}, ${l.nombre}`).join('; ');
  return `        <svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="plano-titulo">
          <title id="plano-titulo">${esc(titulo)}</title>
          <rect class="plano__borde" x="1" y="1" width="${W - 2}" height="${H - 2}"/>
          <path class="plano__junta" d="${juntas.join('')}"/>
          <use href="#baldosa" x="${px(0)}" y="${py(0)}" width="${C}" height="${C}"/>
          <text class="plano__casa-rotulo" x="${px(0) + C + 6}" y="${py(0) + C / 2 + 4}">LA CASA</text>
          ${puntos}
        </svg>`;
}
function bLista() {
  return '      <ol class="lugares">\n' + ordenados().map((l, i) => {
    const apto = l.apartamento ? ' class="es-apto"' : '';
    const etiqueta = l.apartamento ? `<span class="lugares__etiqueta">Da nombre a un apartamento</span>` : '';
    return `        <li${apto}><span class="lugares__n">${i + 1}</span><b>${esc(l.nombre)}</b><span class="lugares__dist" data-lugar="${l.id}">${l.pie_m} m<small>${l.minutos} min</small></span><span class="lugares__linea">${esc(l.linea)}</span>${etiqueta}</li>`;
  }).join('\n') + '\n      </ol>';
}
function bCategorias() {
  return '    <ul class="categorias" aria-label="Puntuaciones por categoría en Booking">\n' + config.booking.categorias.map(([nombre, nota]) => {
    const losas = Array.from({ length: 10 }, (_, i) => {
      const p = Math.max(0, Math.min(1, nota - i));
      return `<i style="--i:${i};--p:${+p.toFixed(2)}"></i>`;
    }).join('');
    return `      <li><span>${esc(nombre)}</span><span class="losas" role="img" aria-label="${num(nota)} sobre 10">${losas}</span><b>${num(nota)}</b></li>`;
  }).join('\n') + '\n    </ul>';
}
function bPuntuaciones() {
  const b = config.booking;
  return `    <table class="puntuaciones" id="puntuaciones">
      <caption>Puntuaciones en Booking · ${b.comentarios} comentarios</caption>
      <tbody>
${b.categorias.map(([n, v]) => `        <tr><th scope="row">${esc(n)}</th><td>${num(v)}</td></tr>`).join('\n')}
        <tr><th scope="row"><b>Nota global</b></th><td>${num(b.nota)}</td></tr>
      </tbody>
    </table>`;
}
function bLicencias() {
  if (config.licencias === null || config.licencias === undefined) return '';
  const l = Array.isArray(config.licencias) ? config.licencias.join(' · ') : config.licencias;
  return `    <p class="pie__licencias">Licencias: ${esc(l)}</p>`;
}
function bAviso() {
  const o = lugares.origen;
  const geo = o.provisional ? 'no (punto provisional en la calle)' : `sí (${o.metodo === 'catastro' ? 'Catastro' : 'OSM'})`;
  const partes = [];
  if (!aptos.confirmado) partes.push('Camas por apartamento sin confirmar');
  if (config.licencias === null) partes.push('licencias sin confirmar');
  partes.push('n.º 16 geolocalizado: ' + geo);
  return `  <p class="mando__aviso">${esc(partes.join(' · '))}</p>`;
}

const BLOQUES = {
  piezas: bPiezas, baldosa: () => simboloBaldosa(), arcos: bArcos, estancias: bEstancias, placas: bPlacas,
  plano: bPlano, 'lista-a-pie': bLista, categorias: bCategorias, puntuaciones: bPuntuaciones,
  licencias: bLicencias, 'aviso-mando': bAviso
};

/* ───────────── index.html ───────────── */
const ruta = path.join(raiz, 'index.html');
const antes = fs.readFileSync(ruta, 'utf8');
let html = antes;
for (const [nombre, fn] of Object.entries(BLOQUES)) {
  const re = new RegExp('(<!-- GENERADO:' + nombre + ' -->)[\\s\\S]*?(<!-- /GENERADO:' + nombre + ' -->)');
  if (!re.test(html)) throw new Error('Falta la marca GENERADO:' + nombre);
  const dentro = fn();
  html = html.replace(re, (t, a, b) => a + '\n' + (dentro ? dentro + '\n' : '') + b);
}
html = html.replace(/<symbol id="baldosa" viewBox="0 0 100 100"[^>]*>/, `<symbol id="baldosa" viewBox="0 0 100 100" data-medallon="${MEDALLON}">`);
let n = 0;
html = html.replace(/([ \t]*)<picture([^>]*\sdata-foto="([\w-]+)"[^>]*)>[\s\S]*?<\/picture>/g, (todo, sangria, atributos, id) => {
  n++;
  const dentro = picture(id, {
    sizes: attr(atributos, 'data-sizes') || '100vw',
    carga: attr(atributos, 'data-carga') || 'lazy',
    alt: attr(atributos, 'data-alt'),
    sangria: sangria + '  '
  });
  return `${sangria}<picture${atributos}>\n${dentro}\n${sangria}</picture>`;
});
const datos = JSON.stringify(FOTOS.map(f => ({ id: f.id, estancia: f.estancia, alt: f.alt, w: f.w, h: f.h, anchos: f.anchos })));
html = html.replace(/(<script type="application\/json" id="datos-fotos">)[^<]*(<\/script>)/, (t, a, b) => a + datos.replace(/</g, '\\u003c') + b);
if (html.length < antes.length * 0.8) throw new Error('Me niego: index.html perdería demasiado');
if (html !== antes) fs.writeFileSync(ruta, html);
console.log((html !== antes ? 'actualizado ' : 'sin cambios ') + 'index.html · ' + n + ' fotos');

/* ───────────── css: la baldosa en data-URI ───────────── */
const rutaCss = path.join(raiz, 'css/estilos.css');
const css0 = fs.readFileSync(rutaCss, 'utf8');
const css = css0.replace(/(\/\* GENERADO:losa \*\/)[\s\S]*?(\/\* \/GENERADO:losa \*\/)/, (t, a, b) =>
  a + '\n  --losa: ' + dataUri() + ';\n' + b);
if (css.length < css0.length * 0.9) throw new Error('Me niego: estilos.css perdería demasiado');
if (css !== css0) fs.writeFileSync(rutaCss, css);
console.log((css !== css0 ? 'actualizado ' : 'sin cambios ') + 'css/estilos.css (--losa)');

/* ───────────── la baldosa suelta ───────────── */
const { svgSuelto } = await import('./baldosa.mjs');
fs.writeFileSync(path.join(raiz, 'assets/baldosa.svg'), svgSuelto() + '\n');
