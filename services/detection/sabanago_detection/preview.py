"""Vista de depuracion en vivo (solo con PREVIEW activo).

Dibuja el estado suavizado por puesto sobre una copia del cuadro y lo sirve
como MJPEG. El JPEG vive SOLO en memoria: nunca se escribe a disco (Habeas Data).
"""
import asyncio
import threading

import cv2
import numpy as np

# BGR
COLORS = {"free": (0, 200, 0), "occupied": (0, 0, 220), "no_data": (150, 150, 150)}

PAGE = (
    "<!doctype html><html><head><title>preview</title></head>"
    "<body style='margin:0;background:#111;text-align:center'>"
    "<img src='/preview/stream' style='max-width:100%;max-height:100vh'>"
    "</body></html>"
)


class FrameHolder:
    """Ultimo JPEG con lock; version crece con cada cuadro nuevo."""

    def __init__(self):
        self._lock = threading.Lock()
        self._jpeg = None
        self.version = 0

    def set(self, jpeg):
        with self._lock:
            self._jpeg = jpeg
            self.version += 1

    def get(self):
        with self._lock:
            return self._jpeg


def draw_overlay(frame, spaces, stable, frame_ms, detector):
    """Copia del cuadro con poligono y etiqueta por puesto. stable: id -> (status, conf)."""
    img = frame.copy()
    for sp in spaces:
        poly = sp.get("image_polygon")
        if not poly:
            continue
        status, conf = stable.get(sp["id"], ("no_data", 0.0))
        color = COLORS.get(status, COLORS["no_data"])
        pts = np.array(poly, dtype=np.int32)
        cv2.polylines(img, [pts], True, color, 2)
        x, y = int(pts[:, 0].min()), int(pts[:, 1].min())
        cv2.putText(img, f"{sp.get('code', '')} {status} {conf:.2f}",
                    (x, max(12, y - 4)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 1)
    cv2.putText(img, f"{detector} frame_ms={frame_ms}", (8, 20),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
    return img


def encode_jpeg(img):
    ok, buf = cv2.imencode(".jpg", img)
    return buf.tobytes() if ok else None


def add_routes(app, holder, poll_s=0.25):
    from fastapi.responses import HTMLResponse, Response, StreamingResponse

    @app.get("/preview")
    def page():
        return HTMLResponse(PAGE)

    @app.get("/preview/frame.jpg")
    def frame():
        jpeg = holder.get()
        if jpeg is None:
            return Response(status_code=503)
        return Response(jpeg, media_type="image/jpeg")

    async def mjpeg():
        # generador async: al desconectar el cliente se cancela, sin hilos colgados
        last = -1
        while True:
            if holder.version != last:
                last = holder.version
                jpeg = holder.get()
                if jpeg:
                    yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n"
                           + jpeg + b"\r\n")
            await asyncio.sleep(poll_s)

    @app.get("/preview/stream")
    def stream():
        return StreamingResponse(
            mjpeg(), media_type="multipart/x-mixed-replace; boundary=frame")


class PreviewPublisher:
    """Compone cada cuadro con el ultimo resultado de deteccion y lo publica.

    update_result() llega a ~1 Hz; publish() a ritmo de video, limitado a max_fps.
    """

    def __init__(self, holder, detector, max_fps=15.0, clock=None):
        import time
        self.holder = holder
        self.detector = detector
        self.min_interval = 1.0 / max_fps
        self._clock = clock or time.monotonic
        self._last_pub = -1e9
        self._lock = threading.Lock()
        self._result = ([], {}, 0.0)

    def update_result(self, spaces, stable, frame_ms):
        with self._lock:
            self._result = (spaces, stable, frame_ms)

    def publish(self, frame):
        now = self._clock()
        if now - self._last_pub < self.min_interval:
            return False
        self._last_pub = now
        with self._lock:
            spaces, stable, ms = self._result
        jpeg = encode_jpeg(draw_overlay(frame, spaces, stable, ms, self.detector))
        if jpeg:
            self.holder.set(jpeg)
        return True
