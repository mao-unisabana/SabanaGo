"""Detector por diferencia contra la imagen del puesto vacio (maqueta).

Diferencia media absoluta en gris dentro del poligono. > DIFF_THRESHOLD ->
occupied. Confianza = distancia normalizada al umbral, recortada a [0.5, 1].
La referencia es la UNICA imagen que este servicio escribe (data/reference/).
"""
from pathlib import Path

import cv2
import numpy as np

REF_DIR = Path("data/reference")


def _gray(frame):
    return cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)


def _mask_mean_diff(cur_gray, ref_gray, poly_pts):
    mask = np.zeros(cur_gray.shape, dtype=np.uint8)
    cv2.fillPoly(mask, [np.array(poly_pts, dtype=np.int32)], 255)
    d = cv2.absdiff(cur_gray, ref_gray)
    sel = d[mask == 255]
    return float(sel.mean()) if sel.size else 0.0


def decide(cur_gray, ref_gray, poly_pts, threshold):
    """Logica pura testeable: un puesto dado gris actual/referencia."""
    md = _mask_mean_diff(cur_gray, ref_gray, poly_pts)
    if md > threshold:
        conf = min(1.0, max(0.5, md / (2 * threshold)))
        return ("occupied", conf)
    conf = min(1.0, max(0.5, 1.0 - md / threshold))
    return ("free", conf)


class DiffDetector:
    def __init__(self, camera_id, threshold):
        self.threshold = threshold
        self.ref_path = REF_DIR / f"{camera_id}.png"
        self.ref_gray = None
        if self.ref_path.exists():
            self.ref_gray = _gray(cv2.imread(str(self.ref_path)))

    def capture_reference(self, frame):
        REF_DIR.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(self.ref_path), frame)
        self.ref_gray = _gray(frame)

    def detect(self, frame, spaces):
        if self.ref_gray is None:  # sin referencia de lote vacio: no_data, no adivinar
            return {}
        cur = _gray(frame)
        out = {}
        for sp in spaces:
            poly = sp.get("image_polygon")
            if not poly:  # ponytail: sin poligono -> omitido, queda no_data
                continue
            out[sp["id"]] = decide(cur, self.ref_gray, poly, self.threshold)
        return out
