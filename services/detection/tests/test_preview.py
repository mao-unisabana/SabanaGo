import numpy as np
from fastapi import FastAPI
from fastapi.testclient import TestClient

from sabanago_detection import config, preview
from sabanago_detection.main import _start_health  # noqa: F401 (import smoke)

POLY = [[10, 10], [60, 10], [60, 60], [10, 60]]


def _px(img, x=11, y=11):
    return tuple(int(v) for v in img[y, x])


def test_draw_overlay_colors_and_size():
    frame = np.zeros((100, 100, 3), dtype=np.uint8)
    for status in ("free", "occupied", "no_data"):
        spaces = [{"id": 1, "code": "A1", "image_polygon": POLY}]
        out = preview.draw_overlay(frame, spaces, {1: (status, 0.9)}, 5.0, "diff")
        assert out.shape == frame.shape
        assert preview.COLORS[status] in {_px(out, 10, 30), _px(out, 60, 30)}
    assert frame.sum() == 0  # no muta el original


def test_missing_state_is_gray():
    frame = np.zeros((100, 100, 3), dtype=np.uint8)
    out = preview.draw_overlay(frame, [{"id": 2, "code": "B", "image_polygon": POLY}],
                               {}, 1.0, "diff")
    assert _px(out, 10, 30) == preview.COLORS["no_data"]


def test_holder():
    h = preview.FrameHolder()
    assert h.get() is None
    h.set(b"x")
    assert h.get() == b"x" and h.version == 1


def test_config_preview_flag(monkeypatch):
    monkeypatch.delenv("PREVIEW", raising=False)
    assert config.load().preview is False
    for v, exp in (("1", True), ("true", True), ("0", False)):
        monkeypatch.setenv("PREVIEW", v)
        assert config.load().preview is exp


def test_routes_absent_without_preview():
    c = TestClient(FastAPI())
    assert c.get("/preview").status_code == 404
    assert c.get("/preview/frame.jpg").status_code == 404


def test_routes_present_with_preview():
    app, h = FastAPI(), preview.FrameHolder()
    preview.add_routes(app, h)
    c = TestClient(app)
    assert c.get("/preview").status_code == 200
    assert c.get("/preview/frame.jpg").status_code == 503
    h.set(b"jpegdata")
    r = c.get("/preview/frame.jpg")
    assert r.status_code == 200 and r.content == b"jpegdata"


def test_publisher_throttle_and_overlay():
    t = [0.0]
    h = preview.FrameHolder()
    pub = preview.PreviewPublisher(h, "diff", max_fps=10, clock=lambda: t[0])
    frame = np.zeros((100, 100, 3), dtype=np.uint8)
    assert pub.publish(frame) is True
    assert pub.publish(frame) is False  # dentro de 0.1 s
    t[0] = 0.2
    pub.update_result([{"id": 1, "code": "A", "image_polygon": POLY}],
                      {1: ("occupied", 0.9)}, 3.0)
    assert pub.publish(frame) is True and h.version == 2
