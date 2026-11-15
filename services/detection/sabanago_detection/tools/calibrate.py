"""Calibracion de puestos: 4 clics por puesto sobre un cuadro congelado.

Uso: python -m sabanago_detection.tools.calibrate --camera-id 1 [--source webcam:0]
Teclas: u deshace el ultimo clic, s guarda el puesto actual, n salta el puesto,
q termina. Los puestos se leen de la base (orden por code); aqui no se crean.
Guarda en space.image_polygon (PATCH) y copia en data/calibration/<camera_id>.json.
Solo reemplaza el poligono de los puestos que se vuelven a marcar.
"""
import argparse
import json
from pathlib import Path

import cv2
import httpx

from sabanago_detection.source import VideoSource
from sabanago_detection.tools._rest import client_headers, credentials

CALIB_DIR = Path("data/calibration")


def polygon_to_json(points):
    """Lista de (x, y) -> [[x, y], ...] con enteros, la forma que lee diff.py."""
    if len(points) != 4:
        raise ValueError("un puesto necesita exactamente 4 vertices")
    return [[int(x), int(y)] for x, y in points]


def merge_calibration(existing, updates):
    """Combina {code: poligono} previo con los nuevos; los nuevos reemplazan."""
    merged = dict(existing)
    merged.update(updates)
    return merged


def load_calibration(camera_id, calib_dir=CALIB_DIR):
    path = Path(calib_dir) / f"{camera_id}.json"
    return json.loads(path.read_text()) if path.exists() else {}


def save_calibration(camera_id, polygons, calib_dir=CALIB_DIR):
    calib_dir = Path(calib_dir)
    calib_dir.mkdir(parents=True, exist_ok=True)
    (calib_dir / f"{camera_id}.json").write_text(json.dumps(polygons, indent=2))


def fetch_spaces(client, url, key, camera_id):
    r = client.get(f"{url}/rest/v1/space",
                   params={"camera_id": f"eq.{camera_id}", "is_active": "eq.true",
                           "select": "id,code", "order": "code.asc"},
                   headers=client_headers(key))
    r.raise_for_status()
    return r.json()


def patch_polygon(client, url, key, space_id, polygon):
    r = client.patch(f"{url}/rest/v1/space", params={"id": f"eq.{space_id}"},
                     json={"image_polygon": polygon}, headers=client_headers(key))
    r.raise_for_status()


def grab_frame(source):  # pragma: no cover - necesita webcam
    src = VideoSource(source)
    frame = None
    for _ in range(10):  # descarta cuadros iniciales (autoexposicion)
        ok, f = src.read()
        if ok:
            frame = f
    src.release()
    if frame is None:
        raise SystemExit(f"No se pudo leer un cuadro de {source}")
    return frame


def _draw(base, done, points, label):  # pragma: no cover - interfaz
    img = base.copy()
    for poly in done.values():
        cv2.polylines(img, [_np(poly)], True, (0, 200, 0), 2)
    for p in points:
        cv2.circle(img, p, 4, (0, 0, 255), -1)
    if len(points) > 1:
        cv2.polylines(img, [_np(points)], len(points) == 4, (0, 255, 255), 1)
    cv2.putText(img, f"{label}: {len(points)}/4  u=deshacer s=guardar n=saltar q=salir",
                (10, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
    return img


def _np(points):  # pragma: no cover
    import numpy as np
    return np.array(points, dtype=np.int32)


def run(camera_id, source):  # pragma: no cover - necesita webcam/Supabase
    url, key = credentials()
    frame = grab_frame(source)
    saved = load_calibration(camera_id)
    new = {}
    with httpx.Client(timeout=10.0) as client:
        spaces = fetch_spaces(client, url, key, camera_id)
        if not spaces:
            raise SystemExit(f"La camara {camera_id} no tiene puestos activos.")
        win = "calibrar"
        points = []
        cv2.namedWindow(win)
        cv2.setMouseCallback(win, lambda e, x, y, f, p: (
            points.append((x, y)) if e == cv2.EVENT_LBUTTONDOWN and len(points) < 4 else None))
        for sp in spaces:
            points.clear()
            while True:
                cv2.imshow(win, _draw(frame, {**saved, **new}, points,
                                      f"Puesto {sp['code']}"))
                k = cv2.waitKey(30) & 0xFF
                if k == ord("u") and points:
                    points.pop()
                elif k == ord("s") and len(points) == 4:
                    poly = polygon_to_json(points)
                    patch_polygon(client, url, key, sp["id"], poly)
                    new[sp["code"]] = poly
                    save_calibration(camera_id, merge_calibration(saved, new))
                    print(f"{sp['code']} guardado")
                    break
                elif k == ord("n"):
                    break
                elif k == ord("q"):
                    cv2.destroyAllWindows()
                    return
    cv2.destroyAllWindows()


def main():  # pragma: no cover
    ap = argparse.ArgumentParser()
    ap.add_argument("--camera-id", type=int, required=True)
    ap.add_argument("--source", default="webcam:0")
    a = ap.parse_args()
    run(a.camera_id, a.source)


if __name__ == "__main__":
    main()
