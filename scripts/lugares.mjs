#!/usr/bin/env node
// Distancias a pie desde la casa (C/ Díaz Brito 16, antigua Rua dos Oleiros) a cinco
// lugares de Olivenza que dan nombre a los apartamentos (y a la Torre del Homenaje).
//
// Uso (Node 22, sin dependencias):
//   node scripts/lugares.mjs            -> geolocaliza el n.º 16 (Catastro → Overpass → mitad de la vía),
//                                          pide la ruta a pie a OSRM y escribe data/lugares.json
//   node scripts/lugares.mjs --sin-red  -> no usa la red: lee data/lugares.json y recalcula
//                                          recta_m, minutos, x_m e y_m desde las lat/lon guardadas
//
// Reglas:
//   origen  = 1.º Catastro (OVCCallejero Consulta_DNPLOC → referencia catastral de 14 caracteres →
//             OVCCoordenadas Consulta_CPMRC en EPSG:4326, que da el centroide de la parcela);
//             2.º Overpass (addr:housenumber=16 + addr:street ~ «Díaz Brito»);
//             3.º punto medio (por longitud) de la vía 560710210, Calle Díaz Brito → provisional
//   comprobación: el origen debe quedar a ≤ 40 m de la vía 560710210 (Calle Díaz Brito)
//   recta_m = haversine
//   pie_m   = distancia OSRM (routing.openstreetmap.de, perfil foot) redondeada a 5 m;
//             el valor sin redondear va en pie_osrm_m
//   minutos = ceil(pie_osrm_m / 80)
//   x_m/y_m = proyección equirectangular local en metros desde el origen (x al este, y al norte)
//
// Los lugares (coordenadas y elemento OSM) salen de casa-juderia-olivenza-web/data/lugares.json
// (2026-10-02). Aquí no hay rumbo ni anillo: esta web no tiene nada radial.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const SALIDA = resolve(AQUI, '../data/lugares.json');
const UA = 'a-casa-da-mae-olivenza-web/1.0 (scripts/lugares.mjs)';
const HOY = new Date().toISOString().slice(0, 10);
const R_TIERRA = 6371008.8; // radio medio (m)
const VIA_DIAZ_BRITO = 560710210;
const MAX_A_LA_VIA_M = 40;

const NOMBRE_ORIGEN = 'A Casa da Mãe';
const DIRECCION = 'C/ Díaz Brito (Antiga Rua dos Oleiros) 16, 06100 Olivenza (Badajoz)';

const FUENTE_LUGARES = 'casa-juderia-olivenza-web/data/lugares.json (OSM, 2026-10-02)';
const LUGARES = [
  { id: 'magdalena', nombre: 'Iglesia de la Magdalena', lat: 38.686201, lon: -7.100356,
    osm: { elemento: 'way/183313818', url: 'https://www.openstreetmap.org/way/183313818', punto: 'centroide de los 24 nodos de la vía', fuente: FUENTE_LUGARES },
    apartamento: 'La Magdalena',
    linea: 'Iglesia de estilo manuelino.' },
  { id: 'ayuntamiento', nombre: 'Ayuntamiento (antiguo Palacio de los Duques de Cadaval)', lat: 38.685547, lon: -7.100837,
    osm: { elemento: 'node/6865900018', url: 'https://www.openstreetmap.org/node/6865900018', punto: 'nodo', fuente: FUENTE_LUGARES },
    apartamento: 'Duques de Cadaval',
    linea: 'El antiguo palacio de los Duques de Cadaval, hoy Ayuntamiento.' },
  { id: 'puerta-calvario', nombre: 'Puerta del Calvario', lat: 38.688051, lon: -7.101764,
    osm: { elemento: 'node/10000118795', url: 'https://www.openstreetmap.org/node/10000118795', punto: 'nodo', fuente: FUENTE_LUGARES },
    apartamento: 'Puerta del Calvario',
    linea: 'Una de las puertas de la muralla.' },
  { id: 'santa-maria', nombre: 'Iglesia de Santa María del Castillo', lat: 38.685107, lon: -7.099602,
    osm: { elemento: 'way/560034728', url: 'https://www.openstreetmap.org/way/560034728', punto: 'centroide de los 33 nodos de la vía', fuente: FUENTE_LUGARES },
    apartamento: 'Santa María del Castillo',
    linea: 'Junto a la Torre del Homenaje.' },
  { id: 'torre', nombre: 'Torre del Homenaje (Alcázar)', lat: 38.685303, lon: -7.099265,
    osm: { elemento: 'node/9514512200', url: 'https://www.openstreetmap.org/node/9514512200', punto: 'nodo', fuente: FUENTE_LUGARES },
    apartamento: null,
    linea: 'La torre del castillo medieval.' },
];

const metodoDe = (fecha) =>
  'recta = haversine; pie = distancia OSRM (routing.openstreetmap.de/routed-foot, perfil foot) ' +
  `${fecha}, redondeada a 5 m (sin redondear en pie_osrm_m); minutos = ceil(pie_osrm_m / 80); ` +
  'x_m/y_m = proyección equirectangular local desde el origen en metros (x al este, y al norte), ' +
  'con cos(latitud del origen); coordenadas de los lugares tomadas de la web de la Casa de la Judería (OSM, 2026-10-02)';

// ---------- geometría ----------
const rad = (g) => (g * Math.PI) / 180;

export function haversine(a, b) {
  const φ1 = rad(a.lat), φ2 = rad(b.lat);
  const Δφ = φ2 - φ1, Δλ = rad(b.lon - a.lon);
  const h = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R_TIERRA * Math.asin(Math.sqrt(h));
}

// proyección equirectangular local (metros) con el origen como referencia
export function proyectar(origen, p) {
  return {
    x: rad(p.lon - origen.lon) * Math.cos(rad(origen.lat)) * R_TIERRA,
    y: rad(p.lat - origen.lat) * R_TIERRA,
  };
}

// distancia (m) de un punto a una polilínea de {lat, lon}
function distanciaAPolilinea(p, nodos) {
  const q = nodos.map((n) => proyectar(p, n)); // p queda en (0,0)
  let min = Infinity;
  for (let i = 0; i < q.length - 1; i++) {
    const a = q[i], b = q[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / (dx * dx + dy * dy || 1)));
    min = Math.min(min, Math.hypot(a.x + t * dx, a.y + t * dy));
  }
  return min;
}

// punto a mitad de recorrido (por longitud) de una polilínea
function mitadDePolilinea(nodos) {
  const tramos = nodos.slice(1).map((n, i) => haversine(nodos[i], n));
  const total = tramos.reduce((s, d) => s + d, 0);
  let falta = total / 2;
  for (let i = 0; i < tramos.length; i++) {
    if (falta <= tramos[i]) {
      const t = falta / tramos[i], a = nodos[i], b = nodos[i + 1];
      return { lat: a.lat + t * (b.lat - a.lat), lon: a.lon + t * (b.lon - a.lon), longitud_m: total };
    }
    falta -= tramos[i];
  }
  return { ...nodos.at(-1), longitud_m: total };
}

const r6 = (x) => Number(x.toFixed(6));
const r1 = (x) => Number(x.toFixed(1));
const a5 = (x) => Math.round(x / 5) * 5;
const minutosDe = (m) => Math.ceil(m / 80);

// Se calcula siempre con las coordenadas ya redondeadas a 6 decimales (las que se guardan),
// para que --sin-red reproduzca exactamente el mismo resultado.
function completar(l, origen) {
  const p = { lat: r6(l.lat), lon: r6(l.lon) };
  const { x, y } = proyectar(origen, p);
  return {
    id: l.id,
    nombre: l.nombre,
    lat: p.lat,
    lon: p.lon,
    osm: l.osm,
    recta_m: Math.round(haversine(origen, p)),
    pie_m: l.pie_osrm_m == null ? null : a5(l.pie_osrm_m),
    pie_osrm_m: l.pie_osrm_m ?? null,
    minutos: l.pie_osrm_m == null ? null : minutosDe(l.pie_osrm_m),
    x_m: r1(x),
    y_m: r1(y),
    apartamento: l.apartamento ?? null,
    linea: l.linea,
    ...(l.pie_aviso ? { pie_aviso: l.pie_aviso } : {}),
  };
}

const ordenar = (lista) =>
  lista.map((l, i) => [l, i])
    .sort((a, b) => (a[0].pie_osrm_m ?? Infinity) - (b[0].pie_osrm_m ?? Infinity) || a[1] - b[1])
    .map(([l]) => l);

// ---------- red ----------
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

async function pedir(url, opciones = {}, ms = 60000) {
  const res = await fetch(url, { ...opciones, headers: { 'User-Agent': UA, ...(opciones.headers ?? {}) }, signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} ← ${url}`);
  return res;
}
const pedirJson = async (url, opciones, ms) => (await pedir(url, opciones, ms)).json();
const pedirTexto = async (url, opciones, ms) => (await pedir(url, opciones, ms)).text();

const etiqueta = (xml, nombre) => xml.match(new RegExp(`<${nombre}>([^<]*)</${nombre}>`))?.[1] ?? null;

async function porCatastro() {
  const ruta = '/ovcservweb/OVCSWLocalizacionRC';
  const qDir = new URLSearchParams({
    Provincia: 'BADAJOZ', Municipio: 'OLIVENZA', Sigla: 'CL', Calle: 'DIAZ BRITO', Numero: '16',
    Bloque: '', Escalera: '', Planta: '', Puerta: '',
  });
  let ultimoError;
  for (const base of ['https://ovc.catastro.meh.es', 'http://ovc.catastro.meh.es']) {
    try {
      const urlDir = `${base}${ruta}/OVCCallejero.asmx/Consulta_DNPLOC?${qDir}`;
      const xmlDir = await pedirTexto(urlDir, {}, 30000);
      const err = etiqueta(xmlDir, 'des');
      if (err) throw new Error(`Catastro (dirección): ${err}`);
      const pc1 = etiqueta(xmlDir, 'pc1'), pc2 = etiqueta(xmlDir, 'pc2');
      if (!pc1 || !pc2) throw new Error('Catastro (dirección): sin referencia catastral');
      const rc14 = pc1 + pc2;
      const rc20 = rc14 + (etiqueta(xmlDir, 'car') ?? '') + (etiqueta(xmlDir, 'cc1') ?? '') + (etiqueta(xmlDir, 'cc2') ?? '');
      const ldt = etiqueta(xmlDir, 'ldt');
      const nv = etiqueta(xmlDir, 'nv'), pnp = etiqueta(xmlDir, 'pnp');
      if (!/DIAZ BRITO/i.test(nv ?? '') || pnp !== '16') throw new Error(`Catastro devolvió otra dirección: ${ldt}`);
      console.log(`Catastro: ${ldt} → RC ${rc20}`);

      await pausa(500);
      const qCoor = new URLSearchParams({ Provincia: '', Municipio: '', SRS: 'EPSG:4326', RC: rc14 });
      const urlCoor = `${base}${ruta}/OVCCoordenadas.asmx/Consulta_CPMRC?${qCoor}`;
      const xmlCoor = await pedirTexto(urlCoor, {}, 30000);
      const errC = etiqueta(xmlCoor, 'des');
      if (errC) throw new Error(`Catastro (coordenadas): ${errC}`);
      const xcen = etiqueta(xmlCoor, 'xcen'), ycen = etiqueta(xmlCoor, 'ycen');
      if (!xcen || !ycen) throw new Error('Catastro (coordenadas): sin xcen/ycen');
      return {
        lat: Number(ycen), lon: Number(xcen), metodo: 'catastro', provisional: false,
        fuente: urlCoor,
        detalle: {
          nota: 'Catastro da el centroide de la parcela catastral, no la puerta; se guarda tal cual',
          referencia_catastral: rc20,
          referencia_catastral_14: rc14,
          ldt,
          uso: etiqueta(xmlDir, 'luso'),
          superficie_construida_m2: Number(etiqueta(xmlDir, 'sfc')),
          ano_construccion: Number(etiqueta(xmlDir, 'ant')),
          xcen, ycen, srs: etiqueta(xmlCoor, 'srs'),
          ldt_coordenadas: etiqueta(xmlCoor, 'ldt'),
          url_direccion: urlDir,
          url_coordenadas: urlCoor,
        },
      };
    } catch (e) {
      ultimoError = e;
      console.warn(`Catastro falló (${base}): ${e.message}`);
    }
  }
  throw ultimoError;
}

async function porOverpass() {
  const q = '[out:json][timeout:30];nwr["addr:housenumber"="16"]["addr:street"~"D[ií]az Brito",i](38.683,-7.106,38.690,-7.096);out center tags;';
  let ultimoError;
  for (const ep of ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']) {
    try {
      const d = await pedirJson(ep, { method: 'POST', body: new URLSearchParams({ data: q }) }, 60000);
      const el = d.elements?.[0];
      if (!el) throw new Error('sin resultados');
      const p = el.type === 'node' ? { lat: el.lat, lon: el.lon } : { lat: el.center.lat, lon: el.center.lon };
      return {
        ...p, metodo: 'overpass', provisional: false,
        fuente: `https://www.openstreetmap.org/${el.type}/${el.id}`,
        detalle: { endpoint: ep, consulta: q, elemento: `${el.type}/${el.id}`, tags: el.tags, punto: el.type === 'node' ? 'nodo' : 'centro (out center)', resultados: d.elements.length },
      };
    } catch (e) {
      ultimoError = e;
      console.warn(`Overpass falló (${ep}): ${e.message}`);
    }
  }
  throw ultimoError;
}

async function porMitadDeVia(via) {
  const m = mitadDePolilinea(via.nodos);
  return {
    lat: m.lat, lon: m.lon, metodo: 'mitad-de-via', provisional: true,
    fuente: `https://www.openstreetmap.org/way/${VIA_DIAZ_BRITO}`,
    detalle: { nota: 'punto medio por longitud de la vía Calle Díaz Brito; NO es la puerta del n.º 16', longitud_via_m: r1(m.longitud_m) },
  };
}

async function viaDiazBrito() {
  const d = await pedirJson(`https://www.openstreetmap.org/api/0.6/way/${VIA_DIAZ_BRITO}/full.json`, {}, 30000);
  const via = d.elements.find((e) => e.type === 'way' && e.id === VIA_DIAZ_BRITO);
  const nodos = new Map(d.elements.filter((e) => e.type === 'node').map((e) => [e.id, e]));
  return { nombre: via.tags?.name ?? null, nodos: via.nodes.map((id) => nodos.get(id)) };
}

async function osrmPie(a, b) {
  // el perfil va en la ruta del servidor (routed-foot); el segmento dice «driving» de verdad
  const url = `https://routing.openstreetmap.de/routed-foot/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`;
  const d = await pedirJson(url, {}, 30000);
  if (d.code !== 'Ok' || !d.routes?.length) throw new Error(`OSRM: ${d.code}`);
  return d.routes[0].distance;
}

async function conRed() {
  const via = await viaDiazBrito();
  console.log(`Vía ${VIA_DIAZ_BRITO}: «${via.nombre}», ${via.nodos.length} nodos`);
  await pausa(1000);

  let o;
  for (const intento of [porCatastro, porOverpass, () => porMitadDeVia(via)]) {
    try { o = await intento(); break; } catch { /* siguiente método */ }
  }
  const aLaVia = distanciaAPolilinea(o, via.nodos);
  console.log(`Origen (${o.metodo}): ${o.lat}, ${o.lon} — a ${aLaVia.toFixed(1)} m de la vía ${VIA_DIAZ_BRITO}`);
  if (aLaVia > MAX_A_LA_VIA_M) {
    console.error(`El origen queda a ${aLaVia.toFixed(1)} m de la Calle Díaz Brito (máx. ${MAX_A_LA_VIA_M} m). No escribo nada.`);
    process.exit(1);
  }
  const origen = {
    nombre: NOMBRE_ORIGEN,
    direccion: DIRECCION,
    lat: o.lat,
    lon: o.lon,
    metodo: o.metodo,
    provisional: o.provisional,
    fuente: o.fuente,
    fecha: HOY,
    detalle: {
      ...o.detalle,
      comprobacion: `a ${r1(aLaVia)} m de la vía ${VIA_DIAZ_BRITO} («${via.nombre}», https://www.openstreetmap.org/way/${VIA_DIAZ_BRITO}); umbral ${MAX_A_LA_VIA_M} m`,
      distancia_a_la_via_m: r1(aLaVia),
    },
  };

  const pOrigen = { lat: r6(o.lat), lon: r6(o.lon) };
  const lista = [];
  for (const l of LUGARES) {
    await pausa(1000);
    let pie = null;
    try {
      pie = await osrmPie(pOrigen, l);
    } catch (e) {
      console.warn(`  OSRM falló para ${l.id}: ${e.message}`);
    }
    const lugar = { ...l, pie_osrm_m: pie };
    const recta = haversine(pOrigen, l);
    if (pie != null && pie / recta > 1.8) {
      lugar.pie_aviso = `a pie ${Math.round(pie)} m frente a ${Math.round(recta)} m en línea recta (×${(pie / recta).toFixed(2)})`;
    }
    console.log(`${l.id.padEnd(16)} OSRM ${pie ?? '—'} m`);
    lista.push(lugar);
  }
  return { origen, metodo: metodoDe(HOY), fecha: HOY, lugares: lista };
}

async function sinRed() {
  const d = JSON.parse(await readFile(SALIDA, 'utf8'));
  return { origen: d.origen, metodo: d.metodo, fecha: d.fecha, lugares: d.lugares };
}

// ---------- main ----------
const datos = process.argv.includes('--sin-red') ? await sinRed() : await conRed();
const origen = { lat: r6(datos.origen.lat), lon: r6(datos.origen.lon) };
const salida = {
  origen: { ...datos.origen, lat: origen.lat, lon: origen.lon },
  metodo: datos.metodo,
  fecha: datos.fecha,
  lugares: ordenar(datos.lugares).map((l) => completar(l, origen)),
};

await mkdir(dirname(SALIDA), { recursive: true });
await writeFile(SALIDA, JSON.stringify(salida, null, 2) + '\n', 'utf8');

console.log(`\nOrigen: ${salida.origen.lat}, ${salida.origen.lon} (${salida.origen.metodo}${salida.origen.provisional ? ', PROVISIONAL' : ''})`);
console.log(`${'lugar'.padEnd(16)} recta   pie   osrm  min     x_m     y_m`);
for (const l of salida.lugares) {
  console.log(`${l.id.padEnd(16)} ${String(l.recta_m).padStart(5)} ${String(l.pie_m ?? '—').padStart(5)} ${String(l.pie_osrm_m ?? '—').padStart(6)} ${String(l.minutos ?? '—').padStart(4)} ${String(l.x_m).padStart(7)} ${String(l.y_m).padStart(7)}`);
}
console.log(`\nEscrito ${SALIDA}`);
