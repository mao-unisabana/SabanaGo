"""Fuente de video: webcam:<n>, ruta de archivo (en bucle) o rtsp://.

read() devuelve (ok, frame). Si la fuente cae, ok=False y el bucle de arriba
deja de enviar latidos; reconnect() reintenta. Archivos hacen bucle al final.
"""
import threading
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


class FrameReader:
    """Hilo que lee la fuente a su ritmo nativo y guarda el ULTIMO cuadro.

    Expone read()/reconnect()/release() como VideoSource, para que el bucle de
    deteccion (1 fps) tome siempre el cuadro mas reciente. on_frame(frame) se
    llama por cada cuadro leido (lo usa la vista previa); el cuadro no se
    escribe a disco.
    """

    def __init__(self, src, on_frame=None, default_fps=30.0, first_wait_s=2.0):
        self.src = src
        self.on_frame = on_frame
        self.first_wait_s = first_wait_s
        fps = src.cap.get(cv2.CAP_PROP_FPS) if src.cap is not None else 0
        self.period = 1.0 / (fps if fps and fps > 1 else default_fps)
        self._lock = threading.Lock()
        self._frame = None
        self._ok = False
        self._ready = threading.Event()
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def _loop(self):
        next_t = time.monotonic()
        while not self._stop.is_set():
            ok, frame = self.src.read()
            if not ok:
                with self._lock:
                    self._ok = False
                self._ready.set()
                self.src.reconnect()  # duerme retry_s
                next_t = time.monotonic()
                continue
            with self._lock:
                self._frame, self._ok = frame, True
            self._ready.set()
            if self.on_frame:
                try:
                    self.on_frame(frame)
                except Exception:  # noqa: BLE001 - la vista previa nunca tumba el lector
                    pass
            next_t += self.period
            delay = next_t - time.monotonic()
            if delay > 0:
                self._stop.wait(delay)
            else:
                next_t = time.monotonic()  # atrasado: no acumular deuda

    def read(self):
        self._ready.wait(self.first_wait_s)
        with self._lock:
            if not self._ok:
                return False, None
            return True, self._frame

    def reconnect(self):
        time.sleep(0.5)  # el hilo ya reintenta la conexion

    def release(self):
        self._stop.set()
        self._thread.join(timeout=3)
        self.src.release()
