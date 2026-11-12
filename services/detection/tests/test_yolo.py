"""yolo: cobertura caja-poligono con cajas sinteticas (sin modelo)."""
from sabanago_detection.detectors import yolo

# puesto cuadrado 10x10 en el origen
SQUARE = [[0, 0], [10, 0], [10, 10], [0, 10]]
SPACES = [
    {"id": 1, "code": "M1", "image_polygon": SQUARE},
    {"id": 2, "code": "M2", "image_polygon": None},  # sin poligono
]


def test_30pct_ocupado():
    # caja que cubre 30% del poligono (10x3)
    boxes = [(0, 0, 10, 3, 0.8)]
    out = yolo.detect(None, SPACES, _boxes=boxes)
    assert out[1][0] == "occupied"
    assert out[1][1] == 0.8


def test_10pct_libre():
    # caja que cubre 10% (10x1): por debajo del 30% -> free
    boxes = [(0, 0, 10, 1, 0.8)]
    out = yolo.detect(None, SPACES, _boxes=boxes)
    assert out[1][0] == "free"


def test_sin_poligono_omitido():
    out = yolo.detect(None, SPACES, _boxes=[])
    assert 2 not in out
    assert out[1][0] == "free"
