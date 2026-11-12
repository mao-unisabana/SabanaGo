"""source: lee un video corto generado en el test y confirma el bucle."""
import numpy as np
import cv2

from sabanago_detection.source import VideoSource


def _make_video(path, n=3):
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    w = cv2.VideoWriter(str(path), fourcc, 5.0, (32, 32))
    for i in range(n):
        frame = np.full((32, 32, 3), i * 40, dtype=np.uint8)
        w.write(frame)
    w.release()


def test_lee_y_hace_bucle(tmp_path):
    vid = tmp_path / "v.mp4"
    _make_video(vid, n=3)
    src = VideoSource(str(vid))
    # leer mas cuadros que los escritos: debe volver al inicio (bucle)
    reads = [src.read()[0] for _ in range(6)]
    src.release()
    assert all(reads), "la fuente de archivo debe hacer bucle, nunca quedar en False"
