"""Fotos de A Casa da Mãe: gradación común + verticales corregidas donde hace falta.

Entrada: a-casa-da-mae-olivenza-bocetos/ref/web/<n>_<nombre> (biblioteca de medios de su web; no se tocan)
Salida:  scripts/fuentes/masters/<id>.jpg   (lado largo <= 2400 px, q 92)
         data/fotos.json                    (id, estancia, alt, origen, verticales, foco; w/h/anchos los pone fotos.mjs)
         screenshots/fotos-antes-despues-<k>.jpg  (para revisar a ojo)
Después: node scripts/fotos.mjs saca AVIF/WebP/JPG y completa w, h y anchos.

Fuera, siempre: 406-420 (página «Visitar Olivenza», fotos del Ayuntamiento y de terceros),
424/635/636 (otra casa), placeholders, logos, kit digital,
Texto-capa y poema.jpg (309, sin permiso todavía).

1 · GRADACIÓN COMÚN, suave (que lean como un mismo reportaje, sin «filtro»):
    balance de grises parcial (40 %) hacia un neutro apenas cálido, medido solo en los
    píxeles poco saturados (así el azul de la baldosa y el ladrillo no tiran del balance);
    brillo medio llevado a medias hacia una mediana común; curva en S suave.
    Sin desenfoque ni cambio de fondo.
2 · VERTICALES (receta de casa-juderia-olivenza-web/scripts/fotos.py): Canny + HoughLinesP
    sobre segmentos casi verticales, punto de fuga por RANSAC, homografía que abre el lado
    lejano al 85 % con tope de 1,4x, estiramiento vertical del 30 % de la apertura y recorte
    al rectángulo interior. Solo si las rectas son fiables y hay algo que corregir; nunca en
    arcos, escaleras, detalles planos ni exteriores.

  python scripts/fotos.py              (todas)
  python scripts/fotos.py patio cocina (algunas, por id)
"""
import json, math, os, sys
import numpy as np
import cv2
from PIL import Image, ImageOps, ImageDraw, ImageFont

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
ORIGEN = os.path.normpath(os.path.join(RAIZ, '..', 'a-casa-da-mae-olivenza-bocetos', 'ref', 'web'))
DESTINO = os.path.join(AQUI, 'fuentes', 'masters')
CAPTURAS = os.path.join(RAIZ, 'screenshots')
JSON = os.path.join(RAIZ, 'data', 'fotos.json')
os.makedirs(DESTINO, exist_ok=True); os.makedirs(CAPTURAS, exist_ok=True)

LADO_MAX = 2400
PROHIBIDAS = set(range(406, 421)) | {424, 635, 636, 309}

# ───────────────────────────── catálogo ─────────────────────────────
# v: 'auto' = probar la corrección (se aplica solo si las rectas son fiables); False = nunca
def F(id, estancia, n, alt, v='auto', **extra):
    return dict(id=id, estancia=estancia, n=n, alt=alt, v=v, **extra)

FOTOS = [
    # salón (bóvedas); el héroe es el vertical
    F('boveda-salon-v', 'salon', 680, 'Salón comedor bajo bóvedas de ladrillo, con mesas redondas, sofá y lámpara de pie', False, hero=True),
    F('boveda-salon', 'salon', 112, 'Salón comedor con bóvedas de ladrillo, mesas redondas y un aparador blanco', False,
      recorte=(0, 0, 1, 0.87)),   # el original de su web se funde a blanco abajo: fuera esa franja
    F('boveda-mesa', 'salon', 663, 'Comedor bajo arcos de ladrillo, con mesas redondas, sillas blancas y suelo hidráulico azul', False),
    F('salon-arco', 'salon', 134, 'Arco de ladrillo que da paso al salón comedor, con mesas redondas al fondo', False),
    F('boveda-detalle', 'salon', 195, 'Detalle de la bóveda de ladrillo del salón', False),
    # habitaciones de la planta baja
    F('hab-flores', 'habitaciones', 214, 'Dormitorio doble bajo bóveda de ladrillo, con papel pintado de flores y cabecero de rejilla'),
    F('hab-azul', 'habitaciones', 679, 'Dormitorio doble con colcha azul, cabecero de rejilla y el baño al fondo'),
    F('hab-toile-rojo', 'habitaciones', 201, 'Pared de un dormitorio con papel toile rojo, aplique de globo y cabecero de rejilla', False),
    F('hab-armario', 'habitaciones', 213, 'Dormitorio bajo bóveda de ladrillo, con armario blanco de dos puertas'),
    # baños de la planta baja
    F('bano-pb', 'banos', 199, 'Baño con ducha de mampara, espejo redondo y azulejo azul y blanco'),
    F('bano-ducha', 'banos', 193, 'Ducha con grifería dorada y pared de azulejo azul y blanco'),
    F('bano-corredera', 'banos', 204, 'Baño con puerta corredera, lavabo sobre balda de madera y espejo redondo'),
    F('bano-boveda', 'banos', 133, 'Baño bajo bóveda de ladrillo, con hornacina de azulejo azul y suelo de madera'),
    # cocina común
    F('cocina', 'cocina', 209, 'Cocina común con muebles de madera, lavadora, lavavajillas y suelo hidráulico azul'),
    # patio
    F('patio', 'patio', 210, 'Patio encalado con dos buganvillas, retablo de azulejo entre faroles y empedrado'),
    F('azulejo-cristo', 'patio', 198, 'Retablo de azulejo azul con Cristo cargando la cruz, entre dos faroles', False),
    F('empedrado', 'patio', 196, 'Empedrado de piedra blanca y negra del patio', False),
    F('arco-patio', 'patio', 197, 'Arco de ladrillo y puerta acristalada que da al patio con buganvillas', False),
    F('reja-patio', 'patio', 194, 'Puerta al patio con reja de forja de monograma'),
    # la casa: pasillos, entrada, calle
    F('pasillo', 'casa', 687, 'Pasillo con suelo hidráulico azul y blanco, zócalo azul y arco al fondo'),
    F('recibidor', 'casa', 686, 'Pasillo con consola, lámpara de flecos y flores, bajo bóveda de ladrillo'),
    F('pasillo-entrada', 'casa', 682, 'Pasillo de la planta baja hacia la puerta de entrada de madera'),
    F('entrada', 'casa', 683, 'Puerta de madera abierta hacia el pasillo, bajo bóveda de ladrillo'),
    F('reja', 'casa', 689, 'Pasillo visto a través de una reja de forja', False),
    F('fachada', 'casa', 690, 'Fachada encalada con reja de forja y placa de alojamiento', False),
    F('calle', 'casa', 692, 'Calle encalada y empedrada, con la puerta de la casa a la izquierda', False),
    F('baldosa', 'casa', 202, 'Baldosa hidráulica azul y blanca del suelo, con flor de cuatro lóbulos', False),
    # apartamentos: las 6 de cada galería suya
    F('magdalena-1', 'magdalena', 916, 'Salón con sofá verde, chimenea eléctrica y techo de ladrillo con vigas'),
    F('magdalena-2', 'magdalena', 917, 'Salón comedor con mesa redonda, chimenea eléctrica y alacena blanca'),
    F('magdalena-3', 'magdalena', 918, 'Baño con mueble de lavabo verde, ducha y azulejo de dibujo'),
    F('magdalena-4', 'magdalena', 919, 'Dormitorio con colcha de flores, armario blanco y ventana'),
    F('magdalena-5', 'magdalena', 920, 'Dormitorio con cabecero rosa y colcha de flores, bajo techo de ladrillo'),
    F('magdalena-6', 'magdalena', 921, 'Cocina con horno, microondas, frigorífico y encimera de madera'),
    F('cadaval-1', 'cadaval', 907, 'Dormitorio con papel toile azul, cama de forja y vigas de madera'),
    F('cadaval-2', 'cadaval', 908, 'Salón con sofá azul oscuro, mesa de comedor y vigas de madera'),
    F('cadaval-3', 'cadaval', 909, 'Comedor con mesa de madera, estantería blanca y chimenea eléctrica'),
    F('cadaval-4', 'cadaval', 910, 'Salón con sofá, butacas blancas y mesa de comedor de madera'),
    F('cadaval-5', 'cadaval', 911, 'Dormitorio con camas individuales y papel de cuadros'),
    F('cadaval-6', 'cadaval', 912, 'Cocina con muebles azul oscuro, campana y lavavajillas'),
    F('calvario-1', 'calvario', 925, 'Cocina vista desde la puerta, con barra y taburetes'),
    F('calvario-2', 'calvario', 926, 'Salón con cocina abierta, barra, frigorífico y televisor'),
    F('calvario-3', 'calvario', 927, 'Dormitorio con colcha estampada y toallas naranjas'),
    F('calvario-4', 'calvario', 928, 'Dormitorio con cabecero capitoné blanco y pared terracota'),
    F('calvario-5', 'calvario', 929, 'Baño con espejo redondo, lavabo y ducha'),
    F('calvario-6', 'calvario', 930, 'Salón con papel pintado de flores, mesa y televisor'),
    F('maria-1', 'maria', 934, 'Salón con sofá amarillo, chimenea eléctrica y techo de ladrillo'),
    F('maria-2', 'maria', 935, 'Baño con ducha y azulejo de dibujo azul y naranja'),
    F('maria-3', 'maria', 936, 'Cocina con mesa alta, taburetes amarillos y suelo de baldosa'),
    F('maria-4', 'maria', 937, 'Dormitorio con cabecero tapizado y papel pintado de ramas'),
    F('maria-5', 'maria', 938, 'Dormitorio con litera blanca y armario'),
    F('maria-6', 'maria', 939, 'Dormitorio con cama de matrimonio, toallas amarillas y papel de flores'),
    # placas de azulejo (se verán en marco cuadrado: foco = centro de la placa, se fija tras mirar los másteres)
    F('placa-magdalena', 'placas', 720, 'Placa de azulejo pintada a mano con la iglesia y el nombre «La Magdalena»', False, foco='72% 52%'),
    F('placa-cadaval', 'placas', 723, 'Placa de azulejo pintada a mano: «Palacio los Duques de Cadaval», n.º 3', False, foco='50% 50%'),
    F('placa-calvario', 'placas', 728, 'Placa de azulejo pintada a mano: «Puerta del Calvario», n.º 4', False, foco='22% 52%'),
    # 1435 es la placa de la puerta del apartamento (no una foto del monumento): es suya
    F('placa-santamaria', 'placas', 1435, 'Placa de azulejo pintada a mano: «Santa María del Castillo»', False, foco='58% 58%'),
    F('placa-calle', 'placas', 207, 'Placa de azulejo de la calle: «Díaz Brito · Antiga Rua dos Oleiros»', False, foco='50% 50%'),
    # planta alta
    F('tejados', 'alta', 307, 'Tejados de teja y fachadas encaladas bajo el cielo azul', False),
    F('buhardilla', 'alta', 306, 'Techo inclinado con viga de madera y papel toile', False),
    F('toile-azul', 'alta', 313, 'Detalle del papel pintado toile azul de un apartamento', False),
]


def archivo(n):
    assert n not in PROHIBIDAS, n
    pref = f'{n}_'
    for f in os.listdir(ORIGEN):
        if f.startswith(pref):
            return os.path.join(ORIGEN, f)
    raise FileNotFoundError(n)


def abrir(n):
    return np.asarray(ImageOps.exif_transpose(Image.open(archivo(n))).convert('RGB'))


# ───────────────────────────── 1 · verticales ─────────────────────────────
FUERZA_VERTICAL = 0.85
TOPE_APERTURA = 1.4
TOPE_INCLINACION = 0.22   # |dx/dy| máximo que se acepta como «vertical torcida»
MIN_RECTAS = 8            # menos que esto: no es fiable
MIN_GRADOS = 0.6          # si los bordes se inclinan menos, no hay nada que corregir


def segmentos_verticales(bgr):
    H, W = bgr.shape[:2]
    esc = 1200 / max(H, W)
    peq = cv2.resize(bgr, (round(W * esc), round(H * esc)), interpolation=cv2.INTER_AREA)
    gris = cv2.GaussianBlur(cv2.cvtColor(peq, cv2.COLOR_BGR2GRAY), (3, 3), 0)
    bordes = cv2.Canny(gris, 40, 120)
    hp = peq.shape[0]
    lineas = cv2.HoughLinesP(bordes, 1, np.pi / 720, threshold=60, minLineLength=round(hp * 0.1), maxLineGap=6)
    segs = []
    if lineas is None:
        return segs
    ym = hp / 2
    for x1, y1, x2, y2 in np.asarray(lineas).reshape(-1, 4):
        dy = y2 - y1
        if abs(dy) < 1: continue
        b = (x2 - x1) / dy
        if abs(b) > TOPE_INCLINACION: continue
        a = x1 + b * (ym - y1)
        segs.append((a / esc, b, math.hypot(x2 - x1, dy) / esc))
    return segs


def ajustar_fuga(segs, H):
    """Ajuste robusto de a = c0 + c1·b (RANSAC + mínimos cuadrados ponderados)."""
    if len(segs) < MIN_RECTAS:
        return None
    A = np.array(segs)
    a, b, w = A[:, 0], A[:, 1], A[:, 2]
    mejor, mejor_in = None, None
    rng = np.random.default_rng(7)
    tol = 0.006 * H
    for _ in range(500):
        i, j = rng.choice(len(A), 2, replace=False)
        if abs(b[i] - b[j]) < 1e-3: continue
        c1 = (a[i] - a[j]) / (b[i] - b[j]); c0 = a[i] - c1 * b[i]
        dentro = np.abs(a - (c0 + c1 * b)) < tol + np.abs(c1) * 0.004
        p = w[dentro].sum()
        if mejor is None or p > mejor:
            mejor, mejor_in = p, dentro
    if mejor_in is None or mejor_in.sum() < MIN_RECTAS:
        return None
    X = np.c_[np.ones(mejor_in.sum()), b[mejor_in]]
    Wd = np.diag(w[mejor_in])
    c0, c1 = np.linalg.solve(X.T @ Wd @ X, X.T @ Wd @ a[mejor_in])
    return dict(c0=c0, c1=c1, n=int(mejor_in.sum()), cuota=float(w[mejor_in].sum() / w.sum()),
                b_medio=float(np.average(b[mejor_in], weights=w[mejor_in])))


def rect_interior(q, W, H):
    TL, TR, BR, BL = q
    x0 = max(0, TL[0], BL[0]); x1 = min(W, TR[0], BR[0])
    y0 = max(0, TL[1], TR[1]); y1 = min(H, BL[1], BR[1])
    def x_en(p, r, y):
        if abs(r[1] - p[1]) < 1e-6: return p[0]
        return p[0] + (r[0] - p[0]) * (y - p[1]) / (r[1] - p[1])
    for y in (y0, y1):
        x0 = max(x0, x_en(TL, BL, y)); x1 = min(x1, x_en(TR, BR, y))
    return (math.ceil(x0), math.ceil(y0), math.floor(x1), math.floor(y1))


def recorte_giro(W, H, grados):
    a = abs(math.radians(grados))
    s = 1 / (math.cos(a) + max(W, H) / min(W, H) * math.sin(a))
    w, h = W * s, H * s
    return (round((W - w) / 2), round((H - h) / 2), round((W + w) / 2), round((H + h) / 2))


def corregir_verticales(rgb, nombre):
    H, W = rgb.shape[:2]
    fit = ajustar_fuga(segmentos_verticales(cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)), H)
    if not fit:
        print(f'  {nombre}: sin verticales fiables'); return rgb, None
    if fit['cuota'] < 0.35:
        print(f'  {nombre}: rectas dispersas (cuota {fit["cuota"]:.2f}), sin corregir'); return rgb, None
    c0, c1 = fit['c0'], fit['c1']
    vx, vy = c0, H / 2 - c1
    if abs(vy - H / 2) < 0.8 * H:
        print(f'  {nombre}: fuga demasiado cerca ({round(vx)}, {round(vy)}), sin corregir'); return rgb, None
    if abs(vy) > 60 * H:   # paralelas: solo giro
        giro = -math.degrees(math.atan(fit['b_medio'])) * FUERZA_VERTICAL
        if abs(giro) < MIN_GRADOS:
            print(f'  {nombre}: a plomo'); return rgb, None
        M = cv2.getRotationMatrix2D((W / 2, H / 2), giro, 1.0)
        out = cv2.warpAffine(rgb, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
        x0, y0, x1, y1 = recorte_giro(W, H, giro)
        return out[y0:y1, x0:x1], dict(tipo='giro', grados=round(giro, 2), n=fit['n'])

    def b_por(x0, y0):
        return (x0 - vx) / (y0 - vy)
    arriba = vy < H / 2
    yb = H if arriba else 0
    yo = 0 if arriba else H
    bl, br = b_por(0, yb), b_por(W, yb)
    incl = max(abs(math.degrees(math.atan(bl))), abs(math.degrees(math.atan(br))))
    if incl < MIN_GRADOS:
        print(f'  {nombre}: a plomo ({incl:.2f}º)'); return rgb, None
    xl_o = bl * (yo - yb); xr_o = W + br * (yo - yb)
    Wo = xr_o - xl_o
    f = FUERZA_VERTICAL
    if Wo < W:
        f = min(f, 1 - (W - TOPE_APERTURA * Wo) / (W - Wo))
    xl_d = (1 - f) * bl * (yo - yb); xr_d = W + (1 - f) * br * (yo - yb)
    src = np.float32([[0, yb], [W, yb], [xr_o, yo], [xl_o, yo]])
    dst = np.float32([[0, yb], [W, yb], [xr_d, yo], [xl_d, yo]])
    Hm = cv2.getPerspectiveTransform(src, dst)
    out = cv2.warpPerspective(rgb, Hm, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT)
    esquinas = cv2.perspectiveTransform(np.float32([[[0, 0], [W, 0], [W, H], [0, H]]]), Hm)[0]
    x0, y0, x1, y1 = rect_interior(esquinas, W, H)
    rec = out[y0:y1, x0:x1]
    apertura = (xr_d - xl_d) / (xr_o - xl_o)
    k = 1 + 0.3 * (apertura - 1)
    if k > 1.005:
        rec = cv2.resize(rec, (rec.shape[1], round(rec.shape[0] * k)), interpolation=cv2.INTER_CUBIC)
    return rec, dict(tipo='homografia', n=fit['n'], fuerza=round(f, 2), aspecto=round(k, 3),
                     inclinacion=round(incl, 2), conservado=round((x1 - x0) * (y1 - y0) / (W * H), 2))


# ───────────────────────────── 2 · gradación ─────────────────────────────
def a_lineal(c): return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
def a_srgb(c): return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(np.clip(c, 0, None), 1 / 2.4) - 0.055)

TONO = np.array([1.02, 1.0, 0.97]); TONO = TONO / (0.2126 * TONO[0] + 0.7152 * TONO[1] + 0.0722 * TONO[2])
MEZCLA_GRIS = 0.40
MEDIANA_COMUN = 0.50
MEZCLA_BRILLO = 0.50
CURVA = 0.05


def gradar(x):
    """x: float 0..1 sRGB."""
    lin = a_lineal(x)
    mx, mn = x.max(-1), x.min(-1)
    sat = (mx - mn) / np.maximum(mx, 1e-6)
    Y = 0.2126 * lin[..., 0] + 0.7152 * lin[..., 1] + 0.0722 * lin[..., 2]
    # balance de grises parcial, medido en lo poco saturado (paredes, techos, sábanas)
    m = (sat < 0.35) & (Y > 0.02) & (Y < 0.92)
    medio = lin[m].mean(0) if m.mean() > 0.05 else lin.reshape(-1, 3).mean(0)
    objetivo = TONO * (0.2126 * medio[0] + 0.7152 * medio[1] + 0.0722 * medio[2])
    g = 1 + MEZCLA_GRIS * (objetivo / np.maximum(medio, 1e-4) - 1)
    g = np.clip(g, 0.9, 1.1)
    g = g / (0.2126 * g[0] + 0.7152 * g[1] + 0.0722 * g[2])     # sin cambiar el brillo
    x = np.clip(a_srgb(np.clip(lin * g, 0, 1)), 0, 1)
    # brillo: la mediana, a medias, hacia una común
    L = 0.299 * x[..., 0] + 0.587 * x[..., 1] + 0.114 * x[..., 2]
    gam = math.log(MEDIANA_COMUN) / math.log(min(max(float(np.median(L)), 0.05), 0.95))
    gam = float(np.clip(1 + MEZCLA_BRILLO * (gam - 1), 0.85, 1.15))
    Ln = np.power(np.clip(L, 0, 1), gam)
    # curva en S suave sobre la luminancia
    s = Ln + CURVA * np.sin(np.pi * (Ln - 0.5)) * (1 - np.abs(2 * Ln - 1)) * 1.6
    x = x * (np.clip(s, 0, 1) / np.maximum(L, 1e-4))[..., None]
    return np.clip(x, 0, 1)


# ───────────────────────────── proceso ─────────────────────────────
def procesar(f):
    rgb = abrir(f['n'])
    if f.get('recorte'):
        H, W = rgb.shape[:2]; x0, y0, x1, y1 = f['recorte']
        rgb = rgb[round(y0 * H):round(y1 * H), round(x0 * W):round(x1 * W)]
    info = None
    if f['v'] == 'auto':
        rgb, info = corregir_verticales(rgb, f['id'])
    x = gradar(rgb.astype(np.float64) / 255.0)
    out = Image.fromarray((x * 255 + 0.5).astype(np.uint8))
    if max(out.size) > LADO_MAX:
        e = LADO_MAX / max(out.size)
        out = out.resize((round(out.width * e), round(out.height * e)), Image.LANCZOS)
    out.save(os.path.join(DESTINO, f['id'] + '.jpg'), quality=92, subsampling=0)
    return info, out.size


def hojas(fotos, por_hoja=12):
    font = ImageFont.truetype('arial.ttf', 16)
    rutas = []
    for k in range(0, len(fotos), por_hoja):
        filas = []
        for f in fotos[k:k + por_hoja]:
            a = Image.fromarray(abrir(f['n'])); b = Image.open(os.path.join(DESTINO, f['id'] + '.jpg'))
            h = 300
            a = a.resize((round(a.width * h / a.height), h)); b = b.resize((round(b.width * h / b.height), h))
            c = Image.new('RGB', (a.width + b.width + 16, h + 24), 'white')
            c.paste(a, (0, 24)); c.paste(b, (a.width + 16, 24))
            marca = ' · VERTICALES' if f.get('_vert') else ''
            ImageDraw.Draw(c).text((4, 3), f"{f['id']} ({f['n']}){marca}", fill='black', font=font)
            filas.append(c)
        cols = 3
        W = max(sum(c.width + 20 for c in filas[i:i + cols]) for i in range(0, len(filas), cols))
        H = sum(max(c.height for c in filas[i:i + cols]) + 16 for i in range(0, len(filas), cols))
        hoja = Image.new('RGB', (W, H), (228, 228, 228))
        y = 0
        for i in range(0, len(filas), cols):
            x = 0
            for c in filas[i:i + cols]:
                hoja.paste(c, (x, y)); x += c.width + 20
            y += max(c.height for c in filas[i:i + cols]) + 16
        ruta = os.path.join(CAPTURAS, f'fotos-antes-despues-{k // por_hoja + 1}.jpg')
        hoja.save(ruta, quality=84); rutas.append(ruta)
    return rutas


if __name__ == '__main__':
    pedidas = set(sys.argv[1:])
    previo = {}
    if os.path.exists(JSON):
        previo = {p['id']: p for p in json.load(open(JSON, encoding='utf-8'))['fotos']}
    salida = []
    for f in FOTOS:
        p = previo.get(f['id'], {})
        if not pedidas or f['id'] in pedidas:
            info, size = procesar(f)
            f['_vert'] = bool(info)
            print(f['id'], f"{size[0]}x{size[1]}", info or '')
        else:
            f['_vert'] = p.get('verticales', False)
        r = dict(id=f['id'], estancia=f['estancia'], alt=f['alt'], origen='ref/web/' + os.path.basename(archivo(f['n'])),
                 verticales=f['_vert'])
        if f.get('hero'): r['hero'] = True
        if f.get('foco'): r['foco'] = f['foco']
        for k in ('w', 'h', 'anchos'):
            if k in p and (pedidas and f['id'] not in pedidas): r[k] = p[k]
        salida.append(r)
    with open(JSON, 'w', encoding='utf-8') as fh:
        fh.write(json.dumps({'fotos': salida}, ensure_ascii=False, indent=1) + '\n')
    hechas = [f for f in FOTOS if not pedidas or f['id'] in pedidas]
    for r in hojas(hechas): print('hoja:', r)
