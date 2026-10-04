/* La baldosa de la web: un módulo CUADRADO derivado de su suelo hidráulico.

   Su suelo real (ref/web/202_16.jpg) es de baldosa hexagonal: los círculos
   (medallones y flores grandes) son tangentes y caen en retícula triangular.
   La web usa un módulo cuadrado (decisión del usuario, 2026-10-04) con las
   medidas de ese suelo (data/baldosa-medidas.json, scripts/medir-baldosa.py):

     - medallón en el centro, de radio R (borde exterior del aro). Es el símbolo
       del logo: el suelo da bolas a 0,738 R (logo 0,739) y disco a 0,59 R (logo
       0,587), así que se usan las piezas medidas del logo, a escala;
     - en las esquinas, cuartos de la flor grande del suelo, de radio 0,97 R,
       tangentes al medallón en la diagonal: lado = 2·√2·R;
     - en cada cuarto: la media luna azul del borde, el lóbulo blanco, medio brazo
       de la cruz sobre la junta (la otra mitad está en la baldosa vecina) y los
       tres puntos de la diagonal a 0,27 / 0,43 / 0,59 R (medidos).

   Lado = 100 unidades. La flor nunca gira sobre su centro: lo único que se
   repite es la baldosa entera, en retícula.

   node scripts/baldosa.mjs   → assets/baldosa.svg (colores fijos, para ver y comparar)
   Lo usa scripts/construir.mjs para el <symbol id="baldosa"> y el data-URI de --losa.
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const COLORES = { tinta: '#1A6EB6', fondo: '#F7F5F0', junta: '#C9D6E4' };

const med = JSON.parse(fs.readFileSync(path.join(raiz, 'data/baldosa-medidas.json'), 'utf8'));
/* R del medallón = borde exterior del aro: lado = 2·√2·R */
export const R = 100 / (2 * Math.SQRT2);                 /* 35,355 */
const RF = R * 0.97;                                      /* flor grande de las esquinas */
/* puntos de la diagonal, medidos sobre el suelo (en R del círculo ajustado → R del aro) */
const escalaR = med.R_px / med.medallon.tramos_diagonal_px.at(-1)[1];   /* el ajuste da R algo mayor que el borde del aro en la diagonal */
const PUNTOS = med.flor_grande.puntos_cuadrante.map(p => ({ d: Math.hypot(p.dx, p.dy) * escalaR * R, r: p.r * escalaR * R }));

const f = n => +n.toFixed(2);

/* ── piezas del símbolo (viewBox 200, centro 100, aro exterior 96) ── */
function piezas() {
  const svg = fs.readFileSync(path.join(raiz, 'assets/logo/piezas.svg'), 'utf8');
  const sacar = id => {
    const m = svg.match(new RegExp('<path id="' + id + '"([^>]*?) d="([^"]+)"'));
    if (!m) throw new Error('Falta la pieza ' + id + ' en assets/logo/piezas.svg');
    const regla = /fill-rule="evenodd"/.test(m[1]) ? ' fill-rule="evenodd"' : '';
    return { id, d: m[2], regla };
  };
  return ['s-disco', 's-flor', 's-cruz', 's-puntos', 's-aro', 's-bolas'].map(sacar);
}

/* ── un cuarto de flor grande, con la esquina en (0,0) y el cuadrante hacia +x +y ── */
function cuarto() {
  const p = [];
  const arco = (r) => `M0 0H${f(r)}A${f(r)} ${f(r)} 0 0 1 0 ${f(r)}Z`;
  /* 1 · media luna: el cuarto de disco azul… */
  p.push(['t', arco(RF)]);
  /* 2 · …vaciado por el lóbulo blanco (tres círculos y el centro) y la holgura de las juntas */
  /* todo en sentido horario: con relleno nonzero, un círculo antihorario sobre un rectángulo horario se anula */
  const circ = (cx, cy, r) => `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 1 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 1 ${f(-2 * r)} 0Z`;
  const polar = (d, ang) => [d * Math.cos(ang * Math.PI / 180), d * Math.sin(ang * Math.PI / 180)];
  const lob = [];
  const [ax, ay] = polar(0.49 * R, 45); lob.push(circ(ax, ay, 0.355 * R));
  for (const ang of [17, 73]) { const [x, y] = polar(0.46 * R, ang); lob.push(circ(x, y, 0.29 * R)); }
  lob.push(`M0 0H${f(0.42 * R)}V${f(0.42 * R)}H0Z`);
  /* holgura blanca a lo largo de las dos juntas (donde corre la cruz) */
  lob.push(`M0 0H${f(RF + 1)}V${f(0.1 * R)}H0Z`, `M0 0V${f(RF + 1)}H${f(0.1 * R)}V0Z`);
  p.push(['f', lob.join('')]);
  /* 3 · medio brazo de la cruz sobre cada junta: lanza fina con su remate */
  const brazo = (eje) => {
    /* perfil (distancia, media anchura) desde la esquina hacia fuera */
    const pts = [[0, 0.07], [0.5, 0.07], [0.6, 0.1], [0.66, 0.17], [0.72, 0.2], [0.8, 0.12], [0.88, 0.04], [0.94, 0]]
      .map(([d, w]) => [d * R, w * R]);
    const ida = pts.map(([d, w]) => eje === 'x' ? `${f(d)} ${f(w)}` : `${f(w)} ${f(d)}`);
    return `M0 0L${ida.join('L')}${eje === 'x' ? `L${f(0.94 * R)} 0` : `L0 ${f(0.94 * R)}`}Z`;
  };
  p.push(['t', brazo('x') + brazo('y')]);
  /* 4 · los tres puntos de la diagonal */
  p.push(['t', PUNTOS.map(({ d, r }) => { const [x, y] = polar(d, 45); return circ(x, y, r); }).join('')]);
  return p;
}

/* las cuatro esquinas: el mismo cuarto reflejado (no girado) hacia cada esquina */
const ESQUINAS = [
  { m: '1 0 0 1 0 0', o: '0 0' },
  { m: '-1 0 0 1 100 0', o: '100 0' },
  { m: '1 0 0 -1 0 100', o: '0 100' },
  { m: '-1 0 0 -1 100 100', o: '100 100' }
];

/* k: escala del símbolo (200 → 100 con aro exterior 96 → R) */
const k = R / 96;
const MATRIZ = `matrix(${f(k * 1000) / 1000} 0 0 ${f(k * 1000) / 1000} ${f(50 - 100 * k)} ${f(50 - 100 * k)})`;

/* ── para el <symbol id="baldosa"> de la página: clases que colorea el CSS ── */
export function simboloBaldosa() {
  const c = cuarto();
  const clase = t => (t === 't' ? 'b-tinta' : 'b-fondo');
  const esquinas = ESQUINAS.map(e =>
    `<g class="b-esquina" data-origen="${e.o}"><g transform="matrix(${e.m})">` +
    c.map(([t, d]) => `<path class="${clase(t)}" d="${d}"/>`).join('') + '</g></g>').join('\n');
  const med = piezas().map(p => {
    const cls = p.id === 's-flor' ? 'b-fondo' : 'b-tinta';
    return `<path id="b${p.id.slice(1)}" class="${cls}" data-pieza="${p.id}" transform="${MATRIZ}"${p.regla} d="${p.d}"/>`;
  }).join('\n');
  return [
    `<rect class="b-fondo" width="100" height="100"/>`,
    `<g id="b-esquinas">\n${esquinas}\n</g>`,
    `<g id="b-medallon">\n${med}\n</g>`,
    `<rect class="b-junta" x=".3" y=".3" width="99.4" height="99.4"/>`
  ].join('\n');
}

/* ── SVG suelto con colores fijos (archivo y data-URI) ── */
export function svgSuelto({ tinta = COLORES.tinta, fondo = COLORES.fondo, junta = COLORES.junta } = {}) {
  const c = cuarto();
  const col = t => (t === 't' ? tinta : fondo);
  const esquinas = ESQUINAS.map(e => `<g transform="matrix(${e.m})">` + c.map(([t, d]) => `<path fill="${col(t)}" d="${d}"/>`).join('') + '</g>').join('');
  const med = piezas().map(p => `<path fill="${p.id === 's-flor' ? fondo : tinta}"${p.regla} d="${p.d}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="${fondo}" width="100" height="100"/>${esquinas}<g transform="${MATRIZ}">${med}</g><rect fill="none" stroke="${junta}" stroke-width=".6" x=".3" y=".3" width="99.4" height="99.4"/></svg>`;
}
export function dataUri(opc) {
  return 'url("data:image/svg+xml,' + svgSuelto(opc).replace(/"/g, "'").replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E') + '")';
}
/* diámetro del medallón en % del lado (lo lee la cortina para volar al logo) */
export const MEDALLON = f(2 * R);

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  fs.writeFileSync(path.join(raiz, 'assets/baldosa.svg'), svgSuelto() + '\n');
  console.log('assets/baldosa.svg · R =', f(R), '· flor de esquina =', f(RF), '· puntos', PUNTOS.map(p => f(p.d) + '/' + f(p.r)).join(' '));
}
