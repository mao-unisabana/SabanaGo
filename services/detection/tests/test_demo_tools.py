"""Pruebas de la logica pura de las herramientas de la demo."""
import json

import httpx
import numpy as np
import pytest

from sabanago_detection.tools import calibrate, capture_reference, demo_reset


def test_brillo_imagen_negra_falla():
    ok, b = capture_reference.brightness_ok(np.zeros((20, 20, 3), np.uint8))
    assert not ok and b == 0


def test_brillo_imagen_saturada_falla():
    ok, _ = capture_reference.brightness_ok(np.full((20, 20, 3), 255, np.uint8))
    assert not ok


def test_brillo_imagen_normal_pasa():
    ok, _ = capture_reference.brightness_ok(np.full((20, 20, 3), 120, np.uint8))
    assert ok


def test_promedio_de_cuadros():
    a = np.full((4, 4, 3), 100, np.uint8)
    b = np.full((4, 4, 3), 110, np.uint8)
    avg = capture_reference.average_frames([a, b])
    assert avg.dtype == np.uint8 and (avg == 105).all()
    with pytest.raises(ValueError):
        capture_reference.average_frames([])


def test_poligono_serializa_4_vertices():
    poly = calibrate.polygon_to_json([(1, 2), (3, 2), (3, 4), (1, 4)])
    assert poly == [[1, 2], [3, 2], [3, 4], [1, 4]]
    json.dumps(poly)
    with pytest.raises(ValueError):
        calibrate.polygon_to_json([(1, 2)])


def test_calibracion_reemplaza_solo_el_puesto_recalibrado(tmp_path):
    calibrate.save_calibration(1, {"M1": [[0, 0]], "M2": [[1, 1]]}, tmp_path)
    merged = calibrate.merge_calibration(
        calibrate.load_calibration(1, tmp_path), {"M2": [[9, 9]]})
    assert merged == {"M1": [[0, 0]], "M2": [[9, 9]]}
    assert calibrate.load_calibration(7, tmp_path) == {}


def test_reset_solo_toca_camaras_de_la_maqueta():
    posts = []

    def handler(req):
        p = req.url.path
        if p.endswith("/parking_lot"):
            return httpx.Response(200, json=[{"id": 2}])
        if p.endswith("/camera"):
            assert req.url.params["parking_lot_id"] == "eq.2"
            return httpx.Response(200, json=[{"id": 5}])
        if p.endswith("/space"):
            return httpx.Response(200, json=[{"id": 11}, {"id": 12}])
        posts.append(json.loads(req.content))
        return httpx.Response(200, json=2)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    res = demo_reset.reset_lot(client, "http://x", "k", "Maqueta demo")
    assert res == {5: 2}
    assert posts == [{"camera_id": 5, "states": [
        {"space_id": 11, "status": "free", "confidence": 1},
        {"space_id": 12, "status": "free", "confidence": 1}]}]
