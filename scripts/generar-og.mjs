/* Genera assets/og-a-casa-da-mae.jpg (1200×630): el logo sobre la cal, una
   franja de baldosas y la foto del salón de bóvedas a la derecha.

   node scripts/generar-og.mjs
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { svgSuelto } from './baldosa.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fotos = JSON.parse(fs.readFileSync(path.join(raiz, 'data/fotos.json'), 'utf8')).fotos;
const f = fotos.find(x => x.id === 'boveda-salon-v') || fotos.find(x => x.id === 'boveda-salon');
const foto = pathToFileURL(path.join(raiz, `assets/fotos/${f.id}-${f.anchos[f.anchos.length - 1]}.jpg`)).href;
const logo = pathToFileURL(path.join(raiz, 'assets/logo/logo-color.svg')).href;
const losa = 'data:image/svg+xml,' + encodeURIComponent(svgSuelto());

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;display:grid;grid-template-columns:640px 56px 504px;background:#F7F5F0;overflow:hidden}
.izq{display:grid;place-items:center;padding:40px}
.izq img{width:470px}
.franja{background:url("${losa}") 0 0/56px 56px repeat-y;box-shadow:inset 2px 0 #1A6EB6,inset -2px 0 #1A6EB6}
.der{background:url('${foto}') 50% 55%/cover}
</style></head><body><div class="izq"><img src="${logo}" alt=""></div><div class="franja"></div><div class="der"></div></body></html>`;

const tmp = path.join(raiz, 'scripts', '_og.html');
fs.writeFileSync(tmp, html);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle' });
await page.screenshot({ path: path.join(raiz, 'assets/og-a-casa-da-mae.jpg'), type: 'jpeg', quality: 86 });
await browser.close();
fs.rmSync(tmp);
console.log('assets/og-a-casa-da-mae.jpg');
