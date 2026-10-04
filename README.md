# A Casa da Mãe · Olivenza · web «La baldosa»

> **Maqueta de propuesta.** Es para un negocio real que todavía no la ha encargado. Lleva `noindex` en todas las páginas, está en local y no se publica sin su permiso.

**El negocio:** alojamiento rural en la planta baja (3 habitaciones dobles) y 4 apartamentos turísticos en la planta alta. Está en la calle Díaz Brito (Antiga Rua dos Oleiros), 16, 06100 Olivenza (Badajoz).

**Material de partida:**
- datos y fuentes: `../a-casa-da-mae-olivenza-bocetos/DATOS-A-CASA-DA-MAE.md`;
- el prompt: `../a-casa-da-mae-olivenza-bocetos/PROMPT-A-la-baldosa.md`.

## Concepto: «La baldosa»

Su logo es la baldosa hidráulica de su propio suelo, y la web se construye con esa pieza:
1. **Cortina «enlosar»** (~3,3 s, encadenada, `expo.inOut`, fondo azul hondo):
   - el medallón se traza en línea de cal: aro → bolas → flor → cruz;
   - se rellena y se encaja en su cuadrado: aparecen los cuartos de flor de las esquinas;
   - se replica en retícula desde el centro (≤ 120 baldosas, módulo mayor en móvil);
   - las baldosas se levantan (`rotateX` 88°) desde el centro hacia fuera;
   - la central, la última, se encoge y vuela al logo del menú. En el aire toma los colores del logo.
2. **Hero:** la foto del salón de bóvedas bajo una retícula fantasma de juntas. La baldosa que está bajo el cursor se ilumina y sus vecinas se ladean. En táctil y con movimiento reducido, la retícula queda quieta.
3. **La retícula ordena lo demás:**
   - cenefas entre secciones;
   - el corte de la casa, dibujado con juntas;
   - el marco de las placas;
   - las puntuaciones, como filas de baldosas;
   - el plano ortogonal;
   - el pie, que se vuelve a enlosar desde los bordes.

**Lo que no se hace, para no parecerse a sus vecinas de Olivenza:**
- la flor nunca gira sobre su centro;
- ningún diagrama es radial;
- no hay marrones de fondo.

La Casa de la Judería («Roseta») y Casa María (línea de cobre) están a unos pasos.

### La baldosa: su suelo es hexagonal

Su suelo real (`ref/web/202_16.jpg`) **no es de baldosa cuadrada sino hexagonal**: sus círculos son tangentes y forman una retícula triangular. El prompt pedía un módulo cuadrado con cuartos de círculo en las esquinas. Se consultó y el usuario eligió (2026-10-04) un **módulo cuadrado derivado**, medido sobre la foto con `scripts/medir-baldosa.py` (resultado en `data/baldosa-medidas.json`):

| Medida (sobre la foto) | Suelo | En la web |
|---|---|---|
| Radio del aro del medallón (R) | 340 px | 35,36 % del lado |
| Grosor del aro | 0,115 R | el del logo (0,118 R) |
| Bolas | r 0,135 R a 0,738 R | las del logo (0,144 R a 0,739 R) |
| Disco interior | 0,585 R | el del logo (0,587 R) |
| Paso entre círculos | 2,03 R (tangentes) | flor de esquina de 0,97 R, tangente en la diagonal |
| Puntos de la flor grande, en la diagonal | 0,27 / 0,43 / 0,59 R | iguales |
| Lado del módulo | — | 2·√2·R |

Como el medallón del suelo y el símbolo del logo coinciden a un 2 %, el medallón de la baldosa usa las piezas medidas del logo.

**Los cuartos de flor de las esquinas** llevan:
- la media luna azul;
- el lóbulo blanco;
- medio brazo de la cruz sobre la junta (la otra mitad está en la baldosa vecina, como en su suelo, donde la junta parte la cruz);
- los tres puntos.

Comparación a la misma escala: `screenshots/baldosa-vs-suelo.png`. El generador es `scripts/baldosa.mjs`, que produce el `<symbol id="baldosa">`, el data-URI `--losa` y `assets/baldosa.svg`.

### El logo

No había vector, así que se redibujó desde `648_Marca-perfiles-redes-sociales-1.jpg` con geometría. Se dibuja un octante y se refleja y gira (simetría D4).

- **Parecido con el original (IoU):** azul 0,967 y verde 0,962. El techo teórico es 0,974 / 0,963 por el temblor del trazo original.
- **Comparación:** `screenshots/logo-vs-png.png`.
- **Detalles:** `assets/logo/LEEME.txt`.
- **Archivos:**
  - `piezas.svg`: el símbolo por capas, para animar;
  - `simbolo-color|cal|tinta.svg`;
  - `logo-color|cal|tinta.svg`: con el texto en trazados y versalitas de verdad;
  - `logo-horizontal-color.svg`;
  - `../favicon.svg`.
- **Cambios respecto al original:** sin las 4 estrellas, y «Olivenza · Olivença» con punto medio y en verde de texto.

### Paleta (contraste medido; también lo mide `verificar.mjs`)

| Token | Color | Uso | Sobre cal | Sobre aguada |
|---|---|---|---|---|
| `--cal` | `#F7F5F0` | fondo | — | — |
| `--aguada` | `#EDF2F8` | superficie | — | — |
| `--tinta` | `#12304F` | texto y cortina | 12,34 | 11,95 |
| `--azul` | `#1A6EB6` | botones y énfasis (el del logo) | 4,88 | 4,72 |
| `--verde` | `#6FBB73` | **solo decorativo** (el del logo) | 2,13 ✗ | 2,07 ✗ |
| `--verde-texto` | `#2F7A3A` | texto en verde | 4,86 | 4,70 |
| `--apagado` | `#4A5A6D` | texto secundario | 6,48 | 6,27 |
| `--junta` | `#C9D6E4` | líneas de junta | — | — |

Otros pares, también medidos:
- cal sobre azul (botón): 4,88;
- `--azul-claro` `#9CC6EE` sobre tinta: 7,51;
- cal sobre tinta: 12,34.

### Letra

**Sorts Mill Goudy** para titulares, con cursiva para el énfasis. Es la más cercana al rótulo del logo y tiene «ã» y «ç».
- Va autoalojada desde el TTF completo, subconjuntada con `pyftsubset`. Así conserva las versalitas (`smcp`), que la versión de Google quita.
- Tiene las métricas iguales en todas las plataformas (comprobado).

**Hanken Grotesk** para el texto, autoalojada.

Las dos son SIL OFL, sin nombre reservado; las licencias están en `assets/fuentes/`.

## Secciones

1. **Hero:** retícula interactiva y cenefa.
2. **La casa:** el siglo cuenta en números romanos hasta XVIII, y la placa de la calle.
3. **Dos plantas, una casa:** anclada en escritorio. Al bajar se enciende la planta baja y luego la alta. En móvil, dos tarjetas sin anclar.
4. **Planta baja · alojamiento rural:**
   - tres fotos en arco de medio punto que se abren. Se anima el número `--abre` con `@property`, no un `clip-path`;
   - botones por estancia que abren un `<dialog>`.
5. **Planta alta · Os apartamentos:**
   - las cuatro placas, que se voltean con ratón, foco o toque, cada una con su `<dialog>` de 6 fotos;
   - «Lo que tienen todos»;
   - «Cómo dormir», tal como lo da Booking.
6. **Bueno saber.**
7. **Olivenza a pie:** plano en retícula ortogonal (25 m por baldosa, norte arriba) y lista con metros y minutos.
8. **Opiniones:**
   - 9,6 en Booking, con 152 comentarios;
   - siete filas de baldosas;
   - marquee con la velocidad ligada al scroll.
9. **Consultar fechas:**
   - el motor de MrPlan;
   - un formulario sin backend que compone el mensaje para WhatsApp, Llamar, SMS, Email y Copiar.
10. **Cómo llegar:** con el mapa de Google solo bajo clic.
11. **Pie:** el suelo se vuelve a enlosar con el logo en el centro, y debajo las licencias (si las hay), los legales y el aviso de cookies.

## Cómo se trabaja

```
node scripts/servir.mjs                 → http://127.0.0.1:4261  (?revision para el mando)
```

Al terminar cualquier cambio, **en este orden**:

```
node scripts/construir.mjs              → rellena los bloques GENERADO del HTML, los <picture> y --losa en el CSS
node scripts/versionar.mjs              → ?v=<huella> en CSS/JS (caché de Pages)
node scripts/verificar.mjs --capturas   → comprobaciones con Playwright y capturas en screenshots/
```

Solo cuando cambie lo que hay detrás:

```
python scripts/medir-baldosa.py         → data/baldosa-medidas.json (medidas del suelo)
node scripts/baldosa.mjs                → assets/baldosa.svg
node scripts/baldosa-comparar.mjs       → screenshots/baldosa-vs-suelo.png
python scripts/logo-medir.py && python scripts/logo.py   → assets/logo/* (+ IoU y comparación)
python scripts/fotos.py [id…]           → másteres graduados en scripts/fuentes/masters/
node scripts/fotos.mjs                  → AVIF/WebP/JPG en assets/fotos y w/h/anchos en data/fotos.json
node scripts/lugares.mjs                → data/lugares.json (Catastro + OSRM; --sin-red recalcula sin red)
node scripts/generar-og.mjs             → assets/og-a-casa-da-mae.jpg
```

**Qué se toca y dónde:**
- **Contacto, motor de reservas, licencias y puntuaciones:** `data/config.json`. Hay una copia de respaldo de los contactos en `js/main.js` (`CONFIG`).
- **Apartamentos y camas:** `data/apartamentos.json`. Hoy está con `confirmado: false`, así que la web no asigna camas a ninguna placa.
- **Distancias:** `data/lugares.json`.
- **Fotos:** `data/fotos.json`. Para cambiar una, se cambia el id en `<picture data-foto>` o en `construir.mjs` y se vuelve a construir.

## Mando de densidades (solo con `?revision`)

| | **«La baldosa»** (cargada) | **«Sobria»** |
|---|---|---|
| Retícula del hero | interactiva | no está |
| Entre secciones | cenefas | filetes rectos (queda una cenefa bajo el hero) |
| Placas | se voltean | foto del apartamento con la placa pequeña en una esquina |
| Puntuaciones | filas de baldosas que se enlosan | tabla |
| Citas | marquee | rejilla quieta |
| Pie | se enlosa | suelo quieto |
| Solo en esta versión | — | **galería completa filtrable** (planta baja, patio y cada apartamento) y **tabla de puntuaciones** |

El aviso del mando lo genera `construir.mjs` desde los datos: «Camas por apartamento sin confirmar · licencias sin confirmar · n.º 16 geolocalizado: sí (Catastro)».

### Quitar el mando de maqueta (no viaja nunca al cliente)

```
node scripts/quitar-mando.mjs ../a-casa-da-mae-entrega
node scripts/comprobar-borrado.mjs ../a-casa-da-mae-entrega
```

`quitar-mando.mjs` escribe una copia limpia y no toca esta carpeta. Quita todo lo que va entre marcas `[MANDO DE MAQUETA]`:
- en `index.html`: el aviso, la densidad del `<head>`, la galería completa, la tabla de puntuaciones y el `<div class="mando">`;
- en `css/estilos.css`: el bloque del mando y las reglas de la sobria;
- en `js/main.js`: `mandoMaqueta()`;
- en `privacidad.html`: la fila `casadamae-densidad`.

Después vuelve a versionar. `comprobar-borrado.mjs` busca los rastros en los archivos, y `verificar.mjs` prueba la receta entera sobre una copia temporal.

Se entrega la versión «La baldosa». **Si el dueño elige la sobria**, antes de quitar el mando:
1. Cambia `densidad-baldosa` por `densidad-sobria` en el `<html>`.
2. Saca de entre las marcas las reglas `.densidad-sobria`, la galería completa y la tabla.
3. Saca de `mandoMaqueta()` la construcción de la galería.

## Qué es real y qué no

**Real y comprobado:**
- Dirección, teléfono, WhatsApp, email e Instagram. Salen de su web; el WhatsApp `34645902955` es el que ya usa.
- Las dos plantas y su equipamiento: textos de su web, reescritos de usted.
- Normas, idiomas y puntuaciones: Booking, 2026-10-04.
- **El n.º 16 está geolocalizado con Catastro** (referencia 5239520PC6853N, centroide de la parcela, a 4,5 m del eje de la calle), así que no es provisional.
- **Las distancias a pie** se midieron con OSRM, perfil a pie, el 2026-10-04 (minutos = ⌈m/80⌉):

  | Lugar | Distancia | Minutos |
  |---|---|---|
  | Magdalena | 100 m | 2 |
  | Puerta del Calvario | 160 m | 3 |
  | Ayuntamiento | 180 m | 3 |
  | Santa María | 275 m | 4 |
  | Torre del Homenaje | 335 m | 5 |
- **Las citas** son textuales de Booking, sin nombre y firmadas «Opinión en Booking». Se normalizaron dos espacios mal puestos ante comas.
  - La de «Infinitas veces mejor que una habitación de hotel» no se usa, por la regla de no decir «hotel».
  - Francisco solo aparece dentro de una de ellas.

**No se afirma:**
- aparcamiento;
- desayuno incluido (hay una cocina común para preparárselo);
- terraza, balcón ni piscina;
- accesibilidad, más allá de «una habitación adaptada»;
- vistas a un monumento concreto;
- estrellas;
- licencias;
- quién es «a Mãe».

Tampoco se usan:
- el 4,8 de Vrbo, que es de un solo apartamento;
- nada de los agregadores («desayuno buffet» y «jardín» son falsos).

**Fotos:** solo las suyas, 59 en total, con un grado de color común suave y las verticales enderezadas en 21 interiores. Quedan fuera:
- las de «Visitar Olivenza» (Ayuntamiento y terceros);
- la casa de campo con césped (424/635/636);
- los placeholders;
- el poema.

`1435_santa-mariadel-castillo-web.jpg` sí se usa: es la placa pintada de la puerta del apartamento, no una foto del monumento.

**Aviso legal:** titular OLIRREFORMAS S.L. (NIF B56626807), tomado de su propio aviso legal, **sin el nombre del representante**.

## Pendientes para el dueño

1. **El vector del logo** (AI, EPS, SVG o PDF). El de la web es un redibujo.
2. **Estrellas y licencias.** El logo lleva 4 estrellas y la placa de la fachada 3. Booking da `AT-BA-003533` (parece llevar un dígito de más), `TR-BA-00297` y `TR-BA-00299`. Mientras estén en `null` en `data/config.json`, el pie no las pinta.
3. **Qué apartamento es el 1, el 2 y el 4 de Booking, y qué camas tiene cada uno.** La correspondencia probable está en `data/apartamentos.json`:
   - Cadaval = 2 dormitorios;
   - Calvario = Apartamento 4;
   - Santa María = Apartamento 1, el de las literas.

   Hasta que la confirme, la web solo da el bloque general «Cómo dormir».
4. **Si quiere aparecer como Francisco** (hoy solo sale dentro de una cita de Booking).
5. **Quién es «a Mãe»,** si quiere contarlo. La web no inventa historia familiar.
6. **El n.º 16 en el mapa:** está tomado de Catastro (centroide de la parcela). Si la puerta está en otro punto, se corrige en `data/lugares.json` y se vuelve a medir con `node scripts/lugares.mjs`.
7. **Si el motor de MrPlan** (`/reservas-acasadamae/`, `id_casa=584167`) sigue siendo su canal de reserva.
8. **Permiso para usar el poema enmarcado** («Poema para nombrar Olivenza»), si se quiere. Hoy no sale.
9. **Fotos:**
   - no hay ninguna de la **sala de lectura** ni que muestre claramente la **habitación adaptada**;
   - varias de la planta baja solo existen a 650–900 px (`hab-flores`, `patio`, `hab-armario`, `cocina`), y el hero solo a 1200 px.

   Con los originales, la web ganaría nitidez.
10. **Permiso para citar las opiniones de Booking** (van sin nombre).

## Créditos

- **Fotos:** las de la propia casa, de su web (biblioteca de medios de acasadamae.com).
- **Distancias:** © colaboradores de OpenStreetMap (ODbL), con rutas OSRM. Punto de la casa: Dirección General del Catastro.
- **Letra:** Sorts Mill Goudy (Barry Schwartz) y Hanken Grotesk, SIL OFL.
- **Librerías:** GSAP y Lenis, desde jsDelivr.
