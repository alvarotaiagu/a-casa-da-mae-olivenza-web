/* Comprueba contra los archivos que el mando de maqueta ya no está.
   La receta del README no se escribe de memoria: se comprueba.

   node scripts/comprobar-borrado.mjs ../a-casa-da-mae-entrega
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raizMaqueta = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const raiz = process.argv[2] ? path.resolve(process.argv[2]) : raizMaqueta;

const rastros = [
  ['index.html',         /\[MANDO DE MAQUETA\]/,  'marcas [MANDO DE MAQUETA]'],
  ['index.html',         /id="mando"/,            'el <div class="mando">'],
  ['index.html',         /casadamae-densidad/,    'la lectura de la densidad en el <head>'],
  ['index.html',         /id="galeria-completa"/, 'la galería completa (solo existe para la sobria)'],
  ['index.html',         /id="puntuaciones"/,     'la tabla de puntuaciones (solo existe para la sobria)'],
  ['index.html',         /revision/,              'cualquier mención al modo ?revision'],
  ['css/estilos.css',    /\[MANDO DE MAQUETA\]/,  'el bloque CSS del mando'],
  ['css/estilos.css',    /densidad-sobria/,       'las reglas de la versión sobria'],
  ['css/estilos.css',    /\.mando/,               'los estilos del mando'],
  ['js/main.js',         /\[MANDO DE MAQUETA\]/,  'el bloque JS del mando'],
  ['js/main.js',         /mandoMaqueta/,          'la función mandoMaqueta()'],
  ['js/main.js',         /casadamae-densidad/,    'la clave guardada de la densidad'],
  ['privacidad.html',    /casadamae-densidad/,    'la fila del aviso de cookies'],
  ['privacidad.html',    /\[MANDO DE MAQUETA\]/,  'el comentario de la fila']
];

let quedan = 0;
console.log('Rastros del mando de maqueta en ' + raiz);
console.log('-'.repeat(76));
for (const [archivo, patron, que] of rastros) {
  const ruta = path.join(raiz, archivo);
  if (!fs.existsSync(ruta)) { console.log('no está ' + archivo.padEnd(20) + '(módulo quitado)'); continue; }
  const hay = patron.test(fs.readFileSync(ruta, 'utf8'));
  if (hay) quedan++;
  console.log((hay ? 'QUEDA ' : 'limpio') + '  ' + archivo.padEnd(20) + que);
}
console.log('-'.repeat(76));
if (quedan) { console.log(quedan + ' rastro(s). No entregar todavía.'); process.exitCode = 1; }
else console.log('Sin rastros del mando. Se puede entregar.');
