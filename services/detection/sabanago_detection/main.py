"""Bucle principal: 1 cuadro/s, deteccion, suavizado, ingesta. /health aparte.

Logs JSON por linea: camara, puestos enviados, tiempo por cuadro, errores.
Si la fuente cae: registra el error, NO envia lotes (la base pasa a no_data) y
reintenta cada 2 s (fuera del try para no romper el proceso).
"""
import json
import threading
import time

from . import config
from .ingest import Ingestor
from .smoothing import Smoother
from .source import VideoSource

_healthy = {"ok": True}


def _log(**kw):
    print(json.dumps(kw), flush=True)


def _build_detector(cfg):
    if cfg.detector == "yolo":
        from .detectors import yolo
        return lambda frame, spaces: yolo.detect(frame, spaces)
    from .detectors.diff import DiffDetector
    d = DiffDetector(cfg.camera_id, cfg.diff_threshold)
    return d.detect


def _start_health():
    from fastapi import FastAPI
    import uvicorn

    app = FastAPI()

    @app.get("/health")
    def health():
        return {"ok": _healthy["ok"]}

    t = threading.Thread(
        target=lambda: uvicorn.run(app, host="0.0.0.0", port=8000,
                                   log_level="warning"),
        daemon=True,
    )
    t.start()


def run(cfg=None, max_iters=None):
    cfg = cfg or config.load()
    src = VideoSource(cfg.video_source)
    ing = Ingestor(cfg.supabase_url, cfg.service_role_key, cfg.camera_id,
                   cfg.ingest_interval_s)
    detect = _build_detector(cfg)
    smoother = Smoother()

    i = 0
    while max_iters is None or i < max_iters:
        i += 1
        t0 = time.monotonic()
        ok, frame = src.read()
        if not ok:
            _healthy["ok"] = False
            _log(event="source_down", camera=cfg.camera_id)
            src.reconnect()  # duerme retry_s; no envia lotes
            continue
        _healthy["ok"] = True
        try:
            spaces = ing.spaces()
            raw = detect(frame, spaces)
            stable = {sid: (smoother.update(sid, st), conf)
                      for sid, (st, conf) in raw.items()}
            sent = ing.push(stable)
            _log(event="frame", camera=cfg.camera_id, spaces=len(stable),
                 sent=sent, frame_ms=round((time.monotonic() - t0) * 1000, 1))
        except Exception as e:  # noqa: BLE001 - loguear y seguir
            _log(event="error", camera=cfg.camera_id, error=str(e))
        # 1 fps
        time.sleep(max(0.0, 1.0 - (time.monotonic() - t0)))
    src.release()


def main():
    _start_health()
    run()


if __name__ == "__main__":
    main()
