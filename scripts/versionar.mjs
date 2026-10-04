/* GitHub Pages sirve CSS/JS con max-age=600: tras un push el navegador mezcla
   durante 10 minutos la hoja vieja con el HTML nuevo. Cada referencia a los
   CSS/JS propios lleva ?v=<huella del contenido>; este script la recalcula.

   Anclado al atributo (href="…" / src="…"), nunca a una mención suelta en un
   comentario. Idempotente: ejecutado dos veces seguidas, la segunda dice
   «sin cambios». 

   node scripts/versionar.mjs [carpeta]
*/
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const raiz = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const huella = f => crypto.createHash('sha1').update(fs.readFileSync(path.join(raiz, f))).digest('hex').slice(0, 8);
const archivos = ['css/estilos.css', 'js/main.js'];
const versiones = Object.fromEntries(archivos.filter(f => fs.existsSync(path.join(raiz, f))).map(f => [f, huella(f)]));
const escapar = s => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

for (const pagina of ['index.html', 'aviso-legal.html', 'privacidad.html', '404.html']) {
  const ruta = path.join(raiz, pagina);
  if (!fs.existsSync(ruta)) continue;
  let html = fs.readFileSync(ruta, 'utf8');
  const antes = html;
  for (const [archivo, v] of Object.entries(versiones)) {
    html = html.replace(new RegExp('((?:href|src)="' + escapar(archivo) + ')(\\?v=[0-9a-f]*)?"', 'g'), '$1?v=' + v + '"');
  }
  if (html !== antes) fs.writeFileSync(ruta, html);
  console.log((html !== antes ? 'actualizado ' : 'sin cambios ') + pagina);
}
console.log(versiones);
