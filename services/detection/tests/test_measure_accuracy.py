"""measure_accuracy: CSV de ejemplo -> error % y matriz."""
from sabanago_detection.tools import measure_accuracy as ma

CSV = """frame,space_code,label
0,M1,free
0,M2,occupied
1,M1,occupied
1,M2,occupied
"""


def test_compare_csv(tmp_path):
    p = tmp_path / "labels.csv"
    p.write_text(CSV)
    labels = ma.read_labels(str(p))
    preds = {
        ("0", "M1"): "free",       # ok
        ("0", "M2"): "occupied",   # ok
        ("1", "M1"): "free",       # error (era occupied)
        ("1", "M2"): "occupied",   # ok
    }
    err, matrix = ma.compare(labels, preds)
    assert err == 25.0  # 1 de 4 mal
    assert matrix[("occupied", "free")] == 1
    assert matrix[("free", "free")] == 1


def test_predict_frames_y_summarize():
    import numpy as np

    vacio = np.full((40, 40, 3), 200, dtype=np.uint8)
    ref = ma.reference_from_frames([vacio, vacio])
    carro = vacio.copy()
    carro[5:20, 5:20] = 20  # oscurece el puesto M1
    polys = {"M1": [[0, 0], [30, 0], [30, 30], [0, 30]],
             "M2": [[32, 32], [39, 32], [39, 39], [32, 39]]}
    preds = ma.predict_frames({0: vacio, 1: carro}, polys, ref, 25.0)
    assert preds[("0", "M1")] == "free"
    assert preds[("1", "M1")] == "occupied"
    assert preds[("1", "M2")] == "free"
    labels = [("0", "M1", "free"), ("1", "M1", "occupied"), ("1", "M2", "occupied")]
    kinds = {("1", "M2"): "transicion"}
    texto = ma.summarize(labels, preds, kinds)
    assert "Error total: 33.3 %" in texto
    assert "estables (2): error 0.0 %" in texto
