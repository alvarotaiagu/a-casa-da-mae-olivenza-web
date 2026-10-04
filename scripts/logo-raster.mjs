/* Rasteriza SVG con Chromium para que logo.py mida el IoU y haga las capturas.

   node scripts/logo-raster.mjs trabajos.json
   trabajos.json = [{ "svg": "ruta.svg", "png": "salida.png", "ancho": 2000, "alto": 2000, "fondo": "#fff" }, ...]
*/
import fs from 'node:fs';
import { chromium } from 'playwright';

const trabajos = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const navegador = await chromium.launch();
const pagina = await navegador.newPage({ deviceScaleFactor: 1 });
for (const t of trabajos) {
  const svg = fs.readFileSync(t.svg, 'utf8');
  const datos = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
  await pagina.setViewportSize({ width: t.ancho, height: t.alto });
  await pagina.setContent(`<!doctype html><html><head><style>
    *{margin:0;padding:0} html,body{width:${t.ancho}px;height:${t.alto}px;background:${t.fondo || '#fff'};overflow:hidden}
    img{display:block;width:${t.ancho}px;height:${t.alto}px}
  </style></head><body><img src="${datos}"></body></html>`);
  await pagina.waitForFunction(() => document.images[0].complete);
  await pagina.screenshot({ path: t.png, omitBackground: false });
}
await navegador.close();
