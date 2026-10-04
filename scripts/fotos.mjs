/* Versiones responsive de las fotos: AVIF + WebP + JPG a 480, 960 y 1440 px de ancho
   (y 1920 para el héroe: boveda-salon-v, boveda-salon y las marcadas hero: true), sin
   pasar del máster. Lee los másteres por id de scripts/fuentes/masters/<id>.jpg (los
   hace scripts/fotos.py: gradación común + verticales) y escribe:

     assets/fotos/<id>-<ancho>.avif|webp|jpg
     data/fotos.json  ← rellena w, h y anchos de cada foto (conserva el resto de campos)

   python scripts/fotos.py   (primero, si cambian los másteres)
   node scripts/fotos.mjs
   Usa sharp del node_modules de alvarotaiagu.github.io (no hay npm en este repo).
*/
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/package.json');
const sharp = require('sharp');

const origen = path.join(raiz, 'scripts', 'fuentes', 'masters');
const destino = path.join(raiz, 'assets', 'fotos');
fs.mkdirSync(destino, { recursive: true });
const ANCHOS = [480, 960, 1440];
const HEROE = new Set(['boveda-salon-v', 'boveda-salon']);
const rutaJson = path.join(raiz, 'data', 'fotos.json');
const datos = JSON.parse(fs.readFileSync(rutaJson, 'utf8'));

// fuera lo que ya no está en el catálogo (versiones viejas de ids renombrados o quitados)
const ids = new Set(datos.fotos.map(f => f.id));
for (const archivo of fs.readdirSync(destino)) {
  const m = archivo.match(/^(.+)-\d+\.(avif|webp|jpg)$/);
  if (m && !ids.has(m[1])) fs.unlinkSync(path.join(destino, archivo));
}

let bytes = 0;
for (const f of datos.fotos) {
  const src = path.join(origen, f.id + '.jpg');
  const meta = await sharp(src).metadata();
  f.w = meta.width; f.h = meta.height;
  const lista = HEROE.has(f.id) || f.hero ? [...ANCHOS, 1920] : ANCHOS;
  const tope = lista[lista.length - 1];
  const anchos = lista.filter(a => a < meta.width - 40);
  if (!anchos.length || (meta.width < tope && meta.width - anchos[anchos.length - 1] > 120)) anchos.push(Math.min(meta.width, tope));
  f.anchos = [...new Set(anchos)].sort((a, b) => a - b);
  for (const a of f.anchos) {
    const base = sharp(src).resize({ width: a, withoutEnlargement: true });
    const salidas = [
      [base.clone().avif({ quality: 50, effort: 5 }), 'avif'],
      [base.clone().webp({ quality: 72 }), 'webp'],
      [base.clone().jpeg({ quality: 76, mozjpeg: true, progressive: true }), 'jpg']
    ];
    for (const [s, ext] of salidas) {
      const out = path.join(destino, `${f.id}-${a}.${ext}`);
      await s.toFile(out);
      bytes += fs.statSync(out).size;
    }
  }
}
fs.writeFileSync(rutaJson, JSON.stringify(datos, null, 1) + '\n');
console.log(datos.fotos.length, 'fotos ·', (bytes / 1048576).toFixed(1), 'MB en assets/fotos');
