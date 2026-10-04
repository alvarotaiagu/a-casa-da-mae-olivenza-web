# Mide la baldosa de su suelo real (ref/web/202_16.jpg, foto frontal a 2521 px).
# El suelo es de baldosa HEXAGONAL: los círculos (medallones y flores grandes)
# caen en retícula triangular y son tangentes entre sí. La web usa un módulo
# CUADRADO derivado (decisión del usuario, 2026-10-04): medallón en el centro y
# cuartos de flor grande en las esquinas, tangentes en la diagonal.
# Salida: data/baldosa-medidas.json (todo relativo al radio R de un círculo).
import cv2, numpy as np, json, os, sys
AQUI = os.path.dirname(os.path.abspath(__file__))
FOTO = os.path.join(AQUI, '..', '..', 'a-casa-da-mae-olivenza-bocetos', 'ref', 'web', '202_16.jpg')
im = cv2.imread(FOTO); g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY).astype(float)
bg = cv2.GaussianBlur(g, (0, 0), 40)
tinta = (g < bg * 0.80).astype(np.uint8)        # 1 = pintado (azul)
tinta = cv2.morphologyEx(tinta, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))

def ajustar_circulo(pts):
    A = np.c_[2 * pts[:, 0], 2 * pts[:, 1], np.ones(len(pts))]
    b = (pts ** 2).sum(1)
    c, *_ = np.linalg.lstsq(A, b, rcond=None)
    return c[0], c[1], np.sqrt(c[2] + c[0] ** 2 + c[1] ** 2)

def borde_exterior(cx, cy, rmin, rmax, angulos):
    # para cada ángulo, el último píxel pintado entre rmin y rmax (borde exterior del aro)
    pts = []
    for a in angulos:
        rs = np.arange(rmin, rmax)
        xs = (cx + rs * np.cos(a)).astype(int); ys = (cy + rs * np.sin(a)).astype(int)
        ok = (xs >= 0) & (ys >= 0) & (xs < tinta.shape[1]) & (ys < tinta.shape[0])
        v = tinta[ys[ok], xs[ok]]; r2 = rs[ok]
        idx = np.where(v > 0)[0]
        if len(idx): pts.append((cx + r2[idx[-1]] * np.cos(a), cy + r2[idx[-1]] * np.sin(a)))
    return np.array(pts)

def perfil(cx, cy, a, r0, r1):
    rs = np.arange(r0, r1); xs = (cx + rs * np.cos(a)).astype(int); ys = (cy + rs * np.sin(a)).astype(int)
    v = tinta[ys, xs]; tramos = []; ini = None
    for r, t in zip(rs, v):
        if t and ini is None: ini = r
        if not t and ini is not None: tramos.append((int(ini), int(r - 1))); ini = None
    if ini is not None: tramos.append((int(ini), int(rs[-1])))
    return tramos

# 1 · medallón central: aro exterior, medido fuera de los ejes (allí están las bolas)
cx, cy = 1340, 1066
angs = [np.radians(d) for d in range(0, 360, 3) if min(d % 90, 90 - d % 90) > 18]
for _ in range(3):
    pts = borde_exterior(cx, cy, 250, 360, angs)
    cx, cy, R = ajustar_circulo(pts)
# grosor del aro y círculo interior, en las diagonales
diag = [perfil(cx, cy, np.radians(d), 0, int(R) + 2) for d in (45, 135, 225, 315)]
aro_ini = np.median([t[-1][0] for t in diag]); aro_fin = np.median([t[-1][1] for t in diag])
# bolas: las cuatro manchas redondas grandes dentro del aro, en los ejes
# (aquí con el color: la tinta es gris azulada y la baldosa crema; el umbral local
#  vacía el centro de las manchas grandes)
bgr = im.astype(int); azulado = ((bgr[:, :, 0] - bgr[:, :, 2]) > 8).astype(np.uint8)
azulado = cv2.morphologyEx(azulado, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
n0, lab0, st0, cen0 = cv2.connectedComponentsWithStats(azulado, 8)
bolas = []
for k in range(1, n0):
    x, y, w, h, area = st0[k]
    if area < 2000 or abs(w - h) > .2 * max(w, h): continue
    if area / (np.pi * (max(w, h) / 2) ** 2) < .75: continue
    d = np.hypot(cen0[k][0] - cx, cen0[k][1] - cy)
    if .5 * R < d < .95 * R: bolas.append((d, np.sqrt(area / np.pi)))
bola_d = np.median([b[0] for b in bolas]); bola_r = np.median([b[1] for b in bolas])

# 2 · la flor grande vecina (a la izquierda): su borde exterior y el paso entre círculos
fx, fy = cx - 2 * R, cy
angs2 = [np.radians(d) for d in range(0, 360, 3) if min(d % 90, 90 - d % 90) > 12]
for _ in range(3):
    pts = borde_exterior(fx, fy, int(R * .7), int(R * 1.04), angs2)
    fx, fy, Rf = ajustar_circulo(pts)
paso = np.hypot(cx - fx, cy - fy)

# 3 · los puntos de la flor grande: manchas redondas pequeñas dentro de su círculo
n, lab, st, cen = cv2.connectedComponentsWithStats(tinta, 8)
puntos = []
for k in range(1, n):
    x, y, w, h, area = st[k]
    if not (60 < area < 2500) or abs(w - h) > max(4, .25 * max(w, h)): continue
    if area / (np.pi * (max(w, h) / 2) ** 2) < .7: continue
    dx, dy = cen[k][0] - fx, cen[k][1] - fy
    if np.hypot(dx, dy) < Rf * .9:
        puntos.append({'dx': round(dx / R, 4), 'dy': round(dy / R, 4), 'r': round(np.sqrt(area / np.pi) / R, 4)})
# en un cuadrante, a lo largo de la diagonal: distancia al centro y radio
cuadrante = sorted([p for p in puntos if p['dx'] < 0 and p['dy'] < 0], key=lambda p: np.hypot(p['dx'], p['dy']))

# 4 · la flor grande a lo largo de la diagonal (pintado / sin pintar) y del eje (brazo de la cruz)
perfil_diag = perfil(fx, fy, np.radians(225), 0, int(Rf) + 2)
perfil_eje = perfil(fx, fy - 0, np.radians(270), 0, int(Rf) + 2)
anchura_brazo = []
for r in range(int(.2 * R), int(.8 * R), 20):
    fila = tinta[int(fy - r), int(fx - 60):int(fx + 60)]
    idx = np.where(fila > 0)[0]
    if len(idx): anchura_brazo.append(int(idx[-1] - idx[0] + 1))

med = {
    'fuente': 'ref/web/202_16.jpg (2521 px, frontal), umbral local g < 0,8·fondo; medido con scripts/medir-baldosa.py el 2026-10-04',
    'suelo': 'hexagonal: círculos tangentes en retícula triangular (medallones y flores grandes alternos)',
    'R_px': round(R, 1),
    'medallon': {
        'centro_px': [round(cx, 1), round(cy, 1)],
        'aro_interior_R': round(aro_ini / R, 4), 'aro_exterior_R': 1.0,
        'grosor_aro_R': round((aro_fin - aro_ini) / R, 4),
        'bola_radio_R': round(bola_r / R, 4), 'bola_distancia_R': round(bola_d / R, 4), 'bolas_halladas': len(bolas),
        'tramos_diagonal_px': diag[0]
    },
    'flor_grande': {
        'centro_px': [round(fx, 1), round(fy, 1)], 'radio_R': round(Rf / R, 4),
        'tramos_diagonal_R': [[round(a / R, 3), round(b / R, 3)] for a, b in perfil_diag],
        'tramos_eje_R': [[round(a / R, 3), round(b / R, 3)] for a, b in perfil_eje],
        'anchura_brazo_R': [round(a / R, 3) for a in anchura_brazo],
        'puntos_cuadrante': cuadrante
    },
    'paso_entre_circulos_R': round(paso / R, 4),
    'modulo_cuadrado': {
        'regla': 'medallón en el centro y cuartos de flor grande en las esquinas, tangentes en la diagonal (como en el suelo, donde los círculos se tocan)',
        'lado_R': round(2 * np.sqrt(2), 4),
        'lado_px_en_la_foto': round(2 * np.sqrt(2) * R, 1)
    }
}
salida = os.path.join(AQUI, '..', 'data', 'baldosa-medidas.json')
json.dump(med, open(salida, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps(med, ensure_ascii=False, indent=1))
