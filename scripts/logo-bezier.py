"""Ajuste de cúbicas de Bézier a una polilínea (Schneider, Graphics Gems 1990)
y utilidades geométricas pequeñas (evaluar, partir, cortar con un círculo).
Solo se usa para pasar un contorno MEDIDO a curvas con pocos nodos."""
import numpy as np


def bez(seg, t):
    p0, p1, p2, p3 = seg
    t = np.asarray(t, float)[..., None]
    u = 1 - t
    return u**3 * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t**3 * p3


def bez_d(seg, t):
    p0, p1, p2, p3 = seg
    t = np.asarray(t, float)[..., None]
    u = 1 - t
    return 3 * u * u * (p1 - p0) + 6 * u * t * (p2 - p1) + 3 * t * t * (p3 - p2)


def bez_dd(seg, t):
    p0, p1, p2, p3 = seg
    t = np.asarray(t, float)[..., None]
    return 6 * (1 - t) * (p2 - 2 * p1 + p0) + 6 * t * (p3 - 2 * p2 + p1)


def partir(seg, t):
    """de Casteljau: devuelve (izquierda, derecha)."""
    p0, p1, p2, p3 = [np.asarray(p, float) for p in seg]
    a = p0 + (p1 - p0) * t
    b = p1 + (p2 - p1) * t
    c = p2 + (p3 - p2) * t
    d = a + (b - a) * t
    e = b + (c - b) * t
    f = d + (e - d) * t
    return (p0, a, d, f), (f, e, c, p3)


def _unit(v):
    n = np.linalg.norm(v)
    return v / n if n > 1e-12 else v


def _chord_params(pts):
    d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(pts, axis=0), axis=1))]
    return d / d[-1]


def _generate(pts, u, t1, t2):
    p0, p3 = pts[0], pts[-1]
    b = lambda k, uu: [(1 - uu) ** 3, 3 * uu * (1 - uu) ** 2, 3 * uu * uu * (1 - uu), uu ** 3][k]
    A1 = t1[None] * b(1, u)[:, None]
    A2 = t2[None] * b(2, u)[:, None]
    C = np.array([[np.sum(A1 * A1), np.sum(A1 * A2)], [np.sum(A1 * A2), np.sum(A2 * A2)]])
    tmp = pts - (p0[None] * (b(0, u) + b(1, u))[:, None] + p3[None] * (b(2, u) + b(3, u))[:, None])
    X = np.array([np.sum(A1 * tmp), np.sum(A2 * tmp)])
    det = C[0, 0] * C[1, 1] - C[0, 1] * C[1, 0]
    seg_len = np.linalg.norm(p3 - p0)
    if abs(det) > 1e-12:
        a1 = (X[0] * C[1, 1] - X[1] * C[0, 1]) / det
        a2 = (C[0, 0] * X[1] - C[1, 0] * X[0]) / det
    else:
        a1 = a2 = seg_len / 3
    eps = 1e-6 * seg_len
    if a1 < eps or a2 < eps:
        a1 = a2 = seg_len / 3
    return (p0, p0 + t1 * a1, p3 + t2 * a2, p3)


def _reparam(seg, pts, u):
    q = bez(seg, u) - pts
    d1 = bez_d(seg, u)
    d2 = bez_dd(seg, u)
    num = np.sum(q * d1, 1)
    den = np.sum(d1 * d1, 1) + np.sum(q * d2, 1)
    with np.errstate(divide='ignore', invalid='ignore'):
        nu = np.where(np.abs(den) > 1e-12, u - num / den, u)
    return np.clip(nu, 0, 1)


def _max_err(seg, pts, u):
    d = np.linalg.norm(bez(seg, u) - pts, axis=1)
    i = int(np.argmax(d))
    return d[i], i


def ajustar(pts, t1, t2, tol):
    """Lista de cúbicas que pasan por pts[0] y pts[-1] con tangentes t1 (salida)
    y t2 (llegada, apuntando hacia atrás) y error máximo <= tol."""
    pts = np.asarray(pts, float)
    if len(pts) == 2:
        d = np.linalg.norm(pts[1] - pts[0]) / 3
        return [(pts[0], pts[0] + t1 * d, pts[1] + t2 * d, pts[1])]
    u = _chord_params(pts)
    seg = _generate(pts, u, t1, t2)
    err, split = _max_err(seg, pts, u)
    if err < tol:
        return [seg]
    if err < tol * 4:
        for _ in range(20):
            u = _reparam(seg, pts, u)
            seg = _generate(pts, u, t1, t2)
            err, split = _max_err(seg, pts, u)
            if err < tol:
                return [seg]
    split = min(max(split, 1), len(pts) - 2)
    tc = _unit(pts[split - 1] - pts[split + 1])
    return ajustar(pts[:split + 1], t1, tc, tol) + ajustar(pts[split:], -tc, t2, tol)


def tangente(pts, i, sentido, n=6):
    """Tangente estimada en pts[i] mirando n puntos hacia +1 o -1."""
    j = i + sentido * n
    j = min(max(j, 0), len(pts) - 1)
    return _unit(pts[j] - pts[i])


def suavizar(pts, sigma):
    """Gauss sobre una polilínea abierta (extremos fijos)."""
    from scipy.ndimage import gaussian_filter1d
    if sigma <= 0:
        return pts
    q = np.c_[gaussian_filter1d(pts[:, 0], sigma, mode='nearest'),
              gaussian_filter1d(pts[:, 1], sigma, mode='nearest')]
    q[0], q[-1] = pts[0], pts[-1]
    return q


def remuestrear(pts, paso):
    d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(pts, axis=0), axis=1))]
    n = max(int(round(d[-1] / paso)), 2)
    s = np.linspace(0, d[-1], n + 1)
    return np.c_[np.interp(s, d, pts[:, 0]), np.interp(s, d, pts[:, 1])]


def esquinas(pts, k, umbral_grados):
    """Índices de esquinas: máximos locales del giro entre pts[i-k]→pts[i]→pts[i+k]."""
    n = len(pts)
    giro = np.zeros(n)
    for i in range(k, n - k):
        a = _unit(pts[i] - pts[i - k])
        b = _unit(pts[i + k] - pts[i])
        giro[i] = np.degrees(np.arccos(np.clip(np.dot(a, b), -1, 1)))
    out = []
    for i in range(k, n - k):
        if giro[i] >= umbral_grados and giro[i] == giro[max(0, i - k):i + k + 1].max():
            if not out or i - out[-1] > k:
                out.append(i)
    return out, giro


def corte_circulo(seg, c, r):
    """Parámetros t donde la cúbica cruza el círculo (c, r)."""
    t = np.linspace(0, 1, 2001)
    f = np.linalg.norm(bez(seg, t) - c, axis=1) - r
    out = []
    for i in np.where(np.sign(f[:-1]) != np.sign(f[1:]))[0]:
        a, b = t[i], t[i + 1]
        fa = f[i]
        for _ in range(60):
            m = (a + b) / 2
            fm = np.linalg.norm(bez(seg, m) - c) - r
            if np.sign(fm) == np.sign(fa):
                a, fa = m, fm
            else:
                b = m
        out.append((a + b) / 2)
    return out
