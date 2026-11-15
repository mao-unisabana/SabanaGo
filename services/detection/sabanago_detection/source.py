"""Fuente de video: webcam:<n>, ruta de archivo (en bucle) o rtsp://.

read() devuelve (ok, frame). Si la fuente cae, ok=False y el bucle de arriba
deja de enviar latidos; reconnect() reintenta. Archivos hacen bucle al final.
"""
import time

import cv2


def _open(source: str):
    if source.startswith("webcam:"):
        return cv2.VideoCapture(int(source.split(":", 1)[1])), False
    # archivo o rtsp
    is_file = not source.startswith("rtsp://")
    return cv2.VideoCapture(source), is_file


class VideoSource:
    def __init__(self, source: str, retry_s: float = 2.0):
        self.source = source
        self.retry_s = retry_s
        self.cap, self.is_file = _open(source)

    def read(self):
        if self.cap is None or not self.cap.isOpened():
            return False, None
        ok, frame = self.cap.read()
        if not ok and self.is_file:
            # bucle: volver al primer cuadro
            self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ok, frame = self.cap.read()
        return ok, frame

    def reconnect(self):
        if self.cap is not None:
            self.cap.release()
        time.sleep(self.retry_s)
        self.cap, self.is_file = _open(self.source)

    def release(self):
        if self.cap is not None:
            self.cap.release()
