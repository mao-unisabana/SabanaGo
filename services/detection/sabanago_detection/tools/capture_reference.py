"""Captura la imagen de referencia (parqueadero vacio) para el detector diff.

Uso: python -m sabanago_detection.tools.capture_reference --camera-id 1 [--source webcam:0]
Promedia 10 cuadros para bajar ruido. Si el brillo medio esta fuera de [40, 220]
advierte y NO reemplaza la referencia anterior. Guarda en data/reference/<camera_id>.png.
"""
import argparse
import sys

import cv2
import numpy as np

from sabanago_detection.detectors.diff import REF_DIR
from sabanago_detection.source import VideoSource

N_FRAMES = 10
BRIGHTNESS_MIN = 40
BRIGHTNESS_MAX = 220


def mean_brightness(frame):
    """Brillo medio en gris, 0-255."""
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY) if frame.ndim == 3 else frame
    return float(gray.mean())


def brightness_ok(frame, lo=BRIGHTNESS_MIN, hi=BRIGHTNESS_MAX):
    b = mean_brightness(frame)
    return lo <= b <= hi, b


def average_frames(frames):
    """Promedio de cuadros del mismo tamano, devuelto como uint8."""
    if not frames:
        raise ValueError("sin cuadros que promediar")
    return np.mean(np.stack(frames).astype(np.float32), axis=0).round().astype(np.uint8)


def capture(source, n=N_FRAMES):  # pragma: no cover - necesita webcam
    src = VideoSource(source)
    frames = []
    for _ in range(n * 5):  # intentos acotados por si la camara pierde cuadros
        ok, f = src.read()
        if ok:
            frames.append(f)
        if len(frames) == n:
            break
    src.release()
    return frames


def main():  # pragma: no cover
    ap = argparse.ArgumentParser()
    ap.add_argument("--camera-id", type=int, required=True)
    ap.add_argument("--source", default="webcam:0")
    a = ap.parse_args()
    frames = capture(a.source)
    if len(frames) < N_FRAMES:
        sys.exit(f"Solo se leyeron {len(frames)}/{N_FRAMES} cuadros; no se guarda.")
    avg = average_frames(frames)
    ok, b = brightness_ok(avg)
    if not ok:
        sys.exit(f"ADVERTENCIA: brillo medio {b:.0f} fuera de "
                 f"[{BRIGHTNESS_MIN}, {BRIGHTNESS_MAX}]. Referencia anterior intacta.")
    REF_DIR.mkdir(parents=True, exist_ok=True)
    path = REF_DIR / f"{a.camera_id}.png"
    cv2.imwrite(str(path), avg)
    print(f"Referencia guardada en {path} (brillo {b:.0f})")


if __name__ == "__main__":
    main()
