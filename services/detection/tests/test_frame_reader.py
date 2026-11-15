import time

import numpy as np

from sabanago_detection.source import FrameReader


class FakeCap:
    def __init__(self, fps):
        self.fps = fps

    def get(self, _prop):
        return self.fps


class FakeSource:
    """Fuente falsa: n cuadros numerados en bucle; fallos opcionales."""

    def __init__(self, fps=50.0, n=3, fail_first=0):
        self.cap = FakeCap(fps)
        self.n, self.i, self.fail = n, 0, fail_first
        self.reads = 0
        self.reconnects = 0
        self.released = False

    def read(self):
        if self.fail > 0:
            self.fail -= 1
            return False, None
        v = self.i % self.n  # bucle
        self.i += 1
        self.reads += 1
        return True, np.full((2, 2, 3), v, dtype=np.uint8)

    def reconnect(self):
        self.reconnects += 1

    def release(self):
        self.released = True


def test_ritmo_nativo_y_bucle():
    src = FakeSource(fps=50.0, n=3)
    seen = []
    r = FrameReader(src, on_frame=lambda f: seen.append(int(f[0, 0, 0])))
    time.sleep(0.5)
    r.release()
    assert 10 <= src.reads <= 35  # ~25 a 50 fps, no 1 fps ni sin freno
    assert set(seen) == {0, 1, 2}  # dio la vuelta
    assert src.released


def test_read_devuelve_ultimo_cuadro():
    src = FakeSource(fps=50.0, n=1000)
    r = FrameReader(src)
    ok, f1 = r.read()
    time.sleep(0.2)
    ok2, f2 = r.read()
    r.release()
    assert ok and ok2 and int(f2[0, 0, 0]) > int(f1[0, 0, 0])


def test_fuente_caida_y_recuperacion():
    src = FakeSource(fps=50.0, fail_first=3)
    r = FrameReader(src, first_wait_s=0.05)
    time.sleep(0.3)
    ok, _ = r.read()
    r.release()
    assert src.reconnects == 3 and ok


def test_fps_invalido_usa_30():
    r = FrameReader(FakeSource(fps=0.0))
    r.release()
    assert abs(r.period - 1 / 30) < 1e-6
