/* screenshots/baldosa-vs-suelo.png: su suelo real (202_16.jpg, recortado
   alrededor de un medallón y dos flores) junto a la baldosa de la web en
   retícula, a la misma escala de círculo. Deja claro que el suelo es
   hexagonal y la baldosa de la web, un módulo cuadrado derivado.

   node scripts/baldosa-comparar.mjs
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { svgSuelto, R } from './baldosa.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const med = JSON.parse(fs.readFileSync(path.join(raiz, 'data/baldosa-medidas.json'), 'utf8'));
const foto = pathToFileURL(path.join(raiz, '..', 'a-casa-da-mae-olivenza-bocetos', 'ref', 'web', '202_16.jpg')).href;
const losa = 'data:image/svg+xml,' + encodeURIComponent(svgSuelto());
/* misma escala: el radio del aro del medallón mide lo mismo en las dos mitades */
const Rpx = 150;                                     /* px de pantalla para R */
const Rfoto = med.medallon.tramos_diagonal_px.at(-1)[1];
const k = Rpx / Rfoto;                               /* escala de la foto */
const [cx, cy] = med.medallon.centro_px;
const lado = Math.round(Rpx / R * 100);              /* lado de la baldosa en px */
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;box-sizing:border-box}body{width:1400px;height:820px;display:grid;grid-template-columns:1fr 1fr;gap:24px;padding:24px;background:#12304F;font:600 18px system-ui;color:#F7F5F0}
figure{display:grid;grid-template-rows:auto 1fr;gap:10px}
.v{position:relative;overflow:hidden;border:2px solid #9CC6EE}
.suelo{background:url('${foto}') ${(338 - cx * k).toFixed(1)}px ${(360 - cy * k).toFixed(1)}px/${(2521 * k).toFixed(1)}px auto no-repeat}
.web{background:url("${losa}") ${(338 - lado / 2).toFixed(1)}px ${(360 - lado / 2).toFixed(1)}px/${lado}px ${lado}px}
.c{position:absolute;left:${338 - Rpx}px;top:${360 - Rpx}px;width:${2 * Rpx}px;height:${2 * Rpx}px;border:2px dashed #E05A3A;border-radius:50%}
small{font-weight:400;color:#C9D6E4}
</style></head><body>
<figure><figcaption>Su suelo (202_16.jpg) <small>· hexagonal, círculos tangentes en retícula triangular</small></figcaption><div class="v suelo"><i class="c"></i></div></figure>
<figure><figcaption>La baldosa de la web <small>· módulo cuadrado derivado: lado = 2·√2·R</small></figcaption><div class="v web"><i class="c"></i></div></figure>
</body></html>`;
const tmp = path.join(raiz, 'scripts', '_comparar.html');
fs.writeFileSync(tmp, html);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 820 } });
await p.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
await p.waitForTimeout(400);
await p.screenshot({ path: path.join(raiz, 'screenshots/baldosa-vs-suelo.png') });
await b.close();
fs.rmSync(tmp);
console.log('screenshots/baldosa-vs-suelo.png · R =', Rpx, 'px en las dos');
