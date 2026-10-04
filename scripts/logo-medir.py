"""Mide el símbolo de A Casa da Mãe en el JPG y escribe scripts/logo-medidas.json.

  python scripts/logo-medir.py

1. Centro y giro: los que hacen el símbolo más simétrico (D4) en azul y verde.
2. Remuestrea a un marco canónico (viewBox 0 0 200 200, centro 100,100,
   borde exterior del aro = 96) y promedia las 8 simetrías: así el trazo a mano
   se compensa y lo que queda es un octante limpio.
3. Mide aro, bolas, disco y puntos (círculos), los 4 lóbulos de la flor
   (círculos sobre los ejes) y el contorno de la cruz en UN octante, que se pasa
   a cúbicas (Schneider). logo.py rota y refleja ese octante.
"""
import sys
sys.dont_write_bytecode = True  # sin __pycache__ en scripts/
import importlib.util
import json
from pathlib import Path

import cv2
import numpy as np
from scipy.optimize import minimize

AQUI = Path(__file__).resolve().parent


def modulo(nombre):
    sp = importlib.util.spec_from_file_location(nombre.replace('-', '_'), AQUI / f'{nombre}.py')
    m = importlib.util.module_from_spec(sp)
    sp.loader.exec_module(m)
    return m


lf = modulo('logo-fuente')
bz = modulo('logo-bezier')

K = 10            # píxeles canónicos por unidad
N = 200 * K
R_ARO = 96.0      # borde exterior del aro en el viewBox


def canon(f, cx, cy, th, esc, k=K):
    n = 200 * k
    u = (np.arange(n) + 0.5) / k - 100
    U, V = np.meshgrid(u, u)
    c, s = np.cos(th), np.sin(th)
    X = cx + esc * (c * U - s * V)
    Y = cy + esc * (s * U + c * V)
    return cv2.remap(f.astype(np.float32), X.astype(np.float32), Y.astype(np.float32), cv2.INTER_LINEAR)


def d4(a):
    out, b = [], a
    for _ in range(4):
        out += [b, b[:, ::-1]]
        b = np.rot90(b)
    return out


def perfil_radial(f, cx, cy, angulos, r0, r1):
    """Para cada ángulo, radios (px) del borde exterior y del interior siguiente."""
    fuera, dentro = [], []
    r = np.arange(r0, r1, 0.1)
    for a in angulos:
        x = (cx + r * np.cos(a)).astype(np.float32)[None]
        y = (cy - r * np.sin(a)).astype(np.float32)[None]
        v = cv2.remap(f.astype(np.float32), x, y, cv2.INTER_LINEAR)[0]
        idx = np.where(v > 0.5)[0]
        j = idx.max()
        # interpolación subpíxel del cruce por 0,5
        fo = r[j] + (v[j] - 0.5) / max(v[j] - v[j + 1], 1e-6) * 0.1
        i = j
        while i > 0 and v[i] > 0.5:
            i -= 1
        fi = r[i] + (0.5 - v[i]) / max(v[i + 1] - v[i], 1e-6) * 0.1
        fuera.append(fo)
        dentro.append(fi)
    return np.array(fuera), np.array(dentro)


def ajustar_circulo(x, y, cx_fijo=None):
    if cx_fijo is None:
        A = np.c_[2 * x, 2 * y, np.ones_like(x)]
        s = np.linalg.lstsq(A, x * x + y * y, rcond=None)[0]
        cx, cy = s[0], s[1]
        R = np.sqrt(s[2] + cx * cx + cy * cy)
    else:
        xx = x - cx_fijo
        A = np.c_[2 * y, np.ones_like(y)]
        s = np.linalg.lstsq(A, xx * xx + y * y, rcond=None)[0]
        cx, cy = cx_fijo, s[0]
        R = np.sqrt(s[1] + cy * cy)
    res = np.hypot(x - cx, y - cy) - R
    return cx, cy, R, float(np.abs(res).max()), float(res.std())


def contorno_mayor(m):
    cs, _ = cv2.findContours(m.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cs, key=cv2.contourArea)[:, 0, :].astype(float)
    return (c + 0.5) / K   # a unidades


def main():
    import sys
    sys.stdout.reconfigure(encoding="utf-8")
    fb, fg, (x0, y0) = lf.mascaras_simbolo()

    # --- 1. pose -----------------------------------------------------------
    H, W = fg.shape
    yy, xx = np.mgrid[:H, :W]
    cx0 = float((fg * xx).sum() / fg.sum())
    cy0 = float((fg * yy).sum() / fg.sum())
    fo, _ = perfil_radial(fb, cx0, cy0, np.linspace(0, 2 * np.pi, 360, endpoint=False), 150, 340)
    esc = float(fo.mean()) / R_ARO           # px de la fuente por unidad (provisional)

    def asim(p):
        g = canon(fg, p[0], p[1], p[2], esc, k=2)
        b = canon(fb, p[0], p[1], p[2], esc, k=2)
        return np.abs(g - np.mean(d4(g), 0)).sum() + np.abs(b - np.mean(d4(b), 0)).sum()

    r = minimize(asim, [cx0, cy0, 0.0], method='Nelder-Mead',
                 options=dict(xatol=0.01, fatol=0.5,
                              initial_simplex=[[cx0, cy0, 0], [cx0 + 1, cy0, 0], [cx0, cy0 + 1, 0], [cx0, cy0, 0.01]]))
    cx, cy, th = [float(v) for v in r.x]

    # radios del aro con el centro bueno (sobre la fuente sin simetrizar)
    ang = np.linspace(0, 2 * np.pi, 1440, endpoint=False)
    fo, fi = perfil_radial(fb, cx, cy, ang, 150, 340)
    grados = np.degrees(ang) % 90
    lejos_bolas = (grados > 20) & (grados < 70)
    esc = float(fo.mean()) / R_ARO
    aro_ext = R_ARO
    aro_int = float(fi[lejos_bolas].mean()) / esc
    print(f'pose: centro ({cx + x0:.2f}, {cy + y0:.2f}) px, giro {np.degrees(th):.3f}º, {esc:.4f} px/u')
    print(f'aro: ext {aro_ext:.2f}  int {aro_int:.2f}  (ondulación exterior ±{fo.std() / esc:.2f} u, interior ±{fi[lejos_bolas].std() / esc:.2f} u)')

    # --- 2. marco canónico simetrizado ------------------------------------
    g = np.mean(d4(canon(fg, cx, cy, th, esc)), 0)
    b = np.mean(d4(canon(fb, cx, cy, th, esc)), 0)
    G = g > 0.5
    B = b > 0.5
    u = (np.arange(N) + 0.5) / K
    UX, UY = np.meshgrid(u, u)
    RR = np.hypot(UX - 100, UY - 100)

    # disco: borde exterior del verde
    fo_g, _ = perfil_radial(g, 100 * K, 100 * K, ang[lejos_bolas], 300, 700)
    disco = float(fo_g.mean()) / K
    print(f'disco: r {disco:.2f}')

    # bolas: contorno de la bola de arriba que no toca el aro
    comp = (B & (RR < aro_int + 1) & (RR > disco)).astype(np.uint8)
    n, lab, st, cen = cv2.connectedComponentsWithStats(comp)
    arriba = min(range(1, n), key=lambda i: cen[i][1])
    cs, _ = cv2.findContours((lab == arriba).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    pc = (cs[0][:, 0, :].astype(float) + 0.5) / K
    sel = np.hypot(pc[:, 0] - 100, pc[:, 1] - 100) < aro_int - 1.0
    _, bcy, bR, emax, _ = ajustar_circulo(pc[sel, 0], pc[sel, 1], cx_fijo=100.0)
    bola_d = 100 - bcy
    print(f'bolas: distancia {bola_d:.2f}  r {bR:.2f}  (error máx {emax:.2f})')

    # puntos: componentes azules dentro del disco, cuadrante NE
    comp = (B & (RR < disco)).astype(np.uint8)
    n, lab, st, cen = cv2.connectedComponentsWithStats(comp)
    puntos = []
    for i in range(1, n):
        x_, y_ = (cen[i] + 0.5) / K
        if x_ > 100 and y_ < 100:
            a = st[i][cv2.CC_STAT_AREA] / K / K
            puntos.append(dict(d=float(np.hypot(x_ - 100, y_ - 100)), r=float(np.sqrt(a / np.pi))))
    puntos.sort(key=lambda p: p['d'])
    print('puntos:', ', '.join(f"d {p['d']:.2f} r {p['r']:.2f}" for p in puntos))

    # --- flor: blanco dentro del disco (los puntos cuentan como blanco) ----
    blanco = (~G) & (RR < disco - 0.3)
    # borde exterior del blanco por rayos en el octante (de la diagonal al eje)
    pts = []
    for a in np.radians(np.linspace(46, 80, 140)):   # ángulo matemático (y hacia arriba)
        rr = np.arange(5, disco, 0.02)
        x = 100 + rr * np.cos(a)
        y = 100 - rr * np.sin(a)
        v = blanco[(y * K).astype(int), (x * K).astype(int)]
        j = np.where(v)[0]
        if len(j):
            pts.append((x[j.max()], y[j.max()]))
    pts = np.array(pts)
    _, fcy, fR, emax, estd = ajustar_circulo(pts[:, 0], pts[:, 1], cx_fijo=100.0)
    flor_d = 100 - fcy
    print(f'flor: lóbulo r {fR:.2f} a {flor_d:.2f} del centro (error máx {emax:.2f}, desv {estd:.2f})')

    # --- cruz: verde dentro de la flor (algo encogida para no coger el borde)
    enc = 0.3
    dentro_flor = np.zeros_like(G)
    for cxl, cyl in [(100, 100 - flor_d), (100, 100 + flor_d), (100 - flor_d, 100), (100 + flor_d, 100)]:
        dentro_flor |= np.hypot(UX - cxl, UY - cyl) < fR - enc
    # el centro, entre los cuatro lóbulos, también es flor
    dentro_flor |= (np.abs(UX - 100) + np.abs(UY - 100)) < flor_d
    C = G & dentro_flor
    cont = contorno_mayor(C)

    # tramo del octante: desde el punto más alto sobre el eje (x≈100) hasta la diagonal
    i0 = int(np.argmin(np.where(np.abs(cont[:, 0] - 100) < 0.11, cont[:, 1], 1e9)))
    n = len(cont)
    paso = 1 if cont[(i0 + 5) % n, 0] > cont[(i0 - 5) % n, 0] else -1
    tramo = []
    i = i0
    while True:
        p = cont[i % n]
        tramo.append(p)
        if (p[0] - 100) >= (100 - p[1]) and len(tramo) > 10:
            break
        i += paso
    tramo = np.array(tramo)
    d = ((tramo[-1, 0] - 100) + (100 - tramo[-1, 1])) / 2
    tramo[-1] = (100 + d, 100 - d)

    pl = bz.remuestrear(tramo, 0.05)
    esq, giro = bz.esquinas(bz.suavizar(pl, 2), 8, 38)
    print('cruz: esquinas en', [tuple(np.round(pl[e], 2)) for e in esq])
    # la primera esquina es donde la punta superior sale del arco de la flor:
    # se descarta el arco y la punta se prolonga en recto hasta r_top
    pl = pl[esq[0]:]
    cortes = [0] + [e - esq[0] for e in esq[1:]] + [len(pl) - 1]
    segs = []
    tol = 0.12
    for a_, b_ in zip(cortes[:-1], cortes[1:]):
        trozo = bz.suavizar(pl[a_:b_ + 1], 3)
        t1 = bz.tangente(trozo, 0, 1)
        t2 = bz.tangente(trozo, len(trozo) - 1, -1)
        segs += bz.ajustar(trozo, t1, t2, tol)
    # prolongación recta de la punta
    r_top = flor_d + fR + 0.6
    p0 = np.asarray(segs[0][0]); t0 = segs[0][1] - p0; t0 = t0 / np.linalg.norm(t0)
    k_ = ((100 - r_top) - p0[1]) / t0[1]
    q = p0 + k_ * t0
    top = np.array([100.0, 100 - r_top])
    lin = lambda a, b: (a, a + (b - a) / 3, a + 2 * (b - a) / 3, b)
    segs = [lin(top, q), lin(q, p0)] + segs
    print(f'cruz: punta hasta r {r_top:.2f} (semiancho {q[0] - 100:.2f}); {len(esq)} esquinas, {len(segs)} cúbicas en el octante')

    medidas = dict(
        fuente=dict(centro_px=[cx + x0, cy + y0], giro_rad=th, px_por_unidad=esc),
        aro=dict(ext=aro_ext, int=aro_int),
        bolas=dict(d=bola_d, r=bR),
        disco=dict(r=disco),
        flor=dict(d=flor_d, r=fR),
        cruz=dict(r_top=float(r_top), octante=[[list(map(float, p)) for p in s] for s in segs]),
        puntos=puntos,
    )
    (AQUI / 'logo-medidas.json').write_text(json.dumps(medidas, indent=1), encoding='utf-8')
    print('→ scripts/logo-medidas.json')


if __name__ == '__main__':
    main()
