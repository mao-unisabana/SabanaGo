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
