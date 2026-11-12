"""Mide el error del detector contra un CSV etiquetado a mano.

CSV: frame,space_code,label  (label en {free, occupied}).
Reporta error en % y la matriz de confusion libre/ocupado.

El nucleo (compare) es puro y testeable con un CSV de ejemplo. La carga real
de video y del detector queda en run_over_video (no se ejecuta en tests).
"""
import csv
import sys


def read_labels(path):
    with open(path, newline="") as f:
        return [(r["frame"], r["space_code"], r["label"])
                for r in csv.DictReader(f)]


def compare(labels, predictions):
    """labels: [(frame, code, label)]. predictions: {(frame, code): status}.

    Devuelve (error_pct, matriz) donde matriz tiene llaves
    (verdadero, predicho) -> conteo.
    """
    matrix = {}
    wrong = 0
    total = 0
    for frame, code, truth in labels:
        pred = predictions.get((frame, code))
        if pred is None:
            continue
        total += 1
        matrix[(truth, pred)] = matrix.get((truth, pred), 0) + 1
        if truth != pred:
            wrong += 1
    error_pct = (100.0 * wrong / total) if total else 0.0
    return error_pct, matrix


def run_over_video(csv_path, cfg):  # pragma: no cover - necesita video/modelo
    import cv2

    from .. import config
    from ..main import _build_detector

    cfg = cfg or config.load()
    detect = _build_detector(cfg)
    labels = read_labels(csv_path)
    # codes esperados, poligonos vendrian de Supabase en uso real
    raise NotImplementedError(
        "run_over_video requiere video y puestos reales; usar compare() con "
        "predicciones ya calculadas."
    )


def main(argv=None):  # pragma: no cover
    argv = argv or sys.argv[1:]
    labels = read_labels(argv[0])
    print(f"{len(labels)} etiquetas leidas de {argv[0]}")


if __name__ == "__main__":  # pragma: no cover
    main()
