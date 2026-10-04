"""Máscaras de color del logo original (A Casa da Mãe).

Desmezcla lineal de cada píxel en blanco / azul #1A6EB6 / verde #6FBB73
(las franjas del JPG quedan como fracciones), de modo que:
  azul  = fracción azul  > 0,5
  verde = fracción verde > 0,5
Lo usan logo-medir.py (medidas) y logo.py (IoU).
"""
from pathlib import Path
import cv2
import numpy as np

RAIZ = Path(__file__).resolve().parent.parent
FUENTE = RAIZ.parent / 'a-casa-da-mae-olivenza-bocetos' / 'ref' / 'web' / '648_Marca-perfiles-redes-sociales-1.jpg'

AZUL = np.array([0x1A, 0x6E, 0xB6], float)
VERDE = np.array([0x6F, 0xBB, 0x73], float)
BLANCO = np.array([255, 255, 255], float)

# recorte que contiene el símbolo (x0, y0, x1, y1) en píxeles del JPG
CAJA = (770, 400, 1430, 1060)


def cargar_rgb():
    im = cv2.imread(str(FUENTE), cv2.IMREAD_COLOR)
    if im is None:
        raise SystemExit(f'No se pudo leer {FUENTE}')
    return im[:, :, ::-1].astype(float)


def fracciones(rgb):
    """Devuelve (fb, fg): fracción azul y verde por píxel (blanco = resto).
    Mínimos cuadrados con suma 1: c = W + fb (B - W) + fg (G - W)."""
    M = np.stack([AZUL - BLANCO, VERDE - BLANCO], 1)  # 3x2
    pinv = np.linalg.pinv(M)
    d = (rgb - BLANCO).reshape(-1, 3).T
    f = (pinv @ d).T.reshape(rgb.shape[:2] + (2,))
    f = np.clip(f, 0, 1)
    return f[..., 0], f[..., 1]


def mascaras_simbolo():
    """Fracciones azul/verde del recorte del símbolo, y el origen del recorte."""
    rgb = cargar_rgb()
    x0, y0, x1, y1 = CAJA
    fb, fg = fracciones(rgb[y0:y1, x0:x1])
    return fb, fg, (x0, y0)
