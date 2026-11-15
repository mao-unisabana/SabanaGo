"""diff: puesto vacio vs. rectangulo pintado (imagenes sinteticas)."""
import numpy as np

from sabanago_detection.detectors import diff

SQUARE = [[2, 2], [20, 2], [20, 20], [2, 20]]


def test_vacio_libre():
    ref = np.zeros((32, 32), dtype=np.uint8)
    cur = ref.copy()
    status, conf = diff.decide(cur, ref, SQUARE, threshold=25)
    assert status == "free"
    assert 0.5 <= conf <= 1.0


def test_pintado_ocupado():
    ref = np.zeros((32, 32), dtype=np.uint8)
    cur = ref.copy()
    cur[2:20, 2:20] = 255  # rectangulo blanco sobre el puesto
    status, conf = diff.decide(cur, ref, SQUARE, threshold=25)
    assert status == "occupied"
    assert 0.5 <= conf <= 1.0
