"""Construye el logo vectorial de A Casa da Mãe y lo compara con el JPG original.

  python scripts/logo-medir.py   # mide el JPG → scripts/logo-medidas.json
  python scripts/logo.py         # geometría → assets/logo/*.svg, favicon, IoU y captura

Método: el símbolo tiene simetría D4. Aro, bolas, disco y puntos son círculos;
la flor son cuatro arcos de círculo (lóbulos sobre los ejes); la cruz es UN
octante de cúbicas ajustadas al contorno medido, reflejado en la diagonal y
girado 4 veces. Nada se calca del todo: el JPG solo da las medidas.
"""
import sys
sys.dont_write_bytecode = True  # sin __pycache__ en scripts/
import importlib.util
import json
import math
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

import cv2
import numpy as np

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
DEST = RAIZ / 'assets' / 'logo'
FUENTE_TTF = AQUI / 'fuentes' / 'ttf' / 'SortsMillGoudy-Regular.ttf'

AZUL = '#1A6EB6'
VERDE = '#6FBB73'
VERDE_TEXTO = '#2F7A3A'
CAL = '#F7F5F0'
TINTA = '#12304F'


def modulo(nombre):
    sp = importlib.util.spec_from_file_location(nombre.replace('-', '_'), AQUI / f'{nombre}.py')
    m = importlib.util.module_from_spec(sp)
    sp.loader.exec_module(m)
    return m


lf = modulo('logo-fuente')
bz = modulo('logo-bezier')
M = json.loads((AQUI / 'logo-medidas.json').read_text(encoding='utf-8'))

# ------------------------------------------------------------------ rutas --
# Un tramo es ('C', p0, p1, p2, p3) o ('A', p0, p1, r, grande, sentido).
P = lambda x, y: np.array([float(x), float(y)])


def cub(p0, p1, p2, p3):
    return ('C', P(*p0), P(*p1), P(*p2), P(*p3))


def recta(a, b):
    a, b = P(*a), P(*b)
    return ('C', a, a + (b - a) / 3, a + 2 * (b - a) / 3, b)


def arco(p0, p1, c, r, sentido=1):
    """Arco sobre el círculo (c, r) de p0 a p1; sentido 1 = horario en pantalla."""
    a0 = math.atan2(p0[1] - c[1], p0[0] - c[0])
    a1 = math.atan2(p1[1] - c[1], p1[0] - c[0])
    giro = (a1 - a0) % (2 * math.pi) if sentido else (a0 - a1) % (2 * math.pi)
    return ('A', P(*p0), P(*p1), float(r), int(giro > math.pi), int(sentido))


def circulo(c, r, horario=True):
    # centro y radio redondeados ANTES de sacar los extremos: así la cuerda
    # vale 2r exacto y el navegador no recoloca el centro del arco
    cx, cy, r = round(float(c[0]), 2), round(float(c[1]), 2), round(float(r), 2)
    s = 1 if horario else 0
    a, b = (cx, cy - r), (cx, cy + r)
    return [('A', P(*a), P(*b), float(r), 0, s), ('A', P(*b), P(*a), float(r), 0, s)]


def invertir(tramos):
    out = []
    for t in reversed(tramos):
        if t[0] == 'C':
            out.append(('C', t[4], t[3], t[2], t[1]))
        else:
            out.append(('A', t[2], t[1], t[3], t[4], 1 - t[5]))
    return out


def afin(tramos, A, b):
    """Aplica x' = A x + b (A 2x2 de semejanza; si invierte, cambia el sentido de los arcos)."""
    A = np.asarray(A, float)
    b = np.asarray(b, float)
    esc = math.sqrt(abs(np.linalg.det(A)))
    refl = np.linalg.det(A) < 0
    f = lambda p: A @ p + b
    out = []
    for t in tramos:
        if t[0] == 'C':
            out.append(('C',) + tuple(f(p) for p in t[1:]))
        else:
            out.append(('A', f(t[1]), f(t[2]), t[3] * esc, t[4], (1 - t[5]) if refl else t[5]))
    return out


# simetrías alrededor de (100, 100)
ROT = np.array([[0, -1], [1, 0]])          # giro horario en pantalla: arriba → derecha
DIAG = np.array([[0, -1], [-1, 0]])        # espejo en la diagonal NE–SO
C0 = np.array([100.0, 100.0])


def sim(tramos, A):
    return afin(tramos, A, C0 - np.asarray(A) @ C0)


def es_recta(t):
    if t[0] != 'C':
        return False
    p0, p1, p2, p3 = t[1:]
    d = p3 - p0
    n = np.linalg.norm(d)
    if n < 1e-9:
        return True
    nn = np.array([-d[1], d[0]]) / n
    return abs(np.dot(p1 - p0, nn)) < 1e-6 and abs(np.dot(p2 - p0, nn)) < 1e-6


def fundir_rectas(tramos):
    """Une rectas consecutivas colineales (también la última con la primera)."""
    out = []
    for t in tramos:
        if out and es_recta(t) and es_recta(out[-1]):
            a, b, c = out[-1][1], t[1], t[4]
            u, v = b - a, c - b
            if abs(u[0] * v[1] - u[1] * v[0]) < 1e-6 * (np.linalg.norm(u) * np.linalg.norm(v) + 1e-12) and np.dot(u, v) > 0:
                out[-1] = recta(a, c)
                continue
        out.append(t)
    return out


def num(v):
    s = f'{v:.2f}'.rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


def pt(p):
    return f'{num(p[0])} {num(p[1])}'


def d_de(*bucles):
    """Atributo d: cada bucle es una lista de tramos cerrada."""
    partes = []
    for b in bucles:
        partes.append('M' + pt(b[0][1]))
        for i, t in enumerate(b):
            ultimo = i == len(b) - 1
            if t[0] == 'C':
                if es_recta(t):
                    if not ultimo:
                        partes.append('L' + pt(t[4]))
                else:
                    partes.append('C' + ' '.join(pt(p) for p in t[2:]))
            else:
                partes.append(f'A{num(t[3])} {num(t[3])} 0 {t[4]} {t[5]} ' + pt(t[2]))
        partes.append('Z')
    return ''.join(partes)


# ----------------------------------------------------------- geometría ----
def geometria():
    g = {}
    g['aro'] = [circulo(C0, M['aro']['ext']), circulo(C0, M['aro']['int'], horario=False)]
    bd, br = M['bolas']['d'], M['bolas']['r']
    g['bolas'] = [circulo((100, 100 - bd), br), circulo((100 + bd, 100), br),
                  circulo((100, 100 + bd), br), circulo((100 - bd, 100), br)]
    g['disco'] = [circulo(C0, M['disco']['r'])]

    fd, fr = M['flor']['d'], M['flor']['r']
    centros = [P(100, 100 - fd), P(100 + fd, 100), P(100, 100 + fd), P(100 - fd, 100)]
    t = (fd + math.sqrt(2 * fr * fr - fd * fd)) / 2
    cusp = [P(100 - t, 100 - t), P(100 + t, 100 - t), P(100 + t, 100 + t), P(100 - t, 100 + t)]
    # cada lóbulo en dos arcos partidos en su ápice: un arco de casi 180º
    # es inestable (redondear 0,01 movería su centro décimas de unidad)
    flor = []
    for i in range(4):
        u = (centros[i] - C0) / fd
        apice = centros[i] + u * fr
        flor += [arco(cusp[i], apice, centros[i], fr), arco(apice, cusp[(i + 1) % 4], centros[i], fr)]
    g['flor'] = [flor]
    g['_flor'] = (centros, fr, cusp)

    octante = [('C',) + tuple(P(*p) for p in s) for s in M['cruz']['octante']]
    cuadrante = octante + invertir(sim(octante, DIAG))
    cruz = []
    A = np.eye(2)
    for _ in range(4):
        cruz += sim(cuadrante, A)
        A = ROT @ A
    cruz = cruz[1:] + cruz[:1]          # empezar tras la recta del remate
    g['cruz'] = [fundir_rectas(cruz)]

    # hueco blanco de un cuadrante (para las versiones aplanadas):
    # la cruz del octante se corta donde entra en el lóbulo de arriba
    ctop = centros[0]
    resto = None
    for i, s in enumerate(octante):
        ts = bz.corte_circulo(np.array(s[1:]), ctop, fr)
        if ts:
            _, der = bz.partir(s[1:], ts[0])
            resto = [('C',) + tuple(der)] + octante[i + 1:]
            break
    Pp = resto[0][1]
    Pr = DIAG @ (Pp - C0) + C0
    bucle = ([arco(Pp, cusp[1], ctop, fr), arco(cusp[1], Pr, centros[1], fr)]
             + sim(resto, DIAG) + invertir(resto))
    bucle = invertir(bucle)             # antihorario: agujero con nonzero
    huecos = []
    A = np.eye(2)
    for _ in range(4):
        huecos.append(sim(bucle, A))
        A = ROT @ A
    g['huecos'] = huecos

    puntos = []
    for sx, sy in [(1, -1), (1, 1), (-1, 1), (-1, -1)]:
        for p in M['puntos']:
            k = p['d'] / math.sqrt(2)
            puntos.append(circulo((100 + sx * k, 100 + sy * k), p['r']))
    g['puntos'] = puntos
    return g


def escalar(bucles, s, dx, dy):
    return [afin(b, np.eye(2) * s, (dx, dy)) for b in bucles]


# ------------------------------------------------------------- SVG -------
def svg(vb, cuerpo, titulo):
    w, h = vb
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {num(w)} {num(h)}" '
            f'role="img" aria-labelledby="t">\n<title id="t">{titulo}</title>\n{cuerpo}</svg>\n')


def piezas(g):
    filas = [
        ('s-disco', g['disco'], VERDE, None),
        ('s-flor', g['flor'], '#FFFFFF', None),
        ('s-cruz', g['cruz'], VERDE, None),
        ('s-puntos', g['puntos'], AZUL, None),
        ('s-aro', g['aro'], AZUL, 'evenodd'),
        ('s-bolas', g['bolas'], AZUL, None),
    ]
    cuerpo = ''
    for id_, bucles, color, regla in filas:
        r = f' fill-rule="{regla}"' if regla else ''
        cuerpo += f'<path id="{id_}" pathLength="1" fill="{color}"{r} d="{d_de(*bucles)}"/>\n'
    return svg((200, 200), cuerpo, 'A Casa da Mãe')


def simbolo_paths(g, s=1.0, dx=0.0, dy=0.0, azul=AZUL, verde=VERDE):
    """Símbolo aplanado: azul (aro, bolas, puntos) y verde (disco con huecos).
    Si azul == verde, un solo trazado."""
    E = lambda b: escalar(b, s, dx, dy)
    azules = E(g['aro'] + g['bolas'] + g['puntos'])
    verdes = E(g['disco'] + g['huecos'])
    if azul == verde:
        return f'<path fill="{azul}" d="{d_de(*(verdes + azules))}"/>\n'
    return (f'<path fill="{verde}" d="{d_de(*verdes)}"/>\n'
            f'<path fill="{azul}" d="{d_de(*azules)}"/>\n')


# ------------------------------------------------------------- texto -----
class Texto:
    def __init__(self):
        import uharfbuzz as hb
        from fontTools.ttLib import TTFont
        self.hb = hb
        self.tt = TTFont(str(FUENTE_TTF))
        self.gs = self.tt.getGlyphSet()
        self.orden = self.tt.getGlyphOrder()
        self.font = hb.Font(hb.Face(hb.Blob.from_file_path(str(FUENTE_TTF))))
        self.upm = self.tt['head'].unitsPerEm

    def formar(self, texto, rasgos, tracking=0.0):
        """[(glifo, x)] en unidades de la fuente y el avance total (sin el tracking final)."""
        buf = self.hb.Buffer()
        buf.add_str(texto)
        buf.guess_segment_properties()
        self.hb.shape(self.font, buf, rasgos)
        x, out = 0, []
        for inf, pos in zip(buf.glyph_infos, buf.glyph_positions):
            out.append((self.orden[inf.codepoint], x + pos.x_offset, pos.y_offset))
            x += pos.x_advance + tracking * self.upm
        return out, x - tracking * self.upm

    def tinta(self, glifos):
        from fontTools.pens.boundsPen import BoundsPen
        x0 = y0 = 1e9
        x1 = y1 = -1e9
        for n, x, y in glifos:
            bp = BoundsPen(self.gs)
            self.gs[n].draw(bp)
            if bp.bounds:
                a, b, c, d = bp.bounds
                x0, y0, x1, y1 = min(x0, a + x), min(y0, b + y), max(x1, c + x), max(y1, d + y)
        return x0, y0, x1, y1

    def d(self, glifos, tam, ox, base):
        """Trazado SVG de la línea: tam = cuerpo (unidades del dibujo),
        ox = x del origen de la línea, base = y de la línea base."""
        from fontTools.pens.svgPathPen import SVGPathPen
        from fontTools.pens.transformPen import TransformPen
        k = tam / self.upm
        partes = []
        for n, x, y in glifos:
            pen = SVGPathPen(self.gs, ntos=num)
            tp = TransformPen(pen, (k, 0, 0, -k, ox + x * k, base - y * k))
            self.gs[n].draw(tp)
            partes.append(pen.getCommands())
        return ''.join(partes)


def medidas_texto():
    """Proporciones del original, en unidades del símbolo (aro exterior = 96)."""
    e = M['fuente']['px_por_unidad']
    cy = M['fuente']['centro_px'][1]
    u = lambda px: px / e
    return dict(
        nombre=dict(alto_mayus=u(1281 - 1096 + 1), base=u(1282 - cy), ancho=u(1959 - 240 + 1)),
        linea2=dict(alto_mayus=u(1375 - 1333 + 1), base=u(1376 - cy), ancho=u(1954 - 240 + 1)),
        linea3=dict(alto_mayus=u(64), base=u(1472.5 - cy), ancho=u(1489 - 706 + 1)),
        hueco_simbolo=u(1096 - 1029),
    )


def lineas_texto(tx):
    """Forma las tres líneas y elige cuerpos: devuelve [(glifos, tam, tinta)]."""
    mt = medidas_texto()
    cap = 710  # altura de la H en Sorts Mill Goudy
    # 1. nombre: entre la altura de mayúscula y el ancho del original
    g1, _ = tx.formar('A Casa da Mãe', {'kern': True})
    t1 = tx.tinta(g1)
    s_cap = mt['nombre']['alto_mayus'] / cap
    s_w = mt['nombre']['ancho'] / (t1[2] - t1[0])
    tam1 = math.sqrt(s_cap * s_w) * tx.upm
    # 2. versalitas de verdad (smcp), inicial en mayúscula, con algo de aire;
    #    mismo ancho que el nombre, como en el original
    track = 0.06
    g2, _ = tx.formar('Alojamiento rural y apartamentos turísticos', {'kern': True, 'smcp': True}, track)
    t2 = tx.tinta(g2)
    tam2 = (t1[2] - t1[0]) * tam1 / tx.upm / (t2[2] - t2[0]) * tx.upm
    # 3. lugar, con punto medio
    g3, _ = tx.formar('Olivenza · Olivença', {'kern': True})
    t3 = tx.tinta(g3)
    tam3 = mt['linea3']['alto_mayus'] / cap * tx.upm
    no_sc = [n for n, _, _ in g2[1:] if n != 'space' and not n.endswith('.sc')]
    if no_sc:
        print('  aviso: glifos sin versalita:', no_sc)
    return [(g1, tam1, t1), (g2, tam2, t2), (g3, tam3, t3)], mt


def bloque_texto(tx, lineas, mt, x_ref, alinear, y_base0, esc, colores):
    """Devuelve (svg, caja) de las tres líneas. alinear = 'centro' o 'izq'.
    y_base0 = línea base del nombre; las otras guardan las distancias del original."""
    bases = [mt['nombre']['base'], mt['linea2']['base'], mt['linea3']['base']]
    cuerpo = ''
    caja = [1e9, 1e9, -1e9, -1e9]
    for (gl, tam, ti), b, col in zip(lineas, bases, colores):
        tam_e = tam * esc
        k = tam_e / tx.upm
        ancho = (ti[2] - ti[0]) * k
        if alinear == 'centro':
            ox = x_ref - ancho / 2 - ti[0] * k
        else:
            ox = x_ref - ti[0] * k
        base = y_base0 + (b - bases[0]) * esc
        cuerpo += f'<path fill="{col}" d="{tx.d(gl, tam_e, ox, base)}"/>\n'
        caja = [min(caja[0], ox + ti[0] * k), min(caja[1], base - ti[3] * k),
                max(caja[2], ox + ti[2] * k), max(caja[3], base - ti[1] * k)]
    return cuerpo, caja


def logos(g, tx):
    lineas, mt = lineas_texto(tx)
    variantes = {
        'color': (AZUL, VERDE, [AZUL, AZUL, VERDE_TEXTO]),
        'cal': (CAL, CAL, [CAL] * 3),
        'tinta': (TINTA, TINTA, [TINTA] * 3),
    }
    margen = 4.0
    archivos = {}
    for nombre, (az, ve, cols) in variantes.items():
        # vertical: símbolo arriba (su caja 0..200), texto centrado debajo
        cuerpo_t, caja = bloque_texto(tx, lineas, mt, 100.0, 'centro', 100 + mt['nombre']['base'], 1.0, cols)
        x0 = min(caja[0], 4.0) - margen
        x1 = max(caja[2], 196.0) + margen
        y0 = 4.0 - margen
        y1 = caja[3] + margen
        dx, dy = -x0, -y0
        cuerpo_t, _ = bloque_texto(tx, lineas, mt, 100 + dx, 'centro', 100 + mt['nombre']['base'] + dy, 1.0, cols)
        cuerpo = simbolo_paths(g, 1.0, dx, dy, az, ve) + cuerpo_t
        archivos[f'logo-{nombre}.svg'] = svg((x1 - x0, y1 - y0), cuerpo, 'A Casa da Mãe · Alojamiento rural y apartamentos turísticos · Olivenza')

    # horizontal: símbolo a la izquierda del alto del bloque de texto
    esc_t = 0.62
    _, caja = bloque_texto(tx, lineas, mt, 0, 'izq', 0, esc_t, cols)
    alto_txt = caja[3] - caja[1]
    s_sim = (alto_txt * 1.12) / 192
    lado = 200 * s_sim
    hueco = 0.16 * 192 * s_sim
    x_txt = (196 * s_sim) + hueco
    # centrar verticalmente el bloque con el símbolo
    y_base0 = lado / 2 - (caja[1] + caja[3]) / 2
    cuerpo_t, caja = bloque_texto(tx, lineas, mt, x_txt, 'izq', y_base0, esc_t, [AZUL, AZUL, VERDE_TEXTO])
    ancho = caja[2] + 4 * s_sim + margen * s_sim
    cuerpo = simbolo_paths(g, s_sim, 0, 0) + cuerpo_t
    archivos['logo-horizontal-color.svg'] = svg((ancho, lado), cuerpo, 'A Casa da Mãe · Alojamiento rural y apartamentos turísticos · Olivenza')
    return archivos


# ------------------------------------------------------------ IoU --------
def rasterizar(trabajos):
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False, encoding='utf-8') as f:
        json.dump(trabajos, f)
    subprocess.run(['node', str(AQUI / 'logo-raster.mjs'), f.name], check=True)


def a_fuente(png, esc_px, forma):
    """Lleva un render del viewBox 200×200 (a esc_px px/unidad) al recorte del JPG."""
    im = cv2.imread(png)[:, :, ::-1].astype(np.float32)
    e = M['fuente']['px_por_unidad']
    th = M['fuente']['giro_rad']
    x0, y0 = lf.CAJA[:2]
    cx, cy = M['fuente']['centro_px'][0] - x0, M['fuente']['centro_px'][1] - y0
    sup = 4
    c, s = math.cos(th), math.sin(th)
    # píxel de render (i, j) → unidad u = (i + .5)/esc_px → px del recorte ×sup
    Au = np.array([[c, -s], [s, c]]) * e / esc_px * sup
    bu = (np.array([cx, cy]) + np.array([[c, -s], [s, c]]) @ (np.array([0.5, 0.5]) / esc_px * np.ones(2) - 100) * e) * sup
    # corrección del centro de píxel en destino
    bu = bu + 0.5 * sup - 0.5
    Mx = np.c_[Au, bu].astype(np.float32)
    h, w = forma
    big = cv2.warpAffine(im, Mx, (w * sup, h * sup), flags=cv2.INTER_LINEAR, borderValue=(255, 255, 255))
    return cv2.resize(big, (w, h), interpolation=cv2.INTER_AREA)


def iou(a, b):
    return (a & b).sum() / max((a | b).sum(), 1)


def comprobar(g, tmp):
    fb, fg, _ = lf.mascaras_simbolo()
    SB, SG = fb > 0.5, fg > 0.5
    esc_px = 16
    lado = 200 * esc_px
    trab = [dict(svg=str(DEST / 'piezas.svg'), png=str(tmp / 'piezas.png'), ancho=lado, alto=lado),
            dict(svg=str(DEST / 'simbolo-color.svg'), png=str(tmp / 'simbolo.png'), ancho=lado, alto=lado)]
    rasterizar(trab)
    res = {}
    for clave in ('piezas', 'simbolo'):
        rgb = a_fuente(str(tmp / f'{clave}.png'), esc_px, SB.shape)
        mb, mg = lf.fracciones(rgb)
        MB, MG = mb > 0.5, mg > 0.5
        res[clave] = (iou(SB, MB), iou(SG, MG), MB, MG, rgb)
    return SB, SG, res


def captura(SB, SG, rgb_mio, MB, MG):
    rgb = lf.cargar_rgb()
    x0, y0, x1, y1 = lf.CAJA
    orig = rgb[y0:y1, x0:x1].astype(np.uint8)
    mio = np.clip(rgb_mio, 0, 255).astype(np.uint8)
    dif = np.full_like(orig, 255)
    ambos = (SB & MB) | (SG & MG)
    dif[ambos] = (200, 200, 200)
    solo_fuente = (SB & ~MB) | (SG & ~MG)
    solo_mio = (MB & ~SB) | (MG & ~SG)
    dif[solo_fuente] = (230, 30, 30)
    dif[solo_mio] = (0, 190, 220)
    sep = np.full((orig.shape[0], 12, 3), 255, np.uint8)
    fila = np.concatenate([orig, sep, mio, sep, dif], 1)
    cab = np.full((44, fila.shape[1], 3), 255, np.uint8)
    for i, t in enumerate(['original (JPG)', 'vector (piezas.svg)', 'rojo: solo original / cian: solo vector']):
        cv2.putText(cab, t, (10 + i * (orig.shape[1] + 12), 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (40, 40, 40), 2, cv2.LINE_AA)
    out = np.concatenate([cab, fila], 0)
    (RAIZ / 'screenshots').mkdir(exist_ok=True)
    cv2.imwrite(str(RAIZ / 'screenshots' / 'logo-vs-png.png'), out[:, :, ::-1])


def validar(ruta):
    raiz = ET.parse(ruta).getroot()
    assert raiz.tag.endswith('svg'), ruta
    vb = raiz.get('viewBox').split()
    assert vb[0] == '0' and vb[1] == '0', (ruta, vb)
    prof = lambda e, n=0: max([prof(h, n + (1 if h.get('transform') else 0)) for h in e] + [n])
    assert prof(raiz) == 0, f'{ruta}: transform'
    for e in raiz.iter():
        assert not e.tag.endswith('metadata'), ruta
    return vb


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    DEST.mkdir(parents=True, exist_ok=True)
    g = geometria()
    tx = Texto()
    archivos = {
        'piezas.svg': piezas(g),
        'simbolo-color.svg': svg((200, 200), simbolo_paths(g), 'A Casa da Mãe'),
        'simbolo-cal.svg': svg((200, 200), simbolo_paths(g, azul=CAL, verde=CAL), 'A Casa da Mãe'),
        'simbolo-tinta.svg': svg((200, 200), simbolo_paths(g, azul=TINTA, verde=TINTA), 'A Casa da Mãe'),
    }
    archivos.update(logos(g, tx))
    for n, c in archivos.items():
        (DEST / n).write_text(c, encoding='utf-8')
    # favicon: símbolo a color sobre un cuadrado de cal redondeado
    fav = (f'<rect width="200" height="200" rx="36" fill="{CAL}"/>\n'
           + simbolo_paths(g, 0.98, 2, 2))
    (RAIZ / 'assets' / 'favicon.svg').write_text(svg((200, 200), fav, 'A Casa da Mãe'), encoding='utf-8')

    for ruta in sorted(DEST.glob('*.svg')) + [RAIZ / 'assets' / 'favicon.svg']:
        vb = validar(ruta)
        print(f'  ok  {ruta.relative_to(RAIZ)}  viewBox {" ".join(vb)}  {ruta.stat().st_size / 1024:.1f} KB')

    nodos = {k: sum(len(b) for b in g[k]) for k in ('aro', 'bolas', 'disco', 'flor', 'cruz', 'puntos')}
    print('  tramos por pieza:', nodos)

    tmp = Path(tempfile.mkdtemp(prefix='logo-'))
    SB, SG, res = comprobar(g, tmp)
    for clave, (ib, ig, *_r) in res.items():
        print(f'IoU {clave:8s}  azul {ib:.4f}   verde {ig:.4f}')
    ib, ig, MB, MG, rgb = res['piezas']
    captura(SB, SG, rgb, MB, MG)
    print('→ screenshots/logo-vs-png.png')
    M['_iou'] = {k: [round(float(v[0]), 4), round(float(v[1]), 4)] for k, v in res.items()}
    (AQUI / 'logo-iou.json').write_text(json.dumps(M['_iou']), encoding='utf-8')
    if min(ib, ig, res['simbolo'][0], res['simbolo'][1]) < 0.95:
        print('¡IoU por debajo de 0,95!')
        sys.exit(1)


if __name__ == '__main__':
    main()
