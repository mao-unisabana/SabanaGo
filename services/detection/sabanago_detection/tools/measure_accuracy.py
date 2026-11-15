"""Mide el error del detector contra un CSV etiquetado a mano.

CSV: frame,space_code,label  (label en {free, occupied}; otras columnas se ignoran).
Reporta error en % y la matriz de confusion libre/ocupado.

Uso (detector por diferencia, el que usa la maqueta):
    python -m sabanago_detection.tools.measure_accuracy \
        --video demo.mp4 --polygons data/demo/polygons.json \
        --labels data/demo/labels.csv [--threshold 25] [--reference-frames 10]

El nucleo (compare, predict_frames) es puro y testeable; solo run_over_video
abre el video.
"""
import argparse
import csv
import json

import numpy as np


def read_labels(path):
    with open(path, newline="") as f:
        return [(r["frame"], r["space_code"], r["label"])
                for r in csv.DictReader(f)]


def read_kinds(path):
    """(frame, code) -> valor de la columna opcional 'tipo' (estable/transicion)."""
    with open(path, newline="") as f:
        return {(r["frame"], r["space_code"]): r.get("tipo", "")
                for r in csv.DictReader(f)}


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


def reference_from_frames(frames):
    """Promedio de varios cuadros BGR -> gris uint8 (igual que capture_reference)."""
    import cv2

    mean = np.mean(np.stack(frames).astype(np.float32), axis=0).astype(np.uint8)
    return cv2.cvtColor(mean, cv2.COLOR_BGR2GRAY)


def predict_frames(frames, polygons, ref_gray, threshold):
    """frames: {indice: cuadro BGR}; polygons: {code: [[x, y] x4]}.

    Usa la misma decision del servicio (diff.decide), sin suavizado.
    Devuelve {(str(indice), code): status}.
    """
    import cv2

    from ..detectors.diff import decide

    out = {}
    for idx, frame in frames.items():
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        for code, poly in polygons.items():
            out[(str(idx), code)] = decide(gray, ref_gray, poly, threshold)[0]
    return out


def run_over_video(video_path, polygons, labels, threshold=25.0,
                   reference_frames=10):  # pragma: no cover - necesita video
    """Lee el video, arma la referencia con los primeros cuadros (lote vacio)
    y predice los cuadros etiquetados."""
    import cv2

    needed = {int(f) for f, _, _ in labels}
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise SystemExit(f"No se pudo abrir el video: {video_path}")
    ref, frames, i = [], {}, 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if i < reference_frames:
            ref.append(frame)
        if i in needed:
            frames[i] = frame
        i += 1
    cap.release()
    missing = needed - set(frames)
    if missing:
        raise SystemExit(f"El video no tiene los cuadros {sorted(missing)[:5]}...")
    return predict_frames(frames, polygons, reference_from_frames(ref), threshold)


def summarize(labels, predictions, kinds=None):
    """Texto con error total, matriz y error solo en cuadros estables."""
    lines = []
    err, matrix = compare(labels, predictions)
    n = sum(matrix.values())
    lines.append(f"Etiquetas evaluadas: {n}")
    lines.append(f"Error total: {err:.1f} %  (exactitud {100 - err:.1f} %)")
    lines.append("Matriz (verdadero -> predicho):")
    for truth in ("free", "occupied"):
        for pred in ("free", "occupied"):
            lines.append(f"  {truth:>8} -> {pred:<8} {matrix.get((truth, pred), 0)}")
    if kinds:
        stable = [(f, c, t) for f, c, t in labels
                  if kinds.get((f, c), "estable") != "transicion"]
        err_s, m_s = compare(stable, predictions)
        lines.append(f"Solo cuadros estables ({sum(m_s.values())}): "
                     f"error {err_s:.1f} %")
        wrong = [(f, c, t, predictions.get((f, c))) for f, c, t in labels
                 if predictions.get((f, c)) not in (None, t)]
        if wrong:
            lines.append("Errores (cuadro, puesto, verdadero, predicho, tipo):")
            for f, c, t, p in wrong:
                lines.append(f"  {f}, {c}, {t}, {p}, {kinds.get((f, c), '')}")
    return "\n".join(lines)


def main(argv=None):  # pragma: no cover
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--video", required=True)
    ap.add_argument("--polygons", required=True, help="JSON {codigo: [[x,y] x4]}")
    ap.add_argument("--labels", required=True)
    ap.add_argument("--threshold", type=float, default=25.0)
    ap.add_argument("--reference-frames", type=int, default=10)
    a = ap.parse_args(argv)
    with open(a.polygons) as f:
        polygons = json.load(f)
    labels = read_labels(a.labels)
    preds = run_over_video(a.video, polygons, labels, a.threshold, a.reference_frames)
    print(summarize(labels, preds, read_kinds(a.labels)))


if __name__ == "__main__":  # pragma: no cover
    main()
